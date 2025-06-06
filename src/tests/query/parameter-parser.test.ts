import { describe, it, expect } from 'vitest';
import { parseParametersAndQuery, formatParameters } from '../../query/parameter-parser';
import { GraphParameters } from '../../types/graph';

describe('Parameter Parser - Hyperdimensions', () => {
    it('should parse hyperdimension data correctly', () => {
        const source = `---
force:
  alphaDecay: 0.05
hyperdimensions:
  spatialSystems:
    - id: sys1
      name: Time
      description: Temporal coordinates
    - id: sys2
      name: Space
  axes:
    - id: axis1
      spatialSystemId: sys1
      name: Year
      bounds:
        min: 2000
        max: 2030
    - id: axis2
      spatialSystemId: sys2
      name: X
    - id: axis3
      spatialSystemId: sys2
      name: Y
  nodePositions:
    - nodeId: node1
      positions:
        - axisId: axis1
          value: 2023
        - axisId: axis2
          value: 100
    - nodeId: node2
      positions:
        - axisId: axis3
          value: -50
  axisMapping:
    xAxis: axis2
    yAxis: axis3
    zAxis: axis1
---
Query text here`;

        const result = parseParametersAndQuery(source);
        
        expect(result.parameters.force?.alphaDecay).toBe(0.05);
        expect(result.parameters.hyperdimensions).toBeDefined();
        
        const hyper = result.parameters.hyperdimensions!;
        
        // Check spatial systems
        expect(hyper.spatialSystems).toHaveLength(2);
        expect(hyper.spatialSystems[0]).toEqual({
            id: 'sys1',
            name: 'Time',
            description: 'Temporal coordinates'
        });
        expect(hyper.spatialSystems[1]).toEqual({
            id: 'sys2',
            name: 'Space'
        });
        
        // Check axes
        expect(hyper.axes).toHaveLength(3);
        expect(hyper.axes[0]).toEqual({
            id: 'axis1',
            spatialSystemId: 'sys1',
            name: 'Year',
            bounds: { min: 2000, max: 2030 }
        });
        
        // Check node positions
        expect(hyper.nodePositions).toHaveLength(2);
        expect(hyper.nodePositions[0]).toEqual({
            nodeId: 'node1',
            positions: [
                { axisId: 'axis1', value: 2023 },
                { axisId: 'axis2', value: 100 }
            ]
        });
        
        // Check axis mapping
        expect(hyper.axisMapping).toEqual({
            xAxis: 'axis2',
            yAxis: 'axis3',
            zAxis: 'axis1'
        });
        
        expect(result.query).toBe('Query text here');
    });

    it('should format hyperdimension data correctly', () => {
        const params: GraphParameters = {
            force: {
                alphaDecay: 0.05
            },
            hyperdimensions: {
                spatialSystems: [
                    {
                        id: 'sys1',
                        name: 'Time',
                        description: 'Temporal coordinates'
                    }
                ],
                axes: [
                    {
                        id: 'axis1',
                        spatialSystemId: 'sys1',
                        name: 'Year',
                        bounds: { min: 2000, max: 2030 }
                    }
                ],
                nodePositions: [
                    {
                        nodeId: 'node1',
                        positions: [
                            { axisId: 'axis1', value: 2023 }
                        ]
                    }
                ],
                axisMapping: {
                    xAxis: 'axis1',
                    yAxis: null,
                    zAxis: null
                }
            }
        };

        const formatted = formatParameters(params);
        
        expect(formatted).toContain('force:');
        expect(formatted).toContain('  alphaDecay: 0.05');
        expect(formatted).toContain('hyperdimensions:');
        expect(formatted).toContain('  spatialSystems:');
        expect(formatted).toContain('    - id: sys1');
        expect(formatted).toContain('      name: Time');
        expect(formatted).toContain('      description: Temporal coordinates');
        expect(formatted).toContain('  axes:');
        expect(formatted).toContain('    - id: axis1');
        expect(formatted).toContain('      bounds:');
        expect(formatted).toContain('        min: 2000');
        expect(formatted).toContain('        max: 2030');
        expect(formatted).toContain('  axisMapping:');
        expect(formatted).toContain('    xAxis: axis1');
        expect(formatted).toContain('    yAxis: null');
    });

    it('should handle empty hyperdimensions', () => {
        const source = `---
force:
  alphaDecay: 0.05
hyperdimensions:
  spatialSystems:
  axes:
  nodePositions:
  axisMapping:
    xAxis: null
    yAxis: null
    zAxis: null
---`;

        const result = parseParametersAndQuery(source);
        
        expect(result.parameters.hyperdimensions).toBeDefined();
        const hyper = result.parameters.hyperdimensions!;
        
        expect(hyper.spatialSystems).toEqual([]);
        expect(hyper.axes).toEqual([]);
        expect(hyper.nodePositions).toEqual([]);
        expect(hyper.axisMapping).toEqual({
            xAxis: null,
            yAxis: null,
            zAxis: null
        });
    });

    it('should parse mixed parameters with lockedNodes and hyperdimensions', () => {
        const source = `---
lockedNodes:
  - name: NodeA
    x: 100
    y: 200
    z: 300
hyperdimensions:
  spatialSystems:
    - id: sys1
      name: Custom
---`;

        const result = parseParametersAndQuery(source);
        
        expect(result.parameters.lockedNodes).toHaveLength(1);
        expect(result.parameters.lockedNodes![0]).toEqual({
            name: 'NodeA',
            x: 100,
            y: 200,
            z: 300
        });
        
        expect(result.parameters.hyperdimensions?.spatialSystems).toHaveLength(1);
    });
});