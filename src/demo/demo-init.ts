// Demo initialization using the core graph abstraction layer
import { GraphData, GraphParameters } from '../types/graph';
import { initGraph, GraphPlatformAdapter } from '../graph/graph-core';

export function initDemoGraph(
    containerId: string,
    graphData: GraphData,
    parameters: Partial<GraphParameters> = {}
): any {
    // Create demo platform adapter
    const demoAdapter: GraphPlatformAdapter = {
        openPage: async (nodeId: string) => {
            console.log(`Demo: Would open page for node ${nodeId}`);
        },
        saveParameters: () => {
            console.log('Demo: Save parameters not implemented');
            return true;
        },
        publicMode: false
    };

    // Convert partial parameters to source text format for parsing
    const sourceText = generateSourceText(parameters);

    // Track graph instances for cleanup
    const graphInstances = new Map<string, any>();

    // Use the core graph initialization
    initGraph(containerId, graphData, sourceText, demoAdapter, graphInstances);

    // Return the graph instance for compatibility
    return graphInstances.get(containerId);
}

// Helper function to convert parameters to source text format
function generateSourceText(parameters: Partial<GraphParameters>): string {
    const lines: string[] = [];
    
    if (parameters.force) {
        if (parameters.force.alphaDecay !== undefined) {
            lines.push(`force.alphaDecay: ${parameters.force.alphaDecay}`);
        }
        if (parameters.force.velocityDecay !== undefined) {
            lines.push(`force.velocityDecay: ${parameters.force.velocityDecay}`);
        }
        if (parameters.force.alphaMin !== undefined) {
            lines.push(`force.alphaMin: ${parameters.force.alphaMin}`);
        }
    }
    
    if (parameters.dag) {
        if (parameters.dag.mode) {
            lines.push(`dag.mode: ${parameters.dag.mode}`);
        }
        if (parameters.dag.levelDistance !== undefined) {
            lines.push(`dag.levelDistance: ${parameters.dag.levelDistance}`);
        }
    }
    
    if (parameters.nodeStyle) {
        if (parameters.nodeStyle.size !== undefined) {
            lines.push(`nodeStyle.size: ${parameters.nodeStyle.size}`);
        }
        if (parameters.nodeStyle.opacity !== undefined) {
            lines.push(`nodeStyle.opacity: ${parameters.nodeStyle.opacity}`);
        }
        if (parameters.nodeStyle.resolution !== undefined) {
            lines.push(`nodeStyle.resolution: ${parameters.nodeStyle.resolution}`);
        }
    }
    
    if (parameters.linkStyle) {
        if (parameters.linkStyle.opacity !== undefined) {
            lines.push(`linkStyle.opacity: ${parameters.linkStyle.opacity}`);
        }
        if (parameters.linkStyle.width !== undefined) {
            lines.push(`linkStyle.width: ${parameters.linkStyle.width}`);
        }
        if (parameters.linkStyle.curvature !== undefined) {
            lines.push(`linkStyle.curvature: ${parameters.linkStyle.curvature}`);
        }
        if (parameters.linkStyle.particles !== undefined) {
            lines.push(`linkStyle.particles: ${parameters.linkStyle.particles}`);
        }
        if (parameters.linkStyle.particleSpeed !== undefined) {
            lines.push(`linkStyle.particleSpeed: ${parameters.linkStyle.particleSpeed}`);
        }
    }
    
    if (parameters.bloom) {
        if (parameters.bloom.strength !== undefined) {
            lines.push(`bloom.strength: ${parameters.bloom.strength}`);
        }
        if (parameters.bloom.radius !== undefined) {
            lines.push(`bloom.radius: ${parameters.bloom.radius}`);
        }
        if (parameters.bloom.threshold !== undefined) {
            lines.push(`bloom.threshold: ${parameters.bloom.threshold}`);
        }
    }
    
    if (parameters.interaction) {
        if (parameters.interaction.enableDrag !== undefined) {
            lines.push(`interaction.enableDrag: ${parameters.interaction.enableDrag}`);
        }
    }
    
    if (parameters.performance) {
        if (parameters.performance.warmupTicks !== undefined) {
            lines.push(`performance.warmupTicks: ${parameters.performance.warmupTicks}`);
        }
        if (parameters.performance.cooldownTicks !== undefined) {
            lines.push(`performance.cooldownTicks: ${parameters.performance.cooldownTicks}`);
        }
        if (parameters.performance.cooldownTime !== undefined) {
            lines.push(`performance.cooldownTime: ${parameters.performance.cooldownTime}`);
        }
    }
    
    return lines.join('\n');
}