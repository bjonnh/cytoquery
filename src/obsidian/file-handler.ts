import { App, TFile } from 'obsidian';

export async function openFileInNewTab(app: App, nodeId: string, publicMode: boolean): Promise<void> {
    // In public mode, we don't open the actual file
    if (publicMode) {
        return;
    }

    // Check if this is an actual file
    const file = app.vault.getAbstractFileByPath(nodeId);
    if (file && file instanceof TFile) {
        // Open existing file in new tab
        const leaf = app.workspace.getLeaf(true);
        await leaf.openFile(file);
    } else {
        // For non-existent links, create a new note
        const leaf = app.workspace.getLeaf(true);
        // Use the nodeId as the file name (it's the link text)
        const fileName = nodeId.endsWith('.md') ? nodeId : `${nodeId}.md`;
        try {
            // Create the file
            const newFile = await app.vault.create(fileName, '');
            // Open it
            await leaf.openFile(newFile);
        } catch (error) {
            // If creation fails (e.g., invalid file name), just create an empty leaf
        }
    }
}