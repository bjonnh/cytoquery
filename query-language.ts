import { CachedMetadata } from 'obsidian';
import { Node, EdgeSet } from './utils';

// Query language types and interfaces
export interface QueryRule {
    condition: (node: Node, metadata: Map<string, CachedMetadata>) => boolean;
    action: (node: Node) => void;
}

// Query language parser
export class QueryParser {
    private rules: QueryRule[] = [];
    private metadata: Map<string, CachedMetadata>;
    private edges: EdgeSet;

    constructor(metadata: Map<string, CachedMetadata>, edges: EdgeSet) {
        this.metadata = metadata;
        this.edges = edges;
    }

    parseQuery(queryText: string): void {
        // Clear existing rules
        this.rules = [];

        // Split the query into lines and process each line
        const lines = queryText.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
            // Parse lines like: link_to("daily") => color(red) or default => color("#FF0000")
            const match = line.match(/^(\w+)(?:\(["'](.+?)["']\))?\s*=>\s*(\w+)\(["']?(.+?)["']?\).*$/);
            if (match) {
                const [_, conditionType, conditionValue, actionType, actionValue] = match;

                // Create the rule based on condition type
                let rule: QueryRule | null = null;

                if (conditionType === 'default') {
                    rule = {
                        condition: () => true, // Always matches
                        action: (node) => this.applyAction(node, actionType, actionValue)
                    };
                } else if (conditionType === 'link_to') {
                    rule = {
                        condition: (node, metadata) => this.link_to(node, conditionValue, metadata),
                        action: (node) => this.applyAction(node, actionType, actionValue)
                    };
                } else if (conditionType === 'link_from') {
                    rule = {
                        condition: (node, metadata) => this.link_from(node, conditionValue, metadata),
                        action: (node) => this.applyAction(node, actionType, actionValue)
                    };
                } else if (conditionType === 'link') {
                    rule = {
                        condition: (node, metadata) => this.link(node, conditionValue, metadata),
                        action: (node) => this.applyAction(node, actionType, actionValue)
                    };
                } else if (conditionType === 'tag') {
                    rule = {
                        condition: (node, metadata) => this.hasTag(node, conditionValue, metadata),
                        action: (node) => this.applyAction(node, actionType, actionValue)
                    };
                }

                if (rule) {
                    this.rules.push(rule);
                }
            }
        }
    }

    applyRules(nodes: Node[]): void {
        // Apply default rules first
        for (const node of nodes) {
            for (const rule of this.rules) {
                if (rule.condition(node, this.metadata)) {
                    rule.action(node);
                }
            }
        }
    }

    private link_to(node: Node, targetName: string, metadata: Map<string, CachedMetadata>): boolean {
        // Use the edges instead of querying metadata
        return this.edges.values().some(edge => {
            // Check if the current node is the source of any edge
            if (edge.source === node.id) {
                // Get the target node's label (usually the basename)
                const targetId = edge.target;
                const targetLabel = targetId.split('/').pop()?.replace('.md', '') || targetId;
                // Check if the target's label includes the targetName
                return targetLabel.toLowerCase() === targetName.toLowerCase();
            }
            return false;
        });
    }

    private link_from(node: Node, targetName: string, metadata: Map<string, CachedMetadata>): boolean {
        // Use the edges instead of querying metadata
        return this.edges.values().some(edge => {
            // Check if the current node is the target of any edge
            if (edge.target === node.id) {
                // If targetName is provided, check if the source matches
                if (targetName) {
                    // Get the source node's label (usually the basename)
                    const sourceId = edge.source;
                    const sourceName = sourceId.split('/').pop()?.replace('.md', '') || sourceId;
                    return sourceName.toLowerCase() === targetName.toLowerCase();
                } else {
                    return true;
                }
            }
            return false;
        });
    }

    private link(node: Node, targetName: string, metadata: Map<string, CachedMetadata>): boolean {
        // Check for links to or from the node
        return this.link_to(node, targetName, metadata) || this.link_from(node, targetName, metadata);
    }

    private hasTag(node: Node, tagName: string, metadata: Map<string, CachedMetadata>): boolean {
        const meta = metadata.get(node.id);
        if (!meta) return false;

        if (meta.frontmatter && meta.frontmatter["tags"]) {
            return meta.frontmatter["tags"].some((tag: string) =>
                tag && (tag.toLowerCase() === tagName.toLowerCase() ||
                    tag.toLowerCase() === '#' + tagName.toLowerCase())
            )
        }

        if (!meta.tags) return false;

        return meta.tags.some(tag =>
            tag.tag.toLowerCase() === tagName.toLowerCase() ||
            tag.tag.toLowerCase() === '#' + tagName.toLowerCase()
        );
    }

    private applyAction(node: Node, actionType: string, actionValue: string): void {
        // Remove quotes if present
        const cleanValue = actionValue.replace(/["']/g, '').toLowerCase();
        
        if (actionType === 'color') {
            node.color = actionValue.replace(/["']/g, '');
        } else if (actionType === 'shape') {
            // Validate shape values
            const validShapes = ['sphere', 'cube', 'cylinder', 'cone', 'torus', 'tetrahedron', 'octahedron', 'dodecahedron', 'icosahedron'];
            if (validShapes.includes(cleanValue)) {
                node.shape = cleanValue as any;
            }
        } else if (actionType === 'material' || actionType === 'texture') {
            // Validate material values
            const validMaterials = ['default', 'glass', 'metal', 'plastic'];
            if (validMaterials.includes(cleanValue)) {
                node.material = cleanValue as any;
            }
        } else if (actionType === 'size') {
            // Parse size as a number
            const sizeValue = parseFloat(actionValue.replace(/["']/g, ''));
            if (!isNaN(sizeValue) && sizeValue > 0) {
                // Clamp size between 0.1 and 10 for reasonable limits
                node.size = Math.max(0.1, Math.min(10, sizeValue));
            }
        }
    }
}
