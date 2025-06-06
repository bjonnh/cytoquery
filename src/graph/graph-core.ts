// Core graph initialization without Obsidian dependencies
import * as THREE from 'three';
import { GraphData, GraphNode, GraphParameters } from '../types/graph';
import { parseParametersAndQuery } from '../query';
import {
    createGraph,
    addBloomPass,
    applyLockedNodes,
    applyHyperdimensionPositions,
    GraphUIState,
    GraphCallbacks
} from './graph-renderer';
import {
    createAnimationLoop,
    toggleIdleRotation,
    toggleFPSLimiter,
    updateNodeObjectTracking,
    cleanupAnimationState,
    AnimationState
} from './graph-animations';
import { findPath, restrictToNode } from './path-finding';
import { createUIControls, createParsingErrorDisplay, UICallbacks } from './ui-components';
import { createCircularMenu, CircularMenuCallbacks, CircularMenuState } from './circular-menu';
import { createSettingsControls, SettingsCallbacks } from './settings-panel';
import { 
    createHyperdimensionManager, 
    deserializeHyperdimensionData,
    serializeHyperdimensionData,
    setNodePosition,
    removeNodePositions
} from './hyperdimension-manager';
import { createHyperdimensionPanel, HyperdimensionUICallbacks } from './hyperdimension-ui';
import { createAxisIndicatorSystem, disposeAxisIndicator } from './axis-indicator';

// Interface for platform-specific implementations
export interface GraphPlatformAdapter {
    // Open a file/page when a node is clicked
    openPage: (nodeId: string) => Promise<void>;
    
    // Save parameters back to the source
    saveParameters?: (parameters: GraphParameters, lockedNodes: any[]) => boolean;
    
    // Whether to show node names or anonymize them
    publicMode: boolean;
}

export function initGraph(
    containerId: string,
    graphData: GraphData,
    sourceText: string = '',
    platformAdapter: GraphPlatformAdapter,
    graphInstances: Map<string, any> = new Map()
): void {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Parse parameters and query from source text
    const { parameters, query: queryText } = parseParametersAndQuery(sourceText);

    // Check if there's an existing graph for this container and dispose of it
    if (graphInstances.has(containerId)) {
        const existingGraph = graphInstances.get(containerId);
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

    // Parse errors display (if query parsing fails)
    let parseErrors: string[] = [];
    if (queryText && queryText.trim()) {
        // For demo, we don't have query parsing, so skip this
        // In Obsidian version, this would parse and apply query rules
    }

    // Create error display element if there are parsing errors
    if (parseErrors.length > 0) {
        createParsingErrorDisplay(container, parseErrors);
    }

    // Initialize hyperdimension manager
    let hyperdimensionManager;
    if (parameters.hyperdimensions) {
        hyperdimensionManager = deserializeHyperdimensionData(parameters.hyperdimensions);
    } else {
        hyperdimensionManager = createHyperdimensionManager();
    }

    // Initialize UI state
    const uiState: GraphUIState = {
        selectedNode: null,
        sourceNode: null,
        targetNode: null,
        currentPath: [],
        lockedNodes: new Set<string>(),
        hyperdimensionManager
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
        },
        hyperdimensions: undefined // Will be updated before saving
    };

    // Track menu state
    const menuState: CircularMenuState = {
        currentRestriction: null,
        publicMode: platformAdapter.publicMode,
        sourceNode: uiState.sourceNode,
        targetNode: uiState.targetNode,
        hyperdimensionManager: uiState.hyperdimensionManager
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
                    await platformAdapter.openPage(nodeId);
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
                        
                        // Remove hyperdimension positions
                        if (uiState.hyperdimensionManager) {
                            removeNodePositions(uiState.hyperdimensionManager, nodeId);
                            // Update UI if panel is open
                            if (hyperdimensionPanel) {
                                hyperdimensionPanel.updateUI();
                            }
                        }
                    } else {
                        // Lock the node at its current position
                        uiState.lockedNodes.add(nodeId);
                        currentNode.fx = currentNode.x;
                        currentNode.fy = currentNode.y;
                        currentNode.fz = currentNode.z;
                        
                        // Update hyperdimension positions if available
                        if (uiState.hyperdimensionManager) {
                            const manager = uiState.hyperdimensionManager;
                            
                            // Update positions for currently mapped axes
                            if (manager.axisMapping.xAxis) {
                                setNodePosition(manager, nodeId, manager.axisMapping.xAxis, currentNode.x);
                            }
                            if (manager.axisMapping.yAxis) {
                                setNodePosition(manager, nodeId, manager.axisMapping.yAxis, currentNode.y);
                            }
                            if (manager.axisMapping.zAxis) {
                                setNodePosition(manager, nodeId, manager.axisMapping.zAxis, currentNode.z);
                            }
                            
                            // Update UI if panel is open
                            if (hyperdimensionPanel) {
                                hyperdimensionPanel.updateUI();
                            }
                        }
                    }
                    
                    // Update unlock all button visibility
                    uiElements.buttons.unlockAll.style.display = uiState.lockedNodes.size > 0 ? 'flex' : 'none';
                    
                    // Mark as unsaved
                    hasUnsavedChanges = true;
                    if (platformAdapter.saveParameters) {
                        uiElements.buttons.save.style.background = 'rgba(100, 200, 100, 0.3)';
                        uiElements.buttons.save.innerHTML = '💾*';
                    }
                    
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

    // Add node drag handlers for hyperdimension sync
    if (uiState.hyperdimensionManager) {
        Graph.onNodeDragEnd((node: any) => {
            // Update hyperdimension positions based on current axis mapping
            const manager = uiState.hyperdimensionManager!;
            
            // Only update if node has been moved (has fx, fy, fz)
            if (node.fx !== undefined || node.fy !== undefined || node.fz !== undefined) {
                // Update X axis position if mapped
                if (manager.axisMapping.xAxis && node.fx !== undefined) {
                    setNodePosition(manager, node.id, manager.axisMapping.xAxis, node.fx);
                }
                
                // Update Y axis position if mapped
                if (manager.axisMapping.yAxis && node.fy !== undefined) {
                    setNodePosition(manager, node.id, manager.axisMapping.yAxis, node.fy);
                }
                
                // Update Z axis position if mapped
                if (manager.axisMapping.zAxis && node.fz !== undefined) {
                    setNodePosition(manager, node.id, manager.axisMapping.zAxis, node.fz);
                }
                
                // Mark as unsaved
                hasUnsavedChanges = true;
                if (platformAdapter.saveParameters) {
                    uiElements.buttons.save.style.background = 'rgba(100, 200, 100, 0.3)';
                    uiElements.buttons.save.innerHTML = '💾*';
                }
                
                // Update UI if panel is open
                if (hyperdimensionPanel) {
                    hyperdimensionPanel.updateUI();
                }
            }
        });
    }

    // Add bloom pass
    const bloomPass = addBloomPass(Graph, graphContainer, parameters);

    // Create axis indicator system (separate renderer for overlay)
    const axisIndicatorSystem = createAxisIndicatorSystem(container);

    // Apply locked nodes from parameters
    applyLockedNodes(Graph, parameters, uiState.lockedNodes);
    
    // Apply hyperdimension positions if available
    if (uiState.hyperdimensionManager) {
        applyHyperdimensionPositions(Graph, uiState.hyperdimensionManager, uiState.lockedNodes);
    }

    // Initialize animation state
    const animationState: AnimationState = {
        nodeObjects: new Map<string, THREE.Group>(),
        isIdleRotationActive: false,
        rotationStartTime: 0,
        rotationSpeed: 0.3,
        idlePreventionInterval: null,
        isFPSLimiterDisabled: false,
        fpsPreventionInterval: null,
        axisIndicatorSystem: axisIndicatorSystem
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
        onResetOrientation: () => {
            // Get current camera distance from origin
            const camera = Graph.camera();
            const currentDistance = camera.position.length();
            
            
            // Disable controls during animation
            const controls = Graph.controls();
            if (controls) {
                controls.enabled = false;
            }
            
            // Set camera to look straight at the graph from the positive Z axis
            // This aligns with screen coordinates:
            // X: horizontal (left-right)
            // Y: vertical (up-down)
            // Z: depth (toward viewer)
            const newPosition = {
                x: 0,
                y: 0,
                z: currentDistance
            };
            
            // Animate camera to new position, looking at origin
            Graph.cameraPosition(
                newPosition,
                { x: 0, y: 0, z: 0 }, // Look at origin
                1000 // 1 second animation
            );
            
            // After animation, ensure camera is properly oriented
            setTimeout(() => {
                // Force exact position and orientation
                camera.position.set(0, 0, currentDistance);
                camera.lookAt(0, 0, 0);
                camera.up.set(0, 1, 0); // Ensure Y is up
                
                // Update controls
                if (controls) {
                    controls.target.set(0, 0, 0);
                    controls.update();
                    controls.enabled = true;
                }
                
            }, 1100);
        },
        onUnlockAll: () => {
            const graphData = Graph.graphData();
            graphData.nodes.forEach((node: any) => {
                if (uiState.lockedNodes.has(node.id)) {
                    uiState.lockedNodes.delete(node.id);
                    delete node.fx;
                    delete node.fy;
                    delete node.fz;
                    
                    // Remove hyperdimension positions
                    if (uiState.hyperdimensionManager) {
                        removeNodePositions(uiState.hyperdimensionManager, node.id);
                    }
                }
            });
            
            // Update UI if panel is open
            if (hyperdimensionPanel) {
                hyperdimensionPanel.updateUI();
            }
            
            uiElements.buttons.unlockAll.style.display = uiState.lockedNodes.size > 0 ? 'flex' : 'none';
            
            // Mark as unsaved
            hasUnsavedChanges = true;
            if (platformAdapter.saveParameters) {
                uiElements.buttons.save.style.background = 'rgba(100, 200, 100, 0.3)';
                uiElements.buttons.save.innerHTML = '💾*';
            }
            
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
            if (platformAdapter.saveParameters) {
                const nodes = Graph.graphData().nodes;
                const lockedNodesData = Array.from(uiState.lockedNodes).map(nodeId => {
                    const node = nodes.find((n: any) => n.id === nodeId);
                    if (node && node.fx !== undefined && node.fy !== undefined && node.fz !== undefined) {
                        return {
                            name: node.name,
                            x: node.fx,
                            y: node.fy,
                            z: node.fz
                        };
                    }
                    return null;
                }).filter(n => n !== null);

                // Update hyperdimensions in currentParams before saving
                if (uiState.hyperdimensionManager) {
                    currentParams.hyperdimensions = serializeHyperdimensionData(uiState.hyperdimensionManager);
                }

                const saved = platformAdapter.saveParameters(currentParams, lockedNodesData);
                if (saved) {
                    hasUnsavedChanges = false;
                    uiElements.buttons.save.style.background = 'rgba(0, 0, 0, 0.7)';
                    uiElements.buttons.save.innerHTML = '💾';
                    uiElements.buttons.save.title = 'Save Parameters to Code Block';
                }
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
    
    // Create hyperdimension panel
    let hyperdimensionPanel: { panel: HTMLDivElement; updateUI: () => void } | null = null;
    
    // Define callbacks that will update the panel when it exists
    const hyperdimensionCallbacks: HyperdimensionUICallbacks = {
        onSpatialSystemCreated: () => {
            hasUnsavedChanges = true;
            if (platformAdapter.saveParameters) {
                uiElements.buttons.save.style.background = 'rgba(100, 200, 100, 0.3)';
                uiElements.buttons.save.innerHTML = '💾*';
            }
            // Update the UI to ensure new system appears
            if (hyperdimensionPanel) {
                hyperdimensionPanel.updateUI();
            }
        },
        onSpatialSystemDeleted: () => {
            hasUnsavedChanges = true;
            if (platformAdapter.saveParameters) {
                uiElements.buttons.save.style.background = 'rgba(100, 200, 100, 0.3)';
                uiElements.buttons.save.innerHTML = '💾*';
            }
            // Update the UI to ensure deleted system is removed from dropdowns
            if (hyperdimensionPanel) {
                hyperdimensionPanel.updateUI();
            }
        },
        onAxisCreated: () => {
            hasUnsavedChanges = true;
            if (platformAdapter.saveParameters) {
                uiElements.buttons.save.style.background = 'rgba(100, 200, 100, 0.3)';
                uiElements.buttons.save.innerHTML = '💾*';
            }
            // Update the UI to ensure new axis appears in dropdowns
            if (hyperdimensionPanel) {
                hyperdimensionPanel.updateUI();
            }
        },
        onAxisDeleted: () => {
            hasUnsavedChanges = true;
            if (platformAdapter.saveParameters) {
                uiElements.buttons.save.style.background = 'rgba(100, 200, 100, 0.3)';
                uiElements.buttons.save.innerHTML = '💾*';
            }
            // Update the UI to ensure deleted axis is removed from dropdowns
            if (hyperdimensionPanel) {
                hyperdimensionPanel.updateUI();
            }
        },
        onAxisMappingChanged: () => {
            hasUnsavedChanges = true;
            if (platformAdapter.saveParameters) {
                uiElements.buttons.save.style.background = 'rgba(100, 200, 100, 0.3)';
                uiElements.buttons.save.innerHTML = '💾*';
            }
            // Re-apply positions with new mapping
            if (uiState.hyperdimensionManager) {
                applyHyperdimensionPositions(Graph, uiState.hyperdimensionManager, uiState.lockedNodes);
            }
        },
        onNodePositionChanged: () => {
            hasUnsavedChanges = true;
            if (platformAdapter.saveParameters) {
                uiElements.buttons.save.style.background = 'rgba(100, 200, 100, 0.3)';
                uiElements.buttons.save.innerHTML = '💾*';
            }
            // Re-apply positions
            if (uiState.hyperdimensionManager) {
                applyHyperdimensionPositions(Graph, uiState.hyperdimensionManager, uiState.lockedNodes);
            }
        }
    };
    
    if (uiState.hyperdimensionManager) {
        // Create hyperdimension button
        const hyperdimensionButton = document.createElement('button');
        hyperdimensionButton.innerHTML = '📐';
        hyperdimensionButton.title = 'Toggle Hyperdimension Panel';
        hyperdimensionButton.className = 'graph-control-button hyperdimension';
        hyperdimensionButton.onclick = () => {
            if (!hyperdimensionPanel) {
                hyperdimensionPanel = createHyperdimensionPanel(
                    container,
                    uiState.hyperdimensionManager!,
                    hyperdimensionCallbacks
                );
            }
            
            hyperdimensionPanel.panel.classList.toggle('open');
            hyperdimensionButton.classList.toggle('active');
        };
        uiElements.containers.topButtons.appendChild(hyperdimensionButton);
    }

    // Update unlock all button visibility based on initial locked nodes
    if (parameters.lockedNodes && parameters.lockedNodes.length > 0) {
        // Set initial visibility
        uiElements.buttons.unlockAll.style.display = 'flex';
        
        // Update again after locked nodes are applied (matching the delay in applyLockedNodes)
        setTimeout(() => {
            uiElements.buttons.unlockAll.style.display = uiState.lockedNodes.size > 0 ? 'flex' : 'none';
        }, 1100);
    }

    // Hide save button if no save callback
    if (!platformAdapter.saveParameters) {
        uiElements.buttons.save.style.display = 'none';
    }

    // Create settings callbacks
    const settingsCallbacks: SettingsCallbacks = {
        onParameterChange: () => {
            hasUnsavedChanges = true;
            if (platformAdapter.saveParameters) {
                uiElements.buttons.save.style.background = 'rgba(100, 200, 100, 0.3)';
                uiElements.buttons.save.innerHTML = '💾*';
                uiElements.buttons.save.title = 'Save Parameters to Code Block (unsaved changes)';
            }
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
        
        // Get initial distance from zoomToFit but override the camera angle
        setTimeout(() => {
            // First let zoomToFit calculate the appropriate distance
            Graph.zoomToFit(1, 50); // Very fast, just to calculate distance
            
            // Wait for zoomToFit to complete then override camera position
            setTimeout(() => {
                const camera = Graph.camera();
                const controls = Graph.controls();
                const currentDistance = camera.position.length();
                
                
                // Disable controls to prevent interference
                if (controls) {
                    controls.enabled = false;
                }
                
                // Use the Graph's cameraPosition method for proper animation
                Graph.cameraPosition(
                    { x: 0, y: 0, z: currentDistance },
                    { x: 0, y: 0, z: 0 },
                    500
                );
                
                // After animation completes, ensure everything is set correctly
                setTimeout(() => {
                    // Force exact position
                    camera.position.set(0, 0, currentDistance);
                    camera.lookAt(0, 0, 0);
                    camera.up.set(0, 1, 0);
                    camera.updateProjectionMatrix();
                    
                    // Update and re-enable controls
                    if (controls) {
                        controls.target.set(0, 0, 0);
                        controls.update();
                        controls.enabled = true;
                    }
                    
                }, 600);
            }, 100);
        }, 100);
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
            // Clean up animation state
            cleanupAnimationState(animationState);
            
            // Disconnect observers
            resizeObserver.disconnect();
            
            // Dispose axis indicator
            if (axisIndicatorSystem) {
                disposeAxisIndicator(axisIndicatorSystem);
            }
            
            // Call 3d-force-graph destructor
            if (Graph._destructor) {
                Graph._destructor();
            }
        }
    });
    
    graphInstances.set(containerId, graphInstance);
}