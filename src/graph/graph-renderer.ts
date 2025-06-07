import ForceGraph3D from "../lib/3d-force-graph";
import * as THREE from "three";
import { UnrealBloomPass } from '../lib/UnrealBloomPass';
import { GraphParameters, GraphData, GraphNode } from '../types/graph';
import { HyperdimensionManager } from '../types/hyperdimensions';
import { getNode3DPosition } from './hyperdimension-manager';

export interface GraphInstance {
    graph: any;
    cleanup: () => void;
}

export interface GraphCallbacks {
    onNodeClick: (node: any, event: MouseEvent) => void;
    onBackgroundClick?: (event: MouseEvent) => void;
}

export interface GraphUIState {
    selectedNode: string | null;
    sourceNode: string | null;
    targetNode: string | null;
    currentPath: string[];
    lockedNodes: Set<string>;
    hyperdimensionManager?: HyperdimensionManager;
}

export function createGraph(
    container: HTMLDivElement,
    graphData: GraphData,
    parameters: GraphParameters,
    currentParams: GraphParameters,
    uiState: GraphUIState,
    callbacks: GraphCallbacks,
    menuState?: any,
    fastMode: boolean = false
): any {
    // Initialize the 3D force graph with default or loaded parameters
    const Graph = ForceGraph3D()(container)
        .backgroundColor('#000003')
        .showNavInfo(parameters.ui?.showNavInfo ?? false)  // Control navigation help text via parameter, default to false
        .nodeLabel('name')
        .nodeColor('color')
        .nodeVal('val')
        .linkColor((link: any) => {
            // Check if this link is part of the current path
            if (uiState.currentPath.length > 1) {
                const srcId = typeof link.source === 'string' ? link.source : link.source.id;
                const tgtId = typeof link.target === 'string' ? link.target : link.target.id;

                // Find consecutive nodes in path that match this link
                for (let i = 0; i < uiState.currentPath.length - 1; i++) {
                    if ((uiState.currentPath[i] === srcId && uiState.currentPath[i + 1] === tgtId) ||
                        (uiState.currentPath[i] === tgtId && uiState.currentPath[i + 1] === srcId)) {
                        return '#ff0000'; // Red for path links
                    }
                }
            }
            // Use color from edge query styling if available
            return link.color || '#ccc'; // Default color
        })
        .linkWidth((link: any) => {
            // Check if this link is part of the current path
            if (uiState.currentPath.length > 1) {
                const srcId = typeof link.source === 'string' ? link.source : link.source.id;
                const tgtId = typeof link.target === 'string' ? link.target : link.target.id;

                // Find consecutive nodes in path that match this link
                for (let i = 0; i < uiState.currentPath.length - 1; i++) {
                    if ((uiState.currentPath[i] === srcId && uiState.currentPath[i + 1] === tgtId) ||
                        (uiState.currentPath[i] === tgtId && uiState.currentPath[i + 1] === srcId)) {
                        return (link.width || currentParams.linkStyle?.width || 1) * 8; // 8x thicker for path links
                    }
                }
            }
            // Use width from edge query styling if available
            return link.width || currentParams.linkStyle?.width || 1; // Default width
        })
        // Use custom material for links
        .linkMaterial((link: any) => {
            const linkColor = link.color || '#ccc';
            
            if (fastMode) {
                // In fast mode, use simple opaque material for performance
                return new THREE.MeshBasicMaterial({
                    color: linkColor,
                    transparent: false,
                    opacity: 1,
                    side: THREE.DoubleSide
                });
            } else {
                // Normal mode with transparency and bloom effects
                const linkOpacity = link.opacity !== undefined ? link.opacity : (currentParams.linkStyle?.opacity || 0.2);
                
                return new THREE.MeshBasicMaterial({
                    color: linkColor,
                    transparent: true,
                    opacity: linkOpacity,
                    // Key settings for bloom compatibility:
                    depthWrite: false, // Allow proper transparency sorting
                    side: THREE.DoubleSide,
                    // Use additive blending for a glow-like effect that works well with bloom
                    blending: linkOpacity < 0.5 ? THREE.AdditiveBlending : THREE.NormalBlending
                });
            }
        })
        // Apply performance parameters
        .cooldownTime(parameters.performance?.cooldownTime || 10000)
        .warmupTicks(parameters.performance?.warmupTicks || 0)
        .cooldownTicks(parameters.performance?.cooldownTicks || Infinity)
        // Apply force parameters
        .d3AlphaDecay(parameters.force?.alphaDecay || 0.0228)
        .d3VelocityDecay(parameters.force?.velocityDecay || 0.4)
        .d3AlphaMin(parameters.force?.alphaMin || 0)
        // Apply DAG parameters
        .dagMode(parameters.dag?.mode as any || null)
        .dagLevelDistance(parameters.dag?.levelDistance || 50)
        // Apply link style parameters
        // Note: linkWidth and linkOpacity are handled by functions above when path is active
        .linkCurvature(parameters.linkStyle?.curvature || 0)
        .linkDirectionalParticles(parameters.linkStyle?.particles || 0)
        .linkDirectionalParticleSpeed(parameters.linkStyle?.particleSpeed || 0.01)
        // Apply interaction parameters
        .enableNodeDrag(parameters.interaction?.enableDrag !== false)
        .linkDirectionalArrowLength(3.5)
        .linkDirectionalArrowRelPos(1)
        .width(container.clientWidth)
        .height(container.clientHeight)
        .graphData(graphData)
        .nodeThreeObject((node: any) => createNodeObject(node, uiState, menuState, currentParams, fastMode))
        .onNodeClick(callbacks.onNodeClick);
    
    // Add background click handler if provided
    if (callbacks.onBackgroundClick) {
        Graph.onBackgroundClick(callbacks.onBackgroundClick);
    }

    Graph.enableNavigationControls();
    
    return Graph;
}

export function createNodeObject(node: any, uiState: GraphUIState, menuState?: any, parameters?: GraphParameters, fastMode: boolean = false): THREE.Group {
    // Create geometry based on shape
    let geometry;
    const baseSize = Math.cbrt(node.val) * 0.5; // Base scale based on node value
    const globalSizeMultiplier = (parameters?.nodeStyle?.size || 4) / 4; // Normalize around default size of 4
    const size = baseSize * (node.size || 1) * globalSizeMultiplier; // Apply both custom and global size
    const resolution = parameters?.nodeStyle?.resolution || 8;
    
    switch (node.shape) {
        case 'cube':
            geometry = new THREE.BoxGeometry(size, size, size);
            break;
        case 'cylinder':
            geometry = new THREE.CylinderGeometry(size/2, size/2, size, resolution * 2);
            break;
        case 'cone':
            geometry = new THREE.ConeGeometry(size/2, size, resolution * 2);
            break;
        case 'torus':
            geometry = new THREE.TorusGeometry(size/2, size/6, resolution, resolution * 2);
            break;
        case 'tetrahedron':
            geometry = new THREE.TetrahedronGeometry(size);
            break;
        case 'octahedron':
            geometry = new THREE.OctahedronGeometry(size);
            break;
        case 'dodecahedron':
            geometry = new THREE.DodecahedronGeometry(size);
            break;
        case 'icosahedron':
            geometry = new THREE.IcosahedronGeometry(size);
            break;
        case 'sphere':
        default:
            geometry = new THREE.SphereGeometry(size, resolution * 2, resolution * 2);
            break;
    }
    
    // Create material based on material type
    let material;
    const color = new THREE.Color(node.color);
    const opacity = parameters?.nodeStyle?.opacity || 0.75;
    
    switch (node.material) {
        case 'glass':
            material = new THREE.MeshPhysicalMaterial({
                color: color,
                metalness: 0,
                roughness: 0,
                transmission: 0.9,
                transparent: true,
                opacity: opacity * 0.8, // Glass is slightly more transparent
                reflectivity: 0.9,
                ior: 1.5,
                clearcoat: 1,
                clearcoatRoughness: 0
            });
            break;
        case 'metal':
            material = new THREE.MeshStandardMaterial({
                color: color,
                metalness: 0.9,
                roughness: 0.2,
                envMapIntensity: 1,
                transparent: opacity < 1,
                opacity: opacity
            });
            break;
        case 'plastic':
            material = new THREE.MeshPhongMaterial({
                color: color,
                shininess: 100,
                specular: new THREE.Color(0x222222),
                reflectivity: 0.3,
                transparent: opacity < 1,
                opacity: opacity
            });
            break;
        case 'default':
        default:
            material = new THREE.MeshLambertMaterial({
                color: color,
                transparent: opacity < 1,
                opacity: opacity
            });
            break;
    }
    
    const mesh = new THREE.Mesh(geometry, material);
    
    // Add a subtle glow effect for all nodes (skip in fast mode)
    if (!fastMode && node.material !== 'glass') {
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: opacity * 0.4 // Scale glow opacity with node opacity
        });
        const glowMesh = new THREE.Mesh(geometry.clone(), glowMaterial);
        glowMesh.scale.multiplyScalar(1.2);
        mesh.add(glowMesh);
    }
    
    // Add halos for special node states
    const nodeGroup = new THREE.Group();
    nodeGroup.add(mesh);
    
    // Check if this node needs a halo indicator
    const isSelected = uiState.selectedNode === node.id;
    const isSource = uiState.sourceNode === node.id;
    const isTarget = uiState.targetNode === node.id;
    const isInPath = uiState.currentPath.includes(node.id);
    
    if (!fastMode && (isSelected || isSource || isTarget || isInPath)) {
        // Determine halo color based on node state (priority order)
        let haloColor;
        if (isSelected) {
            haloColor = new THREE.Color(0x00ff00); // Green for selected (highest priority)
        } else if (isSource) {
            haloColor = new THREE.Color(0x0066ff); // Blue for source
        } else if (isTarget) {
            haloColor = new THREE.Color(0xffa500); // Orange for target
        } else if (isInPath) {
            haloColor = new THREE.Color(0xff0000); // Red for path nodes
        }
        
        // Create double halo system with two rings
        
        // First ring - slightly larger, will rotate around Y-axis
        const haloGeometry1 = new THREE.RingGeometry(size * 1.6, size * 1.9, 32);
        const haloMaterial1 = new THREE.MeshBasicMaterial({
            color: haloColor,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        });
        const haloMesh1 = new THREE.Mesh(haloGeometry1, haloMaterial1);
        
        // Second ring - slightly smaller, will rotate around X-axis  
        const haloGeometry2 = new THREE.RingGeometry(size * 1.4, size * 1.7, 32);
        const haloMaterial2 = new THREE.MeshBasicMaterial({
            color: haloColor,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        });
        const haloMesh2 = new THREE.Mesh(haloGeometry2, haloMaterial2);
        
        // Position the second ring perpendicular to the first
        haloMesh2.rotation.x = Math.PI / 2;
        
        // Create a container for both halos
        const haloContainer = new THREE.Group();
        haloContainer.add(haloMesh1);
        haloContainer.add(haloMesh2);
        
        nodeGroup.add(haloContainer);
        
        // Store references to both halos for animation updates
        (nodeGroup as any).__haloContainer = haloContainer;
        (nodeGroup as any).__haloMesh1 = haloMesh1;
        (nodeGroup as any).__haloMesh2 = haloMesh2;
    }
    
    // Add special effect for restriction center node (skip in fast mode)
    const isRestrictionCenter = menuState?.currentRestriction?.nodeId === node.id;
    if (!fastMode && isRestrictionCenter) {
        // Create a transparent sphere that pulses with color
        const pulseGeometry = new THREE.SphereGeometry(size * 3, 32, 32);
        
        // Use a material that supports transparency and emissive properties
        const pulseMaterial = new THREE.MeshPhysicalMaterial({
            color: new THREE.Color(0x9400d3), // Purple base color
            transparent: true,
            opacity: 0.3,
            metalness: 0,
            roughness: 0,
            transmission: 0.8, // Makes it glass-like
            clearcoat: 1,
            clearcoatRoughness: 0,
            ior: 1.2, // Index of refraction for glass effect
            reflectivity: 0.5,
            side: THREE.DoubleSide
        });
        
        const pulseSphere = new THREE.Mesh(pulseGeometry, pulseMaterial);
        
        // Add a subtle inner glow sphere
        const glowGeometry = new THREE.SphereGeometry(size * 2.5, 32, 32);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: new THREE.Color(0xda70d6), // Lighter purple
            transparent: true,
            opacity: 0.2,
            side: THREE.BackSide // Render inside of sphere
        });
        const glowSphere = new THREE.Mesh(glowGeometry, glowMaterial);
        
        // Container for both spheres
        const pulseContainer = new THREE.Group();
        pulseContainer.add(pulseSphere);
        pulseContainer.add(glowSphere);
        
        nodeGroup.add(pulseContainer);
        
        // Store references for animation
        (nodeGroup as any).__pulseContainer = pulseContainer;
        (nodeGroup as any).__pulseSphere = pulseSphere;
        (nodeGroup as any).__glowSphere = glowSphere;
        (nodeGroup as any).__isRestrictionCenter = true;
    }
    
    // Add lock indicator for locked nodes
    const isLocked = uiState.lockedNodes.has(String(node.id));
    if (isLocked) {
        // Create 4 arrow-like indicators pointing inward
        const lockColor = new THREE.Color(0xffd700); // Gold color for lock
        const arrowSize = size * 0.5; // Larger arrows
        const arrowDistance = size * 2.5;
        
        // Create arrow geometry (cone pointing inward)
        const arrowGeometry = new THREE.ConeGeometry(arrowSize * 0.6, arrowSize * 2, 12);
        const arrowMaterial = new THREE.MeshBasicMaterial({
            color: lockColor,
            transparent: true,
            opacity: 0.9
        });
        
        // Create 4 arrows positioned around the node
        const lockIndicators = new THREE.Group();
        
        // Top arrow (pointing down)
        const topArrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
        topArrow.position.y = arrowDistance;
        topArrow.rotation.z = Math.PI; // Point downward
        lockIndicators.add(topArrow);
        
        // Bottom arrow (pointing up)
        const bottomArrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
        bottomArrow.position.y = -arrowDistance;
        lockIndicators.add(bottomArrow);
        
        // Right arrow (pointing left)
        const rightArrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
        rightArrow.position.x = arrowDistance;
        rightArrow.rotation.z = Math.PI / 2; // Point left
        lockIndicators.add(rightArrow);
        
        // Left arrow (pointing right)
        const leftArrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
        leftArrow.position.x = -arrowDistance;
        leftArrow.rotation.z = -Math.PI / 2; // Point right
        lockIndicators.add(leftArrow);
        
        nodeGroup.add(lockIndicators);
        
        // Store references for animation
        (nodeGroup as any).__lockIndicators = lockIndicators;
        (nodeGroup as any).__lockArrows = [topArrow, bottomArrow, rightArrow, leftArrow];
        (nodeGroup as any).__baseArrowDistance = arrowDistance;
    }
    
    return nodeGroup;
}

export function addBloomPass(Graph: any, container: HTMLElement, parameters: GraphParameters): UnrealBloomPass {
    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(container.clientWidth, container.clientHeight), 
        1.5, 
        0.4, 
        0.85
    );
    bloomPass.strength = parameters.bloom?.strength || 4.5;
    bloomPass.radius = parameters.bloom?.radius || 1;
    bloomPass.threshold = parameters.bloom?.threshold || 0.0;
    Graph.postProcessingComposer().addPass(bloomPass);
    
    return bloomPass;
}

export function applyLockedNodes(Graph: any, parameters: GraphParameters, lockedNodes: Set<string>): void {
    if (parameters.lockedNodes && parameters.lockedNodes.length > 0) {
        // Apply locked nodes after a short delay to ensure graph is initialized
        setTimeout(() => {
            const nodes = Graph.graphData().nodes;
            
            parameters.lockedNodes!.forEach(lockedNode => {
                // Validate the locked node data
                if (!lockedNode.name || 
                    lockedNode.x === undefined || 
                    lockedNode.y === undefined || 
                    lockedNode.z === undefined ||
                    isNaN(lockedNode.x) || 
                    isNaN(lockedNode.y) || 
                    isNaN(lockedNode.z)) {
                    return;
                }
                
                const node = nodes.find((n: any) => n.name === lockedNode.name);
                if (node) {
                    // Set the fixed positions (these lock the node in place)
                    node.fx = lockedNode.x;
                    node.fy = lockedNode.y;
                    node.fz = lockedNode.z;
                    
                    // Track in our set
                    lockedNodes.add(String(node.id));
                }
            });
            
            // Force a re-render to show lock indicators after all nodes are tracked
            if (lockedNodes.size > 0) {
                Graph.nodeThreeObject(Graph.nodeThreeObject());
            }
        }, 1000);
    }
}

/**
 * Applies hyperdimension positions to nodes based on current axis mapping
 */
export function applyHyperdimensionPositions(
    Graph: any,
    hyperdimensionManager: HyperdimensionManager,
    lockedNodes: Set<string>,
    delay: number = 100
): void {
    // Apply positions after a short delay to ensure graph is initialized
    setTimeout(() => {
        const nodes = Graph.graphData().nodes;
        let nodesUpdated = false;
        
        // Clear the locked nodes set - we'll rebuild it based on hyperdimension data
        lockedNodes.clear();
        
        nodes.forEach((node: any) => {
            const position = getNode3DPosition(hyperdimensionManager, node.id);
            
            // Apply positions from hyperdimensions or unlock if no position exists
            if (position.x !== null) {
                node.fx = position.x;
                nodesUpdated = true;
            } else {
                delete node.fx;
            }
            
            if (position.y !== null) {
                node.fy = position.y;
                nodesUpdated = true;
            } else {
                delete node.fy;
            }
            
            if (position.z !== null) {
                node.fz = position.z;
                nodesUpdated = true;
            } else {
                delete node.fz;
            }
            
            // If the node has any position in hyperdimensions (not just in current mapping),
            // add it to locked nodes
            const nodePosition = hyperdimensionManager.nodePositions.get(node.id);
            if (nodePosition && nodePosition.positions.size > 0) {
                lockedNodes.add(String(node.id));
            }
        });
        
        // Force a re-render to update node visuals
        if (nodesUpdated || lockedNodes.size > 0) {
            // Update node objects to show lock indicators
            Graph.nodeThreeObject(Graph.nodeThreeObject());
            
            // Force the simulation to update node positions immediately
            Graph.d3ReheatSimulation();
            // Run a few ticks to apply the new positions
            for (let i = 0; i < 10; i++) {
                Graph.tickFrame();
            }
        }
    }, delay);
}
