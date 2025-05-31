import {
	App,
	Plugin,
	PluginSettingTab,
	Setting
} from 'obsidian';
import { init3DForceGraph } from './graph/force-graph-manager';

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
			const div = el.createDiv({ cls: 'force-graph-3d', attr: { id: randomId } });

			// Pass the source as query text (convert cytoquery to 3d-force-graph)
			setTimeout(() => this.init3DForceGraph(randomId, source, el), 0);
		});

		this.registerMarkdownCodeBlockProcessor('3d-force-graph', (source, el, ctx) => {
			// Generate a random id
			const randomId = Math.random().toString(36).substring(2, 15);
			const div = el.createDiv({ cls: 'force-graph-3d', attr: { id: randomId } });

			// Pass the source and element for updating
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
