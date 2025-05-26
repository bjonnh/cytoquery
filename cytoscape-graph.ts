import { App, CachedMetadata, getLinkpath, TFile } from 'obsidian';
import cytoscape from "cytoscape";
import fcose from "cytoscape-fcose";
import dagre from "cytoscape-dagre";
import cise from "cytoscape-cise";
import { Node, NodeSet, Edge, EdgeSet } from './utils';
import { QueryParser } from './query-language';

// Register Cytoscape plugins
cytoscape.use(cise);
cytoscape.use(dagre);
cytoscape.use(fcose);

export function initCytoscape(
    containerId: string, 
    queryText: string = '', 
    app: App, 
    graphInstances: Map<string, any>,
    generateRandomStringFromSeed: (input: string) => string,
    publicMode: boolean
): void {
    // Check if there's an existing graph for this container and dispose of it
    if (graphInstances.has(containerId)) {
        const existingGraph = graphInstances.get(containerId);
        existingGraph.destroy();
        graphInstances.delete(containerId);
    }

    var cy = cytoscape({
        container: document.getElementById(containerId),
        style: [ // the stylesheet for the graph
            {
                selector: 'node',
                style: {
                    'background-color': 'data(color)', // Use the color data property
                    'label': 'data(label)'
                }
            },
            {
                selector: 'node[color = undefined]', // Default style for nodes without color
                style: {
                    'background-color': '#666'
                }
            },
            {
                selector: 'edge',
                style: {
                    'width': 3,
                    'line-color': '#ccc',
                    'target-arrow-color': '#ccc',
                    'target-arrow-shape': 'triangle',
                    'curve-style': 'bezier'
                }
            }
        ],
    });
    
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

    // Transform nodes and edges into cytoscape.js objects
    const cyNodes = nodeSet.values().map(node => ({
        data: { 
            id: node.id,
            // Use node ID instead of label in public mode
            label: publicMode ? generateRandomStringFromSeed(node.label) : node.label,
            color: node.color // Include color in the data
        }
    }));

    const cyEdges = edgeSet.values().map(edge => ({
        data: {
            id: edge.id,
            source: edge.source,
            target: edge.target
        }
    }));

    // Add all elements to the graph
    cy.add([...cyNodes, ...cyEdges]);
    // @ts-ignore
    cy.layout({ name: "fcose" }).run();

    // Store the graph instance for later cleanup
    graphInstances.set(containerId, cy);
}
