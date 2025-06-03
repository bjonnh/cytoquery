import { describe, it, expect } from 'vitest';
import { 
    createHyperdimensionManager, 
    createSpatialSystem, 
    createAxis, 
    setNodePosition,
    removeNodePositions
} from './hyperdimension-manager';

describe('hyperdimension node unlocking', () => {
    it('should remove all position data when node is unlocked', () => {
        const manager = createHyperdimensionManager();
        
        // Create a spatial system and axes
        const system = createSpatialSystem(manager, 'Time');
        const yearAxis = createAxis(manager, system.id, 'Year');
        const monthAxis = createAxis(manager, system.id, 'Month');
        
        expect(yearAxis).not.toBeNull();
        expect(monthAxis).not.toBeNull();
        
        // Set positions for a node
        const result1 = setNodePosition(manager, 'node1', yearAxis!.id, 2024);
        const result2 = setNodePosition(manager, 'node1', monthAxis!.id, 6);
        expect(result1).toBe(true);
        expect(result2).toBe(true);
        
        // Verify positions are stored
        const nodePos = manager.nodePositions.get('node1');
        expect(nodePos).toBeDefined();
        expect(nodePos?.positions.get(yearAxis!.id)).toBe(2024);
        expect(nodePos?.positions.get(monthAxis!.id)).toBe(6);
        
        // Remove node positions (unlock)
        removeNodePositions(manager, 'node1');
        
        // Verify positions are removed
        expect(manager.nodePositions.get('node1')).toBeUndefined();
    });
    
    it('should only remove positions for the specified node', () => {
        const manager = createHyperdimensionManager();
        
        // Create a spatial system and axis
        const system = createSpatialSystem(manager, 'Time');
        const yearAxis = createAxis(manager, system.id, 'Year');
        
        expect(yearAxis).not.toBeNull();
        
        // Set positions for multiple nodes
        setNodePosition(manager, 'node1', yearAxis!.id, 2024);
        setNodePosition(manager, 'node2', yearAxis!.id, 2023);
        
        // Remove positions for node1 only
        removeNodePositions(manager, 'node1');
        
        // Verify node1 positions are removed but node2 remains
        expect(manager.nodePositions.get('node1')).toBeUndefined();
        expect(manager.nodePositions.get('node2')).toBeDefined();
        expect(manager.nodePositions.get('node2')?.positions.get(yearAxis!.id)).toBe(2023);
    });
});