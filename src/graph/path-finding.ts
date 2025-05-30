export function findPath(
    sourceId: string, 
    targetId: string, 
    directed: boolean,
    graphData: any
): string[] {
    const nodes = graphData.nodes;
    const links = graphData.links;
    
    // Build adjacency list
    const adjacency = new Map<string, string[]>();
    nodes.forEach((node: any) => {
        adjacency.set(node.id, []);
    });
    
    links.forEach((link: any) => {
        const srcId = typeof link.source === 'string' ? link.source : link.source.id;
        const tgtId = typeof link.target === 'string' ? link.target : link.target.id;
        
        adjacency.get(srcId)?.push(tgtId);
        
        // For undirected, add reverse edge
        if (!directed) {
            adjacency.get(tgtId)?.push(srcId);
        }
    });
    
    // BFS to find shortest path
    const queue: { nodeId: string, path: string[] }[] = [{ nodeId: sourceId, path: [sourceId] }];
    const visited = new Set<string>();
    
    while (queue.length > 0) {
        const { nodeId, path } = queue.shift()!;
        
        if (nodeId === targetId) {
            return path;
        }
        
        if (visited.has(nodeId)) continue;
        visited.add(nodeId);
        
        const neighbors = adjacency.get(nodeId) || [];
        for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
                queue.push({ nodeId: neighbor, path: [...path, neighbor] });
            }
        }
    }
    
    return []; // No path found
}

export function restrictToNode(
    nodeId: string, 
    depth: number,
    currentData: any
): { nodes: any[], links: any[] } {
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
    
    return {
        nodes: filteredNodes,
        links: filteredLinks
    };
}