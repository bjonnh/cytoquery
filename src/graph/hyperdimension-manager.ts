import {
    SpatialSystem,
    Axis,
    LockedNodePosition,
    AxisMapping,
    HyperdimensionManager,
    SerializedHyperdimensionData
} from '../types/hyperdimensions';

/**
 * Creates a new hyperdimension manager with default state
 */
export function createHyperdimensionManager(): HyperdimensionManager {
    return {
        spatialSystems: new Map(),
        axes: new Map(),
        nodePositions: new Map(),
        axisMapping: {
            xAxis: null,
            yAxis: null,
            zAxis: null
        }
    };
}

/**
 * Generates a unique ID for spatial systems and axes
 */
function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Creates a new spatial system
 */
export function createSpatialSystem(
    manager: HyperdimensionManager,
    name: string,
    description?: string
): SpatialSystem {
    const system: SpatialSystem = {
        id: generateId(),
        name,
        description
    };
    manager.spatialSystems.set(system.id, system);
    return system;
}

/**
 * Creates a new axis within a spatial system
 */
export function createAxis(
    manager: HyperdimensionManager,
    spatialSystemId: string,
    name: string,
    description?: string,
    bounds?: { min?: number; max?: number }
): Axis | null {
    // Verify spatial system exists
    if (!manager.spatialSystems.has(spatialSystemId)) {
        return null;
    }

    const axis: Axis = {
        id: generateId(),
        spatialSystemId,
        name,
        description,
        bounds
    };
    manager.axes.set(axis.id, axis);
    return axis;
}

/**
 * Updates a node's position for a specific axis
 */
export function setNodePosition(
    manager: HyperdimensionManager,
    nodeId: string,
    axisId: string,
    value: number
): boolean {
    // Verify axis exists
    if (!manager.axes.has(axisId)) {
        return false;
    }

    // Get or create node position entry
    let nodePosition = manager.nodePositions.get(nodeId);
    if (!nodePosition) {
        nodePosition = {
            nodeId,
            positions: new Map()
        };
        manager.nodePositions.set(nodeId, nodePosition);
    }

    // Validate bounds if they exist
    const axis = manager.axes.get(axisId)!;
    if (axis.bounds) {
        if (axis.bounds.min !== undefined && value < axis.bounds.min) {
            return false;
        }
        if (axis.bounds.max !== undefined && value > axis.bounds.max) {
            return false;
        }
    }

    nodePosition.positions.set(axisId, value);
    return true;
}

/**
 * Removes a node's position for a specific axis (unlocks it in that dimension)
 */
export function removeNodePosition(
    manager: HyperdimensionManager,
    nodeId: string,
    axisId: string
): void {
    const nodePosition = manager.nodePositions.get(nodeId);
    if (nodePosition) {
        nodePosition.positions.delete(axisId);
        // If no positions remain, remove the node position entry entirely
        if (nodePosition.positions.size === 0) {
            manager.nodePositions.delete(nodeId);
        }
    }
}

/**
 * Gets a node's position for the currently mapped 3D axes
 * Returns null for axes where the node is unlocked
 */
export function getNode3DPosition(
    manager: HyperdimensionManager,
    nodeId: string
): { x: number | null; y: number | null; z: number | null } {
    const nodePosition = manager.nodePositions.get(nodeId);
    const result: { x: number | null; y: number | null; z: number | null } = { x: null, y: null, z: null };

    if (!nodePosition) {
        return result;
    }

    if (manager.axisMapping.xAxis) {
        result.x = nodePosition.positions.get(manager.axisMapping.xAxis) ?? null;
    }
    if (manager.axisMapping.yAxis) {
        result.y = nodePosition.positions.get(manager.axisMapping.yAxis) ?? null;
    }
    if (manager.axisMapping.zAxis) {
        result.z = nodePosition.positions.get(manager.axisMapping.zAxis) ?? null;
    }

    return result;
}

/**
 * Updates the axis mapping for 3D visualization
 */
export function updateAxisMapping(
    manager: HyperdimensionManager,
    dimension: 'x' | 'y' | 'z',
    axisId: string | null
): boolean {
    // Verify axis exists if not null
    if (axisId !== null && !manager.axes.has(axisId)) {
        return false;
    }

    switch (dimension) {
        case 'x':
            manager.axisMapping.xAxis = axisId;
            break;
        case 'y':
            manager.axisMapping.yAxis = axisId;
            break;
        case 'z':
            manager.axisMapping.zAxis = axisId;
            break;
    }

    return true;
}

/**
 * Deletes a spatial system and all its axes
 */
export function deleteSpatialSystem(
    manager: HyperdimensionManager,
    systemId: string
): void {
    // Find and delete all axes in this system
    const axesToDelete: string[] = [];
    manager.axes.forEach((axis, axisId) => {
        if (axis.spatialSystemId === systemId) {
            axesToDelete.push(axisId);
        }
    });

    // Delete axes and their associated node positions
    axesToDelete.forEach(axisId => {
        deleteAxis(manager, axisId);
    });

    // Delete the spatial system
    manager.spatialSystems.delete(systemId);
}

/**
 * Deletes an axis and removes all node positions for it
 */
export function deleteAxis(
    manager: HyperdimensionManager,
    axisId: string
): void {
    // Remove axis from mapping if it's currently mapped
    if (manager.axisMapping.xAxis === axisId) {
        manager.axisMapping.xAxis = null;
    }
    if (manager.axisMapping.yAxis === axisId) {
        manager.axisMapping.yAxis = null;
    }
    if (manager.axisMapping.zAxis === axisId) {
        manager.axisMapping.zAxis = null;
    }

    // Remove all node positions for this axis
    manager.nodePositions.forEach(nodePosition => {
        nodePosition.positions.delete(axisId);
    });

    // Clean up empty node positions
    const emptyNodes: string[] = [];
    manager.nodePositions.forEach((nodePosition, nodeId) => {
        if (nodePosition.positions.size === 0) {
            emptyNodes.push(nodeId);
        }
    });
    emptyNodes.forEach(nodeId => manager.nodePositions.delete(nodeId));

    // Delete the axis
    manager.axes.delete(axisId);
}

/**
 * Serializes the hyperdimension manager for storage
 */
export function serializeHyperdimensionData(
    manager: HyperdimensionManager
): SerializedHyperdimensionData {
    const spatialSystems = Array.from(manager.spatialSystems.values());
    const axes = Array.from(manager.axes.values());
    
    const nodePositions = Array.from(manager.nodePositions.values()).map(nodePos => ({
        nodeId: nodePos.nodeId,
        positions: Array.from(nodePos.positions.entries()).map(([axisId, value]) => ({
            axisId,
            value
        }))
    }));

    return {
        spatialSystems,
        axes,
        nodePositions,
        axisMapping: { ...manager.axisMapping }
    };
}

/**
 * Deserializes hyperdimension data into a manager
 */
export function deserializeHyperdimensionData(
    data: SerializedHyperdimensionData
): HyperdimensionManager {
    const manager = createHyperdimensionManager();

    // Restore spatial systems
    data.spatialSystems.forEach(system => {
        manager.spatialSystems.set(system.id, system);
    });

    // Restore axes
    data.axes.forEach(axis => {
        manager.axes.set(axis.id, axis);
    });

    // Restore node positions
    data.nodePositions.forEach(nodeData => {
        const positions = new Map<string, number>();
        nodeData.positions.forEach(pos => {
            positions.set(pos.axisId, pos.value);
        });
        manager.nodePositions.set(nodeData.nodeId, {
            nodeId: nodeData.nodeId,
            positions
        });
    });

    // Restore axis mapping
    manager.axisMapping = { ...data.axisMapping };

    return manager;
}

/**
 * Gets all axes for a specific spatial system
 */
export function getAxesForSystem(
    manager: HyperdimensionManager,
    systemId: string
): Axis[] {
    const axes: Axis[] = [];
    manager.axes.forEach(axis => {
        if (axis.spatialSystemId === systemId) {
            axes.push(axis);
        }
    });
    return axes;
}

/**
 * Validates that current axis mapping is still valid
 * (axes might have been deleted)
 */
export function validateAxisMapping(manager: HyperdimensionManager): void {
    if (manager.axisMapping.xAxis && !manager.axes.has(manager.axisMapping.xAxis)) {
        manager.axisMapping.xAxis = null;
    }
    if (manager.axisMapping.yAxis && !manager.axes.has(manager.axisMapping.yAxis)) {
        manager.axisMapping.yAxis = null;
    }
    if (manager.axisMapping.zAxis && !manager.axes.has(manager.axisMapping.zAxis)) {
        manager.axisMapping.zAxis = null;
    }
}

/**
 * Removes all position data for a node (used when unlocking)
 */
export function removeNodePositions(
    manager: HyperdimensionManager,
    nodeId: string
): void {
    manager.nodePositions.delete(nodeId);
}