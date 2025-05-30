import { App, MarkdownView } from 'obsidian';
import { formatParameters, parseParametersAndQuery } from '../query';
import { GraphParameters } from '../types/graph';

export function saveParametersToCodeBlock(
    app: App,
    ctx: any,
    codeBlockElement: HTMLElement | undefined,
    currentParams: GraphParameters,
    lockedNodes: Set<string>,
    graphData: any
): boolean {
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
                const nodes = graphData.nodes;
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
                
                return true;
            }
        }
    }
    return false;
}