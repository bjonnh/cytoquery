import { describe, it, expect, beforeEach } from 'vitest';
import {
    createHyperdimensionManager,
    createSpatialSystem,
    createAxis,
    setNodePosition,
    removeNodePosition,
    getNode3DPosition,
    updateAxisMapping,
    deleteSpatialSystem,
    deleteAxis,
    serializeHyperdimensionData,
    deserializeHyperdimensionData,
    getAxesForSystem,
    validateAxisMapping
} from '../../graph/hyperdimension-manager';
import { HyperdimensionManager } from '../../types/hyperdimensions';

describe('HyperdimensionManager', () => {
    let manager: HyperdimensionManager;

    beforeEach(() => {
        manager = createHyperdimensionManager();
    });

    describe('createSpatialSystem', () => {
        it('should create a spatial system with unique ID', () => {
            const system = createSpatialSystem(manager, 'Time', 'Temporal coordinates');
            
            expect(system.name).toBe('Time');
            expect(system.description).toBe('Temporal coordinates');
            expect(system.id).toBeTruthy();
            expect(manager.spatialSystems.has(system.id)).toBe(true);
        });

        it('should create multiple spatial systems with unique IDs', () => {
            const system1 = createSpatialSystem(manager, 'Space');
            const system2 = createSpatialSystem(manager, 'Time');
            
            expect(system1.id).not.toBe(system2.id);
            expect(manager.spatialSystems.size).toBe(2);
        });
    });

    describe('createAxis', () => {
        it('should create an axis within a spatial system', () => {
            const system = createSpatialSystem(manager, 'Space');
            const axis = createAxis(manager, system.id, 'X', 'Horizontal axis');
            
            expect(axis).not.toBeNull();
            expect(axis!.name).toBe('X');
            expect(axis!.description).toBe('Horizontal axis');
            expect(axis!.spatialSystemId).toBe(system.id);
            expect(manager.axes.has(axis!.id)).toBe(true);
        });

        it('should create axis with bounds', () => {
            const system = createSpatialSystem(manager, 'Normalized');
            const axis = createAxis(manager, system.id, 'Unit', 'Normalized axis', { min: 0, max: 1 });
            
            expect(axis!.bounds).toEqual({ min: 0, max: 1 });
        });

        it('should return null for non-existent spatial system', () => {
            const axis = createAxis(manager, 'invalid-id', 'X');
            expect(axis).toBeNull();
        });
    });

    describe('setNodePosition', () => {
        let systemId: string;
        let axisId: string;

        beforeEach(() => {
            const system = createSpatialSystem(manager, 'Space');
            const axis = createAxis(manager, system.id, 'X');
            systemId = system.id;
            axisId = axis!.id;
        });

        it('should set node position for an axis', () => {
            const result = setNodePosition(manager, 'node1', axisId, 100);
            
            expect(result).toBe(true);
            expect(manager.nodePositions.has('node1')).toBe(true);
            expect(manager.nodePositions.get('node1')!.positions.get(axisId)).toBe(100);
        });

        it('should update existing node position', () => {
            setNodePosition(manager, 'node1', axisId, 100);
            setNodePosition(manager, 'node1', axisId, 200);
            
            expect(manager.nodePositions.get('node1')!.positions.get(axisId)).toBe(200);
        });

        it('should respect axis bounds', () => {
            const boundedAxis = createAxis(manager, systemId, 'Bounded', '', { min: 0, max: 10 });
            
            expect(setNodePosition(manager, 'node1', boundedAxis!.id, 5)).toBe(true);
            expect(setNodePosition(manager, 'node1', boundedAxis!.id, -1)).toBe(false);
            expect(setNodePosition(manager, 'node1', boundedAxis!.id, 11)).toBe(false);
        });

        it('should return false for non-existent axis', () => {
            expect(setNodePosition(manager, 'node1', 'invalid-axis', 100)).toBe(false);
        });

        it('should handle multiple axes per node', () => {
            const axis2 = createAxis(manager, systemId, 'Y');
            
            setNodePosition(manager, 'node1', axisId, 100);
            setNodePosition(manager, 'node1', axis2!.id, 200);
            
            const nodePos = manager.nodePositions.get('node1')!;
            expect(nodePos.positions.size).toBe(2);
            expect(nodePos.positions.get(axisId)).toBe(100);
            expect(nodePos.positions.get(axis2!.id)).toBe(200);
        });
    });

    describe('removeNodePosition', () => {
        let axisId: string;

        beforeEach(() => {
            const system = createSpatialSystem(manager, 'Space');
            const axis = createAxis(manager, system.id, 'X');
            axisId = axis!.id;
        });

        it('should remove node position for an axis', () => {
            setNodePosition(manager, 'node1', axisId, 100);
            removeNodePosition(manager, 'node1', axisId);
            
            const nodePos = manager.nodePositions.get('node1');
            expect(nodePos).toBeUndefined();
        });

        it('should remove node entry when all positions are removed', () => {
            const axis2 = createAxis(manager, manager.spatialSystems.keys().next().value, 'Y');
            
            setNodePosition(manager, 'node1', axisId, 100);
            setNodePosition(manager, 'node1', axis2!.id, 200);
            
            removeNodePosition(manager, 'node1', axisId);
            expect(manager.nodePositions.has('node1')).toBe(true);
            
            removeNodePosition(manager, 'node1', axis2!.id);
            expect(manager.nodePositions.has('node1')).toBe(false);
        });
    });

    describe('getNode3DPosition', () => {
        let xAxisId: string;
        let yAxisId: string;
        let zAxisId: string;

        beforeEach(() => {
            const system = createSpatialSystem(manager, 'Space');
            xAxisId = createAxis(manager, system.id, 'X')!.id;
            yAxisId = createAxis(manager, system.id, 'Y')!.id;
            zAxisId = createAxis(manager, system.id, 'Z')!.id;
        });

        it('should return null positions for unmapped axes', () => {
            const pos = getNode3DPosition(manager, 'node1');
            expect(pos).toEqual({ x: null, y: null, z: null });
        });

        it('should return node positions for mapped axes', () => {
            updateAxisMapping(manager, 'x', xAxisId);
            updateAxisMapping(manager, 'y', yAxisId);
            updateAxisMapping(manager, 'z', zAxisId);
            
            setNodePosition(manager, 'node1', xAxisId, 10);
            setNodePosition(manager, 'node1', yAxisId, 20);
            setNodePosition(manager, 'node1', zAxisId, 30);
            
            const pos = getNode3DPosition(manager, 'node1');
            expect(pos).toEqual({ x: 10, y: 20, z: 30 });
        });

        it('should return null for unmapped dimensions', () => {
            updateAxisMapping(manager, 'x', xAxisId);
            setNodePosition(manager, 'node1', xAxisId, 10);
            
            const pos = getNode3DPosition(manager, 'node1');
            expect(pos).toEqual({ x: 10, y: null, z: null });
        });

        it('should return null for unlocked dimensions', () => {
            updateAxisMapping(manager, 'x', xAxisId);
            updateAxisMapping(manager, 'y', yAxisId);
            
            setNodePosition(manager, 'node1', xAxisId, 10);
            // Node has no position for Y axis, so it's unlocked in that dimension
            
            const pos = getNode3DPosition(manager, 'node1');
            expect(pos).toEqual({ x: 10, y: null, z: null });
        });
    });

    describe('updateAxisMapping', () => {
        let axisId: string;

        beforeEach(() => {
            const system = createSpatialSystem(manager, 'Space');
            axisId = createAxis(manager, system.id, 'X')!.id;
        });

        it('should update axis mapping', () => {
            expect(updateAxisMapping(manager, 'x', axisId)).toBe(true);
            expect(manager.axisMapping.xAxis).toBe(axisId);
        });

        it('should allow null mapping', () => {
            updateAxisMapping(manager, 'x', axisId);
            expect(updateAxisMapping(manager, 'x', null)).toBe(true);
            expect(manager.axisMapping.xAxis).toBeNull();
        });

        it('should reject invalid axis ID', () => {
            expect(updateAxisMapping(manager, 'x', 'invalid-axis')).toBe(false);
        });
    });

    describe('deleteSpatialSystem', () => {
        it('should delete system and all its axes', () => {
            const system = createSpatialSystem(manager, 'Space');
            const axis1 = createAxis(manager, system.id, 'X');
            const axis2 = createAxis(manager, system.id, 'Y');
            
            setNodePosition(manager, 'node1', axis1!.id, 100);
            setNodePosition(manager, 'node1', axis2!.id, 200);
            updateAxisMapping(manager, 'x', axis1!.id);
            
            deleteSpatialSystem(manager, system.id);
            
            expect(manager.spatialSystems.has(system.id)).toBe(false);
            expect(manager.axes.has(axis1!.id)).toBe(false);
            expect(manager.axes.has(axis2!.id)).toBe(false);
            expect(manager.nodePositions.has('node1')).toBe(false);
            expect(manager.axisMapping.xAxis).toBeNull();
        });
    });

    describe('deleteAxis', () => {
        it('should delete axis and update mappings', () => {
            const system = createSpatialSystem(manager, 'Space');
            const axis = createAxis(manager, system.id, 'X');
            
            setNodePosition(manager, 'node1', axis!.id, 100);
            updateAxisMapping(manager, 'x', axis!.id);
            
            deleteAxis(manager, axis!.id);
            
            expect(manager.axes.has(axis!.id)).toBe(false);
            expect(manager.nodePositions.has('node1')).toBe(false);
            expect(manager.axisMapping.xAxis).toBeNull();
        });

        it('should preserve other node positions', () => {
            const system = createSpatialSystem(manager, 'Space');
            const axis1 = createAxis(manager, system.id, 'X');
            const axis2 = createAxis(manager, system.id, 'Y');
            
            setNodePosition(manager, 'node1', axis1!.id, 100);
            setNodePosition(manager, 'node1', axis2!.id, 200);
            
            deleteAxis(manager, axis1!.id);
            
            expect(manager.nodePositions.has('node1')).toBe(true);
            expect(manager.nodePositions.get('node1')!.positions.has(axis2!.id)).toBe(true);
        });
    });

    describe('serialization', () => {
        it('should serialize and deserialize manager state', () => {
            // Set up complex state
            const system1 = createSpatialSystem(manager, 'Space', 'Spatial dimensions');
            const system2 = createSpatialSystem(manager, 'Time', 'Temporal dimensions');
            
            const xAxis = createAxis(manager, system1.id, 'X', 'Horizontal');
            const yAxis = createAxis(manager, system1.id, 'Y', 'Vertical', { min: -100, max: 100 });
            const tAxis = createAxis(manager, system2.id, 'T', 'Time');
            
            setNodePosition(manager, 'node1', xAxis!.id, 10);
            setNodePosition(manager, 'node1', yAxis!.id, 20);
            setNodePosition(manager, 'node2', tAxis!.id, 2023);
            
            updateAxisMapping(manager, 'x', xAxis!.id);
            updateAxisMapping(manager, 'y', yAxis!.id);
            updateAxisMapping(manager, 'z', tAxis!.id);
            
            // Serialize
            const serialized = serializeHyperdimensionData(manager);
            
            // Deserialize
            const restored = deserializeHyperdimensionData(serialized);
            
            // Verify
            expect(restored.spatialSystems.size).toBe(2);
            expect(restored.axes.size).toBe(3);
            expect(restored.nodePositions.size).toBe(2);
            
            expect(restored.spatialSystems.get(system1.id)!.name).toBe('Space');
            expect(restored.axes.get(yAxis!.id)!.bounds).toEqual({ min: -100, max: 100 });
            expect(restored.nodePositions.get('node1')!.positions.get(xAxis!.id)).toBe(10);
            
            expect(restored.axisMapping.xAxis).toBe(xAxis!.id);
            expect(restored.axisMapping.yAxis).toBe(yAxis!.id);
            expect(restored.axisMapping.zAxis).toBe(tAxis!.id);
        });
    });

    describe('getAxesForSystem', () => {
        it('should return all axes for a system', () => {
            const system = createSpatialSystem(manager, 'Space');
            const axis1 = createAxis(manager, system.id, 'X');
            const axis2 = createAxis(manager, system.id, 'Y');
            
            const otherSystem = createSpatialSystem(manager, 'Time');
            createAxis(manager, otherSystem.id, 'T');
            
            const axes = getAxesForSystem(manager, system.id);
            expect(axes.length).toBe(2);
            expect(axes.map(a => a.id)).toContain(axis1!.id);
            expect(axes.map(a => a.id)).toContain(axis2!.id);
        });
    });

    describe('validateAxisMapping', () => {
        it('should clear invalid axis mappings', () => {
            const system = createSpatialSystem(manager, 'Space');
            const axis = createAxis(manager, system.id, 'X');
            
            updateAxisMapping(manager, 'x', axis!.id);
            updateAxisMapping(manager, 'y', axis!.id);
            updateAxisMapping(manager, 'z', axis!.id);
            
            deleteAxis(manager, axis!.id);
            validateAxisMapping(manager);
            
            expect(manager.axisMapping.xAxis).toBeNull();
            expect(manager.axisMapping.yAxis).toBeNull();
            expect(manager.axisMapping.zAxis).toBeNull();
        });
    });
});