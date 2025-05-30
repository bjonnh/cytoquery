import ForceGraph3D from "../../3d-force-graph.js";
import * as THREE from "three";
import { UnrealBloomPass } from '../../UnrealBloomPass';
import { GraphParameters, GraphData, GraphNode } from '../types/graph';

export interface GraphInstance {
    graph: any;
    cleanup: () => void;
}

export interface GraphCallbacks {
    onNodeClick: (node: any, event: MouseEvent) => void;
}

export interface GraphUIState {
    selectedNode: string | null;
    sourceNode: string | null;
    targetNode: string | null;
    currentPath: string[];
    lockedNodes: Set<string>;
}

export function createGraph(
    container: HTMLDivElement,
    graphData: GraphData,
    parameters: GraphParameters,
    currentParams: GraphParameters,
    uiState: GraphUIState,
    callbacks: GraphCallbacks
): any {
    // Initialize the 3D force graph with default or loaded parameters
    const Graph = new ForceGraph3D(container)
        .backgroundColor('#000003')
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
            return '#ccc'; // Default color
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
                        return 32; // Much thicker for path links (32x wider)
                    }
                }
            }
            return currentParams.linkStyle?.width || 1; // Default width
        })
        .linkOpacity(currentParams.linkStyle?.opacity || 0.2)
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
        // Apply node style parameters
        .nodeRelSize(parameters.nodeStyle?.size || 4)
        .nodeOpacity(parameters.nodeStyle?.opacity || 0.75)
        .nodeResolution(parameters.nodeStyle?.resolution || 8)
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
        .nodeThreeObject((node: any) => createNodeObject(node, uiState))
        .onNodeClick(callbacks.onNodeClick);

    Graph.enableNavigationControls();
    
    return Graph;
}

export function createNodeObject(node: any, uiState: GraphUIState): THREE.Group {
    // Create geometry based on shape
    let geometry;
    const baseSize = Math.cbrt(node.val) * 0.5; // Base scale based on node value
    const size = baseSize * (node.size || 1); // Apply custom size multiplier
    
    switch (node.shape) {
        case 'cube':
            geometry = new THREE.BoxGeometry(size, size, size);
            break;
        case 'cylinder':
            geometry = new THREE.CylinderGeometry(size/2, size/2, size, 16);
            break;
        case 'cone':
            geometry = new THREE.ConeGeometry(size/2, size, 16);
            break;
        case 'torus':
            geometry = new THREE.TorusGeometry(size/2, size/6, 8, 16);
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
            geometry = new THREE.SphereGeometry(size, 16, 16);
            break;
    }
    
    // Create material based on material type
    let material;
    const color = new THREE.Color(node.color);
    
    switch (node.material) {
        case 'glass':
            material = new THREE.MeshPhysicalMaterial({
                color: color,
                metalness: 0,
                roughness: 0,
                transmission: 0.9,
                transparent: true,
                opacity: 0.6,
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
                envMapIntensity: 1
            });
            break;
        case 'plastic':
            material = new THREE.MeshPhongMaterial({
                color: color,
                shininess: 100,
                specular: new THREE.Color(0x222222),
                reflectivity: 0.3
            });
            break;
        case 'default':
        default:
            material = new THREE.MeshLambertMaterial({
                color: color,
                transparent: false
            });
            break;
    }
    
    const mesh = new THREE.Mesh(geometry, material);
    
    // Add a subtle glow effect for all nodes
    if (node.material !== 'glass') {
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.3
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
    
    if (isSelected || isSource || isTarget || isInPath) {
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