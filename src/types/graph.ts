export interface GraphParameters {
    force?: {
        alphaDecay?: number;
        velocityDecay?: number;
        alphaMin?: number;
    };
    dag?: {
        mode?: string;
        levelDistance?: number;
    };
    nodeStyle?: {
        size?: number;
        opacity?: number;
        resolution?: number;
    };
    linkStyle?: {
        opacity?: number;
        width?: number;
        curvature?: number;
        particles?: number;
        particleSpeed?: number;
    };
    bloom?: {
        strength?: number;
        radius?: number;
        threshold?: number;
    };
    interaction?: {
        enableDrag?: boolean;
    };
    performance?: {
        warmupTicks?: number;
        cooldownTicks?: number;
        cooldownTime?: number;
    };
    lockedNodes?: Array<{
        name: string;
        x: number;
        y: number;
        z: number;
    }>;
}

export interface GraphNode {
    id: string;
    name: string;
    val: number;
    color: string;
    shape: string;
    material: string;
    size: number;
    fx?: number;
    fy?: number;
    fz?: number;
    x?: number;
    y?: number;
    z?: number;
}

export interface GraphLink {
    source: string;
    target: string;
}

export interface GraphData {
    nodes: GraphNode[];
    links: GraphLink[];
}