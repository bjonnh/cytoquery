declare module 'three-forcegraph' {
  import { Object3D, Vector3 } from 'three';

  export interface NodeObject {
    id?: string | number;
    x?: number;
    y?: number;
    z?: number;
    vx?: number;
    vy?: number;
    vz?: number;
    fx?: number;
    fy?: number;
    fz?: number;
    __threeObj?: Object3D;
    [key: string]: any;
  }

  export interface LinkObject<N extends NodeObject = NodeObject> {
    source?: string | number | N;
    target?: string | number | N;
    [key: string]: any;
  }

  export interface GraphData<N extends NodeObject = NodeObject, L extends LinkObject<N> = LinkObject<N>> {
    nodes: N[];
    links: L[];
  }

  export interface ThreeForceGraphGeneric<ChainableInstance, N extends NodeObject = NodeObject, L extends LinkObject<N> = LinkObject<N>> {
    // Data input
    graphData(): GraphData<N, L>;
    graphData(data: GraphData<N, L>): ChainableInstance;
    jsonUrl(): string | null;
    jsonUrl(url: string | null): ChainableInstance;
    
    // Node styling
    nodeId(accessor: string | ((node: N) => string | number)): ChainableInstance;
    nodeVal(accessor: string | ((node: N) => number)): ChainableInstance;
    nodeColor(accessor: string | ((node: N) => string)): ChainableInstance;
    nodeAutoColorBy(accessor: string | ((node: N) => string | null)): ChainableInstance;
    nodeOpacity(opacity: number): ChainableInstance;
    nodeResolution(resolution: number): ChainableInstance;
    nodeThreeObject(accessor: Object3D | string | ((node: N) => Object3D)): ChainableInstance;
    nodeThreeObjectExtend(extend: boolean): ChainableInstance;
    
    // Link styling
    linkSource(accessor: string | ((link: L) => string | number | N)): ChainableInstance;
    linkTarget(accessor: string | ((link: L) => string | number | N)): ChainableInstance;
    linkColor(accessor: string | ((link: L) => string)): ChainableInstance;
    linkAutoColorBy(accessor: string | ((link: L) => string | null)): ChainableInstance;
    linkOpacity(opacity: number): ChainableInstance;
    linkWidth(accessor: string | number | ((link: L) => number)): ChainableInstance;
    
    // Force engine
    forceEngine(engine: 'd3' | 'ngraph'): ChainableInstance;
    d3AlphaDecay(decay: number): ChainableInstance;
    d3VelocityDecay(decay: number): ChainableInstance;
    d3Force(forceName: string, force: any): ChainableInstance;
    d3ReheatSimulation(): ChainableInstance;
    
    // Interaction
    onNodeClick(callback: (node: N, event: MouseEvent) => void): ChainableInstance;
    onNodeRightClick(callback: (node: N, event: MouseEvent) => void): ChainableInstance;
    onNodeHover(callback: (node: N | null, previousNode: N | null) => void): ChainableInstance;
    onLinkClick(callback: (link: L, event: MouseEvent) => void): ChainableInstance;
    onLinkRightClick(callback: (link: L, event: MouseEvent) => void): ChainableInstance;
    onLinkHover(callback: (link: L | null, previousLink: L | null) => void): ChainableInstance;
    
    // Utility
    tickFrame(): ChainableInstance;
    resetProps(): ChainableInstance;
    refresh(): ChainableInstance;
    
    // Getters
    getGraphBbox(nodeFilter?: (node: N) => boolean): { x: [number, number]; y: [number, number]; z: [number, number] };
    
    // Events
    onLoading(callback: () => void): ChainableInstance;
    onFinishLoading(callback: () => void): ChainableInstance;
    onUpdate(callback: () => void): ChainableInstance;
    onFinishUpdate(callback: () => void): ChainableInstance;
    onEngineTick(callback: () => void): ChainableInstance;
    onEngineStop(callback: () => void): ChainableInstance;
    
    // Other properties from forceGraph
    numDimensions(dim: 1 | 2 | 3): ChainableInstance;
    dagMode(mode: string | null): ChainableInstance;
    dagLevelDistance(distance: number): ChainableInstance;
    dagNodeFilter(filter: (node: N) => boolean): ChainableInstance;
    onDagError(callback: (loopNodeIds: string[]) => void): ChainableInstance;
    nodeRelSize(relSize: number): ChainableInstance;
    nodeVisibility(accessor: boolean | string | ((node: N) => boolean)): ChainableInstance;
    nodePositionUpdate(callback: (node: N, coords: { x: number; y: number; z: number }, node3d: Object3D) => void): ChainableInstance;
    linkVisibility(accessor: boolean | string | ((link: L) => boolean)): ChainableInstance;
    linkResolution(resolution: number): ChainableInstance;
    linkCurvature(curvature: number | string | ((link: L) => number)): ChainableInstance;
    linkCurveRotation(rotation: number | string | ((link: L) => number)): ChainableInstance;
    linkMaterial(material: any | string | ((link: L) => any)): ChainableInstance;
    linkThreeObject(accessor: Object3D | string | ((link: L) => Object3D)): ChainableInstance;
    linkThreeObjectExtend(extend: boolean): ChainableInstance;
    linkPositionUpdate(callback: (link: L, coords: { start: Coords; end: Coords }, link3d: Object3D) => void): ChainableInstance;
    linkDirectionalArrowLength(length: number | string | ((link: L) => number)): ChainableInstance;
    linkDirectionalArrowColor(color: string | ((link: L) => string | null)): ChainableInstance;
    linkDirectionalArrowRelPos(relPos: number | string | ((link: L) => number)): ChainableInstance;
    linkDirectionalArrowResolution(resolution: number): ChainableInstance;
    linkDirectionalParticles(particles: number | string | ((link: L) => number)): ChainableInstance;
    linkDirectionalParticleSpeed(speed: number | string | ((link: L) => number)): ChainableInstance;
    linkDirectionalParticleWidth(width: number | string | ((link: L) => number)): ChainableInstance;
    linkDirectionalParticleColor(color: string | ((link: L) => string | null)): ChainableInstance;
    linkDirectionalParticleResolution(resolution: number): ChainableInstance;
    ngraphPhysics(physics: object): ChainableInstance;
    warmupTicks(ticks: number): ChainableInstance;
    cooldownTicks(ticks: number): ChainableInstance;
    cooldownTime(ms: number): ChainableInstance;
    d3AlphaMin(alphaMin: number): ChainableInstance;
    d3AlphaTarget(alphaTarget: number): ChainableInstance;
    resetCountdown(): ChainableInstance;
    position: Vector3;
    emitParticle(link: L): ChainableInstance;
  }

  type Coords = { x: number; y: number; z: number };

  class ThreeForceGraph<N extends NodeObject = NodeObject, L extends LinkObject<N> = LinkObject<N>>
    extends Object3D
    implements ThreeForceGraphGeneric<ThreeForceGraph<N, L>, N, L> {
    constructor(graphData?: GraphData<N, L>);
    // Include all methods from ThreeForceGraphGeneric interface
    graphData(): GraphData<N, L>;
    graphData(data: GraphData<N, L>): this;
    jsonUrl(): string | null;
    jsonUrl(url: string | null): this;
    nodeId(accessor: string | ((node: N) => string | number)): this;
    nodeVal(accessor: string | ((node: N) => number)): this;
    nodeColor(accessor: string | ((node: N) => string)): this;
    nodeAutoColorBy(accessor: string | ((node: N) => string | null)): this;
    nodeOpacity(opacity: number): this;
    nodeResolution(resolution: number): this;
    nodeThreeObject(accessor: Object3D | string | ((node: N) => Object3D)): this;
    nodeThreeObjectExtend(extend: boolean): this;
    linkSource(accessor: string | ((link: L) => string | number | N)): this;
    linkTarget(accessor: string | ((link: L) => string | number | N)): this;
    linkColor(accessor: string | ((link: L) => string)): this;
    linkAutoColorBy(accessor: string | ((link: L) => string | null)): this;
    linkOpacity(opacity: number): this;
    linkWidth(accessor: string | number | ((link: L) => number)): this;
    forceEngine(engine: 'd3' | 'ngraph'): this;
    d3AlphaDecay(decay: number): this;
    d3VelocityDecay(decay: number): this;
    d3Force(forceName: string, force: any): this;
    d3ReheatSimulation(): this;
    onNodeClick(callback: (node: N, event: MouseEvent) => void): this;
    onNodeRightClick(callback: (node: N, event: MouseEvent) => void): this;
    onNodeHover(callback: (node: N | null, previousNode: N | null) => void): this;
    onLinkClick(callback: (link: L, event: MouseEvent) => void): this;
    onLinkRightClick(callback: (link: L, event: MouseEvent) => void): this;
    onLinkHover(callback: (link: L | null, previousLink: L | null) => void): this;
    tickFrame(): this;
    resetProps(): this;
    refresh(): this;
    getGraphBbox(nodeFilter?: (node: N) => boolean): { x: [number, number]; y: [number, number]; z: [number, number] };
    onLoading(callback: () => void): this;
    onFinishLoading(callback: () => void): this;
    onUpdate(callback: () => void): this;
    onFinishUpdate(callback: () => void): this;
    onEngineTick(callback: () => void): this;
    onEngineStop(callback: () => void): this;
    numDimensions(dim: 1 | 2 | 3): this;
    dagMode(mode: string | null): this;
    dagLevelDistance(distance: number): this;
    dagNodeFilter(filter: (node: N) => boolean): this;
    onDagError(callback: (loopNodeIds: string[]) => void): this;
    nodeRelSize(relSize: number): this;
    nodeVisibility(accessor: boolean | string | ((node: N) => boolean)): this;
    nodePositionUpdate(callback: (node: N, coords: { x: number; y: number; z: number }, node3d: Object3D) => void): this;
    linkVisibility(accessor: boolean | string | ((link: L) => boolean)): this;
    linkResolution(resolution: number): this;
    linkCurvature(curvature: number | string | ((link: L) => number)): this;
    linkCurveRotation(rotation: number | string | ((link: L) => number)): this;
    linkMaterial(material: any | string | ((link: L) => any)): this;
    linkThreeObject(accessor: Object3D | string | ((link: L) => Object3D)): this;
    linkThreeObjectExtend(extend: boolean): this;
    linkPositionUpdate(callback: (link: L, coords: { start: Coords; end: Coords }, link3d: Object3D) => void): this;
    linkDirectionalArrowLength(length: number | string | ((link: L) => number)): this;
    linkDirectionalArrowColor(color: string | ((link: L) => string | null)): this;
    linkDirectionalArrowRelPos(relPos: number | string | ((link: L) => number)): this;
    linkDirectionalArrowResolution(resolution: number): this;
    linkDirectionalParticles(particles: number | string | ((link: L) => number)): this;
    linkDirectionalParticleSpeed(speed: number | string | ((link: L) => number)): this;
    linkDirectionalParticleWidth(width: number | string | ((link: L) => number)): this;
    linkDirectionalParticleColor(color: string | ((link: L) => string | null)): this;
    linkDirectionalParticleResolution(resolution: number): this;
    ngraphPhysics(physics: object): this;
    warmupTicks(ticks: number): this;
    cooldownTicks(ticks: number): this;
    cooldownTime(ms: number): this;
    d3AlphaMin(alphaMin: number): this;
    d3AlphaTarget(alphaTarget: number): this;
    resetCountdown(): this;
    position: Vector3;
    emitParticle(link: L): this;
  }

  export default ThreeForceGraph;
}