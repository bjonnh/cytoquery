import { GraphParameters } from '../types/graph';

export interface SettingsCallbacks {
    onParameterChange: () => void;
    onReset: () => void;
}

export function createSettingsControls(
    settingsPanel: HTMLElement,
    currentParams: GraphParameters,
    Graph: any,
    bloomPass: any,
    callbacks: SettingsCallbacks
): void {
    // Clear existing content
    settingsPanel.innerHTML = '';

    // Title
    const title = document.createElement('h2');
    title.textContent = 'Graph Settings';
    title.style.cssText = 'margin: 0 0 20px 0; font-size: 14px; border-bottom: 1px solid rgba(255, 255, 255, 0.3); padding-bottom: 10px;';
    settingsPanel.appendChild(title);

    // Helper function to create a section
    const createSection = (name: string) => {
        const section = document.createElement('div');
        section.style.cssText = 'margin-bottom: 20px;';
        const sectionTitle = document.createElement('h3');
        sectionTitle.textContent = name;
        sectionTitle.style.cssText = 'margin: 0 0 10px 0; font-size: 12px; color: #aaa;';
        section.appendChild(sectionTitle);
        return section;
    };

    // Helper function to create a slider control
    const createSlider = (label: string, min: number, max: number, step: number, value: number, onChange: (value: number) => void, onUpdate?: () => void) => {
        const container = document.createElement('div');
        container.style.cssText = 'margin-bottom: 15px;';
        
        const labelEl = document.createElement('label');
        labelEl.style.cssText = 'display: block; margin-bottom: 5px; font-size: 11px;';
        const valueSpan = document.createElement('span');
        valueSpan.textContent = value.toString();
        valueSpan.style.cssText = 'float: right; color: #888;';
        labelEl.textContent = label;
        labelEl.appendChild(valueSpan);
        
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = min.toString();
        slider.max = max.toString();
        slider.step = step.toString();
        slider.value = value.toString();
        slider.style.cssText = 'width: 100%; margin-top: 5px; cursor: pointer;';
        
        slider.oninput = () => {
            const val = parseFloat(slider.value);
            valueSpan.textContent = val.toFixed(step < 1 ? 2 : 0);
            onChange(val);
            if (onUpdate) onUpdate();
        };
        
        container.appendChild(labelEl);
        container.appendChild(slider);
        return container;
    };

    // Helper function to create a select control
    const createSelect = (label: string, options: string[], value: string, onChange: (value: string) => void, onUpdate?: () => void) => {
        const container = document.createElement('div');
        container.style.cssText = 'margin-bottom: 15px;';
        
        const labelEl = document.createElement('label');
        labelEl.textContent = label;
        labelEl.style.cssText = 'display: block; margin-bottom: 5px; font-size: 11px;';
        
        const select = document.createElement('select');
        select.style.cssText = 'width: 100%; padding: 5px; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.3); color: white; border-radius: 4px; cursor: pointer;';
        
        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt;
            option.textContent = opt;
            option.style.background = '#333';
            if (opt === value) option.selected = true;
            select.appendChild(option);
        });
        
        select.onchange = () => {
            onChange(select.value);
            if (onUpdate) onUpdate();
        };
        
        container.appendChild(labelEl);
        container.appendChild(select);
        return container;
    };

    // Force Engine Section
    const forceSection = createSection('Force Engine');
    forceSection.appendChild(createSlider('Alpha Decay', 0, 0.1, 0.001, currentParams.force!.alphaDecay!, (val) => {
        Graph.d3AlphaDecay(val);
        currentParams.force!.alphaDecay = val;
    }, callbacks.onParameterChange));
    forceSection.appendChild(createSlider('Velocity Decay', 0, 1, 0.1, currentParams.force!.velocityDecay!, (val) => {
        Graph.d3VelocityDecay(val);
        currentParams.force!.velocityDecay = val;
    }, callbacks.onParameterChange));
    forceSection.appendChild(createSlider('Alpha Min', 0, 0.1, 0.001, currentParams.force!.alphaMin!, (val) => {
        Graph.d3AlphaMin(val);
        currentParams.force!.alphaMin = val;
    }, callbacks.onParameterChange));
    settingsPanel.appendChild(forceSection);

    // DAG Mode Section
    const dagSection = createSection('DAG Layout');
    dagSection.appendChild(createSelect('DAG Mode', ['', 'td', 'bu', 'lr', 'rl', 'radialout', 'radialin'], currentParams.dag!.mode!, (val) => {
        Graph.dagMode(val as any);
        currentParams.dag!.mode = val;
    }, callbacks.onParameterChange));
    dagSection.appendChild(createSlider('DAG Level Distance', 0, 200, 10, currentParams.dag!.levelDistance!, (val) => {
        Graph.dagLevelDistance(val);
        currentParams.dag!.levelDistance = val;
    }, callbacks.onParameterChange));
    settingsPanel.appendChild(dagSection);

    // Node Styling Section
    const nodeSection = createSection('Node Styling');
    nodeSection.appendChild(createSlider('Node Size', 1, 20, 1, currentParams.nodeStyle!.size!, (val) => {
        currentParams.nodeStyle!.size = val;
        // Force re-render of all nodes with new size
        Graph.nodeThreeObject(Graph.nodeThreeObject());
    }, callbacks.onParameterChange));
    nodeSection.appendChild(createSlider('Node Opacity', 0, 1, 0.05, currentParams.nodeStyle!.opacity!, (val) => {
        currentParams.nodeStyle!.opacity = val;
        // Force re-render of all nodes with new opacity
        Graph.nodeThreeObject(Graph.nodeThreeObject());
    }, callbacks.onParameterChange));
    nodeSection.appendChild(createSlider('Node Resolution', 4, 32, 2, currentParams.nodeStyle!.resolution!, (val) => {
        currentParams.nodeStyle!.resolution = val;
        // Force re-render of all nodes with new resolution
        Graph.nodeThreeObject(Graph.nodeThreeObject());
    }, callbacks.onParameterChange));
    settingsPanel.appendChild(nodeSection);

    // Link Styling Section
    const linkSection = createSection('Link Styling');
    linkSection.appendChild(createSlider('Link Opacity', 0, 1, 0.05, currentParams.linkStyle!.opacity!, (val) => {
        Graph.linkOpacity(val);
        currentParams.linkStyle!.opacity = val;
    }, callbacks.onParameterChange));
    linkSection.appendChild(createSlider('Link Width', 0, 10, 0.5, currentParams.linkStyle!.width!, (val) => {
        currentParams.linkStyle!.width = val;
        Graph.refresh();
    }, callbacks.onParameterChange));
    linkSection.appendChild(createSlider('Link Curvature', 0, 1, 0.1, currentParams.linkStyle!.curvature!, (val) => {
        Graph.linkCurvature(val);
        currentParams.linkStyle!.curvature = val;
    }, callbacks.onParameterChange));
    linkSection.appendChild(createSlider('Link Particles', 0, 10, 1, currentParams.linkStyle!.particles!, (val) => {
        Graph.linkDirectionalParticles(val);
        currentParams.linkStyle!.particles = val;
    }, callbacks.onParameterChange));
    linkSection.appendChild(createSlider('Link Particle Speed', 0, 0.1, 0.01, currentParams.linkStyle!.particleSpeed!, (val) => {
        Graph.linkDirectionalParticleSpeed(val);
        currentParams.linkStyle!.particleSpeed = val;
    }, callbacks.onParameterChange));
    settingsPanel.appendChild(linkSection);

    // Bloom Effect Section
    const bloomSection = createSection('Bloom Effect');
    bloomSection.appendChild(createSlider('Bloom Strength', 0, 10, 0.1, currentParams.bloom!.strength!, (val) => {
        bloomPass.strength = val;
        currentParams.bloom!.strength = val;
    }, callbacks.onParameterChange));
    bloomSection.appendChild(createSlider('Bloom Radius', 0, 2, 0.1, currentParams.bloom!.radius!, (val) => {
        bloomPass.radius = val;
        currentParams.bloom!.radius = val;
    }, callbacks.onParameterChange));
    bloomSection.appendChild(createSlider('Bloom Threshold', 0, 1, 0.05, currentParams.bloom!.threshold!, (val) => {
        bloomPass.threshold = val;
        currentParams.bloom!.threshold = val;
    }, callbacks.onParameterChange));
    settingsPanel.appendChild(bloomSection);

    // Interaction Section
    const interactionSection = createSection('Interaction');
    const enableDragToggle = document.createElement('div');
    enableDragToggle.style.cssText = 'margin-bottom: 15px;';
    const dragLabel = document.createElement('label');
    dragLabel.style.cssText = 'display: flex; align-items: center; font-size: 13px; cursor: pointer;';
    const dragCheckbox = document.createElement('input');
    dragCheckbox.type = 'checkbox';
    dragCheckbox.checked = currentParams.interaction!.enableDrag!;
    dragCheckbox.style.cssText = 'margin-right: 8px;';
    dragCheckbox.onchange = () => {
        Graph.enableNodeDrag(dragCheckbox.checked);
        currentParams.interaction!.enableDrag = dragCheckbox.checked;
        callbacks.onParameterChange();
    };
    dragLabel.appendChild(dragCheckbox);
    dragLabel.appendChild(document.createTextNode('Enable Node Dragging'));
    enableDragToggle.appendChild(dragLabel);
    interactionSection.appendChild(enableDragToggle);
    settingsPanel.appendChild(interactionSection);

    // Performance Section
    const perfSection = createSection('Performance');
    perfSection.appendChild(createSlider('Warmup Ticks', 0, 200, 10, currentParams.performance!.warmupTicks!, (val) => {
        Graph.warmupTicks(val);
        currentParams.performance!.warmupTicks = val;
    }, callbacks.onParameterChange));
    perfSection.appendChild(createSlider('Cooldown Ticks', 0, 1000, 50, currentParams.performance!.cooldownTicks!, (val) => {
        Graph.cooldownTicks(val);
        currentParams.performance!.cooldownTicks = val;
    }, callbacks.onParameterChange));
    perfSection.appendChild(createSlider('Cooldown Time (ms)', 0, 30000, 1000, currentParams.performance!.cooldownTime!, (val) => {
        Graph.cooldownTime(val);
        currentParams.performance!.cooldownTime = val;
    }, callbacks.onParameterChange));
    settingsPanel.appendChild(perfSection);

    // Add reset button
    const resetSection = document.createElement('div');
    resetSection.style.cssText = 'margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(255, 255, 255, 0.2);';
    const resetBtn = document.createElement('button');
    resetBtn.textContent = 'Reset to Defaults';
    resetBtn.style.cssText = `
        display: block;
        width: 100%;
        padding: 10px 16px;
        background: rgba(200, 100, 100, 0.2);
        border: 1px solid rgba(200, 100, 100, 0.5);
        border-radius: 4px;
        color: white;
        cursor: pointer;
        font-size: 14px;
        transition: background 0.2s;
    `;
    resetBtn.onmouseover = () => resetBtn.style.background = 'rgba(200, 100, 100, 0.3)';
    resetBtn.onmouseout = () => resetBtn.style.background = 'rgba(200, 100, 100, 0.2)';
    resetBtn.onclick = () => {
        // Reset all values to defaults
        Graph.d3AlphaDecay(0.0228);
        Graph.d3VelocityDecay(0.4);
        Graph.d3AlphaMin(0);
        Graph.dagMode(null as any);
        Graph.dagLevelDistance(50);
        Graph.linkOpacity(0.2);
        Graph.linkCurvature(0);
        Graph.linkDirectionalParticles(0);
        Graph.linkDirectionalParticleSpeed(0.01);
        Graph.enableNodeDrag(true);
        Graph.warmupTicks(0);
        Graph.cooldownTicks(Infinity);
        Graph.cooldownTime(10000);
        bloomPass.strength = 4.5;
        bloomPass.radius = 1;
        bloomPass.threshold = 0;
        // Reset current params
        currentParams.force!.alphaDecay = 0.0228;
        currentParams.force!.velocityDecay = 0.4;
        currentParams.force!.alphaMin = 0;
        currentParams.dag!.mode = '';
        currentParams.dag!.levelDistance = 50;
        currentParams.nodeStyle!.size = 4;
        currentParams.nodeStyle!.opacity = 0.75;
        currentParams.nodeStyle!.resolution = 8;
        currentParams.linkStyle!.opacity = 0.2;
        currentParams.linkStyle!.width = 1;
        currentParams.linkStyle!.curvature = 0;
        currentParams.linkStyle!.particles = 0;
        currentParams.linkStyle!.particleSpeed = 0.01;
        currentParams.interaction!.enableDrag = true;
        currentParams.performance!.warmupTicks = 0;
        currentParams.performance!.cooldownTicks = Infinity;
        currentParams.performance!.cooldownTime = 10000;
        currentParams.bloom!.strength = 4.5;
        currentParams.bloom!.radius = 1;
        currentParams.bloom!.threshold = 0;
        
        // Force re-render of all nodes after reset
        Graph.nodeThreeObject(Graph.nodeThreeObject());
        
        callbacks.onReset();
    };
    resetSection.appendChild(resetBtn);
    settingsPanel.appendChild(resetSection);
}