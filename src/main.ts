import {
	App,
	Plugin,
	PluginSettingTab,
	Setting
} from 'obsidian';
import { init3DForceGraph } from './graph/force-graph-manager';
import { CytoQueryView, VIEW_TYPE_CYTOQUERY } from './views/cytoquery-view';

interface CytoQuerySettings {
	mySetting: string;
	publicMode: boolean;
}

export interface CytoQueryData {
	queries?: SavedQuery[];
	activeQueryId?: string;
}

export interface SavedQuery {
	id: string;
	name: string;
	query: string;
	createdAt: number;
	modifiedAt: number;
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

		// Register the view
		this.registerView(
			VIEW_TYPE_CYTOQUERY,
			(leaf) => new CytoQueryView(leaf, this)
		);

		// Add command to open graph view
		this.addCommand({
			id: 'open-cytoquery-view',
			name: 'Open CytoQuery Graph View',
			callback: () => {
				this.activateView();
			}
		});

		// Add settings tab
		this.addSettingTab(new CytoQuerySettingTab(this.app, this));

		// Initialize MutationObserver to watch for removed elements
		this.setupMutationObserver();

		this.registerMarkdownCodeBlockProcessor('cytoquery', (source, el, ctx) => {
			// Generate a random id
			const randomId = Math.random().toString(36).substring(2, 15);
			const div = el.createDiv({ cls: 'force-graph-3d', attr: { id: randomId } });

			// Pass the source as query text (convert cytoquery to 3d-force-graph)
			setTimeout(() => this.init3DForceGraph(randomId, source, el, ctx), 0);
		});
	}

	onunload() {
		// Clean up all graph instances
		this.cleanupAllGraphs();

		// Disconnect the mutation observer
		if (this.mutationObserver) {
			this.mutationObserver.disconnect();
		}

		// Detach leaves for the view type
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_CYTOQUERY);

		// Clean up Three.js global instance to prevent multiple instances warning
		if ((window as any).THREE) {
			delete (window as any).THREE;
		}
	}

	async activateView() {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_CYTOQUERY);

		const leaf = this.app.workspace.getRightLeaf(false);
		if (leaf) {
			await leaf.setViewState({
				type: VIEW_TYPE_CYTOQUERY,
				active: true,
			});

			const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CYTOQUERY);
			if (leaves.length > 0) {
				this.app.workspace.revealLeaf(leaves[0]);
			}
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
			// Call our custom cleanup function first
			if (graph._cleanup) {
				graph._cleanup();
			} else if (graph._destructor) {
				// Fallback to 3D-force-graph destructor
				graph._destructor();
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
							const containers = removedNode.querySelectorAll('.force-graph-3d');
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


	private init3DForceGraph(containerId: string, queryText: string = '', el?: HTMLElement, ctx?: any): void {
		init3DForceGraph(
			containerId, 
			queryText, 
			this.app, 
			this.graphInstances, 
			this.generateRandomStringFromSeed.bind(this), 
			this.settings.publicMode,
			el,
			ctx
		);
	}
 }

 class CytoQuerySettingTab extends PluginSettingTab {
 	plugin: CytoQuery;

 	constructor(app: App, plugin: CytoQuery) {
 		super(app, plugin);
 		this.plugin = plugin;
 	}

 	async display(): Promise<void> {
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

 		// Saved Queries Section
 		containerEl.createEl('h3', {text: 'Saved Queries'});
 		
 		const data = await this.plugin.loadData() as CytoQueryData;
 		if (data?.queries && data.queries.length > 0) {
 			const queriesContainer = containerEl.createEl('div', { cls: 'cytoquery-queries-list' });
 			
 			data.queries.forEach((query) => {
 				new Setting(queriesContainer)
 					.setName(query.name)
 					.setDesc(`Created: ${new Date(query.createdAt).toLocaleDateString()}`)
 					.addButton(button => button
 						.setButtonText('Delete')
 						.setWarning()
 						.onClick(async () => {
 							if (confirm(`Delete query "${query.name}"?`)) {
 								data.queries = data.queries!.filter(q => q.id !== query.id);
 								if (data.activeQueryId === query.id) {
 									delete data.activeQueryId;
 								}
 								await this.plugin.saveData(data);
 								this.display(); // Refresh the settings
 							}
 						}));
 			});
 		} else {
 			containerEl.createEl('p', {
 				text: 'No saved queries yet. Open the CytoQuery Graph View to create queries.',
 				cls: 'setting-item-description'
 			});
 		}

 		// Add button to open the view
 		new Setting(containerEl)
 			.addButton(button => button
 				.setButtonText('Open CytoQuery View')
 				.setCta()
 				.onClick(() => {
 					this.plugin.activateView();
 				}));
 	}
 }
