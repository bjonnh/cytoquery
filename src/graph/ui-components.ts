import { GraphParameters } from '../types/graph';

export interface UICallbacks {
    onResetView: () => void;
    onResetOrientation: () => void;
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
        resetOrientation: HTMLButtonElement;
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
        circularMenu: HTMLDivElement;
    };
    updatePathNodesStatus: (hasStartNode: boolean, hasEndNode: boolean) => void;
    showCircularMenu: (x: number, y: number) => void;
    hideCircularMenu: () => void;
} {
    // Create circular menu container
    const circularMenu = document.createElement('div');
    circularMenu.className = 'graph-circular-menu';
    container.appendChild(circularMenu);

    // Position function for circular layout
    const positionMenuItem = (item: HTMLElement, index: number, total: number) => {
        const angleStep = (2 * Math.PI) / total;
        const angle = angleStep * index - Math.PI / 2; // Start from top
        const radius = 80; // Distance from center
        const x = Math.cos(angle) * radius + 24 - 18; // Center at 24px, item is 36px
        const y = Math.sin(angle) * radius + 24 - 18;
        item.style.left = `${x}px`;
        item.style.top = `${y}px`;
    };

    const menuItems: HTMLButtonElement[] = [];
    let isMenuOpen = false;

    // Keep topButtonsContainer for compatibility but hide it
    const topButtonsContainer = document.createElement('div');
    topButtonsContainer.className = 'graph-top-buttons';
    topButtonsContainer.style.display = 'none';
    container.appendChild(topButtonsContainer);

    // Create reset view button
    const resetViewButton = document.createElement('button');
    resetViewButton.innerHTML = '⟲';
    resetViewButton.title = 'Reset View to Center';
    resetViewButton.className = 'graph-circular-menu-item';
    resetViewButton.onclick = () => {
        callbacks.onResetView();
        hideCircularMenu();
    };
    menuItems.push(resetViewButton);
    circularMenu.appendChild(resetViewButton);
    
    // Create reset orientation button
    const resetOrientationButton = document.createElement('button');
    resetOrientationButton.innerHTML = '🧭';
    resetOrientationButton.title = 'Reset Camera Orientation (Standard XYZ)';
    resetOrientationButton.className = 'graph-circular-menu-item';
    resetOrientationButton.onclick = () => {
        callbacks.onResetOrientation();
        hideCircularMenu();
    };
    menuItems.push(resetOrientationButton);
    circularMenu.appendChild(resetOrientationButton);

    // Create unlock all button
    const unlockAllButton = document.createElement('button');
    unlockAllButton.innerHTML = '🔓';
    unlockAllButton.title = 'Unlock All Nodes';
    unlockAllButton.className = 'graph-circular-menu-item';
    unlockAllButton.onclick = () => {
        callbacks.onUnlockAll();
        hideCircularMenu();
    };
    menuItems.push(unlockAllButton);
    circularMenu.appendChild(unlockAllButton);

    // Create find path buttons container (for compatibility)
    const pathButtonsContainer = document.createElement('div');
    pathButtonsContainer.className = 'path-buttons-container';
    pathButtonsContainer.style.display = 'none';
    topButtonsContainer.appendChild(pathButtonsContainer);
    
    // Create directed path button
    const directedPathButton = document.createElement('button');
    directedPathButton.innerHTML = '→';
    directedPathButton.title = 'Find Directed Path';
    directedPathButton.className = 'graph-circular-menu-item path-button';
    directedPathButton.onclick = () => {
        callbacks.onFindDirectedPath();
        hideCircularMenu();
    };
    menuItems.push(directedPathButton);
    circularMenu.appendChild(directedPathButton);
    
    // Create undirected path button
    const undirectedPathButton = document.createElement('button');
    undirectedPathButton.innerHTML = '↔';
    undirectedPathButton.title = 'Find Undirected Path';
    undirectedPathButton.className = 'graph-circular-menu-item path-button';
    undirectedPathButton.onclick = () => {
        callbacks.onFindUndirectedPath();
        hideCircularMenu();
    };
    menuItems.push(undirectedPathButton);
    circularMenu.appendChild(undirectedPathButton);

    // Create clear path button
    const clearPathButton = document.createElement('button');
    clearPathButton.innerHTML = '✕';
    clearPathButton.title = 'Clear Path';
    clearPathButton.className = 'graph-circular-menu-item path-button';
    clearPathButton.onclick = () => {
        callbacks.onClearPath();
        hideCircularMenu();
    };
    menuItems.push(clearPathButton);
    circularMenu.appendChild(clearPathButton);

    // Create save parameters button
    const saveButton = document.createElement('button');
    saveButton.innerHTML = '💾';
    saveButton.title = 'Save Parameters to Code Block';
    saveButton.className = 'graph-circular-menu-item';
    saveButton.onclick = () => {
        callbacks.onSaveParameters();
        hideCircularMenu();
    };
    menuItems.push(saveButton);
    circularMenu.appendChild(saveButton);

    // Create idle rotation button
    const idleRotationButton = document.createElement('button');
    idleRotationButton.innerHTML = '🔄';
    idleRotationButton.title = 'Toggle Idle Rotation Mode';
    idleRotationButton.className = 'graph-circular-menu-item';
    idleRotationButton.onclick = () => {
        callbacks.onToggleIdleRotation();
        hideCircularMenu();
    };
    menuItems.push(idleRotationButton);
    circularMenu.appendChild(idleRotationButton);

    // Create FPS limiter toggle button
    const fpsLimiterButton = document.createElement('button');
    fpsLimiterButton.innerHTML = '⚡';
    fpsLimiterButton.title = 'Toggle FPS Limiter (60 FPS when disabled)';
    fpsLimiterButton.className = 'graph-circular-menu-item';
    fpsLimiterButton.onclick = () => {
        callbacks.onToggleFPSLimiter();
        hideCircularMenu();
    };
    menuItems.push(fpsLimiterButton);
    circularMenu.appendChild(fpsLimiterButton);

    // Position all menu items in a circle
    const updateMenuLayout = () => {
        const visibleItems = menuItems.filter(item => !item.classList.contains('path-button') || circularMenu.classList.contains('has-path-nodes'));
        visibleItems.forEach((item, index) => {
            positionMenuItem(item, index, visibleItems.length);
        });
    };

    // Function to show circular menu at position
    const showCircularMenu = (x: number, y: number) => {
        // Ensure menu stays within bounds
        const containerRect = container.getBoundingClientRect();
        const menuRadius = 120;
        const adjustedX = Math.max(menuRadius, Math.min(containerRect.width - menuRadius, x));
        const adjustedY = Math.max(menuRadius, Math.min(containerRect.height - menuRadius, y));
        
        circularMenu.style.left = `${adjustedX - 24}px`; // Center the menu (48px / 2)
        circularMenu.style.top = `${adjustedY - 24}px`;
        circularMenu.classList.add('open');
        isMenuOpen = true;
        updateMenuLayout();
    };

    // Function to hide circular menu
    const hideCircularMenu = () => {
        circularMenu.classList.remove('open');
        isMenuOpen = false;
    };

    // Add click-outside handler
    document.addEventListener('click', (e) => {
        if (isMenuOpen && !circularMenu.contains(e.target as Node)) {
            hideCircularMenu();
        }
    });

    // Create hamburger menu button (keep existing for settings panel)
    const menuButton = document.createElement('button');
    menuButton.innerHTML = '☰';
    menuButton.className = 'graph-control-button menu';
    menuButton.onclick = callbacks.onSettingsToggle;
    container.appendChild(menuButton);

    // Create settings panel
    const settingsPanel = document.createElement('div');
    settingsPanel.className = 'graph-settings-panel';
    container.appendChild(settingsPanel);

    // Function to update path nodes visibility
    const updatePathNodesStatus = (hasStartNode: boolean, hasEndNode: boolean) => {
        if (hasStartNode && hasEndNode) {
            circularMenu.classList.add('has-path-nodes');
        } else {
            circularMenu.classList.remove('has-path-nodes');
        }
        updateMenuLayout();
    };

    return {
        buttons: {
            resetView: resetViewButton,
            resetOrientation: resetOrientationButton,
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
            settingsPanel: settingsPanel,
            circularMenu: circularMenu
        },
        updatePathNodesStatus,
        showCircularMenu,
        hideCircularMenu
    };
}

export function createParsingErrorDisplay(container: HTMLElement, errors: Array<{ message: string; line?: number; column?: number }>) {
    // Create error container
    const errorContainer = document.createElement('div');
    errorContainer.className = 'graph-error-container';
    
    // Create error title
    const errorTitle = document.createElement('div');
    errorTitle.className = 'graph-error-title';
    errorTitle.textContent = 'Query Parsing Error';
    errorContainer.appendChild(errorTitle);
    
    // Create error messages
    errors.forEach(error => {
        const errorMsg = document.createElement('div');
        errorMsg.className = 'graph-error-message';
        if (error.line && error.column) {
            errorMsg.textContent = `Line ${error.line}, Column ${error.column}: ${error.message}`;
        } else {
            errorMsg.textContent = error.message;
        }
        errorContainer.appendChild(errorMsg);
    });
    
    // Create close button
    const closeButton = document.createElement('button');
    closeButton.className = 'graph-error-close';
    closeButton.innerHTML = '×';
    closeButton.onclick = () => errorContainer.remove();
    errorContainer.appendChild(closeButton);
    
    container.appendChild(errorContainer);
}

export function createSettingsPanel(container: HTMLElement, parameters: GraphParameters) {
    container.innerHTML = '';
    
    // Create header
    const header = document.createElement('div');
    header.className = 'graph-settings-header';
    header.innerHTML = '<h3>Graph Settings</h3>';
    container.appendChild(header);
    
    // Create content area
    const content = document.createElement('div');
    content.className = 'graph-settings-content';
    container.appendChild(content);
    
    // Add sections for different parameter groups
    // This is a placeholder - the actual settings UI will be created elsewhere
    content.innerHTML = `
        <div class="settings-section">
            <h4>Force Engine</h4>
            <div class="settings-group">
                <!-- Force settings will be added here -->
            </div>
        </div>
        <div class="settings-section">
            <h4>Visual Settings</h4>
            <div class="settings-group">
                <!-- Visual settings will be added here -->
            </div>
        </div>
    `;
}