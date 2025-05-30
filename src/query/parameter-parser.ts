import { GraphParameters } from '../types/graph';

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

export function formatParameters(params: GraphParameters): string {
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