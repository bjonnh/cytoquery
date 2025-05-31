import { App, CachedMetadata } from 'obsidian';
import * as THREE from 'three';
import { NodeSet, EdgeSet } from '../utils';
import { GraphData, GraphNode, GraphParameters } from '../types/graph';
import { QueryParser, parseParametersAndQuery } from '../query';
import { buildGraphData, saveParametersToCodeBlock, openFileInNewTab } from '../obsidian';
import {
    createGraph,
    addBloomPass,
    applyLockedNodes,
    GraphUIState,
    GraphCallbacks
} from './graph-renderer';
import {
    createAnimationLoop,
    toggleIdleRotation,
    toggleFPSLimiter,
    updateNodeObjectTracking,
    AnimationState
} from './graph-animations';
import { findPath, restrictToNode } from './path-finding';
import { createUIControls, createParsingErrorDisplay, UICallbacks } from './ui-components';
import { createCircularMenu, CircularMenuCallbacks, CircularMenuState } from './circular-menu';
import { createSettingsControls, SettingsCallbacks } from './settings-panel';

export function init3DForceGraph(
    containerId: string, 
    sourceText: string = '', 
    app: App, 
    graphInstances: Map<string, any>,
    generateRandomStringFromSeed: (input: string) => string,
    publicMode: boolean,
    codeBlockElement?: HTMLElement,
    ctx?: any
): void {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Parse parameters and query from source text
    const { parameters, query: queryText } = parseParametersAndQuery(sourceText);

    // Check if there's an existing graph for this container and dispose of it
    if (graphInstances.has(containerId)) {
        const existingGraph = graphInstances.get(containerId);
        // For 3D-force-graph, we need to dispose of the THREE.js resources
        if (existingGraph._cleanup) {
            existingGraph._cleanup();
        } else if (existingGraph._destructor) {
            existingGraph._destructor();
        }
        graphInstances.delete(containerId);
    }

    // Clear container first
    container.innerHTML = '';
    
    // Ensure container has relative positioning for absolute children
    container.style.position = 'relative';

    // Create a wrapper div for the graph itself
    const graphContainer = document.createElement('div');
    graphContainer.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%;';
    container.appendChild(graphContainer);

    // Build graph data from Obsidian vault
    const { nodeSet, edgeSet, metadataMap } = buildGraphData(app, publicMode, generateRandomStringFromSeed);

    // Parse and apply query rules if query text is provided
    let parseErrors: string[] = [];
    if (queryText.trim()) {
        const queryParser = new QueryParser(metadataMap, edgeSet);
        parseErrors = queryParser.getParseErrors(queryText);
        
        if (parseErrors.length === 0) {
            queryParser.parseQuery(queryText);
            queryParser.applyRules(nodeSet.values());
        }
    }

    // Count links in and out for each node
    const linkCounts = new Map<string, number>();

    // Initialize counts for all nodes
    nodeSet.values().forEach(node => {
        linkCounts.set(node.id, 0);
    });

    // Count links for each node
    edgeSet.values().forEach(edge => {
        // Increment count for source node (outgoing link)
        linkCounts.set(edge.source, (linkCounts.get(edge.source) || 0) + 1);
        // Increment count for target node (incoming link)
        linkCounts.set(edge.target, (linkCounts.get(edge.target) || 0) + 1);
    });

    // Transform nodes and edges into 3D force graph format
    const graphNodes = nodeSet.values().map(node => {
        const linkCount = linkCounts.get(node.id) || 0;
        // Calculate val as log(5*number_of_links_in_and_out)
        // Use Math.max to ensure we don't take log of 0, and add 1 to ensure minimum value
        const val = Math.max(3, 50 * (3+linkCount));

        const nodeName = publicMode ? generateRandomStringFromSeed(node.id) : node.label;
        
        // Check if this node should be locked based on saved parameters
        const lockedNode = parameters.lockedNodes?.find(ln => ln.name === nodeName);
        
        const graphNode: GraphNode = {
            id: node.id,
            name: nodeName,
            val: val,
            color: node.color || "#666",
            shape: node.shape || 'sphere',
            material: node.material || 'default',
            size: node.size || 1
        };
        
        // If this node has saved locked position, we'll apply it after engine starts
        
        return graphNode;
    });

    const graphLinks = edgeSet.values().map(edge => ({
        source: edge.source,
        target: edge.target
    }));

    const graphData: GraphData = {
        nodes: graphNodes,
        links: graphLinks
    };

    // Create error display element if there are parsing errors
    if (parseErrors.length > 0) {
        createParsingErrorDisplay(container, parseErrors);
    }

    // Initialize UI state
    const uiState: GraphUIState = {
        selectedNode: null,
        sourceNode: null,
        targetNode: null,
        currentPath: [],
        lockedNodes: new Set<string>()
    };

    // Track current parameter values for dynamic functions
    const currentParams: GraphParameters = {
        force: {
            alphaDecay: parameters.force?.alphaDecay || 0.0228,
            velocityDecay: parameters.force?.velocityDecay || 0.4,
            alphaMin: parameters.force?.alphaMin || 0
        },
        dag: {
            mode: parameters.dag?.mode || '',
            levelDistance: parameters.dag?.levelDistance || 50
        },
        nodeStyle: {
            size: parameters.nodeStyle?.size || 4,
            opacity: parameters.nodeStyle?.opacity || 0.75,
            resolution: parameters.nodeStyle?.resolution || 8
        },
        linkStyle: {
            opacity: parameters.linkStyle?.opacity || 0.2,
            width: parameters.linkStyle?.width || 1,
            curvature: parameters.linkStyle?.curvature || 0,
            particles: parameters.linkStyle?.particles || 0,
            particleSpeed: parameters.linkStyle?.particleSpeed || 0.01
        },
        bloom: {
            strength: parameters.bloom?.strength || 4.5,
            radius: parameters.bloom?.radius || 1,
            threshold: parameters.bloom?.threshold || 0
        },
        interaction: {
            enableDrag: parameters.interaction?.enableDrag !== false
        },
        performance: {
            warmupTicks: parameters.performance?.warmupTicks || 0,
            cooldownTicks: parameters.performance?.cooldownTicks || Infinity,
            cooldownTime: parameters.performance?.cooldownTime || 10000
        }
    };

    // Track menu state
    const menuState: CircularMenuState = {
        currentRestriction: null,
        publicMode,
        sourceNode: uiState.sourceNode,
        targetNode: uiState.targetNode
    };

    // Create menu cleanup
    let currentMenu: { cleanup: () => void } | null = null;
    const closeMenu = () => {
        if (currentMenu) {
            currentMenu.cleanup();
            currentMenu = null;
        }
    };

    // Create graph callbacks
    const graphCallbacks: GraphCallbacks = {
        onNodeClick: (node: any, event: MouseEvent) => {
            // Toggle node selection (allow deselection by clicking again)
            if (uiState.selectedNode === node.id) {
                uiState.selectedNode = null; // Deselect if already selected
            } else {
                uiState.selectedNode = node.id; // Select this node
            }
            
            // Refresh the graph to update halo displays
            Graph.refresh();
            
            // Close existing menu if any
            closeMenu();

            // Update menu state
            menuState.sourceNode = uiState.sourceNode;
            menuState.targetNode = uiState.targetNode;

            // Create circular menu with callbacks
            const menuCallbacks: CircularMenuCallbacks = {
                onGoToPage: async (nodeId: string) => {
                    await openFileInNewTab(app, nodeId, publicMode);
                },
                onToggleLock: (nodeId: string, isLocked: boolean) => {
                    const currentNode = Graph.graphData().nodes.find((n: any) => n.id === nodeId);
                    if (!currentNode) return;
                    
                    if (isLocked) {
                        // Unlock the node
                        uiState.lockedNodes.delete(nodeId);
                        delete currentNode.fx;
                        delete currentNode.fy;
                        delete currentNode.fz;
                    } else {
                        // Lock the node at its current position
                        uiState.lockedNodes.add(nodeId);
                        currentNode.fx = currentNode.x;
                        currentNode.fy = currentNode.y;
                        currentNode.fz = currentNode.z;
                    }
                    
                    // Update unlock all button visibility
                    uiElements.buttons.unlockAll.style.display = uiState.lockedNodes.size > 0 ? 'flex' : 'none';
                    
                    // Force re-render to update lock indicators
                    Graph.nodeThreeObject(Graph.nodeThreeObject());
                },
                onRestrictToNode: (nodeId: string, depth: number) => {
                    const filteredData = restrictToNode(nodeId, depth, Graph.graphData());
                    Graph.graphData(filteredData);
                    menuState.currentRestriction = { nodeId, depth };
                    // Refresh node objects to show restriction center effect
                    Graph.nodeThreeObject(Graph.nodeThreeObject());
                },
                onUnrestrict: () => {
                    Graph.graphData(graphData);
                    menuState.currentRestriction = null;
                    // Refresh node objects to remove restriction center effect
                    Graph.nodeThreeObject(Graph.nodeThreeObject());
                },
                onCenterOnNode: (node: any, distance: number) => {
                    // First, ensure we have the current node position
                    const currentNode = Graph.graphData().nodes.find((n: any) => n.id === node.id);
                    if (!currentNode) {
                        return;
                    }
                    
                    // Get current camera position to maintain similar viewing angle
                    const currentCameraPos = Graph.cameraPosition();
                    const nodePos = { x: currentNode.x || 0, y: currentNode.y || 0, z: currentNode.z || 0 };
                    
                    // Calculate direction from node to current camera
                    const dx = currentCameraPos.x - nodePos.x;
                    const dy = currentCameraPos.y - nodePos.y;
                    const dz = currentCameraPos.z - nodePos.z;
                    const currentDistance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                    
                    // Normalize direction and apply new distance
                    const scale = currentDistance > 0 ? distance / currentDistance : 1;
                    
                    // If camera is too close to node (or at node), use default angle
                    let newCameraPos;
                    if (currentDistance < 10) {
                        // Default viewing angle: diagonally above
                        const angle = Math.PI / 4; // 45 degrees
                        const elevation = Math.PI / 6; // 30 degrees above horizontal
                        
                        newCameraPos = {
                            x: nodePos.x + distance * Math.cos(angle) * Math.cos(elevation),
                            y: nodePos.y + distance * Math.sin(elevation),
                            z: nodePos.z + distance * Math.sin(angle) * Math.cos(elevation)
                        };
                    } else {
                        // Maintain current viewing angle, just adjust distance
                        newCameraPos = {
                            x: nodePos.x + dx * scale,
                            y: nodePos.y + dy * scale,
                            z: nodePos.z + dz * scale
                        };
                    }
                    
                    Graph.cameraPosition(
                        newCameraPos, // new camera position
                        nodePos, // lookAt the node position
                        1000 // duration in ms
                    );
                    // Re-enable controls after camera movement
                    setTimeout(() => {
                        Graph.enableNavigationControls();
                    }, 1100);
                },
                onSetAsSource: (nodeId: string) => {
                    uiState.sourceNode = nodeId;
                    isSelectingSource = false;
                    // Clear selection when node becomes source
                    if (uiState.selectedNode === nodeId) {
                        uiState.selectedNode = null;
                    }
                    updatePathUI();
                },
                onSetAsTarget: (nodeId: string) => {
                    uiState.targetNode = nodeId;
                    isSelectingTarget = false;
                    // Clear selection when node becomes target
                    if (uiState.selectedNode === nodeId) {
                        uiState.selectedNode = null;
                    }
                    updatePathUI();
                }
            };

            const result = createCircularMenu(
                container,
                node,
                event,
                uiState.lockedNodes.has(node.id),
                menuCallbacks,
                menuState
            );
            currentMenu = result;
        }
    };

    // Create graph
    const Graph = createGraph(
        graphContainer,
        graphData,
        parameters,
        currentParams,
        uiState,
        graphCallbacks,
        menuState
    );

    // Add bloom pass
    const bloomPass = addBloomPass(Graph, graphContainer, parameters);

    // Apply locked nodes from parameters
    applyLockedNodes(Graph, parameters, uiState.lockedNodes);

    // Initialize animation state
    const animationState: AnimationState = {
        nodeObjects: new Map<string, THREE.Group>(),
        isIdleRotationActive: false,
        rotationStartTime: 0,
        rotationSpeed: 0.3,
        idlePreventionInterval: null,
        isFPSLimiterDisabled: false,
        fpsPreventionInterval: null
    };

    // Update node object tracking in the graph renderer
    const originalNodeThreeObject = Graph.nodeThreeObject();
    Graph.nodeThreeObject((node: any) => {
        const nodeGroup = originalNodeThreeObject(node);
        const hasHalo = uiState.selectedNode === node.id ||
                       uiState.sourceNode === node.id ||
                       uiState.targetNode === node.id ||
                       uiState.currentPath.includes(node.id);
        const hasLockIndicator = uiState.lockedNodes.has(String(node.id));
        const isRestrictionCenter = (nodeGroup as any).__isRestrictionCenter;
        updateNodeObjectTracking(nodeGroup, node.id, animationState, hasHalo || isRestrictionCenter, hasLockIndicator);
        return nodeGroup;
    });

    // Start animation loop
    createAnimationLoop(Graph, animationState);

    // Track UI state
    let isSelectingSource = false;
    let isSelectingTarget = false;
    let isPanelOpen = false;
    let hasUnsavedChanges = false;

    // Function to update UI based on current state
    const updatePathUI = () => {
        // Show/hide path buttons
        uiElements.containers.pathButtons.style.display = (uiState.sourceNode && uiState.targetNode) ? 'flex' : 'none';
        
        // Show/hide clear path button
        uiElements.buttons.clearPath.style.display = uiState.currentPath.length > 0 ? 'flex' : 'none';
        
        // Update graph colors and node halos
        Graph.refresh();
    };

    // Create UI callbacks
    const uiCallbacks: UICallbacks = {
        onResetView: () => {
            Graph.zoomToFit(400, 50);
            setTimeout(() => {
                Graph.enableNavigationControls();
            }, 500);
        },
        onUnlockAll: () => {
            const graphData = Graph.graphData();
            graphData.nodes.forEach((node: any) => {
                if (uiState.lockedNodes.has(node.id)) {
                    uiState.lockedNodes.delete(node.id);
                    delete node.fx;
                    delete node.fy;
                    delete node.fz;
                }
            });
            uiElements.buttons.unlockAll.style.display = uiState.lockedNodes.size > 0 ? 'flex' : 'none';
            
            // Force re-render to update lock indicators
            Graph.nodeThreeObject(Graph.nodeThreeObject());
        },
        onFindDirectedPath: () => {
            if (uiState.sourceNode && uiState.targetNode) {
                uiState.currentPath = findPath(uiState.sourceNode, uiState.targetNode, true, Graph.graphData());
                updatePathUI();
            }
        },
        onFindUndirectedPath: () => {
            if (uiState.sourceNode && uiState.targetNode) {
                uiState.currentPath = findPath(uiState.sourceNode, uiState.targetNode, false, Graph.graphData());
                updatePathUI();
            }
        },
        onClearPath: () => {
            uiState.currentPath = [];
            uiState.sourceNode = null;
            uiState.targetNode = null;
            uiState.selectedNode = null;
            isSelectingSource = false;
            isSelectingTarget = false;
            updatePathUI();
        },
        onSaveParameters: () => {
            const saved = saveParametersToCodeBlock(
                app,
                ctx,
                codeBlockElement,
                currentParams,
                uiState.lockedNodes,
                Graph.graphData()
            );
            if (saved) {
                hasUnsavedChanges = false;
                uiElements.buttons.save.style.background = 'rgba(0, 0, 0, 0.7)';
                uiElements.buttons.save.innerHTML = '💾';
                uiElements.buttons.save.title = 'Save Parameters to Code Block';
            }
        },
        onToggleIdleRotation: () => {
            toggleIdleRotation(Graph, animationState, !animationState.isIdleRotationActive);
            const btn = uiElements.buttons.idleRotation;
            if (animationState.isIdleRotationActive) {
                btn.style.background = 'rgba(100, 200, 100, 0.5)';
                btn.title = 'Disable Idle Rotation Mode';
            } else {
                btn.style.background = 'rgba(0, 0, 0, 0.7)';
                btn.title = 'Enable Idle Rotation Mode';
            }
        },
        onToggleFPSLimiter: () => {
            toggleFPSLimiter(Graph, animationState, !animationState.isFPSLimiterDisabled);
            const btn = uiElements.buttons.fpsLimiter;
            if (animationState.isFPSLimiterDisabled) {
                btn.style.background = 'rgba(255, 100, 100, 0.5)';
                btn.title = 'Enable FPS Limiter (currently 60 FPS)';
            } else {
                btn.style.background = 'rgba(0, 0, 0, 0.7)';
                btn.title = 'Disable FPS Limiter (currently limited)';
            }
        },
        onSettingsToggle: () => {
            isPanelOpen = !isPanelOpen;
            uiElements.containers.settingsPanel.style.right = isPanelOpen ? '0' : '-320px';
            uiElements.buttons.menu.innerHTML = isPanelOpen ? '×' : '☰';
        }
    };

    // Update idle rotation button hover effects
    const setupIdleRotationButton = () => {
        const btn = uiElements.buttons.idleRotation;
        btn.onmouseover = () => {
            btn.style.background = animationState.isIdleRotationActive ? 'rgba(100, 200, 100, 0.8)' : 'rgba(0, 0, 0, 0.8)';
        };
        btn.onmouseout = () => {
            btn.style.background = animationState.isIdleRotationActive ? 'rgba(100, 200, 100, 0.5)' : 'rgba(0, 0, 0, 0.7)';
        };
    };

    // Update FPS limiter button hover effects
    const setupFPSLimiterButton = () => {
        const btn = uiElements.buttons.fpsLimiter;
        btn.onmouseover = () => {
            btn.style.background = animationState.isFPSLimiterDisabled ? 'rgba(255, 100, 100, 0.8)' : 'rgba(0, 0, 0, 0.8)';
        };
        btn.onmouseout = () => {
            btn.style.background = animationState.isFPSLimiterDisabled ? 'rgba(255, 100, 100, 0.5)' : 'rgba(0, 0, 0, 0.7)';
        };
    };

    // Create UI controls
    const uiElements = createUIControls(container, uiCallbacks);
    setupIdleRotationButton();
    setupFPSLimiterButton();

    // Update unlock all button visibility based on initial locked nodes
    if (parameters.lockedNodes && parameters.lockedNodes.length > 0) {
        // Set initial visibility
        uiElements.buttons.unlockAll.style.display = 'flex';
        
        // Update again after locked nodes are applied (matching the delay in applyLockedNodes)
        setTimeout(() => {
            uiElements.buttons.unlockAll.style.display = uiState.lockedNodes.size > 0 ? 'flex' : 'none';
        }, 1100);
    }

    // Create settings callbacks
    const settingsCallbacks: SettingsCallbacks = {
        onParameterChange: () => {
            hasUnsavedChanges = true;
            uiElements.buttons.save.style.background = 'rgba(100, 200, 100, 0.3)';
            uiElements.buttons.save.innerHTML = '💾*';
            uiElements.buttons.save.title = 'Save Parameters to Code Block (unsaved changes)';
        },
        onReset: () => {
            // Recreate controls to update UI
            createSettingsControls(
                uiElements.containers.settingsPanel,
                currentParams,
                Graph,
                bloomPass,
                settingsCallbacks
            );
        }
    };

    // Create settings controls
    createSettingsControls(
        uiElements.containers.settingsPanel,
        currentParams,
        Graph,
        bloomPass,
        settingsCallbacks
    );

    // Access the renderer and set its size properly
    setTimeout(() => {
        const renderer = Graph.renderer();
        if (renderer) {
            renderer.setSize(graphContainer.clientWidth, graphContainer.clientHeight);
            
            // Update camera aspect ratio
            const camera = Graph.camera() as THREE.PerspectiveCamera;
            if (camera && camera.isPerspectiveCamera) {
                camera.aspect = graphContainer.clientWidth / graphContainer.clientHeight;
                camera.updateProjectionMatrix();
            }
        }
        
        // Center on graph after size adjustment
        Graph.zoomToFit(400, 50);
    }, 100);
    
    // Handle container resize
    const resizeObserver = new ResizeObserver(() => {
        const renderer = Graph.renderer();
        const camera = Graph.camera() as THREE.PerspectiveCamera;
        
        if (renderer && graphContainer.clientWidth > 0 && graphContainer.clientHeight > 0) {
            renderer.setSize(graphContainer.clientWidth, graphContainer.clientHeight);
            
            if (camera && camera.isPerspectiveCamera) {
                camera.aspect = graphContainer.clientWidth / graphContainer.clientHeight;
                camera.updateProjectionMatrix();
            }
            
            // Update graph dimensions
            Graph.width(graphContainer.clientWidth).height(graphContainer.clientHeight);
        }
    });
    resizeObserver.observe(graphContainer);

    // Store graph instance with cleanup function
    const graphInstance = Object.assign(Graph, {
        _cleanup: () => {
            resizeObserver.disconnect();
            if (Graph._destructor) {
                Graph._destructor();
            }
        }
    });
    
    graphInstances.set(containerId, graphInstance);
}