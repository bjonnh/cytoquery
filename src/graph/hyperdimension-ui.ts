import { HyperdimensionManager, HyperdimensionUIState, SpatialSystem, Axis } from '../types/hyperdimensions';
import {
    createSpatialSystem,
    createAxis,
    deleteSpatialSystem,
    deleteAxis,
    getAxesForSystem,
    updateAxisMapping,
    setNodePosition,
    removeNodePosition,
    getNode3DPosition
} from './hyperdimension-manager';

export interface HyperdimensionUICallbacks {
    onSpatialSystemCreated: (system: SpatialSystem) => void;
    onSpatialSystemDeleted: (systemId: string) => void;
    onAxisCreated: (axis: Axis) => void;
    onAxisDeleted: (axisId: string) => void;
    onAxisMappingChanged: (dimension: 'x' | 'y' | 'z', axisId: string | null) => void;
    onNodePositionChanged: (nodeId: string, axisId: string, value: number | null) => void;
}

/**
 * Creates the hyperdimension panel UI
 */
export function createHyperdimensionPanel(
    container: HTMLElement,
    manager: HyperdimensionManager,
    callbacks: HyperdimensionUICallbacks
): {
    panel: HTMLDivElement;
    updateUI: () => void;
} {
    const panel = document.createElement('div');
    panel.className = 'hyperdimension-panel';
    container.appendChild(panel);

    // Header
    const header = document.createElement('div');
    header.className = 'hyperdimension-header';
    header.innerHTML = '<h3>Hyperdimensions</h3>';
    panel.appendChild(header);

    // Axis mapping section
    const axisMappingSection = createAxisMappingSection(manager, callbacks);
    panel.appendChild(axisMappingSection.element);

    // Spatial systems section
    const spatialSystemsSection = createSpatialSystemsSection(manager, callbacks);
    panel.appendChild(spatialSystemsSection.element);

    const updateUI = () => {
        axisMappingSection.update();
        spatialSystemsSection.update();
    };

    return { panel, updateUI };
}

/**
 * Creates the axis mapping section
 */
function createAxisMappingSection(
    manager: HyperdimensionManager,
    callbacks: HyperdimensionUICallbacks
): {
    element: HTMLDivElement;
    update: () => void;
} {
    const section = document.createElement('div');
    section.className = 'axis-mapping-section';

    const title = document.createElement('h4');
    title.textContent = '3D Axis Mapping';
    section.appendChild(title);

    const mappingContainer = document.createElement('div');
    mappingContainer.className = 'axis-mapping-container';
    section.appendChild(mappingContainer);

    const createAxisSelector = (dimension: 'x' | 'y' | 'z', label: string) => {
        const selectorDiv = document.createElement('div');
        selectorDiv.className = 'axis-selector';

        const labelElem = document.createElement('label');
        labelElem.textContent = label;
        selectorDiv.appendChild(labelElem);

        const select = document.createElement('select');
        select.className = 'axis-select';
        select.onchange = () => {
            const value = select.value === '' ? null : select.value;
            
            // Check if this axis is already mapped to another dimension
            if (value !== null) {
                const mappings = ['x', 'y', 'z'] as const;
                for (const dim of mappings) {
                    if (dim !== dimension && manager.axisMapping[`${dim}Axis`] === value) {
                        alert(`This axis is already mapped to the ${dim.toUpperCase()} dimension. Please select a different axis.`);
                        // Reset to previous value
                        select.value = manager.axisMapping[`${dimension}Axis`] || '';
                        return;
                    }
                }
            }
            
            updateAxisMapping(manager, dimension, value);
            callbacks.onAxisMappingChanged(dimension, value);
        };
        selectorDiv.appendChild(select);

        return { element: selectorDiv, select };
    };

    const xSelector = createAxisSelector('x', 'X Axis:');
    const ySelector = createAxisSelector('y', 'Y Axis:');
    const zSelector = createAxisSelector('z', 'Z Axis:');

    mappingContainer.appendChild(xSelector.element);
    mappingContainer.appendChild(ySelector.element);
    mappingContainer.appendChild(zSelector.element);

    const update = () => {
        // Update all selectors with current axes
        const axes = Array.from(manager.axes.values());
        const selectors = [
            { select: xSelector.select, current: manager.axisMapping.xAxis },
            { select: ySelector.select, current: manager.axisMapping.yAxis },
            { select: zSelector.select, current: manager.axisMapping.zAxis }
        ];

        selectors.forEach(({ select, current }) => {
            // Clear options
            select.innerHTML = '<option value="">None</option>';

            // Group axes by spatial system
            const systemGroups = new Map<string, Axis[]>();
            axes.forEach(axis => {
                const system = manager.spatialSystems.get(axis.spatialSystemId);
                if (system) {
                    if (!systemGroups.has(system.id)) {
                        systemGroups.set(system.id, []);
                    }
                    systemGroups.get(system.id)!.push(axis);
                }
            });

            // Add options grouped by system
            systemGroups.forEach((axes, systemId) => {
                const system = manager.spatialSystems.get(systemId)!;
                const optgroup = document.createElement('optgroup');
                optgroup.label = system.name;

                axes.forEach(axis => {
                    const option = document.createElement('option');
                    option.value = axis.id;
                    option.textContent = axis.name;
                    if (axis.id === current) {
                        option.selected = true;
                    }
                    optgroup.appendChild(option);
                });

                select.appendChild(optgroup);
            });
        });
    };

    update();

    return { element: section, update };
}

/**
 * Creates the spatial systems management section
 */
function createSpatialSystemsSection(
    manager: HyperdimensionManager,
    callbacks: HyperdimensionUICallbacks
): {
    element: HTMLDivElement;
    update: () => void;
} {
    const section = document.createElement('div');
    section.className = 'spatial-systems-section';

    const header = document.createElement('div');
    header.className = 'section-header';

    const title = document.createElement('h4');
    title.textContent = 'Spatial Systems';
    header.appendChild(title);

    const addButton = document.createElement('button');
    addButton.className = 'add-spatial-system-btn';
    addButton.textContent = '+ New System';
    addButton.onclick = () => showSpatialSystemDialog(manager, callbacks, update);
    header.appendChild(addButton);

    section.appendChild(header);

    const systemsList = document.createElement('div');
    systemsList.className = 'spatial-systems-list';
    section.appendChild(systemsList);

    const update = () => {
        systemsList.innerHTML = '';

        manager.spatialSystems.forEach(system => {
            const systemDiv = createSpatialSystemElement(system, manager, callbacks, update);
            systemsList.appendChild(systemDiv);
        });

        if (manager.spatialSystems.size === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'empty-message';
            emptyMsg.textContent = 'No spatial systems defined. Click "New System" to create one.';
            systemsList.appendChild(emptyMsg);
        }
    };

    update();

    return { element: section, update };
}

/**
 * Creates a spatial system element with its axes
 */
function createSpatialSystemElement(
    system: SpatialSystem,
    manager: HyperdimensionManager,
    callbacks: HyperdimensionUICallbacks,
    updateParent: () => void
): HTMLDivElement {
    const systemDiv = document.createElement('div');
    systemDiv.className = 'spatial-system';

    // System header
    const header = document.createElement('div');
    header.className = 'system-header';

    const nameDiv = document.createElement('div');
    nameDiv.className = 'system-name';
    nameDiv.textContent = system.name;
    if (system.description) {
        nameDiv.title = system.description;
    }
    header.appendChild(nameDiv);

    const controls = document.createElement('div');
    controls.className = 'system-controls';

    const addAxisBtn = document.createElement('button');
    addAxisBtn.className = 'small-button';
    addAxisBtn.textContent = '+ Axis';
    addAxisBtn.onclick = () => showAxisDialog(system.id, manager, callbacks, updateParent);
    controls.appendChild(addAxisBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'small-button delete';
    deleteBtn.textContent = '×';
    deleteBtn.title = 'Delete spatial system';
    deleteBtn.onclick = () => {
        if (confirm(`Delete spatial system "${system.name}" and all its axes?`)) {
            deleteSpatialSystem(manager, system.id);
            callbacks.onSpatialSystemDeleted(system.id);
            updateParent();
        }
    };
    controls.appendChild(deleteBtn);

    header.appendChild(controls);
    systemDiv.appendChild(header);

    // Axes list
    const axesList = document.createElement('div');
    axesList.className = 'axes-list';

    const axes = getAxesForSystem(manager, system.id);
    axes.forEach(axis => {
        const axisDiv = createAxisElement(axis, manager, callbacks, updateParent);
        axesList.appendChild(axisDiv);
    });

    if (axes.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'empty-axes';
        emptyMsg.textContent = 'No axes defined';
        axesList.appendChild(emptyMsg);
    }

    systemDiv.appendChild(axesList);

    return systemDiv;
}

/**
 * Creates an axis element
 */
function createAxisElement(
    axis: Axis,
    manager: HyperdimensionManager,
    callbacks: HyperdimensionUICallbacks,
    updateParent: () => void
): HTMLDivElement {
    const axisDiv = document.createElement('div');
    axisDiv.className = 'axis-item';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'axis-name';
    nameSpan.textContent = axis.name;
    if (axis.description) {
        nameSpan.title = axis.description;
    }
    axisDiv.appendChild(nameSpan);

    if (axis.bounds) {
        const boundsSpan = document.createElement('span');
        boundsSpan.className = 'axis-bounds';
        const min = axis.bounds.min !== undefined ? axis.bounds.min : '-∞';
        const max = axis.bounds.max !== undefined ? axis.bounds.max : '∞';
        boundsSpan.textContent = `[${min}, ${max}]`;
        axisDiv.appendChild(boundsSpan);
    }

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'small-button delete';
    deleteBtn.textContent = '×';
    deleteBtn.title = 'Delete axis';
    deleteBtn.onclick = () => {
        if (confirm(`Delete axis "${axis.name}"?`)) {
            deleteAxis(manager, axis.id);
            callbacks.onAxisDeleted(axis.id);
            updateParent();
        }
    };
    axisDiv.appendChild(deleteBtn);

    return axisDiv;
}

/**
 * Shows dialog for creating a spatial system
 */
function showSpatialSystemDialog(
    manager: HyperdimensionManager,
    callbacks: HyperdimensionUICallbacks,
    updateUI: () => void
): void {
    const dialog = createDialog('Create Spatial System');

    const form = document.createElement('form');
    form.className = 'dialog-form';

    const nameInput = createFormField('Name:', 'text', 'system-name', true);
    const descInput = createFormField('Description:', 'text', 'system-desc', false);

    form.appendChild(nameInput.container);
    form.appendChild(descInput.container);

    const buttons = document.createElement('div');
    buttons.className = 'dialog-buttons';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = () => dialog.remove();
    buttons.appendChild(cancelBtn);

    const createBtn = document.createElement('button');
    createBtn.type = 'submit';
    createBtn.textContent = 'Create';
    buttons.appendChild(createBtn);

    form.appendChild(buttons);

    form.onsubmit = (e) => {
        e.preventDefault();
        const name = nameInput.input.value.trim();
        const desc = descInput.input.value.trim() || undefined;

        if (name) {
            const system = createSpatialSystem(manager, name, desc);
            callbacks.onSpatialSystemCreated(system);
            updateUI();
            dialog.remove();
        }
    };

    dialog.appendChild(form);
    document.body.appendChild(dialog);
    nameInput.input.focus();
}

/**
 * Shows dialog for creating an axis
 */
function showAxisDialog(
    systemId: string,
    manager: HyperdimensionManager,
    callbacks: HyperdimensionUICallbacks,
    updateUI: () => void
): void {
    const dialog = createDialog('Create Axis');

    const form = document.createElement('form');
    form.className = 'dialog-form';

    const nameInput = createFormField('Name:', 'text', 'axis-name', true);
    const descInput = createFormField('Description:', 'text', 'axis-desc', false);
    const minInput = createFormField('Min Bound:', 'number', 'axis-min', false);
    const maxInput = createFormField('Max Bound:', 'number', 'axis-max', false);

    form.appendChild(nameInput.container);
    form.appendChild(descInput.container);
    form.appendChild(minInput.container);
    form.appendChild(maxInput.container);

    const buttons = document.createElement('div');
    buttons.className = 'dialog-buttons';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = () => dialog.remove();
    buttons.appendChild(cancelBtn);

    const createBtn = document.createElement('button');
    createBtn.type = 'submit';
    createBtn.textContent = 'Create';
    buttons.appendChild(createBtn);

    form.appendChild(buttons);

    form.onsubmit = (e) => {
        e.preventDefault();
        const name = nameInput.input.value.trim();
        const desc = descInput.input.value.trim() || undefined;
        const min = minInput.input.value ? parseFloat(minInput.input.value) : undefined;
        const max = maxInput.input.value ? parseFloat(maxInput.input.value) : undefined;

        if (name) {
            const bounds = (min !== undefined || max !== undefined) ? { min, max } : undefined;
            const axis = createAxis(manager, systemId, name, desc, bounds);
            if (axis) {
                callbacks.onAxisCreated(axis);
                updateUI();
                dialog.remove();
            }
        }
    };

    dialog.appendChild(form);
    document.body.appendChild(dialog);
    nameInput.input.focus();
}

/**
 * Creates the node position editor UI
 */
export function createNodePositionEditor(
    nodeId: string,
    nodeName: string,
    manager: HyperdimensionManager,
    callbacks: HyperdimensionUICallbacks
): HTMLDivElement {
    const editor = document.createElement('div');
    editor.className = 'node-position-editor';

    const title = document.createElement('h4');
    title.textContent = `Positions for ${nodeName}`;
    editor.appendChild(title);

    const positionsContainer = document.createElement('div');
    positionsContainer.className = 'node-positions-container';
    editor.appendChild(positionsContainer);

    const nodePosition = manager.nodePositions.get(nodeId);

    // Group axes by spatial system
    const systemGroups = new Map<string, Axis[]>();
    manager.axes.forEach(axis => {
        const system = manager.spatialSystems.get(axis.spatialSystemId);
        if (system) {
            if (!systemGroups.has(system.id)) {
                systemGroups.set(system.id, []);
            }
            systemGroups.get(system.id)!.push(axis);
        }
    });

    // Create position inputs for each system
    systemGroups.forEach((axes, systemId) => {
        const system = manager.spatialSystems.get(systemId)!;
        
        const systemSection = document.createElement('div');
        systemSection.className = 'position-system-section';

        const systemTitle = document.createElement('h5');
        systemTitle.textContent = system.name;
        systemSection.appendChild(systemTitle);

        axes.forEach(axis => {
            const positionDiv = document.createElement('div');
            positionDiv.className = 'position-input-row';

            const label = document.createElement('label');
            label.textContent = axis.name + ':';
            positionDiv.appendChild(label);

            const input = document.createElement('input');
            input.type = 'number';
            input.className = 'position-input';
            input.step = 'any';

            // Set current value if it exists
            const currentValue = nodePosition?.positions.get(axis.id);
            if (currentValue !== undefined) {
                input.value = currentValue.toString();
            }

            // Set bounds if they exist
            if (axis.bounds?.min !== undefined) {
                input.min = axis.bounds.min.toString();
            }
            if (axis.bounds?.max !== undefined) {
                input.max = axis.bounds.max.toString();
            }

            // Handle changes
            input.onchange = () => {
                const value = input.value.trim();
                if (value === '') {
                    removeNodePosition(manager, nodeId, axis.id);
                    callbacks.onNodePositionChanged(nodeId, axis.id, null);
                } else {
                    const numValue = parseFloat(value);
                    if (!isNaN(numValue)) {
                        if (setNodePosition(manager, nodeId, axis.id, numValue)) {
                            callbacks.onNodePositionChanged(nodeId, axis.id, numValue);
                        } else {
                            // Reset to previous value if validation failed
                            input.value = currentValue?.toString() || '';
                        }
                    }
                }
            };

            positionDiv.appendChild(input);

            const unlockBtn = document.createElement('button');
            unlockBtn.className = 'unlock-axis-btn';
            unlockBtn.textContent = '🔓';
            unlockBtn.title = 'Unlock in this dimension';
            unlockBtn.onclick = () => {
                removeNodePosition(manager, nodeId, axis.id);
                callbacks.onNodePositionChanged(nodeId, axis.id, null);
                input.value = '';
            };
            positionDiv.appendChild(unlockBtn);

            systemSection.appendChild(positionDiv);
        });

        positionsContainer.appendChild(systemSection);
    });

    if (systemGroups.size === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'empty-message';
        emptyMsg.textContent = 'No spatial systems defined.';
        positionsContainer.appendChild(emptyMsg);
    }

    return editor;
}

// Helper functions

function createDialog(title: string): HTMLDivElement {
    const dialog = document.createElement('div');
    dialog.className = 'hyperdimension-dialog-overlay';

    const dialogContent = document.createElement('div');
    dialogContent.className = 'hyperdimension-dialog';

    const dialogTitle = document.createElement('h3');
    dialogTitle.textContent = title;
    dialogContent.appendChild(dialogTitle);

    dialog.appendChild(dialogContent);
    dialog.onclick = (e) => {
        if (e.target === dialog) {
            dialog.remove();
        }
    };

    return dialogContent.parentElement as HTMLDivElement;
}

function createFormField(
    label: string,
    type: string,
    name: string,
    required: boolean
): {
    container: HTMLDivElement;
    input: HTMLInputElement;
} {
    const container = document.createElement('div');
    container.className = 'form-field';

    const labelElem = document.createElement('label');
    labelElem.textContent = label;
    labelElem.setAttribute('for', name);
    container.appendChild(labelElem);

    const input = document.createElement('input');
    input.type = type;
    input.id = name;
    input.name = name;
    if (required) {
        input.required = true;
    }
    container.appendChild(input);

    return { container, input };
}