import * as THREE from 'three';

export interface AxisIndicatorSystem {
    container: HTMLDivElement;
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.OrthographicCamera;
    axisGroup: THREE.Group;
    labelsContainer: HTMLDivElement;
}

/**
 * Creates a complete axis indicator system with its own renderer
 * This creates a small separate canvas overlay for the axis indicator
 */
export function createAxisIndicatorSystem(parentContainer: HTMLElement): AxisIndicatorSystem {
    // Create container for the axis indicator
    const container = document.createElement('div');
    container.className = 'axis-indicator-container';
    container.style.position = 'absolute';
    container.style.bottom = '10px';
    container.style.left = '10px';
    container.style.width = '120px';
    container.style.height = '150px'; // Increased height for labels
    container.style.zIndex = '1000';
    container.style.pointerEvents = 'none';
    container.style.background = 'rgba(0, 0, 0, 0.5)';
    container.style.borderRadius = '8px';
    container.style.border = '1px solid rgba(255, 255, 255, 0.1)';
    parentContainer.appendChild(container);
    
    // Create labels container above the axis indicator
    const labelsContainer = document.createElement('div');
    labelsContainer.className = 'axis-labels-container';
    labelsContainer.style.position = 'absolute';
    labelsContainer.style.top = '5px';
    labelsContainer.style.left = '0';
    labelsContainer.style.right = '0';
    labelsContainer.style.height = '25px';
    labelsContainer.style.fontSize = '10px';
    labelsContainer.style.color = 'rgba(255, 255, 255, 0.8)';
    labelsContainer.style.textAlign = 'center';
    labelsContainer.style.lineHeight = '12px';
    labelsContainer.style.padding = '0 5px';
    labelsContainer.style.fontFamily = 'monospace';
    container.appendChild(labelsContainer);

    // Create a wrapper for the renderer to position it below the labels
    const rendererWrapper = document.createElement('div');
    rendererWrapper.style.position = 'absolute';
    rendererWrapper.style.bottom = '0';
    rendererWrapper.style.left = '0';
    rendererWrapper.style.width = '120px';
    rendererWrapper.style.height = '120px';
    container.appendChild(rendererWrapper);
    
    // Create a separate renderer for the axis indicator
    const renderer = new THREE.WebGLRenderer({ 
        alpha: true, 
        antialias: true 
    });
    renderer.setSize(120, 120);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    rendererWrapper.appendChild(renderer.domElement);
    
    // Create a separate scene
    const scene = new THREE.Scene();
    
    // Create orthographic camera
    const viewSize = 100;
    const camera = new THREE.OrthographicCamera(
        -viewSize / 2,
        viewSize / 2,
        viewSize / 2,
        -viewSize / 2,
        0.1,
        1000
    );
    // Position camera on Z axis to match screen coordinates
    camera.position.set(0, 0, 100);
    camera.lookAt(0, 0, 0);
    camera.up.set(0, 1, 0);
    
    // Create the axis indicator group
    const axisGroup = createAxisIndicator();
    scene.add(axisGroup);
    
    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);
    
    return { container, renderer, scene, camera, axisGroup, labelsContainer };
}

/**
 * Creates a 3D axis indicator showing X (red), Y (green), Z (blue) axes
 */
export function createAxisIndicator(): THREE.Group {
    const group = new THREE.Group();
    
    // Create arrow helper for each axis
    const arrowLength = 30;
    const arrowHeadLength = 8;
    const arrowHeadWidth = 6;
    
    // X axis - Red (right)
    const xDir = new THREE.Vector3(1, 0, 0);
    const xOrigin = new THREE.Vector3(0, 0, 0);
    const xArrow = new THREE.ArrowHelper(xDir, xOrigin, arrowLength, 0xff0000, arrowHeadLength, arrowHeadWidth);
    group.add(xArrow);
    
    // Y axis - Green (up)
    const yDir = new THREE.Vector3(0, 1, 0);
    const yOrigin = new THREE.Vector3(0, 0, 0);
    const yArrow = new THREE.ArrowHelper(yDir, yOrigin, arrowLength, 0x00ff00, arrowHeadLength, arrowHeadWidth);
    group.add(yArrow);
    
    // Z axis - Blue (forward)
    const zDir = new THREE.Vector3(0, 0, 1);
    const zOrigin = new THREE.Vector3(0, 0, 0);
    const zArrow = new THREE.ArrowHelper(zDir, zOrigin, arrowLength, 0x0080ff, arrowHeadLength, arrowHeadWidth);
    group.add(zArrow);
    
    // Add axis labels using sprites (simpler than loading fonts)
    const createTextSprite = (text: string, color: string) => {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d')!;
        canvas.width = 64;
        canvas.height = 64;
        
        context.font = 'Bold 48px Arial';
        context.fillStyle = color;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, 32, 32);
        
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ 
            map: texture,
            depthTest: false,
            depthWrite: false
        });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(8, 8, 1);
        
        return sprite;
    };
    
    // Add labels at the end of each arrow
    const xLabel = createTextSprite('X', '#ff0000');
    xLabel.position.set(arrowLength + 8, 0, 0);
    group.add(xLabel);
    
    const yLabel = createTextSprite('Y', '#00ff00');
    yLabel.position.set(0, arrowLength + 8, 0);
    group.add(yLabel);
    
    const zLabel = createTextSprite('Z', '#0080ff');
    zLabel.position.set(0, 0, arrowLength + 8);
    group.add(zLabel);
    
    return group;
}

/**
 * Updates the axis labels display
 */
export function updateAxisLabels(
    axisIndicatorSystem: AxisIndicatorSystem,
    xLabel: string | null,
    yLabel: string | null,
    zLabel: string | null
): void {
    const labels = [];
    if (xLabel) labels.push(`<span style="color: #ff0000">X:</span> ${xLabel}`);
    if (yLabel) labels.push(`<span style="color: #00ff00">Y:</span> ${yLabel}`);
    if (zLabel) labels.push(`<span style="color: #0080ff">Z:</span> ${zLabel}`);
    
    axisIndicatorSystem.labelsContainer.innerHTML = labels.length > 0 
        ? labels.join('<br>')
        : '<span style="color: rgba(255,255,255,0.5)">No axes mapped</span>';
}

/**
 * Updates and renders the axis indicator
 */
export function updateAxisIndicator(
    axisIndicatorSystem: AxisIndicatorSystem,
    mainCamera: THREE.Camera
): void {
    // Get the main camera's view matrix to extract its orientation
    const viewMatrix = new THREE.Matrix4();
    viewMatrix.copy(mainCamera.matrixWorldInverse);
    
    // Extract the rotation part (top-left 3x3) from the view matrix
    const rotation = new THREE.Matrix4();
    rotation.extractRotation(viewMatrix);
    
    // Apply this rotation to the axis group
    axisIndicatorSystem.axisGroup.setRotationFromMatrix(rotation);
    
    // Render the axis indicator
    axisIndicatorSystem.renderer.render(
        axisIndicatorSystem.scene, 
        axisIndicatorSystem.camera
    );
}

/**
 * Cleans up the axis indicator system
 */
export function disposeAxisIndicator(axisIndicatorSystem: AxisIndicatorSystem): void {
    axisIndicatorSystem.renderer.dispose();
    axisIndicatorSystem.container.remove();
}
