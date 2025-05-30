import { GraphParameters } from '../types/graph';

export interface UICallbacks {
    onResetView: () => void;
    onUnlockAll: () => void;
    onSourceSelect: () => void;
    onTargetSelect: () => void;
    onFindDirectedPath: () => void;
    onFindUndirectedPath: () => void;
    onClearPath: () => void;
    onSaveParameters: () => void;
    onToggleIdleRotation: () => void;
    onSettingsToggle: () => void;
}

export function createUIControls(container: HTMLElement, callbacks: UICallbacks): {
    buttons: {
        resetView: HTMLButtonElement;
        unlockAll: HTMLButtonElement;
        source: HTMLButtonElement;
        target: HTMLButtonElement;
        directedPath: HTMLButtonElement;
        undirectedPath: HTMLButtonElement;
        clearPath: HTMLButtonElement;
        save: HTMLButtonElement;
        idleRotation: HTMLButtonElement;
        menu: HTMLButtonElement;
    };
    containers: {
        pathButtons: HTMLDivElement;
        settingsPanel: HTMLDivElement;
    };
} {
    // Create reset view button (top left)
    const resetViewButton = document.createElement('button');
    resetViewButton.innerHTML = '⟲';
    resetViewButton.title = 'Reset View to Center';
    resetViewButton.style.cssText = `
        position: absolute;
        top: 16px;
        left: 16px;
        width: 36px;
        height: 36px;
        background: rgba(0, 0, 0, 0.7);
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 8px;
        color: white;
        font-size: 20px;
        cursor: pointer;
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
    `;
    resetViewButton.onmouseover = () => resetViewButton.style.background = 'rgba(0, 0, 0, 0.8)';
    resetViewButton.onmouseout = () => resetViewButton.style.background = 'rgba(0, 0, 0, 0.7)';
    resetViewButton.onclick = callbacks.onResetView;
    container.appendChild(resetViewButton);

    // Create unlock all button (next to reset view)
    const unlockAllButton = document.createElement('button');
    unlockAllButton.innerHTML = '🔓';
    unlockAllButton.title = 'Unlock All Nodes';
    unlockAllButton.style.cssText = `
        position: absolute;
        top: 16px;
        left: 58px;
        width: 36px;
        height: 36px;
        background: rgba(0, 0, 0, 0.7);
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 8px;
        color: white;
        font-size: 18px;
        cursor: pointer;
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
    `;
    unlockAllButton.onmouseover = () => unlockAllButton.style.background = 'rgba(0, 0, 0, 0.8)';
    unlockAllButton.onmouseout = () => unlockAllButton.style.background = 'rgba(0, 0, 0, 0.7)';
    unlockAllButton.onclick = callbacks.onUnlockAll;
    unlockAllButton.style.display = 'none';
    container.appendChild(unlockAllButton);

    // Create source node selection button
    const sourceButton = document.createElement('button');
    sourceButton.innerHTML = '🔵';
    sourceButton.title = 'Select Source Node for Path Finding';
    sourceButton.style.cssText = `
        position: absolute;
        top: 16px;
        left: 100px;
        width: 36px;
        height: 36px;
        background: rgba(0, 0, 0, 0.7);
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 8px;
        color: white;
        font-size: 18px;
        cursor: pointer;
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
    `;
    sourceButton.onmouseover = () => sourceButton.style.background = 'rgba(0, 0, 0, 0.8)';
    sourceButton.onclick = callbacks.onSourceSelect;
    container.appendChild(sourceButton);

    // Create target node selection button
    const targetButton = document.createElement('button');
    targetButton.innerHTML = '🟠';
    targetButton.title = 'Select Target Node for Path Finding';
    targetButton.style.cssText = `
        position: absolute;
        top: 16px;
        left: 142px;
        width: 36px;
        height: 36px;
        background: rgba(0, 0, 0, 0.7);
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 8px;
        color: white;
        font-size: 18px;
        cursor: pointer;
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
    `;
    targetButton.onmouseover = () => targetButton.style.background = 'rgba(0, 0, 0, 0.8)';
    targetButton.onclick = callbacks.onTargetSelect;
    container.appendChild(targetButton);

    // Create find path buttons container
    const pathButtonsContainer = document.createElement('div');
    pathButtonsContainer.style.cssText = `
        position: absolute;
        top: 16px;
        left: 184px;
        display: flex;
        gap: 4px;
        z-index: 1000;
    `;
    pathButtonsContainer.style.display = 'none';
    
    // Create directed path button
    const directedPathButton = document.createElement('button');
    directedPathButton.innerHTML = '→';
    directedPathButton.title = 'Find Directed Path';
    directedPathButton.style.cssText = `
        width: 36px;
        height: 36px;
        background: rgba(100, 200, 100, 0.3);
        border: 1px solid rgba(100, 200, 100, 0.5);
        border-radius: 8px;
        color: white;
        font-size: 18px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
    `;
    directedPathButton.onmouseover = () => directedPathButton.style.background = 'rgba(100, 200, 100, 0.4)';
    directedPathButton.onmouseout = () => directedPathButton.style.background = 'rgba(100, 200, 100, 0.3)';
    directedPathButton.onclick = callbacks.onFindDirectedPath;
    pathButtonsContainer.appendChild(directedPathButton);
    
    // Create undirected path button
    const undirectedPathButton = document.createElement('button');
    undirectedPathButton.innerHTML = '↔';
    undirectedPathButton.title = 'Find Undirected Path';
    undirectedPathButton.style.cssText = `
        width: 36px;
        height: 36px;
        background: rgba(100, 200, 100, 0.3);
        border: 1px solid rgba(100, 200, 100, 0.5);
        border-radius: 8px;
        color: white;
        font-size: 18px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
    `;
    undirectedPathButton.onmouseover = () => undirectedPathButton.style.background = 'rgba(100, 200, 100, 0.4)';
    undirectedPathButton.onmouseout = () => undirectedPathButton.style.background = 'rgba(100, 200, 100, 0.3)';
    undirectedPathButton.onclick = callbacks.onFindUndirectedPath;
    pathButtonsContainer.appendChild(undirectedPathButton);
    
    container.appendChild(pathButtonsContainer);

    // Create clear path button
    const clearPathButton = document.createElement('button');
    clearPathButton.innerHTML = '✕';
    clearPathButton.title = 'Clear Path';
    clearPathButton.style.cssText = `
        position: absolute;
        top: 16px;
        left: 264px;
        width: 36px;
        height: 36px;
        background: rgba(200, 100, 100, 0.3);
        border: 1px solid rgba(200, 100, 100, 0.5);
        border-radius: 8px;
        color: white;
        font-size: 18px;
        cursor: pointer;
        z-index: 1000;
        display: none;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
    `;
    clearPathButton.onmouseover = () => clearPathButton.style.background = 'rgba(200, 100, 100, 0.4)';
    clearPathButton.onmouseout = () => clearPathButton.style.background = 'rgba(200, 100, 100, 0.3)';
    clearPathButton.onclick = callbacks.onClearPath;
    container.appendChild(clearPathButton);

    // Create save parameters button
    const saveButton = document.createElement('button');
    saveButton.innerHTML = '💾';
    saveButton.title = 'Save Parameters to Code Block';
    saveButton.style.cssText = `
        position: absolute;
        top: 16px;
        left: 306px;
        width: 36px;
        height: 36px;
        background: rgba(0, 0, 0, 0.7);
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 8px;
        color: white;
        font-size: 18px;
        cursor: pointer;
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
    `;
    saveButton.onmouseover = () => saveButton.style.background = 'rgba(0, 0, 0, 0.8)';
    saveButton.onmouseout = () => saveButton.style.background = 'rgba(0, 0, 0, 0.7)';
    saveButton.onclick = callbacks.onSaveParameters;
    container.appendChild(saveButton);

    // Create idle rotation button
    const idleRotationButton = document.createElement('button');
    idleRotationButton.innerHTML = '🔄';
    idleRotationButton.title = 'Toggle Idle Rotation Mode';
    idleRotationButton.style.cssText = `
        position: absolute;
        top: 16px;
        left: 348px;
        width: 36px;
        height: 36px;
        background: rgba(0, 0, 0, 0.7);
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 8px;
        color: white;
        font-size: 18px;
        cursor: pointer;
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
    `;
    idleRotationButton.onclick = callbacks.onToggleIdleRotation;
    container.appendChild(idleRotationButton);

    // Create hamburger menu button
    const menuButton = document.createElement('button');
    menuButton.innerHTML = '☰';
    menuButton.style.cssText = `
        position: absolute;
        top: 16px;
        right: 16px;
        width: 36px;
        height: 36px;
        background: rgba(0, 0, 0, 0.7);
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 8px;
        color: white;
        font-size: 20px;
        cursor: pointer;
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
    `;
    menuButton.onmouseover = () => menuButton.style.background = 'rgba(0, 0, 0, 0.8)';
    menuButton.onmouseout = () => menuButton.style.background = 'rgba(0, 0, 0, 0.7)';
    menuButton.onclick = callbacks.onSettingsToggle;
    container.appendChild(menuButton);

    // Create settings panel
    const settingsPanel = document.createElement('div');
    settingsPanel.style.cssText = `
        position: absolute;
        top: 0;
        right: -320px;
        width: 300px;
        height: 100%;
        background: rgba(0, 0, 0, 0.9);
        border-left: 1px solid rgba(255, 255, 255, 0.2);
        color: white;
        padding: 20px;
        padding-bottom: 40px;
        overflow-y: auto;
        overflow-x: hidden;
        transition: right 0.3s ease;
        z-index: 999;
        font-family: sans-serif;
        font-size: 12px;
        box-sizing: border-box;
    `;
    container.appendChild(settingsPanel);

    return {
        buttons: {
            resetView: resetViewButton,
            unlockAll: unlockAllButton,
            source: sourceButton,
            target: targetButton,
            directedPath: directedPathButton,
            undirectedPath: undirectedPathButton,
            clearPath: clearPathButton,
            save: saveButton,
            idleRotation: idleRotationButton,
            menu: menuButton
        },
        containers: {
            pathButtons: pathButtonsContainer,
            settingsPanel
        }
    };
}

export function createParsingErrorDisplay(container: HTMLElement, errors: string[]): void {
    const errorContainer = document.createElement('div');
    errorContainer.style.cssText = `
        position: absolute;
        top: 70px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(200, 50, 50, 0.9);
        border: 1px solid rgba(255, 100, 100, 0.5);
        border-radius: 8px;
        padding: 12px 20px;
        color: white;
        font-family: sans-serif;
        font-size: 14px;
        z-index: 1001;
        max-width: 80%;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    `;
    
    const errorTitle = document.createElement('div');
    errorTitle.textContent = 'Query Parsing Error:';
    errorTitle.style.cssText = 'font-weight: bold; margin-bottom: 8px;';
    errorContainer.appendChild(errorTitle);
    
    errors.forEach(error => {
        const errorMsg = document.createElement('div');
        errorMsg.textContent = error;
        errorMsg.style.cssText = 'margin-bottom: 4px;';
        errorContainer.appendChild(errorMsg);
    });
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = `
        position: absolute;
        top: 8px;
        right: 8px;
        background: transparent;
        border: none;
        color: white;
        font-size: 20px;
        cursor: pointer;
        width: 24px;
        height: 24px;
        padding: 0;
        line-height: 1;
    `;
    closeBtn.onclick = () => errorContainer.remove();
    errorContainer.appendChild(closeBtn);
    
    container.appendChild(errorContainer);
}