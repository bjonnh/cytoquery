import { SerializedHyperdimensionData } from './hyperdimensions';

/**
 * Interface defining all configurable parameters for the 3D force graph
 */
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
    ui?: {
        /** Show the 3D axis indicator in the bottom left */
        showAxisIndicator?: boolean;
        /** Show navigation help text at the bottom */
        showNavInfo?: boolean;
    };
    /**
     * @deprecated Use hyperdimensions instead
     */
    lockedNodes?: Array<{
        name: string;
        x: number;
        y: number;
        z: number;
    }>;
    /** Hyperdimensional positioning data */
    hyperdimensions?: SerializedHyperdimensionData;
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
