/**
 * Represents a spatial coordinate system that can contain multiple axes
 */
export interface SpatialSystem {
    /** Unique identifier for the spatial system */
    id: string;
    /** Human-readable name for the spatial system */
    name: string;
    /** Optional description of what this spatial system represents */
    description?: string;
}

/**
 * Represents an axis within a spatial system
 */
export interface Axis {
    /** Unique identifier for the axis */
    id: string;
    /** The spatial system this axis belongs to */
    spatialSystemId: string;
    /** Human-readable name for the axis */
    name: string;
    /** Optional description of what this axis represents */
    description?: string;
    /** Optional min/max bounds for this axis */
    bounds?: {
        min?: number;
        max?: number;
    };
}

/**
 * Represents a node's positions across multiple axes in different spatial systems
 * If a node doesn't have a position for a given axis, it is unlocked in that dimension
 */
export interface LockedNodePosition {
    /** The node ID this position data belongs to */
    nodeId: string;
    /** Map of axis ID to position value */
    positions: Map<string, number>;
}

/**
 * Maps 3D graph axes (X, Y, Z) to specific axes from spatial systems
 */
export interface AxisMapping {
    /** The axis ID to use for the X dimension of the 3D graph */
    xAxis: string | null;
    /** The axis ID to use for the Y dimension of the 3D graph */
    yAxis: string | null;
    /** The axis ID to use for the Z dimension of the 3D graph */
    zAxis: string | null;
}

/**
 * Manages spatial systems and axes
 */
export interface HyperdimensionManager {
    /** All spatial systems */
    spatialSystems: Map<string, SpatialSystem>;
    /** All axes, indexed by ID */
    axes: Map<string, Axis>;
    /** Node positions across all axes */
    nodePositions: Map<string, LockedNodePosition>;
    /** Current axis mapping for the 3D graph */
    axisMapping: AxisMapping;
}

/**
 * UI state for hyperdimension management
 */
export interface HyperdimensionUIState {
    /** Whether the spatial system editor is open */
    showSpatialSystemEditor: boolean;
    /** Currently selected spatial system for editing */
    selectedSpatialSystem: string | null;
    /** Currently selected axis for editing */
    selectedAxis: string | null;
}

/**
 * Serializable format for storing hyperdimension data in parameters
 */
export interface SerializedHyperdimensionData {
    spatialSystems: Array<{
        id: string;
        name: string;
        description?: string;
    }>;
    axes: Array<{
        id: string;
        spatialSystemId: string;
        name: string;
        description?: string;
        bounds?: {
            min?: number;
            max?: number;
        };
    }>;
    nodePositions: Array<{
        nodeId: string;
        positions: Array<{
            axisId: string;
            value: number;
        }>;
    }>;
    axisMapping: {
        xAxis: string | null;
        yAxis: string | null;
        zAxis: string | null;
    };
}