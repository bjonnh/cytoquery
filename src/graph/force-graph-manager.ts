import { App } from 'obsidian';
import { GraphData, GraphNode } from '../types/graph';
import { QueryParser, parseParametersAndQuery } from '../query';
import { buildGraphData, saveParametersToCodeBlock, openFileInNewTab } from '../obsidian';
import { initGraph, GraphPlatformAdapter } from './graph-core';

export function init3DForceGraph(
    containerId: string, 
    sourceText: string = '', 
    app: App, 
    graphInstances: Map<string, any>,
    generateRandomStringFromSeed: (input: string) => string,
    publicMode: boolean,
    fastMode: boolean = false,
    codeBlockElement?: HTMLElement,
    ctx?: any
): void {
    // Build graph data from Obsidian vault
    const { nodeSet, edgeSet, metadataMap } = buildGraphData(app, publicMode, generateRandomStringFromSeed);

    // Parse parameters and query from source text
    const { parameters, query: queryText } = parseParametersAndQuery(sourceText);

    // Parse and apply query rules if query text is provided
    if (queryText.trim()) {
        const queryParser = new QueryParser(metadataMap, edgeSet);
        const parseErrors = queryParser.getParseErrors(queryText);
        
        if (parseErrors.length === 0) {
            queryParser.parseQuery(queryText);
            queryParser.applyRules(nodeSet.values());
            // Apply edge rules to edges
            queryParser.applyEdgeRules(edgeSet.values());
        }
    }

    // Count links for node sizing
    const linkCounts = new Map<string, number>();
    nodeSet.values().forEach(node => {
        linkCounts.set(node.id, 0);
    });
    edgeSet.values().forEach(edge => {
        linkCounts.set(edge.source, (linkCounts.get(edge.source) || 0) + 1);
        linkCounts.set(edge.target, (linkCounts.get(edge.target) || 0) + 1);
    });

    // Transform nodes and edges into 3D force graph format
    const graphNodes = nodeSet.values().map(node => {
        const linkCount = linkCounts.get(node.id) || 0;
        const val = Math.max(3, 50 * (3 + linkCount));
        const nodeName = publicMode ? generateRandomStringFromSeed(node.id) : node.label;
        
        const graphNode: GraphNode = {
            id: node.id,
            name: nodeName,
            val: val,
            color: node.color || "#666",
            shape: node.shape || 'sphere',
            material: node.material || 'default',
            size: node.size || 1
        };
        
        return graphNode;
    });

    const graphLinks = edgeSet.values().map(edge => ({
        source: edge.source,
        target: edge.target,
        color: edge.color,
        width: edge.width,
        opacity: edge.opacity
    }));

    const graphData: GraphData = {
        nodes: graphNodes,
        links: graphLinks
    };

    // Create Obsidian platform adapter
    const obsidianAdapter: GraphPlatformAdapter = {
        openPage: async (nodeId: string) => {
            await openFileInNewTab(app, nodeId, publicMode);
        },
        saveParameters: (params, lockedNodes) => {
            return saveParametersToCodeBlock(
                app,
                ctx,
                codeBlockElement,
                params,
                new Set(lockedNodes.map(n => n.name)),
                graphData
            );
        },
        publicMode,
        fastMode
    };

    // Use the core graph initialization
    initGraph(containerId, graphData, sourceText, obsidianAdapter, graphInstances);
}
