// Demo entry point - standalone version without Obsidian dependencies
import { initDemoGraph } from './demo-init';
import { GraphData, GraphParameters } from '../types/graph';

// Export the demo graph manager
window.CytoQuery = {
    createDemoGraph: initDemoGraph,
    
    // Generate sample graph data
    generateSampleData: (nodeCount: number = 50): GraphData => {
        const nodes = [];
        const links = [];
        
        // Define a palette of 5 vibrant colors that work well with bloom
        const colorPalette = [
            '#FF006E', // Hot Pink
            '#00F5FF', // Cyan
            '#FFD60A', // Golden Yellow
            '#8338EC', // Purple
            '#3AFA53'  // Neon Green
        ];
        
        // Create nodes
        for (let i = 0; i < nodeCount; i++) {
            nodes.push({
                id: `node-${i}`,
                name: `Note ${i}`,
                val: Math.random() * 20 + 5,
                color: colorPalette[Math.floor(Math.random() * colorPalette.length)], // Random color from palette
                shape: 'sphere',
                material: 'phong',
                size: 4,
                x: (Math.random() - 0.5) * 300,
                y: (Math.random() - 0.5) * 300,
                z: (Math.random() - 0.5) * 300
            });
        }
        
        // Create random connections
        for (let i = 0; i < nodeCount * 1.5; i++) {
            const source = Math.floor(Math.random() * nodeCount);
            const target = Math.floor(Math.random() * nodeCount);
            if (source !== target) {
                links.push({
                    source: `node-${source}`,
                    target: `node-${target}`
                });
            }
        }
        
        return { nodes, links };
    }
};

// Type declarations for window
declare global {
    interface Window {
        CytoQuery: {
            createDemoGraph: (containerId: string, graphData: GraphData, parameters?: Partial<GraphParameters>) => any;
            generateSampleData: (nodeCount?: number) => GraphData;
        };
    }
}