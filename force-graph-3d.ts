import { App, CachedMetadata, getLinkpath, TFile } from 'obsidian';
import ForceGraph3D from "./3d-force-graph.js";
import * as THREE from "three";
import { UnrealBloomPass } from 'UnrealBloomPass';
import { Node, NodeSet, Edge, EdgeSet } from './utils';
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
        if (existingGraph._destructor) {
            existingGraph._destructor();
        }
        graphInstances.delete(containerId);
    }

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
        }
    }

    // Parse and apply query rules if query text is provided
    if (queryText.trim()) {
        const queryParser = new QueryParser(metadataMap, edgeSet);
        queryParser.parseQuery(queryText);
        queryParser.applyRules(nodeSet.values());
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
            color: node.color || "#666"
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

    // Initialize the 3D force graph
    const Graph = new ForceGraph3D(container)
        .backgroundColor('#000003')
        .nodeLabel('name')
        //.nodeAutoColorBy('group')
        .nodeColor('color')
        .nodeVal('val')
        .linkColor(() => '#ccc')
        .cooldownTime(1000)
        .linkWidth(1)
        .linkDirectionalArrowLength(3.5)
        .linkDirectionalArrowRelPos(1)
        .graphData(graphData);

    Graph.enableNavigationControls();
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(container.innerWidth, container.innerHeight), 1.5, 0.4, 0.85);
    bloomPass.strength = 4.5;
    bloomPass.radius = 1;
    bloomPass.threshold = 0.0;
    Graph.postProcessingComposer().addPass(bloomPass);

    graphInstances.set(containerId, Graph);
}
