export interface PopupCallbacks {
    onGoToPage: (nodeId: string) => Promise<void>;
    onToggleLock: (nodeId: string, isLocked: boolean) => void;
    onRestrictToNode: (nodeId: string, depth: number) => void;
    onUnrestrict: () => void;
    onCenterOnNode: (node: any, distance: number) => void;
}

export interface PopupState {
    currentRestriction: { nodeId: string, depth: number } | null;
    publicMode: boolean;
}

export function createNodePopup(
    container: HTMLElement,
    node: any,
    event: MouseEvent,
    isLocked: boolean,
    callbacks: PopupCallbacks,
    state: PopupState
): { 
    popup: HTMLDivElement, 
    cleanup: () => void 
} {
    // Create popup container
    const popup = document.createElement('div');
    popup.className = 'graph-node-popup';
    
    // Get container bounds to properly position the popup
    const containerRect = container.getBoundingClientRect();
    const popupX = event.clientX - containerRect.left + 10;
    const popupY = event.clientY - containerRect.top + 10;
    
    popup.style.cssText = `
        position: absolute;
        left: ${popupX}px;
        top: ${popupY}px;
        background: rgba(0, 0, 0, 0.85);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 8px;
        padding: 16px;
        color: white;
        font-family: sans-serif;
        font-size: 14px;
        z-index: 1000;
        min-width: 250px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
        cursor: move;
    `;

    // Add title
    const title = document.createElement('h3');
    title.textContent = node.name;
    title.style.cssText = 'margin: 0 0 12px 0; font-size: 14px; color: #fff;';
    popup.appendChild(title);

    // Create button container for icon buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = 'display: flex; gap: 8px; margin-bottom: 12px;';

    // Add "Go to page" button with icon
    const goToPageBtn = document.createElement('button');
    goToPageBtn.innerHTML = '📄';
    goToPageBtn.title = 'Go to page in new tab';
    goToPageBtn.style.cssText = `
        flex: 1;
        padding: 8px;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 4px;
        color: white;
        cursor: pointer;
        font-size: 16px;
        transition: background 0.2s;
    `;
    goToPageBtn.onmouseover = () => goToPageBtn.style.background = 'rgba(255, 255, 255, 0.2)';
    goToPageBtn.onmouseout = () => goToPageBtn.style.background = 'rgba(255, 255, 255, 0.1)';
    goToPageBtn.onclick = async () => {
        await callbacks.onGoToPage(node.id);
        closePopup();
    };
    buttonContainer.appendChild(goToPageBtn);

    // Add lock/unlock button
    const lockBtn = document.createElement('button');
    lockBtn.innerHTML = isLocked ? '🔓' : '🔒';
    lockBtn.title = isLocked ? 'Unlock node' : 'Lock node in place';
    lockBtn.style.cssText = `
        flex: 1;
        padding: 8px;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 4px;
        color: white;
        cursor: pointer;
        font-size: 16px;
        transition: background 0.2s;
    `;
    lockBtn.onmouseover = () => lockBtn.style.background = 'rgba(255, 255, 255, 0.2)';
    lockBtn.onmouseout = () => lockBtn.style.background = 'rgba(255, 255, 255, 0.1)';
    lockBtn.onclick = () => {
        callbacks.onToggleLock(node.id, isLocked);
        closePopup();
    };
    buttonContainer.appendChild(lockBtn);

    popup.appendChild(buttonContainer);

    // Add restriction controls
    const restrictionDiv = document.createElement('div');
    restrictionDiv.style.cssText = 'margin-bottom: 12px;';
    
    const restrictLabel = document.createElement('label');
    restrictLabel.textContent = 'Restrict to neighbors within depth:';
    restrictLabel.style.cssText = 'display: block; margin-bottom: 8px; font-size: 13px;';
    restrictionDiv.appendChild(restrictLabel);

    const depthSlider = document.createElement('input');
    depthSlider.type = 'range';
    depthSlider.min = '1';
    depthSlider.max = '5';
    depthSlider.value = (state.currentRestriction && state.currentRestriction.nodeId === node.id) 
        ? state.currentRestriction.depth.toString() : '2';
    depthSlider.style.cssText = 'width: 100%; margin-bottom: 4px;';
    
    const depthValue = document.createElement('span');
    depthValue.textContent = depthSlider.value;
    depthValue.style.cssText = 'display: inline-block; margin-left: 8px; font-size: 13px;';
    
    depthSlider.oninput = () => {
        depthValue.textContent = depthSlider.value;
    };
    
    const sliderContainer = document.createElement('div');
    sliderContainer.style.cssText = 'display: flex; align-items: center; margin-bottom: 8px;';
    sliderContainer.appendChild(depthSlider);
    sliderContainer.appendChild(depthValue);
    restrictionDiv.appendChild(sliderContainer);

    const restrictBtn = document.createElement('button');
    restrictBtn.textContent = 'Apply Restriction';
    restrictBtn.style.cssText = `
        display: block;
        width: 100%;
        padding: 8px 16px;
        background: rgba(100, 200, 100, 0.2);
        border: 1px solid rgba(100, 200, 100, 0.5);
        border-radius: 4px;
        color: white;
        cursor: pointer;
        font-size: 14px;
        transition: background 0.2s;
    `;
    restrictBtn.onmouseover = () => restrictBtn.style.background = 'rgba(100, 200, 100, 0.3)';
    restrictBtn.onmouseout = () => restrictBtn.style.background = 'rgba(100, 200, 100, 0.2)';
    restrictBtn.onclick = () => {
        callbacks.onRestrictToNode(node.id, parseInt(depthSlider.value));
        closePopup();
    };
    restrictionDiv.appendChild(restrictBtn);
    
    popup.appendChild(restrictionDiv);

    // Add unrestrict button if there's a current restriction
    if (state.currentRestriction) {
        const unrestrictBtn = document.createElement('button');
        unrestrictBtn.textContent = 'Remove All Restrictions';
        unrestrictBtn.style.cssText = `
            display: block;
            width: 100%;
            padding: 8px 16px;
            margin-bottom: 12px;
            background: rgba(200, 100, 100, 0.2);
            border: 1px solid rgba(200, 100, 100, 0.5);
            border-radius: 4px;
            color: white;
            cursor: pointer;
            font-size: 14px;
            transition: background 0.2s;
        `;
        unrestrictBtn.onmouseover = () => unrestrictBtn.style.background = 'rgba(200, 100, 100, 0.3)';
        unrestrictBtn.onmouseout = () => unrestrictBtn.style.background = 'rgba(200, 100, 100, 0.2)';
        unrestrictBtn.onclick = () => {
            callbacks.onUnrestrict();
            closePopup();
        };
        popup.appendChild(unrestrictBtn);
    }

    // Add center on node controls
    const centerDiv = document.createElement('div');
    centerDiv.style.cssText = 'margin-bottom: 12px; padding: 12px; background: rgba(100, 100, 200, 0.1); border-radius: 4px;';
    
    const centerLabel = document.createElement('label');
    centerLabel.textContent = 'Center View on Node:';
    centerLabel.style.cssText = 'display: block; margin-bottom: 8px; font-size: 13px;';
    centerDiv.appendChild(centerLabel);
    
    const distanceLabel = document.createElement('label');
    distanceLabel.textContent = 'Camera Distance:';
    distanceLabel.style.cssText = 'display: block; margin-bottom: 4px; font-size: 12px; color: #ccc;';
    centerDiv.appendChild(distanceLabel);
    
    const distanceSlider = document.createElement('input');
    distanceSlider.type = 'range';
    distanceSlider.min = '50';
    distanceSlider.max = '500';
    distanceSlider.value = '200';
    distanceSlider.style.cssText = 'width: 100%; margin-bottom: 4px;';
    
    const distanceValue = document.createElement('span');
    distanceValue.textContent = distanceSlider.value;
    distanceValue.style.cssText = 'display: inline-block; margin-left: 8px; font-size: 12px;';
    
    distanceSlider.oninput = () => {
        distanceValue.textContent = distanceSlider.value;
    };
    
    const distanceSliderContainer = document.createElement('div');
    distanceSliderContainer.style.cssText = 'display: flex; align-items: center; margin-bottom: 8px;';
    distanceSliderContainer.appendChild(distanceSlider);
    distanceSliderContainer.appendChild(distanceValue);
    centerDiv.appendChild(distanceSliderContainer);

    const centerBtn = document.createElement('button');
    centerBtn.textContent = 'Center on This Node';
    centerBtn.style.cssText = `
        display: block;
        width: 100%;
        padding: 8px 16px;
        background: rgba(100, 100, 200, 0.3);
        border: 1px solid rgba(100, 100, 200, 0.5);
        border-radius: 4px;
        color: white;
        cursor: pointer;
        font-size: 14px;
        transition: background 0.2s;
    `;
    centerBtn.onmouseover = () => centerBtn.style.background = 'rgba(100, 100, 200, 0.4)';
    centerBtn.onmouseout = () => centerBtn.style.background = 'rgba(100, 100, 200, 0.3)';
    centerBtn.onclick = () => {
        callbacks.onCenterOnNode(node, parseFloat(distanceSlider.value));
        closePopup();
    };
    centerDiv.appendChild(centerBtn);
    popup.appendChild(centerDiv);

    // Add close button
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
    closeBtn.onclick = closePopup;
    popup.appendChild(closeBtn);

    // Add popup to container
    container.appendChild(popup);

    // Make popup draggable
    let isDragging = false;
    let currentX: number;
    let currentY: number;
    let initialX: number;
    let initialY: number;
    let xOffset = 0;
    let yOffset = 0;

    const dragStartHandler = (e: MouseEvent) => {
        if (e.type === "mousedown") {
            // Don't start dragging if clicking on interactive elements
            const target = e.target as HTMLElement;
            if (target.tagName === 'BUTTON' || target.tagName === 'INPUT' || 
                target.tagName === 'A' || target.closest('button') || 
                target.closest('input') || target.closest('a')) {
                return;
            }
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;
            isDragging = true;
        }
    };

    const dragEndHandler = () => {
        initialX = currentX;
        initialY = currentY;
        isDragging = false;
    };

    const dragHandler = (e: MouseEvent) => {
        if (isDragging) {
            e.preventDefault();
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;
            xOffset = currentX;
            yOffset = currentY;
            popup.style.transform = `translate(${currentX}px, ${currentY}px)`;
        }
    };

    popup.addEventListener('mousedown', dragStartHandler);
    document.addEventListener('mousemove', dragHandler);
    document.addEventListener('mouseup', dragEndHandler);

    // Function to close popup
    function closePopup() {
        // Remove drag event listeners
        document.removeEventListener('mousemove', dragHandler);
        document.removeEventListener('mouseup', dragEndHandler);
        popup.remove();
    }

    // Close popup when clicking outside
    const clickOutside = (e: MouseEvent) => {
        if (!popup.contains(e.target as HTMLElement)) {
            closePopup();
            document.removeEventListener('click', clickOutside);
        }
    };
    // Add delay to prevent immediate closing
    setTimeout(() => {
        document.addEventListener('click', clickOutside);
    }, 100);

    return { popup, cleanup: closePopup };
}