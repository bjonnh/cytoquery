import { ItemView, WorkspaceLeaf, Menu, Notice } from 'obsidian';
import type CytoQuery from '../main';
import type { SavedQuery, CytoQueryData } from '../main';
import { init3DForceGraph } from '../graph/force-graph-manager';

export const VIEW_TYPE_CYTOQUERY = 'cytoquery-graph-view';

export class CytoQueryView extends ItemView {
    plugin: CytoQuery;
    graphContainer: HTMLElement;
    editorContainer: HTMLElement;
    contentContainer: HTMLElement;
    graphInstance: any;
    graphInstancesMap: Map<string, any> = new Map();
    currentQuery: SavedQuery | null = null;
    editor: HTMLTextAreaElement;
    statusBar: HTMLElement;
    editorVisible: boolean = false; // Start with editor hidden
    graphVisible: boolean = true;

    constructor(leaf: WorkspaceLeaf, plugin: CytoQuery) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType() {
        return VIEW_TYPE_CYTOQUERY;
    }

    getDisplayText() {
        return this.currentQuery ? `CytoQuery: ${this.currentQuery.name}` : 'CytoQuery Graph';
    }

    getIcon() {
        return 'git-fork';
    }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();
        container.addClass('cytoquery-view');

        // Create layout
        const mainContainer = container.createDiv('cytoquery-main-container');
        
        // Create toolbar
        const toolbar = mainContainer.createDiv('cytoquery-toolbar');
        this.createToolbar(toolbar);

        // Create split view
        this.contentContainer = mainContainer.createDiv('cytoquery-content');
        
        // Editor panel
        this.editorContainer = this.contentContainer.createDiv('cytoquery-editor-panel');
        this.createEditorPanel();

        // Graph panel
        this.graphContainer = this.contentContainer.createDiv('cytoquery-graph-panel');
        
        // Status bar
        this.statusBar = mainContainer.createDiv('cytoquery-status-bar');
        this.updateStatus('Ready');

        // Load saved queries
        await this.loadSavedQueries();

        // Restore panel visibility state
        const state = this.leaf.getViewState();
        if (state.state) {
            // Only toggle if state differs from default
            if (state.state.editorHidden === false && !this.editorVisible) {
                this.toggleEditorPanel();
            } else if (state.state.editorHidden === true && this.editorVisible) {
                this.toggleEditorPanel();
            }
            // Graph is always visible
        } else {
            // Apply default state (editor hidden)
            if (this.editorVisible) {
                this.toggleEditorPanel();
            }
        }
        
        // Run empty query by default to show graph
        this.runQuery();
    }

    createToolbar(toolbar: HTMLElement) {
        // Query selector dropdown
        const querySelector = toolbar.createDiv('cytoquery-query-selector');
        const select = querySelector.createEl('select', { cls: 'dropdown' });
        select.createEl('option', { text: 'New Query', value: '' });
        
        select.addEventListener('change', async (e) => {
            const target = e.target as HTMLSelectElement;
            if (target.value) {
                await this.loadQuery(target.value);
            } else {
                await this.newQuery();
            }
        });

        // Buttons
        const buttons = toolbar.createDiv('cytoquery-buttons');
        
        const saveBtn = buttons.createEl('button', { 
            cls: 'cytoquery-icon-button mod-cta',
            title: 'Save query (Ctrl/Cmd+S)'
        });
        saveBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>';
        saveBtn.addEventListener('click', () => this.saveQuery());

        const saveAsBtn = buttons.createEl('button', { 
            cls: 'cytoquery-icon-button',
            title: 'Save as new query'
        });
        saveAsBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4zM21 12v7c0 1.1-.9 2-2 2H7.5L12 16.5V19h7V12h2z"/></svg>';
        saveAsBtn.addEventListener('click', () => this.saveQueryAs());

        const deleteBtn = buttons.createEl('button', { 
            cls: 'cytoquery-icon-button mod-warning',
            title: 'Delete query'
        });
        deleteBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>';
        deleteBtn.addEventListener('click', () => this.deleteQuery());

        const runBtn = buttons.createEl('button', { 
            cls: 'cytoquery-icon-button mod-cta',
            title: 'Run query (Ctrl/Cmd+Enter)'
        });
        runBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>';
        runBtn.addEventListener('click', () => this.runQuery());

        // Export/Import
        const exportBtn = buttons.createEl('button', { 
            cls: 'cytoquery-icon-button',
            title: 'Export to code block'
        });
        exportBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2z"/></svg>';
        exportBtn.addEventListener('click', () => this.exportToCodeBlock());

        // Add spacer
        toolbar.createDiv('cytoquery-toolbar-spacer');

        // Panel visibility toggles
        const panelToggles = toolbar.createDiv('cytoquery-panel-toggles');
        
        const editorToggle = panelToggles.createEl('button', { 
            cls: 'cytoquery-panel-toggle',
            title: 'Toggle editor panel (Ctrl/Cmd+\\)'
        });
        editorToggle.innerHTML = this.editorVisible ? 
            '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>' : 
            '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>';
        editorToggle.addEventListener('click', () => this.toggleEditorPanel());
    }

    createEditorPanel() {
        const editorHeader = this.editorContainer.createDiv('cytoquery-editor-header');
        editorHeader.createEl('h3', { text: 'Query Editor' });

        this.editor = this.editorContainer.createEl('textarea', {
            cls: 'cytoquery-editor',
            placeholder: 'Enter your CytoQuery code here...\n\nExample:\ntagged("important") => color("red"), size(3)'
        });

        // Add keyboard shortcuts
        this.editor.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 's') {
                    e.preventDefault();
                    this.saveQuery();
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    this.runQuery();
                } else if (e.key === '\\') {
                    e.preventDefault();
                    this.toggleEditorPanel();
                }
            }
        });

        // Removed global keyboard shortcuts for graph toggle
    }

    async loadSavedQueries() {
        const data = await this.plugin.loadData() as CytoQueryData;
        if (data?.queries) {
            const select = this.containerEl.querySelector('select') as HTMLSelectElement;
            
            // Clear existing options except "New Query"
            while (select.options.length > 1) {
                select.remove(1);
            }

            // Add saved queries
            data.queries.forEach((query: SavedQuery) => {
                const option = select.createEl('option', {
                    text: query.name,
                    value: query.id
                });
            });

            // Load the last active query if available
            if (data.activeQueryId) {
                select.value = data.activeQueryId;
                await this.loadQuery(data.activeQueryId);
            }
        }
    }

    async newQuery() {
        this.currentQuery = null;
        this.editor.value = '';
        // Update display text via re-render
        this.app.workspace.requestSaveLayout();
        this.updateStatus('New query created');
        
        // Clear all graphs
        this.cleanupGraphs();
        this.graphContainer.empty();
    }

    async loadQuery(id: string) {
        const data = await this.plugin.loadData() as CytoQueryData;
        const query = data?.queries?.find((q: SavedQuery) => q.id === id);
        
        if (query) {
            this.currentQuery = query;
            this.editor.value = query.query;
            // Update display text via re-render
            this.app.workspace.requestSaveLayout();
            this.updateStatus(`Loaded: ${query.name}`);
            
            // Run the query automatically
            await this.runQuery();
        }
    }

    async saveQuery() {
        if (!this.editor.value.trim()) {
            new Notice('Cannot save empty query');
            return;
        }

        if (!this.currentQuery) {
            await this.saveQueryAs();
            return;
        }

        // Update existing query
        this.currentQuery.query = this.editor.value;
        this.currentQuery.modifiedAt = Date.now();

        await this.saveQueries();
        this.updateStatus(`Saved: ${this.currentQuery.name}`);
        new Notice(`Query "${this.currentQuery.name}" saved`);
    }

    async saveQueryAs() {
        if (!this.editor.value.trim()) {
            new Notice('Cannot save empty query');
            return;
        }

        const name = await this.promptForName();
        if (!name) return;

        const newQuery: SavedQuery = {
            id: Date.now().toString(),
            name,
            query: this.editor.value,
            createdAt: Date.now(),
            modifiedAt: Date.now()
        };

        this.currentQuery = newQuery;
        
        const data = await this.plugin.loadData() as CytoQueryData || { queries: [] };
        if (!data.queries) data.queries = [];
        data.queries.push(newQuery);
        data.activeQueryId = newQuery.id;
        
        await this.plugin.saveData(data);
        await this.loadSavedQueries();
        
        const select = this.containerEl.querySelector('select') as HTMLSelectElement;
        select.value = newQuery.id;
        
        // Update display text via re-render
        this.app.workspace.requestSaveLayout();
        this.updateStatus(`Created: ${name}`);
        new Notice(`Query "${name}" created`);
    }

    async deleteQuery() {
        if (!this.currentQuery) {
            new Notice('No query to delete');
            return;
        }

        const confirmed = await this.confirmDelete(this.currentQuery.name);
        if (!confirmed) return;

        const data = await this.plugin.loadData() as CytoQueryData || { queries: [] };
        if (data.queries) {
            data.queries = data.queries.filter((q: SavedQuery) => q.id !== this.currentQuery!.id);
        }
        
        if (data.activeQueryId === this.currentQuery.id) {
            delete data.activeQueryId;
        }

        await this.plugin.saveData(data);
        new Notice(`Query "${this.currentQuery.name}" deleted`);
        
        await this.newQuery();
        await this.loadSavedQueries();
    }

    async runQuery() {
        const query = this.editor.value.trim();
        // Allow empty query - it will use defaults
        
        this.updateStatus('Running query...');

        try {
            // Clean up existing graphs
            this.cleanupGraphs();
            this.graphContainer.empty();

            // Create new graph container
            const graphDiv = this.graphContainer.createDiv('cytoquery-graph-instance');
            
            // Create a unique container ID
            const containerId = `cytoquery-graph-${Date.now()}`;
            graphDiv.id = containerId;

            // Initialize the graph with the query
            init3DForceGraph(
                containerId,
                query,
                this.plugin.app,
                this.graphInstancesMap,
                (input: string) => this.plugin.generateRandomStringFromSeed(input),
                this.plugin.settings.publicMode
            );

            this.updateStatus('Query executed successfully');
        } catch (error) {
            console.error('Error running query:', error);
            this.updateStatus(`Error: ${error.message}`);
            new Notice(`Query error: ${error.message}`);
        }
    }

    exportToCodeBlock() {
        if (!this.editor.value.trim()) {
            new Notice('Nothing to export');
            return;
        }

        const codeBlock = '```cytoquery\n' + this.editor.value + '\n```';
        navigator.clipboard.writeText(codeBlock);
        new Notice('Query copied to clipboard as code block');
    }

    async saveQueries() {
        const data = await this.plugin.loadData() as CytoQueryData || { queries: [] };
        if (!data.queries) data.queries = [];
        const queryIndex = data.queries.findIndex((q: SavedQuery) => q.id === this.currentQuery!.id);
        
        if (queryIndex >= 0) {
            data.queries[queryIndex] = this.currentQuery!;
        }
        
        data.activeQueryId = this.currentQuery!.id;
        await this.plugin.saveData(data);
    }

    async promptForName(): Promise<string | null> {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.addClass('modal-container');
            
            const bg = modal.createDiv('modal-bg');
            const content = modal.createDiv('modal');
            
            content.createEl('h2', { text: 'Save Query As' });
            
            const inputContainer = content.createDiv();
            const input = inputContainer.createEl('input', {
                type: 'text',
                placeholder: 'Query name'
            });
            input.focus();
            
            const buttonContainer = content.createDiv('modal-button-container');
            
            const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
            const saveBtn = buttonContainer.createEl('button', { 
                text: 'Save',
                cls: 'mod-cta'
            });
            
            const cleanup = () => {
                modal.remove();
            };
            
            const save = () => {
                const name = input.value.trim();
                if (name) {
                    cleanup();
                    resolve(name);
                }
            };
            
            cancelBtn.addEventListener('click', () => {
                cleanup();
                resolve(null);
            });
            
            saveBtn.addEventListener('click', save);
            input.addEventListener('keydown', (e) => {
                if ((e as KeyboardEvent).key === 'Enter') save();
                if ((e as KeyboardEvent).key === 'Escape') {
                    cleanup();
                    resolve(null);
                }
            });
            
            bg.addEventListener('click', () => {
                cleanup();
                resolve(null);
            });
            
            document.body.appendChild(modal);
        });
    }

    async confirmDelete(name: string): Promise<boolean> {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.addClass('modal-container');
            
            const bg = modal.createDiv('modal-bg');
            const content = modal.createDiv('modal');
            
            content.createEl('h2', { text: 'Delete Query' });
            content.createEl('p', { text: `Are you sure you want to delete "${name}"?` });
            
            const buttonContainer = content.createDiv('modal-button-container');
            
            const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
            const deleteBtn = buttonContainer.createEl('button', { 
                text: 'Delete',
                cls: 'mod-warning'
            });
            
            const cleanup = () => modal.remove();
            
            cancelBtn.addEventListener('click', () => {
                cleanup();
                resolve(false);
            });
            
            deleteBtn.addEventListener('click', () => {
                cleanup();
                resolve(true);
            });
            
            bg.addEventListener('click', () => {
                cleanup();
                resolve(false);
            });
            
            document.body.appendChild(modal);
        });
    }

    updateStatus(message: string) {
        this.statusBar.setText(message);
    }

    toggleEditorPanel() {
        this.editorVisible = !this.editorVisible;
        if (this.editorVisible) {
            this.editorContainer.removeClass('hidden');
            this.contentContainer.removeClass('editor-hidden');
        } else {
            this.editorContainer.addClass('hidden');
            this.contentContainer.addClass('editor-hidden');
        }
        
        // Update button icon
        const button = this.containerEl.querySelector('.cytoquery-panel-toggle') as HTMLButtonElement;
        if (button) {
            button.innerHTML = this.editorVisible ? 
                '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>' : 
                '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>';
        }
        
        // Save state
        this.saveViewState();
    }

    // Removed toggleGraphPanel - graph should always be visible

    saveViewState() {
        const state = this.leaf.getViewState();
        if (!state.state) state.state = {};
        state.state.editorHidden = !this.editorVisible;
        this.leaf.setViewState(state);
    }

    cleanupGraphs() {
        for (const [containerId, graph] of this.graphInstancesMap.entries()) {
            try {
                if (graph._cleanup) {
                    graph._cleanup();
                } else if (graph._destructor) {
                    graph._destructor();
                }
            } catch (error) {
                console.error(`Error cleaning up graph ${containerId}:`, error);
            }
        }
        this.graphInstancesMap.clear();
    }

    async onClose() {
        // Clean up all graph instances
        this.cleanupGraphs();
    }
}