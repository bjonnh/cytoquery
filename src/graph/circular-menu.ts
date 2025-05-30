export interface CircularMenuCallbacks {
    onGoToPage: (nodeId: string) => Promise<void>;
    onToggleLock: (nodeId: string, isLocked: boolean) => void;
    onRestrictToNode: (nodeId: string, depth: number) => void;
    onUnrestrict: () => void;
    onCenterOnNode: (node: any, distance: number) => void;
    onSetAsSource: (nodeId: string) => void;
    onSetAsTarget: (nodeId: string) => void;
}

export interface CircularMenuState {
    currentRestriction: { nodeId: string, depth: number } | null;
    publicMode: boolean;
    sourceNode: string | null;
    targetNode: string | null;
}

interface MenuItem {
    icon: string;
    label: string;
    action: () => void;
    color?: string;
}

export function createCircularMenu(
    container: HTMLElement,
    node: any,
    event: MouseEvent,
    isLocked: boolean,
    callbacks: CircularMenuCallbacks,
    state: CircularMenuState
): { 
    menu: HTMLDivElement, 
    cleanup: () => void 
} {
    // Create menu container
    const menu = document.createElement('div');
    menu.className = 'circular-menu';
    
    // Get container bounds to properly position the menu
    const containerRect = container.getBoundingClientRect();
    let menuX = event.clientX - containerRect.left;
    let menuY = event.clientY - containerRect.top;
    
    // Ensure menu stays within bounds (accounting for menu radius of ~120px)
    const menuRadius = 120;
    menuX = Math.max(menuRadius, Math.min(containerRect.width - menuRadius, menuX));
    menuY = Math.max(menuRadius, Math.min(containerRect.height - menuRadius, menuY));
    
    menu.style.cssText = `
        position: absolute;
        left: ${menuX}px;
        top: ${menuY}px;
        z-index: 1000;
        cursor: move;
    `;

    // Create center node info
    const centerInfo = document.createElement('div');
    centerInfo.className = 'circular-menu-center';
    centerInfo.style.cssText = `
        position: absolute;
        left: -60px;
        top: -60px;
        width: 120px;
        height: 120px;
        background: radial-gradient(circle, rgba(0, 0, 0, 0.95) 0%, rgba(0, 0, 0, 0.85) 100%);
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        cursor: default;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.8);
    `;
    
    const nodeLabel = document.createElement('div');
    nodeLabel.textContent = node.name;
    nodeLabel.style.cssText = `
        color: white;
        font-size: 14px;
        font-weight: bold;
        text-align: center;
        max-width: 100px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        padding: 0 10px;
    `;
    centerInfo.appendChild(nodeLabel);
    
    menu.appendChild(centerInfo);

    // Define menu items
    const menuItems: MenuItem[] = [
        {
            icon: '📄',
            label: 'Open in new tab',
            action: async () => {
                await callbacks.onGoToPage(node.id);
                closeMenu();
            }
        },
        {
            icon: isLocked ? '🔓' : '🔒',
            label: isLocked ? 'Unlock node' : 'Lock node',
            action: () => {
                callbacks.onToggleLock(node.id, isLocked);
                closeMenu();
            }
        },
        {
            icon: '🎯',
            label: 'Set as start',
            action: () => {
                callbacks.onSetAsSource(node.id);
                closeMenu();
            },
            color: state.sourceNode === node.id ? '#00c800' : undefined
        },
        {
            icon: '🏁',
            label: 'Set as end',
            action: () => {
                callbacks.onSetAsTarget(node.id);
                closeMenu();
            },
            color: state.targetNode === node.id ? '#ffa500' : undefined
        },
        {
            icon: '👁️',
            label: 'Center view',
            action: () => {
                showCenterDialog();
            }
        },
        {
            icon: '🔍',
            label: 'Show neighbors',
            action: () => {
                showRestrictDialog();
            }
        }
    ];

    // Add "Remove restrictions" if there's a current restriction
    if (state.currentRestriction) {
        menuItems.push({
            icon: '↩️',
            label: 'Remove restrictions',
            action: () => {
                callbacks.onUnrestrict();
                closeMenu();
            },
            color: '#c86464'
        });
    }

    // Create menu items in a circle
    const radius = 90; // Distance from center
    const angleStep = (2 * Math.PI) / menuItems.length;
    const startAngle = -Math.PI / 2; // Start from top

    menuItems.forEach((item, index) => {
        const angle = startAngle + (index * angleStep);
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;

        const button = document.createElement('button');
        button.className = 'circular-menu-item';
        button.innerHTML = item.icon;
        button.title = item.label;
        
        const bgColor = item.color || 'rgba(255, 255, 255, 0.1)';
        const hoverColor = item.color ? 
            item.color.replace(')', ', 0.3)').replace('rgb', 'rgba') : 
            'rgba(255, 255, 255, 0.2)';
        
        button.style.cssText = `
            position: absolute;
            left: ${x - 24}px;
            top: ${y - 24}px;
            width: 48px;
            height: 48px;
            background: ${bgColor};
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            color: white;
            cursor: pointer;
            font-size: 20px;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
            transform: scale(0);
            animation: circularMenuItemAppear 0.3s ease-out ${index * 0.05}s forwards;
        `;
        
        button.onmouseover = () => {
            button.style.background = hoverColor;
            button.style.transform = 'scale(1.1)';
            button.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.7)';
        };
        
        button.onmouseout = () => {
            button.style.background = bgColor;
            button.style.transform = 'scale(1)';
            button.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.5)';
        };
        
        button.onclick = (e) => {
            e.stopPropagation();
            item.action();
        };
        
        menu.appendChild(button);
    });

    // Helper function to make dialogs draggable
    function makeDraggable(element: HTMLElement, handle?: HTMLElement) {
        let isDraggingDialog = false;
        let dialogX = 0;
        let dialogY = 0;
        let dialogInitialX = 0;
        let dialogInitialY = 0;
        let dialogOffsetX = 0;
        let dialogOffsetY = 0;
        
        const dragHandle = handle || element;
        dragHandle.style.cursor = 'move';
        
        const dialogDragStart = (e: MouseEvent) => {
            if (dragHandle.contains(e.target as HTMLElement)) {
                dialogInitialX = e.clientX - dialogOffsetX;
                dialogInitialY = e.clientY - dialogOffsetY;
                isDraggingDialog = true;
                element.style.cursor = 'grabbing';
            }
        };
        
        const dialogDragEnd = () => {
            dialogInitialX = dialogX;
            dialogInitialY = dialogY;
            isDraggingDialog = false;
            element.style.cursor = 'auto';
        };
        
        const dialogDrag = (e: MouseEvent) => {
            if (isDraggingDialog) {
                e.preventDefault();
                e.stopPropagation();
                dialogX = e.clientX - dialogInitialX;
                dialogY = e.clientY - dialogInitialY;
                dialogOffsetX = dialogX;
                dialogOffsetY = dialogY;
                
                // Get current position relative to menu
                const currentLeft = parseFloat(element.style.left);
                const currentTop = parseFloat(element.style.top);
                
                // Calculate new position
                let newLeft = currentLeft + dialogX;
                let newTop = currentTop + dialogY;
                
                // Keep dialog within container bounds
                const dialogRect = element.getBoundingClientRect();
                const menuRect = menu.getBoundingClientRect();
                const maxLeft = containerRect.width - menuRect.left - dialogRect.width + containerRect.left - 20;
                const maxTop = containerRect.height - menuRect.top - dialogRect.height + containerRect.top - 20;
                const minLeft = -menuRect.left + containerRect.left + 20;
                const minTop = -menuRect.top + containerRect.top + 20;
                
                newLeft = Math.max(minLeft, Math.min(maxLeft, newLeft));
                newTop = Math.max(minTop, Math.min(maxTop, newTop));
                
                element.style.left = `${newLeft}px`;
                element.style.top = `${newTop}px`;
                
                // Reset offset
                dialogOffsetX = 0;
                dialogOffsetY = 0;
                dialogInitialX = e.clientX;
                dialogInitialY = e.clientY;
            }
        };
        
        element.addEventListener('mousedown', dialogDragStart);
        document.addEventListener('mousemove', dialogDrag);
        document.addEventListener('mouseup', dialogDragEnd);
        
        return () => {
            element.removeEventListener('mousedown', dialogDragStart);
            document.removeEventListener('mousemove', dialogDrag);
            document.removeEventListener('mouseup', dialogDragEnd);
        };
    }

    // Function to show center dialog
    function showCenterDialog() {
        const dialog = document.createElement('div');
        dialog.className = 'circular-menu-dialog';
        dialog.style.cssText = `
            position: absolute;
            left: -150px;
            top: -200px;
            width: 300px;
            background: rgba(0, 0, 0, 0.95);
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-radius: 8px;
            padding: 16px;
            color: white;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.8);
            cursor: move;
        `;

        const title = document.createElement('h4');
        title.textContent = 'Center View on Node';
        title.style.cssText = 'margin: 0 0 12px 0; color: white; cursor: move;';
        dialog.appendChild(title);

        const label = document.createElement('label');
        label.textContent = 'Camera Distance:';
        label.style.cssText = 'display: block; margin-bottom: 8px; font-size: 13px;';
        dialog.appendChild(label);

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '50';
        slider.max = '500';
        slider.value = '200';
        slider.style.cssText = 'width: 100%; margin-bottom: 8px;';

        const value = document.createElement('span');
        value.textContent = slider.value;
        value.style.cssText = 'display: inline-block; margin-left: 8px;';

        slider.oninput = () => {
            value.textContent = slider.value;
        };

        const sliderContainer = document.createElement('div');
        sliderContainer.style.cssText = 'display: flex; align-items: center; margin-bottom: 12px;';
        sliderContainer.appendChild(slider);
        sliderContainer.appendChild(value);
        dialog.appendChild(sliderContainer);

        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = 'display: flex; gap: 8px;';

        const applyBtn = document.createElement('button');
        applyBtn.textContent = 'Apply';
        applyBtn.style.cssText = `
            flex: 1;
            padding: 8px;
            background: rgba(100, 100, 200, 0.3);
            border: 1px solid rgba(100, 100, 200, 0.5);
            border-radius: 4px;
            color: white;
            cursor: pointer;
        `;
        applyBtn.onclick = () => {
            callbacks.onCenterOnNode(node, parseFloat(slider.value));
            closeMenu();
        };

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.cssText = `
            flex: 1;
            padding: 8px;
            background: rgba(200, 100, 100, 0.3);
            border: 1px solid rgba(200, 100, 100, 0.5);
            border-radius: 4px;
            color: white;
            cursor: pointer;
        `;
        cancelBtn.onclick = () => {
            if ((dialog as any).cleanupDrag) {
                (dialog as any).cleanupDrag();
            }
            dialog.remove();
        };

        buttonContainer.appendChild(applyBtn);
        buttonContainer.appendChild(cancelBtn);
        dialog.appendChild(buttonContainer);

        menu.appendChild(dialog);
        
        // Make dialog draggable
        const cleanupDrag = makeDraggable(dialog, title);
        
        // Store cleanup function on dialog for later use
        (dialog as any).cleanupDrag = cleanupDrag;
    }

    // Function to show restrict dialog
    function showRestrictDialog() {
        const dialog = document.createElement('div');
        dialog.className = 'circular-menu-dialog';
        dialog.style.cssText = `
            position: absolute;
            left: -150px;
            top: -200px;
            width: 300px;
            background: rgba(0, 0, 0, 0.95);
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-radius: 8px;
            padding: 16px;
            color: white;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.8);
            cursor: move;
        `;

        const title = document.createElement('h4');
        title.textContent = 'Show Neighbors';
        title.style.cssText = 'margin: 0 0 12px 0; color: white; cursor: move;';
        dialog.appendChild(title);

        const label = document.createElement('label');
        label.textContent = 'Depth:';
        label.style.cssText = 'display: block; margin-bottom: 8px; font-size: 13px;';
        dialog.appendChild(label);

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '1';
        slider.max = '5';
        slider.value = (state.currentRestriction && state.currentRestriction.nodeId === node.id) 
            ? state.currentRestriction.depth.toString() : '2';
        slider.style.cssText = 'width: 100%; margin-bottom: 8px;';

        const value = document.createElement('span');
        value.textContent = slider.value;
        value.style.cssText = 'display: inline-block; margin-left: 8px;';

        slider.oninput = () => {
            value.textContent = slider.value;
        };

        const sliderContainer = document.createElement('div');
        sliderContainer.style.cssText = 'display: flex; align-items: center; margin-bottom: 12px;';
        sliderContainer.appendChild(slider);
        sliderContainer.appendChild(value);
        dialog.appendChild(sliderContainer);

        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = 'display: flex; gap: 8px;';

        const applyBtn = document.createElement('button');
        applyBtn.textContent = 'Apply';
        applyBtn.style.cssText = `
            flex: 1;
            padding: 8px;
            background: rgba(100, 200, 100, 0.3);
            border: 1px solid rgba(100, 200, 100, 0.5);
            border-radius: 4px;
            color: white;
            cursor: pointer;
        `;
        applyBtn.onclick = () => {
            callbacks.onRestrictToNode(node.id, parseInt(slider.value));
            closeMenu();
        };

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.cssText = `
            flex: 1;
            padding: 8px;
            background: rgba(200, 100, 100, 0.3);
            border: 1px solid rgba(200, 100, 100, 0.5);
            border-radius: 4px;
            color: white;
            cursor: pointer;
        `;
        cancelBtn.onclick = () => {
            if ((dialog as any).cleanupDrag) {
                (dialog as any).cleanupDrag();
            }
            dialog.remove();
        };

        buttonContainer.appendChild(applyBtn);
        buttonContainer.appendChild(cancelBtn);
        dialog.appendChild(buttonContainer);

        menu.appendChild(dialog);
        
        // Make dialog draggable
        const cleanupDrag = makeDraggable(dialog, title);
        
        // Store cleanup function on dialog for later use
        (dialog as any).cleanupDrag = cleanupDrag;
    }

    // Add menu to container
    container.appendChild(menu);

    // Make menu draggable
    let isDragging = false;
    let currentX: number;
    let currentY: number;
    let initialX: number;
    let initialY: number;
    let xOffset = 0;
    let yOffset = 0;

    const dragStartHandler = (e: MouseEvent) => {
        // Only drag when clicking on the center info
        if (centerInfo.contains(e.target as HTMLElement)) {
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;
            isDragging = true;
            menu.style.cursor = 'grabbing';
        }
    };

    const dragEndHandler = () => {
        initialX = currentX;
        initialY = currentY;
        isDragging = false;
        menu.style.cursor = 'move';
    };

    const dragHandler = (e: MouseEvent) => {
        if (isDragging) {
            e.preventDefault();
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;
            xOffset = currentX;
            yOffset = currentY;
            
            // Calculate new position
            let newX = parseFloat(menu.style.left) + currentX;
            let newY = parseFloat(menu.style.top) + currentY;
            
            // Keep menu within bounds
            const menuRadius = 120;
            newX = Math.max(menuRadius, Math.min(containerRect.width - menuRadius, newX));
            newY = Math.max(menuRadius, Math.min(containerRect.height - menuRadius, newY));
            
            menu.style.left = `${newX}px`;
            menu.style.top = `${newY}px`;
            
            // Reset offset after applying position
            xOffset = 0;
            yOffset = 0;
            initialX = e.clientX;
            initialY = e.clientY;
        }
    };

    menu.addEventListener('mousedown', dragStartHandler);
    document.addEventListener('mousemove', dragHandler);
    document.addEventListener('mouseup', dragEndHandler);

    // Function to close menu
    function closeMenu() {
        // Remove drag event listeners
        document.removeEventListener('mousemove', dragHandler);
        document.removeEventListener('mouseup', dragEndHandler);
        
        menu.style.animation = 'circularMenuFadeOut 0.2s ease-out forwards';
        setTimeout(() => {
            menu.remove();
        }, 200);
    }

    // Close menu when clicking outside
    const clickOutside = (e: MouseEvent) => {
        if (!menu.contains(e.target as HTMLElement)) {
            closeMenu();
            document.removeEventListener('click', clickOutside);
        }
    };
    
    // Add delay to prevent immediate closing
    setTimeout(() => {
        document.addEventListener('click', clickOutside);
    }, 100);

    return { menu, cleanup: closeMenu };
}