import { GraphParameters } from '../types/graph';
import { SerializedHyperdimensionData } from '../types/hyperdimensions';

function parseHyperdimensions(lines: string[], startIndex: number): { data: SerializedHyperdimensionData, endIndex: number } {
    const data: SerializedHyperdimensionData = {
        spatialSystems: [],
        axes: [],
        nodePositions: [],
        axisMapping: { xAxis: null, yAxis: null, zAxis: null }
    };
    
    let i = startIndex;
    let currentSubsection: string | null = null;
    let currentItem: any = null;
    let currentPositions: any[] = [];
    
    while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trim();
        const indentLevel = line.length - line.trimStart().length;
        
        // Check if we've moved back to a higher level (end of hyperdimensions section)
        if (indentLevel === 0 && trimmed.endsWith(':')) {
            break;
        }
        
        // Subsection headers (2 spaces)
        if (indentLevel === 2 && trimmed.endsWith(':')) {
            // Save any pending item
            if (currentItem) {
                if (currentSubsection === 'spatialSystems') {
                    data.spatialSystems.push(currentItem);
                } else if (currentSubsection === 'axes') {
                    data.axes.push(currentItem);
                } else if (currentSubsection === 'nodePositions') {
                    currentItem.positions = currentPositions;
                    data.nodePositions.push(currentItem);
                    currentPositions = [];
                }
                currentItem = null;
            }
            
            currentSubsection = trimmed.slice(0, -1);
        }
        // List items (4 spaces, starts with -)
        else if (indentLevel === 4 && trimmed.startsWith('- ')) {
            // Save previous item if any
            if (currentItem) {
                if (currentSubsection === 'spatialSystems') {
                    data.spatialSystems.push(currentItem);
                } else if (currentSubsection === 'axes') {
                    data.axes.push(currentItem);
                } else if (currentSubsection === 'nodePositions') {
                    currentItem.positions = currentPositions;
                    data.nodePositions.push(currentItem);
                    currentPositions = [];
                }
            }
            
            currentItem = {};
            // Check if there's an inline property
            const afterDash = trimmed.substring(2).trim();
            if (afterDash.includes(':')) {
                const [key, value] = afterDash.split(':').map(s => s.trim());
                currentItem[key] = value;
            }
        }
        // Properties of current item (6+ spaces)
        else if (indentLevel >= 6 && currentItem && trimmed.includes(':')) {
            const [key, value] = trimmed.split(':').map(s => s.trim());
            
            if (key === 'positions' && currentSubsection === 'nodePositions') {
                // Special handling for positions array
            } else if (indentLevel === 8 && trimmed.startsWith('- ') && currentSubsection === 'nodePositions') {
                // Position array item
                const posItem: any = {};
                const afterDash = trimmed.substring(2).trim();
                if (afterDash.includes(':')) {
                    const [k, v] = afterDash.split(':').map(s => s.trim());
                    posItem[k] = v;
                }
                currentPositions.push(posItem);
            } else if (indentLevel === 10 && currentPositions.length > 0) {
                // Property of position item
                const lastPos = currentPositions[currentPositions.length - 1];
                if (key === 'value') {
                    lastPos[key] = Number(value);
                } else {
                    lastPos[key] = value;
                }
            } else if (key === 'bounds' && currentSubsection === 'axes') {
                currentItem.bounds = {};
            } else if (indentLevel === 8 && currentItem.bounds !== undefined) {
                // Bounds properties
                currentItem.bounds[key] = Number(value);
            } else {
                // Regular property
                if (value === 'null') {
                    currentItem[key] = null;
                } else if (!isNaN(Number(value))) {
                    currentItem[key] = Number(value);
                } else {
                    currentItem[key] = value.replace(/['"]/g, '');
                }
            }
        }
        // Axis mapping properties (4 spaces)
        else if (indentLevel === 4 && currentSubsection === 'axisMapping' && trimmed.includes(':')) {
            const [key, value] = trimmed.split(':').map(s => s.trim());
            if (key && (key === 'xAxis' || key === 'yAxis' || key === 'zAxis')) {
                data.axisMapping[key] = value === 'null' ? null : value;
            }
        }
        
        i++;
    }
    
    // Save any final pending item
    if (currentItem) {
        if (currentSubsection === 'spatialSystems') {
            data.spatialSystems.push(currentItem);
        } else if (currentSubsection === 'axes') {
            data.axes.push(currentItem);
        } else if (currentSubsection === 'nodePositions') {
            currentItem.positions = currentPositions;
            data.nodePositions.push(currentItem);
        }
    }
    
    return { data, endIndex: i };
}

export function parseParametersAndQuery(source: string): { parameters: GraphParameters, query: string } {
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
            if (currentSection === 'hyperdimensions') {
                // Parse hyperdimensions separately
                const result = parseHyperdimensions(parameterLines, i + 1);
                parameters.hyperdimensions = result.data;
                i = result.endIndex - 1; // -1 because loop will increment
                currentSection = null;
            } else if (currentSection !== 'lockedNodes') {
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

export function formatParameters(params: GraphParameters): string {
    const lines: string[] = ['---'];
    
    const sections: (keyof GraphParameters)[] = ['force', 'dag', 'nodeStyle', 'linkStyle', 'bloom', 'interaction', 'performance', 'ui'];
    
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
    
    
    // Handle hyperdimensions separately
    if (params.hyperdimensions) {
        lines.push('hyperdimensions:');
        const hyper = params.hyperdimensions;
        
        // Spatial systems
        if (hyper.spatialSystems && hyper.spatialSystems.length > 0) {
            lines.push('  spatialSystems:');
            for (const system of hyper.spatialSystems) {
                lines.push(`    - id: ${system.id}`);
                lines.push(`      name: ${system.name}`);
                if (system.description) {
                    lines.push(`      description: ${system.description}`);
                }
            }
        }
        
        // Axes
        if (hyper.axes && hyper.axes.length > 0) {
            lines.push('  axes:');
            for (const axis of hyper.axes) {
                lines.push(`    - id: ${axis.id}`);
                lines.push(`      spatialSystemId: ${axis.spatialSystemId}`);
                lines.push(`      name: ${axis.name}`);
                if (axis.description) {
                    lines.push(`      description: ${axis.description}`);
                }
                if (axis.bounds) {
                    lines.push(`      bounds:`);
                    if (axis.bounds.min !== undefined) {
                        lines.push(`        min: ${axis.bounds.min}`);
                    }
                    if (axis.bounds.max !== undefined) {
                        lines.push(`        max: ${axis.bounds.max}`);
                    }
                }
            }
        }
        
        // Node positions
        if (hyper.nodePositions && hyper.nodePositions.length > 0) {
            lines.push('  nodePositions:');
            for (const nodePos of hyper.nodePositions) {
                lines.push(`    - nodeId: ${nodePos.nodeId}`);
                lines.push(`      positions:`);
                for (const pos of nodePos.positions) {
                    lines.push(`        - axisId: ${pos.axisId}`);
                    lines.push(`          value: ${pos.value}`);
                }
            }
        }
        
        // Axis mapping
        if (hyper.axisMapping) {
            lines.push('  axisMapping:');
            lines.push(`    xAxis: ${hyper.axisMapping.xAxis || 'null'}`);
            lines.push(`    yAxis: ${hyper.axisMapping.yAxis || 'null'}`);
            lines.push(`    zAxis: ${hyper.axisMapping.zAxis || 'null'}`);
        }
    }
    
    lines.push('---');
    return lines.join('\n');
}