import { GraphParameters } from '../types/graph';

export interface UICallbacks {
    onResetView: () => void;
    onUnlockAll: () => void;
    onFindDirectedPath: () => void;
    onFindUndirectedPath: () => void;
    onClearPath: () => void;
    onSaveParameters: () => void;
    onToggleIdleRotation: () => void;
    onToggleFPSLimiter: () => void;
    onSettingsToggle: () => void;
}

export function createUIControls(container: HTMLElement, callbacks: UICallbacks): {
    buttons: {
        resetView: HTMLButtonElement;
        unlockAll: HTMLButtonElement;
        directedPath: HTMLButtonElement;
        undirectedPath: HTMLButtonElement;
        clearPath: HTMLButtonElement;
        save: HTMLButtonElement;
        idleRotation: HTMLButtonElement;
        fpsLimiter: HTMLButtonElement;
        menu: HTMLButtonElement;
    };
    containers: {
        topButtons: HTMLDivElement;
        pathButtons: HTMLDivElement;
        settingsPanel: HTMLDivElement;
    };
} {
    // Create top button container
    const topButtonsContainer = document.createElement('div');
    topButtonsContainer.className = 'graph-top-buttons';
    container.appendChild(topButtonsContainer);

    // Create reset view button
    const resetViewButton = document.createElement('button');
    resetViewButton.innerHTML = '⟲';
    resetViewButton.title = 'Reset View to Center';
    resetViewButton.className = 'graph-control-button reset-view';
    resetViewButton.onclick = callbacks.onResetView;
    topButtonsContainer.appendChild(resetViewButton);

    // Create unlock all button
    const unlockAllButton = document.createElement('button');
    unlockAllButton.innerHTML = '🔓';
    unlockAllButton.title = 'Unlock All Nodes';
    unlockAllButton.className = 'graph-control-button unlock-all';
    unlockAllButton.onclick = callbacks.onUnlockAll;
    topButtonsContainer.appendChild(unlockAllButton);

    // Create find path buttons container
    const pathButtonsContainer = document.createElement('div');
    pathButtonsContainer.className = 'path-buttons-container';
    
    // Create directed path button
    const directedPathButton = document.createElement('button');
    directedPathButton.innerHTML = '→';
    directedPathButton.title = 'Find Directed Path';
    directedPathButton.className = 'path-button';
    directedPathButton.onclick = callbacks.onFindDirectedPath;
    pathButtonsContainer.appendChild(directedPathButton);
    
    // Create undirected path button
    const undirectedPathButton = document.createElement('button');
    undirectedPathButton.innerHTML = '↔';
    undirectedPathButton.title = 'Find Undirected Path';
    undirectedPathButton.className = 'path-button';
    undirectedPathButton.onclick = callbacks.onFindUndirectedPath;
    pathButtonsContainer.appendChild(undirectedPathButton);
    
    topButtonsContainer.appendChild(pathButtonsContainer);

    // Create clear path button
    const clearPathButton = document.createElement('button');
    clearPathButton.innerHTML = '✕';
    clearPathButton.title = 'Clear Path';
    clearPathButton.className = 'clear-path-button';
    clearPathButton.onclick = callbacks.onClearPath;
    topButtonsContainer.appendChild(clearPathButton);

    // Create save parameters button
    const saveButton = document.createElement('button');
    saveButton.innerHTML = '💾';
    saveButton.title = 'Save Parameters to Code Block';
    saveButton.className = 'graph-control-button save-params';
    saveButton.onclick = callbacks.onSaveParameters;
    topButtonsContainer.appendChild(saveButton);

    // Create idle rotation button
    const idleRotationButton = document.createElement('button');
    idleRotationButton.innerHTML = '🔄';
    idleRotationButton.title = 'Toggle Idle Rotation Mode';
    idleRotationButton.className = 'graph-control-button idle-rotation';
    idleRotationButton.onclick = callbacks.onToggleIdleRotation;
    topButtonsContainer.appendChild(idleRotationButton);

    // Create FPS limiter toggle button
    const fpsLimiterButton = document.createElement('button');
    fpsLimiterButton.innerHTML = '⚡';
    fpsLimiterButton.title = 'Toggle FPS Limiter (60 FPS when disabled)';
    fpsLimiterButton.className = 'graph-control-button fps-limiter';
    fpsLimiterButton.onclick = callbacks.onToggleFPSLimiter;
    topButtonsContainer.appendChild(fpsLimiterButton);

    // Create hamburger menu button
    const menuButton = document.createElement('button');
    menuButton.innerHTML = '☰';
    menuButton.className = 'graph-control-button menu';
    menuButton.onclick = callbacks.onSettingsToggle;
    container.appendChild(menuButton);

    // Create settings panel
    const settingsPanel = document.createElement('div');
    settingsPanel.className = 'graph-settings-panel';
    container.appendChild(settingsPanel);

    return {
        buttons: {
            resetView: resetViewButton,
            unlockAll: unlockAllButton,
            directedPath: directedPathButton,
            undirectedPath: undirectedPathButton,
            clearPath: clearPathButton,
            save: saveButton,
            idleRotation: idleRotationButton,
            fpsLimiter: fpsLimiterButton,
            menu: menuButton
        },
        containers: {
            topButtons: topButtonsContainer,
            pathButtons: pathButtonsContainer,
            settingsPanel
        }
    };
}

export function createParsingErrorDisplay(container: HTMLElement, errors: string[]): void {
    const errorContainer = document.createElement('div');
    errorContainer.className = 'graph-error-container';
    
    const errorTitle = document.createElement('div');
    errorTitle.textContent = 'Query Parsing Error:';
    errorTitle.className = 'graph-error-title';
    errorContainer.appendChild(errorTitle);
    
    errors.forEach(error => {
        const errorMsg = document.createElement('div');
        errorMsg.textContent = error;
        errorMsg.className = 'graph-error-message';
        errorContainer.appendChild(errorMsg);
    });
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.className = 'graph-error-close';
    closeBtn.onclick = () => errorContainer.remove();
    errorContainer.appendChild(closeBtn);
    
    container.appendChild(errorContainer);
}