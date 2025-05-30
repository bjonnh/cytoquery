import { App, CachedMetadata, getLinkpath, TFile, MarkdownView } from 'obsidian';
import ForceGraph3D from "./3d-force-graph.js";
import * as THREE from "three";
import { UnrealBloomPass } from 'UnrealBloomPass';
import { NodeSet, EdgeSet } from './utils';
import { QueryParser } from './query-language';

interface GraphParameters {
    force?: {
        alphaDecay?: number;
        velocityDecay?: number;
        alphaMin?: number;
    };
    dag?: {
        mode?: string;
        levelDistance?: number;
    };
    nodeStyle?: {
        size?: number;
        opacity?: number;
        resolution?: number;
    };
    linkStyle?: {
        opacity?: number;
        width?: number;
        curvature?: number;
        particles?: number;
        particleSpeed?: number;
    };
    bloom?: {
        strength?: number;
        radius?: number;
        threshold?: number;
    };
    interaction?: {
        enableDrag?: boolean;
    };
    performance?: {
        warmupTicks?: number;
        cooldownTicks?: number;
        cooldownTime?: number;
    };
    lockedNodes?: Array<{
        name: string;
        x: number;
        y: number;
        z: number;
    }>;
}

function parseParametersAndQuery(source: string): { parameters: GraphParameters, query: string } {
    const lines = source.split('\n');
    let inParameters = false;
    let parameterLines: string[] = [];
    let queryLines: string[] = [];
    
    for (const line of lines) {
        if (line.trim() === '---') {
            inParameters = !inParameters;
            continue;
        }
        
        if (inParameters) {
            parameterLines.push(line);
        } else {
            queryLines.push(line);
        }
    }
    
    // Parse parameters from YAML-like format
    const parameters: GraphParameters = {};
    let currentSection: string | null = null;
    let currentLockedNode: any = null;
    
    for (let i = 0; i < parameterLines.length; i++) {
        const line = parameterLines[i];
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('//')) continue;
        
        // Count leading spaces to determine indentation level
        const indentLevel = line.length - line.trimStart().length;
        
        // Check if it's a section header (no indentation, ends with colon)
        if (indentLevel === 0 && trimmed.endsWith(':') && !trimmed.includes(' ')) {
            // Finish current locked node if any
            if (currentLockedNode) {
                if (!parameters.lockedNodes) parameters.lockedNodes = [];
                parameters.lockedNodes.push(currentLockedNode);
                currentLockedNode = null;
            }
            
            currentSection = trimmed.slice(0, -1);
            if (currentSection !== 'lockedNodes') {
                parameters[currentSection as keyof GraphParameters] = {} as any;
            }
        }
        // Check if it's a list item (for lockedNodes)
        else if (trimmed.startsWith('- ') && currentSection === 'lockedNodes') {
            // Start a new locked node
            if (currentLockedNode) {
                if (!parameters.lockedNodes) parameters.lockedNodes = [];
                parameters.lockedNodes.push(currentLockedNode);
            }
            currentLockedNode = {};
            const content = trimmed.substring(2).trim();
            if (content.includes(':')) {
                const [key, value] = content.split(':').map(s => s.trim());
                if (key && value) {
                    if (!isNaN(Number(value))) currentLockedNode[key] = Number(value);
                    else currentLockedNode[key] = value.replace(/['"]/g, '');
                }
            }
        }
        // Check if it's a property of a locked node (indented under a list item)
        else if (indentLevel >= 4 && currentLockedNode && currentSection === 'lockedNodes') {
            // Add property to current locked node
            const [key, value] = trimmed.split(':').map(s => s.trim());
            if (key && value) {
                if (!isNaN(Number(value))) currentLockedNode[key] = Number(value);
                else currentLockedNode[key] = value.replace(/['"]/g, '');
            }
        }
        // Check if it's a property of a section (indented under section header)
        else if (indentLevel >= 2 && currentSection && currentSection !== 'lockedNodes' && trimmed.includes(':')) {
            // Parse key-value pair for non-array sections
            const [key, value] = trimmed.split(':').map(s => s.trim());
            const section = parameters[currentSection as keyof GraphParameters] as any;
            
            // Parse value
            if (value === 'true') section[key] = true;
            else if (value === 'false') section[key] = false;
            else if (value === 'Infinity') section[key] = Infinity;
            else if (value === 'null') section[key] = null;
            else if (!isNaN(Number(value))) section[key] = Number(value);
            else section[key] = value.replace(/['"]/g, ''); // Remove quotes
        }
    }
    
    // Don't forget the last locked node
    if (currentLockedNode) {
        if (!parameters.lockedNodes) parameters.lockedNodes = [];
        parameters.lockedNodes.push(currentLockedNode);
    }
    
    return {
        parameters,
        query: queryLines.join('\n').trim()
    };
}

function formatParameters(params: GraphParameters): string {
    const lines: string[] = ['---'];
    
    const sections: (keyof GraphParameters)[] = ['force', 'dag', 'nodeStyle', 'linkStyle', 'bloom', 'interaction', 'performance'];
    
    for (const section of sections) {
        if (params[section]) {
            lines.push(`${section}:`);
            const sectionData = params[section] as any;
            for (const [key, value] of Object.entries(sectionData)) {
                lines.push(`  ${key}: ${value}`);
            }
        }
    }
    
    // Handle locked nodes separately
    if (params.lockedNodes && params.lockedNodes.length > 0) {
        lines.push('lockedNodes:');
        for (const node of params.lockedNodes) {
            lines.push(`  - name: ${node.name}`);
            lines.push(`    x: ${node.x}`);
            lines.push(`    y: ${node.y}`);
            lines.push(`    z: ${node.z}`);
        }
    }
    
    lines.push('---');
    return lines.join('\n');
}

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

    // Create reset view button (top left)
    const resetViewButton = document.createElement('button');
    resetViewButton.innerHTML = '⟲';
    resetViewButton.title = 'Reset View to Center';
    resetViewButton.style.cssText = `
        position: absolute;
        top: 16px;
        left: 16px;
        width: 36px;
        height: 36px;
        background: rgba(0, 0, 0, 0.7);
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 8px;
        color: white;
        font-size: 20px;
        cursor: pointer;
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
    `;
    resetViewButton.onmouseover = () => resetViewButton.style.background = 'rgba(0, 0, 0, 0.8)';
    resetViewButton.onmouseout = () => resetViewButton.style.background = 'rgba(0, 0, 0, 0.7)';
    resetViewButton.onclick = () => {
        // Reset camera to look at center of graph with padding
        Graph.zoomToFit(400, 50);
        // Re-enable controls after camera movement
        setTimeout(() => {
            Graph.enableNavigationControls();
        }, 500);
    };
    container.appendChild(resetViewButton);

    // Create unlock all button (next to reset view)
    const unlockAllButton = document.createElement('button');
    unlockAllButton.innerHTML = '🔓';
    unlockAllButton.title = 'Unlock All Nodes';
    unlockAllButton.style.cssText = `
        position: absolute;
        top: 16px;
        left: 58px;
        width: 36px;
        height: 36px;
        background: rgba(0, 0, 0, 0.7);
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 8px;
        color: white;
        font-size: 18px;
        cursor: pointer;
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
    `;
    unlockAllButton.onmouseover = () => unlockAllButton.style.background = 'rgba(0, 0, 0, 0.8)';
    unlockAllButton.onmouseout = () => unlockAllButton.style.background = 'rgba(0, 0, 0, 0.7)';
    unlockAllButton.onclick = () => {
        // Unlock all nodes
        const graphData = Graph.graphData();
        graphData.nodes.forEach((node: any) => {
            if (lockedNodes.has(node.id)) {
                lockedNodes.delete(node.id);
                // Remove fixed position
                delete node.fx;
                delete node.fy;
                delete node.fz;
            }
        });
        // Update button visibility
        unlockAllButton.style.display = lockedNodes.size > 0 ? 'flex' : 'none';
    };
    // Initially hide if no locked nodes
    unlockAllButton.style.display = 'none';
    container.appendChild(unlockAllButton);

    // Create save parameters button (next to unlock all)
    const saveButton = document.createElement('button');
    saveButton.innerHTML = '💾';
    saveButton.title = 'Save Parameters to Code Block';
    saveButton.style.cssText = `
        position: absolute;
        top: 16px;
        left: 100px;
        width: 36px;
        height: 36px;
        background: rgba(0, 0, 0, 0.7);
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 8px;
        color: white;
        font-size: 18px;
        cursor: pointer;
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
    `;
    saveButton.onmouseover = () => saveButton.style.background = 'rgba(0, 0, 0, 0.8)';
    saveButton.onmouseout = () => saveButton.style.background = 'rgba(0, 0, 0, 0.7)';
    
    // Store reference to track parameter changes
    let hasUnsavedChanges = false;
    
    container.appendChild(saveButton);

    // Create hamburger menu button
    const menuButton = document.createElement('button');
    menuButton.innerHTML = '☰';
    menuButton.style.cssText = `
        position: absolute;
        top: 16px;
        right: 16px;
        width: 36px;
        height: 36px;
        background: rgba(0, 0, 0, 0.7);
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 8px;
        color: white;
        font-size: 20px;
        cursor: pointer;
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
    `;
    menuButton.onmouseover = () => menuButton.style.background = 'rgba(0, 0, 0, 0.8)';
    menuButton.onmouseout = () => menuButton.style.background = 'rgba(0, 0, 0, 0.7)';
    container.appendChild(menuButton);

    // Create settings panel
    const settingsPanel = document.createElement('div');
    settingsPanel.style.cssText = `
        position: absolute;
        top: 0;
        right: -320px;
        width: 300px;
        height: 100%;
        background: rgba(0, 0, 0, 0.9);
        border-left: 1px solid rgba(255, 255, 255, 0.2);
        color: white;
        padding: 20px;
        padding-bottom: 40px;
        overflow-y: auto;
        overflow-x: hidden;
        transition: right 0.3s ease;
        z-index: 999;
        font-family: sans-serif;
        font-size: 12px;
        box-sizing: border-box;
    `;
    container.appendChild(settingsPanel);

    let isPanelOpen = false;
    menuButton.onclick = () => {
        isPanelOpen = !isPanelOpen;
        settingsPanel.style.right = isPanelOpen ? '0' : '-320px';
        menuButton.innerHTML = isPanelOpen ? '×' : '☰';
    };

    const files = app.vault.getMarkdownFiles();
    // Create custom sets for nodes and edges
    const nodeSet = new NodeSet();
    const edgeSet = new EdgeSet();

    // Create a map to store file metadata for query processing
    const metadataMap = new Map<string, CachedMetadata>();

    // Process all files
    for (let file of files) {
        // Add file as node - use basename as label
        nodeSet.add({
            id: file.path,
            label: file.basename
        });

        let meta: CachedMetadata | null = app.metadataCache.getFileCache(file);
        if (meta) {
            // Store metadata for query processing
            metadataMap.set(file.path, meta);

            // Process regular content links
            if (meta.links) {
                for (let link of meta.links) {
                    let linkPath = getLinkpath(link.link);
                    let target: TFile | null = app.metadataCache.getFirstLinkpathDest(linkPath, file.path);

                    if (target) {
                        // Add target file as node with basename as label
                        nodeSet.add({
                            id: target.path,
                            label: target.basename
                        });
                        // Create an edge between file and target
                        if (file.path != target.path)
                            edgeSet.addSourceTarget(file.path, target.path);

                        // Get and store target metadata if not already stored
                        if (!metadataMap.has(target.path)) {
                            const targetMeta = app.metadataCache.getFileCache(target);
                            if (targetMeta) {
                                metadataMap.set(target.path, targetMeta);
                            }
                        }
                    } else {
                        // For non-existent links, use the raw link text as label
                        nodeSet.add({
                            id: link.link,
                            label: link.link
                        });
                        // Create an edge between file and link
                        edgeSet.addSourceTarget(file.path, link.link);
                    }
                }
            }

            // Process frontmatter links (added in v1.4)
            if (meta.frontmatterLinks) {
                for (let link of meta.frontmatterLinks) {
                    let linkPath = getLinkpath(link.link);
                    let target: TFile | null = app.metadataCache.getFirstLinkpathDest(linkPath, file.path);

                    if (target) {
                        // Add target file as node with basename as label
                        nodeSet.add({
                            id: target.path,
                            label: target.basename
                        });
                        // Create an edge between file and target
                        if (file.path != target.path)
                            edgeSet.addSourceTarget(file.path, target.path);

                        // Get and store target metadata if not already stored
                        if (!metadataMap.has(target.path)) {
                            const targetMeta = app.metadataCache.getFileCache(target);
                            if (targetMeta) {
                                metadataMap.set(target.path, targetMeta);
                            }
                        }
                    } else {
                        // For non-existent links, use the raw link text as label
                        nodeSet.add({
                            id: link.link,
                            label: link.link
                        });
                        // Create an edge between file and link
                        edgeSet.addSourceTarget(file.path, link.link);
                    }
                }
            }
        }
    }

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
        
        const graphNode: any = {
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

    const graphData = {
        nodes: graphNodes,
        links: graphLinks
    };

    // Create error display element if there are parsing errors
    if (parseErrors.length > 0) {
        const errorContainer = document.createElement('div');
        errorContainer.style.cssText = `
            position: absolute;
            top: 70px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(200, 50, 50, 0.9);
            border: 1px solid rgba(255, 100, 100, 0.5);
            border-radius: 8px;
            padding: 12px 20px;
            color: white;
            font-family: sans-serif;
            font-size: 14px;
            z-index: 1001;
            max-width: 80%;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
        `;
        
        const errorTitle = document.createElement('div');
        errorTitle.textContent = 'Query Parsing Error:';
        errorTitle.style.cssText = 'font-weight: bold; margin-bottom: 8px;';
        errorContainer.appendChild(errorTitle);
        
        parseErrors.forEach(error => {
            const errorMsg = document.createElement('div');
            errorMsg.textContent = error;
            errorMsg.style.cssText = 'margin-bottom: 4px;';
            errorContainer.appendChild(errorMsg);
        });
        
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        closeBtn.style.cssText = `
            position: absolute;
            top: 8px;
            right: 8px;
            background: transparent;
            border: none;
            color: white;
            font-size: 20px;
            cursor: pointer;
            width: 24px;
            height: 24px;
            padding: 0;
            line-height: 1;
        `;
        closeBtn.onclick = () => errorContainer.remove();
        errorContainer.appendChild(closeBtn);
        
        container.appendChild(errorContainer);
    }

    // Track locked nodes
    const lockedNodes = new Set<string>();

    // Initialize the 3D force graph with default or loaded parameters
    const Graph = new ForceGraph3D(graphContainer)
        .backgroundColor('#000003')
        .nodeLabel('name')
        //.nodeAutoColorBy('group')
        .nodeColor('color')
        .nodeVal('val')
        .linkColor(() => '#ccc')
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
        .linkWidth(parameters.linkStyle?.width || 1)
        .linkOpacity(parameters.linkStyle?.opacity || 0.2)
        .linkCurvature(parameters.linkStyle?.curvature || 0)
        .linkDirectionalParticles(parameters.linkStyle?.particles || 0)
        .linkDirectionalParticleSpeed(parameters.linkStyle?.particleSpeed || 0.01)
        // Apply interaction parameters
        .enableNodeDrag(parameters.interaction?.enableDrag !== false)
        .linkDirectionalArrowLength(3.5)
        .linkDirectionalArrowRelPos(1)
        .width(graphContainer.clientWidth)
        .height(graphContainer.clientHeight)
        .graphData(graphData)
        .nodeThreeObject((node: any) => {
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
            
            return mesh;
        });

    Graph.enableNavigationControls();
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(graphContainer.clientWidth, graphContainer.clientHeight), 1.5, 0.4, 0.85);
    bloomPass.strength = parameters.bloom?.strength || 4.5;
    bloomPass.radius = parameters.bloom?.radius || 1;
    bloomPass.threshold = parameters.bloom?.threshold || 0.0;
    Graph.postProcessingComposer().addPass(bloomPass);
    
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
    
    // Apply locked nodes from parameters
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
            
            // Update unlock all button visibility
            if (lockedNodes.size > 0) {
                unlockAllButton.style.display = 'flex';
            }
        }, 1000);
    }


    // Create settings controls
    const createSettingsControls = () => {
        // Title
        const title = document.createElement('h2');
        title.textContent = 'Graph Settings';
        title.style.cssText = 'margin: 0 0 20px 0; font-size: 14px; border-bottom: 1px solid rgba(255, 255, 255, 0.3); padding-bottom: 10px;';
        settingsPanel.appendChild(title);

        // Helper function to create a section
        const createSection = (name: string) => {
            const section = document.createElement('div');
            section.style.cssText = 'margin-bottom: 20px;';
            const sectionTitle = document.createElement('h3');
            sectionTitle.textContent = name;
            sectionTitle.style.cssText = 'margin: 0 0 10px 0; font-size: 12px; color: #aaa;';
            section.appendChild(sectionTitle);
            return section;
        };

        // Helper function to create a slider control
        const createSlider = (label: string, min: number, max: number, step: number, value: number, onChange: (value: number) => void, onUpdate?: () => void) => {
            const container = document.createElement('div');
            container.style.cssText = 'margin-bottom: 15px;';
            
            const labelEl = document.createElement('label');
            labelEl.style.cssText = 'display: block; margin-bottom: 5px; font-size: 11px;';
            const valueSpan = document.createElement('span');
            valueSpan.textContent = value.toString();
            valueSpan.style.cssText = 'float: right; color: #888;';
            labelEl.textContent = label;
            labelEl.appendChild(valueSpan);
            
            const slider = document.createElement('input');
            slider.type = 'range';
            slider.min = min.toString();
            slider.max = max.toString();
            slider.step = step.toString();
            slider.value = value.toString();
            slider.style.cssText = 'width: 100%; margin-top: 5px; cursor: pointer;';
            
            slider.oninput = () => {
                const val = parseFloat(slider.value);
                valueSpan.textContent = val.toFixed(step < 1 ? 2 : 0);
                onChange(val);
                if (onUpdate) onUpdate();
            };
            
            container.appendChild(labelEl);
            container.appendChild(slider);
            return container;
        };

        // Helper function to create a select control
        const createSelect = (label: string, options: string[], value: string, onChange: (value: string) => void, onUpdate?: () => void) => {
            const container = document.createElement('div');
            container.style.cssText = 'margin-bottom: 15px;';
            
            const labelEl = document.createElement('label');
            labelEl.textContent = label;
            labelEl.style.cssText = 'display: block; margin-bottom: 5px; font-size: 11px;';
            
            const select = document.createElement('select');
            select.style.cssText = 'width: 100%; padding: 5px; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.3); color: white; border-radius: 4px; cursor: pointer;';
            
            options.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt;
                option.textContent = opt;
                option.style.background = '#333';
                if (opt === value) option.selected = true;
                select.appendChild(option);
            });
            
            select.onchange = () => {
                onChange(select.value);
                if (onUpdate) onUpdate();
            };
            
            container.appendChild(labelEl);
            container.appendChild(select);
            return container;
        };

        // Track current parameter values
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

        // Function to update parameters
        const updateSaveButton = () => {
            hasUnsavedChanges = true;
            saveButton.style.background = 'rgba(100, 200, 100, 0.3)';
            saveButton.innerHTML = '💾*';
            saveButton.title = 'Save Parameters to Code Block (unsaved changes)';
        };

        // Force Engine Section
        const forceSection = createSection('Force Engine');
        forceSection.appendChild(createSlider('Alpha Decay', 0, 0.1, 0.001, currentParams.force!.alphaDecay!, (val) => {
            Graph.d3AlphaDecay(val);
            currentParams.force!.alphaDecay = val;
        }, updateSaveButton));
        forceSection.appendChild(createSlider('Velocity Decay', 0, 1, 0.1, currentParams.force!.velocityDecay!, (val) => {
            Graph.d3VelocityDecay(val);
            currentParams.force!.velocityDecay = val;
        }, updateSaveButton));
        forceSection.appendChild(createSlider('Alpha Min', 0, 0.1, 0.001, currentParams.force!.alphaMin!, (val) => {
            Graph.d3AlphaMin(val);
            currentParams.force!.alphaMin = val;
        }, updateSaveButton));
        settingsPanel.appendChild(forceSection);

        // DAG Mode Section
        const dagSection = createSection('DAG Layout');
        dagSection.appendChild(createSelect('DAG Mode', ['', 'td', 'bu', 'lr', 'rl', 'radialout', 'radialin'], currentParams.dag!.mode!, (val) => {
            Graph.dagMode(val as any);
            currentParams.dag!.mode = val;
        }, updateSaveButton));
        dagSection.appendChild(createSlider('DAG Level Distance', 0, 200, 10, currentParams.dag!.levelDistance!, (val) => {
            Graph.dagLevelDistance(val);
            currentParams.dag!.levelDistance = val;
        }, updateSaveButton));
        settingsPanel.appendChild(dagSection);

        // Node Styling Section
        const nodeSection = createSection('Node Styling');
        nodeSection.appendChild(createSlider('Node Size', 1, 20, 1, currentParams.nodeStyle!.size!, (val) => {
            Graph.nodeRelSize(val);
            currentParams.nodeStyle!.size = val;
        }, updateSaveButton));
        nodeSection.appendChild(createSlider('Node Opacity', 0, 1, 0.05, currentParams.nodeStyle!.opacity!, (val) => {
            Graph.nodeOpacity(val);
            currentParams.nodeStyle!.opacity = val;
        }, updateSaveButton));
        nodeSection.appendChild(createSlider('Node Resolution', 4, 32, 2, currentParams.nodeStyle!.resolution!, (val) => {
            Graph.nodeResolution(val);
            currentParams.nodeStyle!.resolution = val;
        }, updateSaveButton));
        settingsPanel.appendChild(nodeSection);

        // Link Styling Section
        const linkSection = createSection('Link Styling');
        linkSection.appendChild(createSlider('Link Opacity', 0, 1, 0.05, currentParams.linkStyle!.opacity!, (val) => {
            Graph.linkOpacity(val);
            currentParams.linkStyle!.opacity = val;
        }, updateSaveButton));
        linkSection.appendChild(createSlider('Link Width', 0, 10, 0.5, currentParams.linkStyle!.width!, (val) => {
            Graph.linkWidth(val);
            currentParams.linkStyle!.width = val;
        }, updateSaveButton));
        linkSection.appendChild(createSlider('Link Curvature', 0, 1, 0.1, currentParams.linkStyle!.curvature!, (val) => {
            Graph.linkCurvature(val);
            currentParams.linkStyle!.curvature = val;
        }, updateSaveButton));
        linkSection.appendChild(createSlider('Link Particles', 0, 10, 1, currentParams.linkStyle!.particles!, (val) => {
            Graph.linkDirectionalParticles(val);
            currentParams.linkStyle!.particles = val;
        }, updateSaveButton));
        linkSection.appendChild(createSlider('Link Particle Speed', 0, 0.1, 0.01, currentParams.linkStyle!.particleSpeed!, (val) => {
            Graph.linkDirectionalParticleSpeed(val);
            currentParams.linkStyle!.particleSpeed = val;
        }, updateSaveButton));
        settingsPanel.appendChild(linkSection);

        // Bloom Effect Section
        const bloomSection = createSection('Bloom Effect');
        bloomSection.appendChild(createSlider('Bloom Strength', 0, 10, 0.1, currentParams.bloom!.strength!, (val) => {
            bloomPass.strength = val;
            currentParams.bloom!.strength = val;
        }, updateSaveButton));
        bloomSection.appendChild(createSlider('Bloom Radius', 0, 2, 0.1, currentParams.bloom!.radius!, (val) => {
            bloomPass.radius = val;
            currentParams.bloom!.radius = val;
        }, updateSaveButton));
        bloomSection.appendChild(createSlider('Bloom Threshold', 0, 1, 0.05, currentParams.bloom!.threshold!, (val) => {
            bloomPass.threshold = val;
            currentParams.bloom!.threshold = val;
        }, updateSaveButton));
        settingsPanel.appendChild(bloomSection);

        // Interaction Section
        const interactionSection = createSection('Interaction');
        const enableDragToggle = document.createElement('div');
        enableDragToggle.style.cssText = 'margin-bottom: 15px;';
        const dragLabel = document.createElement('label');
        dragLabel.style.cssText = 'display: flex; align-items: center; font-size: 13px; cursor: pointer;';
        const dragCheckbox = document.createElement('input');
        dragCheckbox.type = 'checkbox';
        dragCheckbox.checked = currentParams.interaction!.enableDrag!;
        dragCheckbox.style.cssText = 'margin-right: 8px;';
        dragCheckbox.onchange = () => {
            Graph.enableNodeDrag(dragCheckbox.checked);
            currentParams.interaction!.enableDrag = dragCheckbox.checked;
            updateSaveButton();
        };
        dragLabel.appendChild(dragCheckbox);
        dragLabel.appendChild(document.createTextNode('Enable Node Dragging'));
        enableDragToggle.appendChild(dragLabel);
        interactionSection.appendChild(enableDragToggle);
        settingsPanel.appendChild(interactionSection);

        // Performance Section
        const perfSection = createSection('Performance');
        perfSection.appendChild(createSlider('Warmup Ticks', 0, 200, 10, currentParams.performance!.warmupTicks!, (val) => {
            Graph.warmupTicks(val);
            currentParams.performance!.warmupTicks = val;
        }, updateSaveButton));
        perfSection.appendChild(createSlider('Cooldown Ticks', 0, 1000, 50, currentParams.performance!.cooldownTicks!, (val) => {
            Graph.cooldownTicks(val);
            currentParams.performance!.cooldownTicks = val;
        }, updateSaveButton));
        perfSection.appendChild(createSlider('Cooldown Time (ms)', 0, 30000, 1000, currentParams.performance!.cooldownTime!, (val) => {
            Graph.cooldownTime(val);
            currentParams.performance!.cooldownTime = val;
        }, updateSaveButton));
        settingsPanel.appendChild(perfSection);


        // Add reset button
        const resetSection = document.createElement('div');
        resetSection.style.cssText = 'margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(255, 255, 255, 0.2);';
        const resetBtn = document.createElement('button');
        resetBtn.textContent = 'Reset to Defaults';
        resetBtn.style.cssText = `
            display: block;
            width: 100%;
            padding: 10px 16px;
            background: rgba(200, 100, 100, 0.2);
            border: 1px solid rgba(200, 100, 100, 0.5);
            border-radius: 4px;
            color: white;
            cursor: pointer;
            font-size: 14px;
            transition: background 0.2s;
        `;
        resetBtn.onmouseover = () => resetBtn.style.background = 'rgba(200, 100, 100, 0.3)';
        resetBtn.onmouseout = () => resetBtn.style.background = 'rgba(200, 100, 100, 0.2)';
        resetBtn.onclick = () => {
            // Reset all values to defaults
            Graph.d3AlphaDecay(0.0228);
            Graph.d3VelocityDecay(0.4);
            Graph.d3AlphaMin(0);
            Graph.dagMode(null as any);
            Graph.dagLevelDistance(50);
            Graph.nodeRelSize(4);
            Graph.nodeOpacity(0.75);
            Graph.nodeResolution(8);
            Graph.linkOpacity(0.2);
            Graph.linkWidth(1);
            Graph.linkCurvature(0);
            Graph.linkDirectionalParticles(0);
            Graph.linkDirectionalParticleSpeed(0.01);
            Graph.enableNodeDrag(true);
            Graph.warmupTicks(0);
            Graph.cooldownTicks(Infinity);
            Graph.cooldownTime(10000);
            bloomPass.strength = 4.5;
            bloomPass.radius = 1;
            bloomPass.threshold = 0;
            // Recreate controls to update UI
            settingsPanel.innerHTML = '';
            createSettingsControls();
        };
        resetSection.appendChild(resetBtn);
        settingsPanel.appendChild(resetSection);
        
        // Configure save button onclick handler
        saveButton.onclick = () => {
            if (ctx && ctx.getSectionInfo && codeBlockElement) {
                const view = app.workspace.getActiveViewOfType(MarkdownView);
                if (view) {
                    const sectionInfo = ctx.getSectionInfo(codeBlockElement);
                    if (sectionInfo) {
                        const { lineStart, lineEnd } = sectionInfo;
                        const editor = view.editor;
                        
                        // Get the current query text
                        const currentContent = editor.getRange(
                            { line: lineStart + 1, ch: 0 },
                            { line: lineEnd - 1, ch: editor.getLine(lineEnd - 1).length }
                        );
                        const { query } = parseParametersAndQuery(currentContent);
                        
                        // Collect locked nodes with their current positions
                        const lockedNodeData: Array<{name: string, x: number, y: number, z: number}> = [];
                        const nodes = Graph.graphData().nodes;
                        lockedNodes.forEach(nodeId => {
                            const node = nodes.find((n: any) => n.id === nodeId);
                            if (node && node.fx !== undefined && node.fy !== undefined && node.fz !== undefined) {
                                lockedNodeData.push({
                                    name: (node as any).name,
                                    x: node.fx,
                                    y: node.fy,
                                    z: node.fz
                                });
                            }
                        });
                        
                        // Update currentParams with locked nodes
                        currentParams.lockedNodes = lockedNodeData;
                        
                        // Format the new content with updated parameters
                        const newContent = formatParameters(currentParams) + '\n' + query;
                        
                        // Replace the code block content (excluding the backticks)
                        editor.replaceRange(
                            newContent,
                            { line: lineStart + 1, ch: 0 },
                            { line: lineEnd - 1, ch: editor.getLine(lineEnd - 1).length }
                        );
                        
                        // Reset button appearance
                        hasUnsavedChanges = false;
                        saveButton.style.background = 'rgba(0, 0, 0, 0.7)';
                        saveButton.innerHTML = '💾';
                        saveButton.title = 'Save Parameters to Code Block';
                    }
                }
            }
        };
    };

    createSettingsControls();

    // Create popup elements
    let popup: HTMLDivElement | null = null;
    let currentRestriction: { nodeId: string, depth: number } | null = null;

    // Drag-related variables and functions (declared here for proper scoping)
    let dragStartHandler: ((e: MouseEvent) => void) | null = null;
    let dragHandler: ((e: MouseEvent) => void) | null = null;
    let dragEndHandler: (() => void) | null = null;

    // Function to close popup
    const closePopup = () => {
        if (popup) {
            // Remove drag event listeners
            if (dragHandler) document.removeEventListener('mousemove', dragHandler);
            if (dragEndHandler) document.removeEventListener('mouseup', dragEndHandler);
            popup.remove();
            popup = null;
            dragStartHandler = null;
            dragHandler = null;
            dragEndHandler = null;
        }
    };

    // Function to restrict graph to node and neighbors
    const restrictToNode = (nodeId: string, depth: number) => {
        // Get current graph data (3d-force-graph mutates links)
        const currentData = Graph.graphData();
        
        // Get all nodes within depth distance
        const nodesToKeep = new Set<string>();
        const queue: { id: string, depth: number }[] = [{ id: nodeId, depth: 0 }];
        
        while (queue.length > 0) {
            const { id, depth: currentDepth } = queue.shift()!;
            if (currentDepth > depth) continue;
            
            nodesToKeep.add(id);
            
            if (currentDepth < depth) {
                // Find all connected nodes
                currentData.links.forEach((link: any) => {
                    // Handle both string IDs and node objects
                    const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
                    const targetId = typeof link.target === 'string' ? link.target : link.target.id;
                    
                    if (sourceId === id && !nodesToKeep.has(targetId)) {
                        queue.push({ id: targetId, depth: currentDepth + 1 });
                    } else if (targetId === id && !nodesToKeep.has(sourceId)) {
                        queue.push({ id: sourceId, depth: currentDepth + 1 });
                    }
                });
            }
        }
        
        // Create filtered data
        const filteredNodes = currentData.nodes.filter((node: any) => nodesToKeep.has(node.id));
        const filteredLinks = currentData.links.filter((link: any) => {
            const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
            const targetId = typeof link.target === 'string' ? link.target : link.target.id;
            return nodesToKeep.has(sourceId) && nodesToKeep.has(targetId);
        });
        
        Graph.graphData({
            nodes: filteredNodes,
            links: filteredLinks
        });
        
        currentRestriction = { nodeId, depth };
    };

    // Function to unrestrict (show all nodes)
    const unrestrict = () => {
        Graph.graphData(graphData);
        currentRestriction = null;
    };

    // Add node click handler
    Graph.onNodeClick((node: any, event: MouseEvent) => {
        // Close existing popup if any
        closePopup();

        // Create popup container
        popup = document.createElement('div');
        popup.className = 'graph-node-popup';
        
        // Get container bounds to properly position the popup
        const containerRect = container.getBoundingClientRect();
        const popupX = event.clientX - containerRect.left + 10;
        const popupY = event.clientY - containerRect.top + 10;
        
        popup.style.cssText = `
            position: absolute;
            left: ${popupX}px;
            top: ${popupY}px;
            background: rgba(0, 0, 0, 0.85);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 8px;
            padding: 16px;
            color: white;
            font-family: sans-serif;
            font-size: 14px;
            z-index: 1000;
            min-width: 250px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
            cursor: move;
        `;

        // Add title
        const title = document.createElement('h3');
        title.textContent = node.name;
        title.style.cssText = 'margin: 0 0 12px 0; font-size: 14px; color: #fff;';
        popup.appendChild(title);

        // Create button container for icon buttons
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = 'display: flex; gap: 8px; margin-bottom: 12px;';

        // Add "Go to page" button with icon
        const goToPageBtn = document.createElement('button');
        goToPageBtn.innerHTML = '📄';
        goToPageBtn.title = 'Go to page in new tab';
        goToPageBtn.style.cssText = `
            flex: 1;
            padding: 8px;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 4px;
            color: white;
            cursor: pointer;
            font-size: 16px;
            transition: background 0.2s;
        `;
        goToPageBtn.onmouseover = () => goToPageBtn.style.background = 'rgba(255, 255, 255, 0.2)';
        goToPageBtn.onmouseout = () => goToPageBtn.style.background = 'rgba(255, 255, 255, 0.1)';
        goToPageBtn.onclick = async () => {
            // In public mode, we don't open the actual file
            if (!publicMode) {
                // Check if this is an actual file
                const file = app.vault.getAbstractFileByPath(node.id);
                if (file && file instanceof TFile) {
                    // Open existing file in new tab
                    const leaf = app.workspace.getLeaf(true);
                    await leaf.openFile(file);
                } else {
                    // For non-existent links, create a new note
                    const leaf = app.workspace.getLeaf(true);
                    // Use the node.id as the file name (it's the link text)
                    const fileName = node.id.endsWith('.md') ? node.id : `${node.id}.md`;
                    try {
                        // Create the file
                        const newFile = await app.vault.create(fileName, '');
                        // Open it
                        await leaf.openFile(newFile);
                    } catch (error) {
                        // If creation fails (e.g., invalid file name), just create an empty leaf
                    }
                }
            }
            closePopup();
        };
        buttonContainer.appendChild(goToPageBtn);

        // Add lock/unlock button
        const lockBtn = document.createElement('button');
        const isLocked = lockedNodes.has(node.id);
        lockBtn.innerHTML = isLocked ? '🔓' : '🔒';
        lockBtn.title = isLocked ? 'Unlock node' : 'Lock node in place';
        lockBtn.style.cssText = `
            flex: 1;
            padding: 8px;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 4px;
            color: white;
            cursor: pointer;
            font-size: 16px;
            transition: background 0.2s;
        `;
        lockBtn.onmouseover = () => lockBtn.style.background = 'rgba(255, 255, 255, 0.2)';
        lockBtn.onmouseout = () => lockBtn.style.background = 'rgba(255, 255, 255, 0.1)';
        lockBtn.onclick = () => {
            const currentNode = Graph.graphData().nodes.find((n: any) => n.id === node.id);
            if (!currentNode) return;
            
            if (isLocked) {
                // Unlock the node
                lockedNodes.delete(node.id);
                delete currentNode.fx;
                delete currentNode.fy;
                delete currentNode.fz;
            } else {
                // Lock the node at its current position
                lockedNodes.add(node.id);
                currentNode.fx = currentNode.x;
                currentNode.fy = currentNode.y;
                currentNode.fz = currentNode.z;
            }
            
            // Update unlock all button visibility
            unlockAllButton.style.display = lockedNodes.size > 0 ? 'flex' : 'none';
            
            closePopup();
        };
        buttonContainer.appendChild(lockBtn);

        popup.appendChild(buttonContainer);

        // Add restriction controls
        const restrictionDiv = document.createElement('div');
        restrictionDiv.style.cssText = 'margin-bottom: 12px;';
        
        const restrictLabel = document.createElement('label');
        restrictLabel.textContent = 'Restrict to neighbors within depth:';
        restrictLabel.style.cssText = 'display: block; margin-bottom: 8px; font-size: 13px;';
        restrictionDiv.appendChild(restrictLabel);

        const depthSlider = document.createElement('input');
        depthSlider.type = 'range';
        depthSlider.min = '1';
        depthSlider.max = '5';
        depthSlider.value = (currentRestriction && currentRestriction.nodeId === node.id) ? currentRestriction.depth.toString() : '2';
        depthSlider.style.cssText = 'width: 100%; margin-bottom: 4px;';
        
        const depthValue = document.createElement('span');
        depthValue.textContent = depthSlider.value;
        depthValue.style.cssText = 'display: inline-block; margin-left: 8px; font-size: 13px;';
        
        depthSlider.oninput = () => {
            depthValue.textContent = depthSlider.value;
        };
        
        const sliderContainer = document.createElement('div');
        sliderContainer.style.cssText = 'display: flex; align-items: center; margin-bottom: 8px;';
        sliderContainer.appendChild(depthSlider);
        sliderContainer.appendChild(depthValue);
        restrictionDiv.appendChild(sliderContainer);

        const restrictBtn = document.createElement('button');
        restrictBtn.textContent = 'Apply Restriction';
        restrictBtn.style.cssText = `
            display: block;
            width: 100%;
            padding: 8px 16px;
            background: rgba(100, 200, 100, 0.2);
            border: 1px solid rgba(100, 200, 100, 0.5);
            border-radius: 4px;
            color: white;
            cursor: pointer;
            font-size: 14px;
            transition: background 0.2s;
        `;
        restrictBtn.onmouseover = () => restrictBtn.style.background = 'rgba(100, 200, 100, 0.3)';
        restrictBtn.onmouseout = () => restrictBtn.style.background = 'rgba(100, 200, 100, 0.2)';
        restrictBtn.onclick = () => {
            restrictToNode(node.id, parseInt(depthSlider.value));
            closePopup();
        };
        restrictionDiv.appendChild(restrictBtn);
        
        popup.appendChild(restrictionDiv);

        // Add unrestrict button if there's a current restriction
        if (currentRestriction) {
            const unrestrictBtn = document.createElement('button');
            unrestrictBtn.textContent = 'Remove All Restrictions';
            unrestrictBtn.style.cssText = `
                display: block;
                width: 100%;
                padding: 8px 16px;
                margin-bottom: 12px;
                background: rgba(200, 100, 100, 0.2);
                border: 1px solid rgba(200, 100, 100, 0.5);
                border-radius: 4px;
                color: white;
                cursor: pointer;
                font-size: 14px;
                transition: background 0.2s;
            `;
            unrestrictBtn.onmouseover = () => unrestrictBtn.style.background = 'rgba(200, 100, 100, 0.3)';
            unrestrictBtn.onmouseout = () => unrestrictBtn.style.background = 'rgba(200, 100, 100, 0.2)';
            unrestrictBtn.onclick = () => {
                unrestrict();
                closePopup();
            };
            popup.appendChild(unrestrictBtn);
        }

        // Add center on node controls
        const centerDiv = document.createElement('div');
        centerDiv.style.cssText = 'margin-bottom: 12px; padding: 12px; background: rgba(100, 100, 200, 0.1); border-radius: 4px;';
        
        const centerLabel = document.createElement('label');
        centerLabel.textContent = 'Center View on Node:';
        centerLabel.style.cssText = 'display: block; margin-bottom: 8px; font-size: 13px;';
        centerDiv.appendChild(centerLabel);
        
        const distanceLabel = document.createElement('label');
        distanceLabel.textContent = 'Camera Distance:';
        distanceLabel.style.cssText = 'display: block; margin-bottom: 4px; font-size: 12px; color: #ccc;';
        centerDiv.appendChild(distanceLabel);
        
        const distanceSlider = document.createElement('input');
        distanceSlider.type = 'range';
        distanceSlider.min = '50';
        distanceSlider.max = '500';
        distanceSlider.value = '200';
        distanceSlider.style.cssText = 'width: 100%; margin-bottom: 4px;';
        
        const distanceValue = document.createElement('span');
        distanceValue.textContent = distanceSlider.value;
        distanceValue.style.cssText = 'display: inline-block; margin-left: 8px; font-size: 12px;';
        
        distanceSlider.oninput = () => {
            distanceValue.textContent = distanceSlider.value;
        };
        
        const distanceSliderContainer = document.createElement('div');
        distanceSliderContainer.style.cssText = 'display: flex; align-items: center; margin-bottom: 8px;';
        distanceSliderContainer.appendChild(distanceSlider);
        distanceSliderContainer.appendChild(distanceValue);
        centerDiv.appendChild(distanceSliderContainer);

        const centerBtn = document.createElement('button');
        centerBtn.textContent = 'Center on This Node';
        centerBtn.style.cssText = `
            display: block;
            width: 100%;
            padding: 8px 16px;
            background: rgba(100, 100, 200, 0.3);
            border: 1px solid rgba(100, 100, 200, 0.5);
            border-radius: 4px;
            color: white;
            cursor: pointer;
            font-size: 14px;
            transition: background 0.2s;
        `;
        centerBtn.onmouseover = () => centerBtn.style.background = 'rgba(100, 100, 200, 0.4)';
        centerBtn.onmouseout = () => centerBtn.style.background = 'rgba(100, 100, 200, 0.3)';
        centerBtn.onclick = () => {
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
            const distance = parseFloat(distanceSlider.value);
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
            closePopup();
        };
        centerDiv.appendChild(centerBtn);
        popup.appendChild(centerDiv);

        // Add close button
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        closeBtn.style.cssText = `
            position: absolute;
            top: 8px;
            right: 8px;
            background: transparent;
            border: none;
            color: white;
            font-size: 20px;
            cursor: pointer;
            width: 24px;
            height: 24px;
            padding: 0;
            line-height: 1;
        `;
        closeBtn.onclick = closePopup;
        popup.appendChild(closeBtn);

        // Add popup to container (not document body)
        container.appendChild(popup);

        // Make popup draggable
        let isDragging = false;
        let currentX: number;
        let currentY: number;
        let initialX: number;
        let initialY: number;
        let xOffset = 0;
        let yOffset = 0;

        dragStartHandler = (e: MouseEvent) => {
            if (e.type === "mousedown") {
                // Don't start dragging if clicking on interactive elements
                const target = e.target as HTMLElement;
                if (target.tagName === 'BUTTON' || target.tagName === 'INPUT' || 
                    target.tagName === 'A' || target.closest('button') || 
                    target.closest('input') || target.closest('a')) {
                    return;
                }
                initialX = e.clientX - xOffset;
                initialY = e.clientY - yOffset;
                isDragging = true;
            }
        };

        dragEndHandler = () => {
            initialX = currentX;
            initialY = currentY;
            isDragging = false;
        };

        dragHandler = (e: MouseEvent) => {
            if (isDragging) {
                e.preventDefault();
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;
                xOffset = currentX;
                yOffset = currentY;
                if (popup) {
                    popup.style.transform = `translate(${currentX}px, ${currentY}px)`;
                }
            }
        };

        popup.addEventListener('mousedown', dragStartHandler);
        document.addEventListener('mousemove', dragHandler);
        document.addEventListener('mouseup', dragEndHandler);

        // Close popup when clicking outside
        const clickOutside = (e: MouseEvent) => {
            if (popup && !popup.contains(e.target as HTMLElement)) {
                closePopup();
                document.removeEventListener('click', clickOutside);
            }
        };
        // Add delay to prevent immediate closing
        setTimeout(() => {
            document.addEventListener('click', clickOutside);
        }, 100);
    });

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
