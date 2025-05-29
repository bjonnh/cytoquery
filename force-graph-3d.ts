import { App, CachedMetadata, getLinkpath, TFile } from 'obsidian';
import ForceGraph3D from "./3d-force-graph.js";
import * as THREE from "three";
import { UnrealBloomPass } from 'UnrealBloomPass';
import { NodeSet, EdgeSet } from './utils';
import { QueryParser } from './query-language';

export function init3DForceGraph(
    containerId: string, 
    queryText: string = '', 
    app: App, 
    graphInstances: Map<string, any>,
    generateRandomStringFromSeed: (input: string) => string,
    publicMode: boolean
): void {
    const container = document.getElementById(containerId);
    if (!container) return;

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
        width: 40px;
        height: 40px;
        background: rgba(0, 0, 0, 0.7);
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 8px;
        color: white;
        font-size: 24px;
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

    // Create hamburger menu button
    const menuButton = document.createElement('button');
    menuButton.innerHTML = '☰';
    menuButton.style.cssText = `
        position: absolute;
        top: 16px;
        right: 16px;
        width: 40px;
        height: 40px;
        background: rgba(0, 0, 0, 0.7);
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 8px;
        color: white;
        font-size: 24px;
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
        font-size: 14px;
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

        return {
            id: node.id,
            // Use node ID instead of label in public mode
            name: publicMode ? generateRandomStringFromSeed(node.id) : node.label,
            val: val,
            color: node.color || "#666",
            shape: node.shape || 'sphere',
            material: node.material || 'default',
            size: node.size || 1
        };
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

    // Initialize the 3D force graph
    const Graph = new ForceGraph3D(graphContainer)
        .backgroundColor('#000003')
        .nodeLabel('name')
        //.nodeAutoColorBy('group')
        .nodeColor('color')
        .nodeVal('val')
        .linkColor(() => '#ccc')
        .cooldownTime(10000)
        .linkWidth(1)
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
    bloomPass.strength = 4.5;
    bloomPass.radius = 1;
    bloomPass.threshold = 0.0;
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

    // Create settings controls
    const createSettingsControls = () => {
        // Title
        const title = document.createElement('h2');
        title.textContent = 'Graph Settings';
        title.style.cssText = 'margin: 0 0 20px 0; font-size: 18px; border-bottom: 1px solid rgba(255, 255, 255, 0.3); padding-bottom: 10px;';
        settingsPanel.appendChild(title);

        // Helper function to create a section
        const createSection = (name: string) => {
            const section = document.createElement('div');
            section.style.cssText = 'margin-bottom: 20px;';
            const sectionTitle = document.createElement('h3');
            sectionTitle.textContent = name;
            sectionTitle.style.cssText = 'margin: 0 0 10px 0; font-size: 16px; color: #aaa;';
            section.appendChild(sectionTitle);
            return section;
        };

        // Helper function to create a slider control
        const createSlider = (label: string, min: number, max: number, step: number, value: number, onChange: (value: number) => void) => {
            const container = document.createElement('div');
            container.style.cssText = 'margin-bottom: 15px;';
            
            const labelEl = document.createElement('label');
            labelEl.style.cssText = 'display: block; margin-bottom: 5px; font-size: 13px;';
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
            };
            
            container.appendChild(labelEl);
            container.appendChild(slider);
            return container;
        };

        // Helper function to create a select control
        const createSelect = (label: string, options: string[], value: string, onChange: (value: string) => void) => {
            const container = document.createElement('div');
            container.style.cssText = 'margin-bottom: 15px;';
            
            const labelEl = document.createElement('label');
            labelEl.textContent = label;
            labelEl.style.cssText = 'display: block; margin-bottom: 5px; font-size: 13px;';
            
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
            
            select.onchange = () => onChange(select.value);
            
            container.appendChild(labelEl);
            container.appendChild(select);
            return container;
        };

        // Force Engine Section
        const forceSection = createSection('Force Engine');
        forceSection.appendChild(createSlider('Alpha Decay', 0, 0.1, 0.001, 0.0228, (val) => Graph.d3AlphaDecay(val)));
        forceSection.appendChild(createSlider('Velocity Decay', 0, 1, 0.1, 0.4, (val) => Graph.d3VelocityDecay(val)));
        forceSection.appendChild(createSlider('Alpha Min', 0, 0.1, 0.001, 0, (val) => Graph.d3AlphaMin(val)));
        settingsPanel.appendChild(forceSection);

        // DAG Mode Section
        const dagSection = createSection('DAG Layout');
        dagSection.appendChild(createSelect('DAG Mode', ['', 'td', 'bu', 'lr', 'rl', 'radialout', 'radialin'], '', (val) => Graph.dagMode(val as any)));
        dagSection.appendChild(createSlider('DAG Level Distance', 0, 200, 10, 50, (val) => Graph.dagLevelDistance(val)));
        settingsPanel.appendChild(dagSection);

        // Node Styling Section
        const nodeSection = createSection('Node Styling');
        nodeSection.appendChild(createSlider('Node Size', 1, 20, 1, 4, (val) => Graph.nodeRelSize(val)));
        nodeSection.appendChild(createSlider('Node Opacity', 0, 1, 0.05, 0.75, (val) => Graph.nodeOpacity(val)));
        nodeSection.appendChild(createSlider('Node Resolution', 4, 32, 2, 8, (val) => Graph.nodeResolution(val)));
        settingsPanel.appendChild(nodeSection);

        // Link Styling Section
        const linkSection = createSection('Link Styling');
        linkSection.appendChild(createSlider('Link Opacity', 0, 1, 0.05, 0.2, (val) => Graph.linkOpacity(val)));
        linkSection.appendChild(createSlider('Link Width', 0, 10, 0.5, 1, (val) => Graph.linkWidth(val)));
        linkSection.appendChild(createSlider('Link Curvature', 0, 1, 0.1, 0, (val) => Graph.linkCurvature(val)));
        linkSection.appendChild(createSlider('Link Particles', 0, 10, 1, 0, (val) => Graph.linkDirectionalParticles(val)));
        linkSection.appendChild(createSlider('Link Particle Speed', 0, 0.1, 0.01, 0.01, (val) => Graph.linkDirectionalParticleSpeed(val)));
        settingsPanel.appendChild(linkSection);

        // Bloom Effect Section
        const bloomSection = createSection('Bloom Effect');
        bloomSection.appendChild(createSlider('Bloom Strength', 0, 10, 0.1, 4.5, (val) => { bloomPass.strength = val; }));
        bloomSection.appendChild(createSlider('Bloom Radius', 0, 2, 0.1, 1, (val) => { bloomPass.radius = val; }));
        bloomSection.appendChild(createSlider('Bloom Threshold', 0, 1, 0.05, 0, (val) => { bloomPass.threshold = val; }));
        settingsPanel.appendChild(bloomSection);

        // Interaction Section
        const interactionSection = createSection('Interaction');
        const enableDragToggle = document.createElement('div');
        enableDragToggle.style.cssText = 'margin-bottom: 15px;';
        const dragLabel = document.createElement('label');
        dragLabel.style.cssText = 'display: flex; align-items: center; font-size: 13px; cursor: pointer;';
        const dragCheckbox = document.createElement('input');
        dragCheckbox.type = 'checkbox';
        dragCheckbox.checked = true;
        dragCheckbox.style.cssText = 'margin-right: 8px;';
        dragCheckbox.onchange = () => Graph.enableNodeDrag(dragCheckbox.checked);
        dragLabel.appendChild(dragCheckbox);
        dragLabel.appendChild(document.createTextNode('Enable Node Dragging'));
        enableDragToggle.appendChild(dragLabel);
        interactionSection.appendChild(enableDragToggle);
        settingsPanel.appendChild(interactionSection);

        // Performance Section
        const perfSection = createSection('Performance');
        perfSection.appendChild(createSlider('Warmup Ticks', 0, 200, 10, 0, (val) => Graph.warmupTicks(val)));
        perfSection.appendChild(createSlider('Cooldown Ticks', 0, 1000, 50, Infinity, (val) => Graph.cooldownTicks(val)));
        perfSection.appendChild(createSlider('Cooldown Time (ms)', 0, 30000, 1000, 10000, (val) => Graph.cooldownTime(val)));
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
        title.style.cssText = 'margin: 0 0 12px 0; font-size: 16px; color: #fff;';
        popup.appendChild(title);

        // Add "Go to page" button
        const goToPageBtn = document.createElement('button');
        goToPageBtn.textContent = 'Go to page in new tab';
        goToPageBtn.style.cssText = `
            display: block;
            width: 100%;
            padding: 8px 16px;
            margin-bottom: 12px;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 4px;
            color: white;
            cursor: pointer;
            font-size: 14px;
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
                        console.error('Failed to create file:', error);
                    }
                }
            }
            closePopup();
        };
        popup.appendChild(goToPageBtn);

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
                console.error('Node not found in graph data');
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
