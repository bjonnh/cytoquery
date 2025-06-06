declare module 'three-render-objects' {
  import { WebGLRendererParameters, Scene, Camera, WebGLRenderer, Object3D, Light } from 'three';
  import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
  import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls';
  import { FlyControls } from 'three/examples/jsm/controls/FlyControls';

  export interface ConfigOptions {
    controlType?: 'trackball' | 'orbit' | 'fly';
    rendererConfig?: WebGLRendererParameters;
    extraRenderers?: any[];
  }

  export interface ThreeRenderObjectsInstance {
    (element: HTMLElement): ThreeRenderObjectsInstance;
    
    // Container layout
    width(): number;
    width(width: number): ThreeRenderObjectsInstance;
    height(): number;
    height(height: number): ThreeRenderObjectsInstance;
    backgroundColor(): string;
    backgroundColor(color: string): ThreeRenderObjectsInstance;
    showNavInfo(): boolean;
    showNavInfo(enabled: boolean): ThreeRenderObjectsInstance;
    
    // Objects
    objects(): Object3D[];
    objects(objs: Object3D[]): ThreeRenderObjectsInstance;
    
    // Scene
    scene(): Scene;
    camera(): Camera;
    renderer(): WebGLRenderer;
    controls(): OrbitControls | TrackballControls | FlyControls;
    tbControls(): any; // Legacy
    
    // Lighting
    lights(): Light[];
    lights(lights: Light[]): ThreeRenderObjectsInstance;
    
    // Camera controls
    cameraPosition(): { x: number; y: number; z: number };
    cameraPosition(position: Partial<{ x: number; y: number; z: number }>, lookAt?: { x: number; y: number; z: number }, transitionMs?: number): ThreeRenderObjectsInstance;
    fitToBbox(bbox: { x: [number, number]; y: [number, number]; z: [number, number] }, transitionMs?: number, padding?: number): ThreeRenderObjectsInstance;
    
    // Post-processing
    postProcessingComposer(): any;
    
    // Render cycle
    tick(): ThreeRenderObjectsInstance;
    
    // Interaction
    enablePointerInteraction(): boolean;
    enablePointerInteraction(enable: boolean): ThreeRenderObjectsInstance;
    lineHoverPrecision(): number;
    lineHoverPrecision(precision: number): ThreeRenderObjectsInstance;
    hoverOrderComparator(compareFn: (a: Object3D, b: Object3D) => number): ThreeRenderObjectsInstance;
    tooltipContent(contentFn: (obj: Object3D) => string): ThreeRenderObjectsInstance;
    hoverDuringDrag(enabled: boolean): ThreeRenderObjectsInstance;
    clickAfterDrag(enabled: boolean): ThreeRenderObjectsInstance;
    onHover(callback: (obj: Object3D | null) => void): ThreeRenderObjectsInstance;
    onClick(callback: (obj: Object3D | null, event: MouseEvent) => void): ThreeRenderObjectsInstance;
    onRightClick(callback: (obj: Object3D | null, event: MouseEvent) => void): ThreeRenderObjectsInstance;
    
    // Coordinate conversion
    getScreenCoords(x: number, y: number, z: number): { x: number; y: number };
    getSceneCoords(screenX: number, screenY: number, distance: number): { x: number; y: number; z: number };
  }

  export default function ThreeRenderObjects(config?: ConfigOptions): ThreeRenderObjectsInstance;
}