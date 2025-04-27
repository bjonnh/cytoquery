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
	Setting, TFile
} from 'obsidian';
import cytoscape from "cytoscape";
import fcose from "cytoscape-fcose";
import dagre from "cytoscape-dagre";
import cise from "cytoscape-cise";
import ForceGraph3D from "3d-force-graph";
import * as THREE from "three";


cytoscape.use( cise );
cytoscape.use( dagre );
cytoscape.use( fcose );

interface Node {
	id: string;
	label: string;
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

interface CytoQuerySettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: CytoQuerySettings = {
	mySetting: 'default'
}

export default class CytoQuery extends Plugin {
	settings: CytoQuerySettings;

	async onload() {
		await this.loadSettings();

		this.registerMarkdownCodeBlockProcessor('cytoquery', (source, el, _) => {
			// Generate a random id
			const randomId = Math.random().toString(36).substring(2, 15);
			const div = el.createDiv({ cls: 'cytoquery', attr: { id: randomId } });
			//const notes = source.split(' ').filter(Boolean);

			setTimeout(() => this.initCytoscape(randomId), 0);
		});

		this.registerMarkdownCodeBlockProcessor('3d-force-graph', (source, el, _) => {
			// Generate a random id
			const randomId = Math.random().toString(36).substring(2, 15);
			const div = el.createDiv({ cls: 'force-graph-3d', attr: { id: randomId } });

			setTimeout(() => this.init3DForceGraph(randomId), 0);
		});

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('dice', 'Sample Plugin', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new Notice('This is a notice!');
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status Bar Text');

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-sample-modal-simple',
			name: 'Open sample modal (simple)',
			callback: () => {
				new SampleModal(this.app).open();
			}
		});
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'sample-editor-command',
			name: 'Sample editor command',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection('Sample Editor Command');
			}
		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-sample-modal-complex',
			name: 'Open sample modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new SampleModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private initCytoscape(containerId: string): void {
		var cy = cytoscape({container: document.getElementById(containerId),
		style: [ // the stylesheet for the graph
			{
				selector: 'node',
				style: {
					'background-color': '#666',
					'label': 'data(label)'
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

		// Process all files
		for (let file of files) {
			// Add file as node - use basename as label
			nodeSet.add({
				id: file.path,
				label: file.basename
			});

			let meta: CachedMetadata | null = this.app.metadataCache.getFileCache(file);
			if (meta && meta.links) {
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

		// Transform nodes and edges into cytoscape.js objects
		const cyNodes = nodeSet.values().map(node => ({
			data: { 
				id: node.id,
				label: node.label
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
	}

	private init3DForceGraph(containerId: string): void {
		const container = document.getElementById(containerId);
		if (!container) return;

		const files = this.app.vault.getMarkdownFiles();
		// Create custom sets for nodes and edges
		const nodeSet = new NodeSet();
		const edgeSet = new EdgeSet();

		// Process all files
		for (let file of files) {
			// Add file as node - use basename as label
			nodeSet.add({
				id: file.path,
				label: file.basename
			});

			let meta: CachedMetadata | null = this.app.metadataCache.getFileCache(file);
			if (meta && meta.links) {
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

		// Transform nodes and edges into 3D force graph format
		const graphNodes = nodeSet.values().map(node => ({
			id: node.id,
			name: node.label,
			val: 1
		}));

		const graphLinks = edgeSet.values().map(edge => ({
			source: edge.source,
			target: edge.target
		}));

		const graphData = {
			nodes: graphNodes,
			links: graphLinks
		};

		// Initialize the 3D force graph
		const Graph = ForceGraph3D();

		// Set the graph in the container and configure it
		Graph(container)
			.backgroundColor('rgba(255, 255, 255, 0.8)')
			.nodeLabel('name')
			.nodeColor(() => '#666')
			.linkColor(() => '#ccc')
			.linkWidth(1)
			.linkDirectionalArrowLength(3.5)
			.linkDirectionalArrowRelPos(1)
			.graphData(graphData);
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: CytoQuery;

	constructor(app: App, plugin: CytoQuery) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Setting #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));
	}
}
