import {
	App,
	CachedMetadata,
	Editor,
	getLinkpath,
	MarkdownView,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting, TFile, TagCache
} from 'obsidian';
import cytoscape from "cytoscape";
import fcose from "cytoscape-fcose";
import dagre from "cytoscape-dagre";
import cise from "cytoscape-cise";
import ForceGraph3D from "3d-force-graph";
import * as THREE from "three";
import { UnrealBloomPass } from 'UnrealBloomPass';

cytoscape.use( cise );
cytoscape.use( dagre );
cytoscape.use( fcose );

interface Node {
	id: string;
	label: string;
	color?: string; // Optional color property for styling
}

interface Edge {
	id: string;
	source: string;
	target: string;
}

class NodeSet {
	private nodes = new Map<string, Node>();

	add(node: Node): void {
		this.nodes.set(node.id, node);
	}

	has(id: string): boolean {
		return this.nodes.has(id);
	}

	values(): Node[] {
		return Array.from(this.nodes.values());
	}

	get size(): number {
		return this.nodes.size;
	}
}

class EdgeSet {
	private edges = new Map<string, Edge>();
	private counter = 0;

	add(edge: Edge): void {
		this.edges.set(edge.id, edge);
	}

	addSourceTarget(source: string, target: string): void {
		const id = `edge-${this.counter++}`;
		this.edges.set(id, { id, source, target });
	}

	values(): Edge[] {
		return Array.from(this.edges.values());
	}

	get size(): number {
		return this.edges.size;
	}
}

// Query language types and interfaces
interface QueryRule {
    condition: (node: Node, metadata: Map<string, CachedMetadata>) => boolean;
    action: (node: Node) => void;
}

// Query language parser
class QueryParser {
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
            // Parse lines like: link_to("daily") => color(red) or color("#FF0000")
            const match = line.match(/^(\w+)\(["'](.+)["']\)\s*=>\s*(\w+)\(["']?(.+?)["']?\).*$/);
            if (match) {
                const [_, conditionType, conditionValue, actionType, actionValue] = match;

                // Create the rule based on condition type
                let rule: QueryRule | null = null;

                if (conditionType === 'link_to') {
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
        if (actionType === 'color') {
            // Remove quotes if present
            const color = actionValue.replace(/["']/g, '');
            node.color = color;
        }
        // Add more action types as needed
    }
}

interface CytoQuerySettings {
	mySetting: string;
	publicMode: boolean;
}

const DEFAULT_SETTINGS: CytoQuerySettings = {
	mySetting: 'default',
	publicMode: false
}

export default class CytoQuery extends Plugin {
	settings: CytoQuerySettings;
	private graphInstances: Map<string, any> = new Map();
	private mutationObserver: MutationObserver;

	async onload() {
		await this.loadSettings();

		// Add settings tab
		this.addSettingTab(new CytoQuerySettingTab(this.app, this));

		// Initialize MutationObserver to watch for removed elements
		this.setupMutationObserver();

		this.registerMarkdownCodeBlockProcessor('cytoquery', (source, el, _) => {
			// Generate a random id
			const randomId = Math.random().toString(36).substring(2, 15);
			const div = el.createDiv({ cls: 'cytoquery', attr: { id: randomId } });

			// Pass the source as query text
			setTimeout(() => this.initCytoscape(randomId, source), 0);
		});

		this.registerMarkdownCodeBlockProcessor('3d-force-graph', (source, el, _) => {
			// Generate a random id
			const randomId = Math.random().toString(36).substring(2, 15);
			const div = el.createDiv({ cls: 'force-graph-3d', attr: { id: randomId } });

			// Pass the source as query text
			setTimeout(() => this.init3DForceGraph(randomId, source), 0);
		});


	}

	onunload() {
		// Clean up all graph instances
		this.cleanupAllGraphs();

		// Disconnect the mutation observer
		if (this.mutationObserver) {
			this.mutationObserver.disconnect();
		}
	}

	private cleanupAllGraphs() {
		for (const [containerId, graph] of this.graphInstances.entries()) {
			this.cleanupGraph(containerId, graph);
		}
		this.graphInstances.clear();
	}

	private cleanupGraph(containerId: string, graph: any) {
		try {
			if (graph._destructor) {
				// For 3D-force-graph
				graph._destructor();
			} else if (graph.destroy) {
				// For cytoscape
				graph.destroy();
			}
		} catch (error) {
			console.error(`Error cleaning up graph ${containerId}:`, error);
		}
	}

	private setupMutationObserver() {
		// Create a mutation observer to watch for removed elements
		this.mutationObserver = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				if (mutation.type === 'childList' && mutation.removedNodes.length > 0) {
					// Check if any of the removed nodes contain graph containers
					for (const removedNode of Array.from(mutation.removedNodes)) {
						if (removedNode instanceof HTMLElement) {
							// Check if this element is a graph container
							const containerId = removedNode.id;
							if (this.graphInstances.has(containerId)) {
								const graph = this.graphInstances.get(containerId);
								this.cleanupGraph(containerId, graph);
								this.graphInstances.delete(containerId);
								continue;
							}

							// Check if this element contains any graph containers
							const containers = removedNode.querySelectorAll('.cytoquery, .force-graph-3d');
							for (const container of Array.from(containers)) {
								const containerId = container.id;
								if (this.graphInstances.has(containerId)) {
									const graph = this.graphInstances.get(containerId);
									this.cleanupGraph(containerId, graph);
									this.graphInstances.delete(containerId);
								}
							}
						}
					}
				}
			}
		});

		// Start observing the document with the configured parameters
		this.mutationObserver.observe(document.body, { 
			childList: true,
			subtree: true
		});
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	generateRandomStringFromSeed(input: string, length?: number): string {
		const outputLength = length ?? input.length;

		let seed = 0;
		for (let i = 0; i < input.length; i++) {
			seed = ((seed << 5) - seed) + input.charCodeAt(i);
			seed = seed & seed;
		}

		const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		let result = '';

		let currentSeed = Math.abs(seed);

		for (let i = 0; i < outputLength; i++) {
			const a = 1664525;
			const c = 1013904223;
			const m = Math.pow(2, 32);

			currentSeed = (a * currentSeed + c) % m;

			const randomIndex = Math.floor((currentSeed / m) * chars.length);
			result += chars[randomIndex];
		}

		return result;
	}

	private initCytoscape(containerId: string, queryText: string = ''): void {
		// Check if there's an existing graph for this container and dispose of it
		if (this.graphInstances.has(containerId)) {
			const existingGraph = this.graphInstances.get(containerId);
			existingGraph.destroy();
			this.graphInstances.delete(containerId);
		}

		var cy = cytoscape({container: document.getElementById(containerId),
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
		],});
		const files = this.app.vault.getMarkdownFiles();
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

			let meta: CachedMetadata | null = this.app.metadataCache.getFileCache(file);
			if (meta) {
				// Store metadata for query processing
				metadataMap.set(file.path, meta);

				if (meta.links) {
					for (let link of meta.links) {
						let linkPath = getLinkpath(link.link);
						let target: TFile | null = this.app.metadataCache.getFirstLinkpathDest(linkPath, file.path);

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
								const targetMeta = this.app.metadataCache.getFileCache(target);
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
				label: true ? this.generateRandomStringFromSeed(node.label) : node.label,
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
		this.graphInstances.set(containerId, cy);
	}

	private init3DForceGraph(containerId: string, queryText: string = ''): void {
		const container = document.getElementById(containerId);
		if (!container) return;

		// Check if there's an existing graph for this container and dispose of it
		if (this.graphInstances.has(containerId)) {
			const existingGraph = this.graphInstances.get(containerId);
			// For 3D-force-graph, we need to dispose of the THREE.js resources
			if (existingGraph._destructor) {
				existingGraph._destructor();
			}
			this.graphInstances.delete(containerId);
		}

		const files = this.app.vault.getMarkdownFiles();
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

			let meta: CachedMetadata | null = this.app.metadataCache.getFileCache(file);
			if (meta) {
				// Store metadata for query processing
				metadataMap.set(file.path, meta);

				if (meta.links) {
					for (let link of meta.links) {
						let linkPath = getLinkpath(link.link);
						let target: TFile | null = this.app.metadataCache.getFirstLinkpathDest(linkPath, file.path);

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
								const targetMeta = this.app.metadataCache.getFileCache(target);
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
				name: this.settings.publicMode ? this.generateRandomStringFromSeed(node.id) : node.label,
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
			.linkWidth(1)
			.linkDirectionalArrowLength(3.5)
			.linkDirectionalArrowRelPos(1)
			.graphData(graphData);

		const bloomPass = new UnrealBloomPass( new THREE.Vector2( container.innerWidth, container.innerHeight  ), 1.5, 0.4, 0.85 );
		bloomPass.strength = 4.5;
		bloomPass.radius = 1;
		bloomPass.threshold=0.0;
		Graph.postProcessingComposer().addPass(bloomPass);

 	// Store the graph instance for later cleanup
 	this.graphInstances.set(containerId, Graph);
 	}
 }

 class CytoQuerySettingTab extends PluginSettingTab {
 	plugin: CytoQuery;

 	constructor(app: App, plugin: CytoQuery) {
 		super(app, plugin);
 		this.plugin = plugin;
 	}

 	display(): void {
 		const {containerEl} = this;

 		containerEl.empty();

 		containerEl.createEl('h2', {text: 'CytoQuery Settings'});

 		new Setting(containerEl)
 			.setName('Public Mode')
 			.setDesc('Hide node names in graphs for public sharing (replaces names with internal IDs)')
 			.addToggle(toggle => toggle
 				.setValue(this.plugin.settings.publicMode)
 				.onChange(async (value) => {
 					this.plugin.settings.publicMode = value;
 					await this.plugin.saveSettings();
 				}));
 	}
 }
