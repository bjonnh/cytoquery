declare module '3d-force-graph' {
  interface ForceGraphInstance {
    (element: HTMLElement): ForceGraphInstance;
    backgroundColor(color: string): ForceGraphInstance;
    nodeLabel(label: string): ForceGraphInstance;
    nodeColor(colorFn: () => string): ForceGraphInstance;
    linkColor(colorFn: () => string): ForceGraphInstance;
    linkWidth(width: number): ForceGraphInstance;
    linkDirectionalArrowLength(length: number): ForceGraphInstance;
    linkDirectionalArrowRelPos(pos: number): ForceGraphInstance;
    graphData(data: any): ForceGraphInstance;
  }

  export default function ForceGraph3D(): ForceGraphInstance;
}
