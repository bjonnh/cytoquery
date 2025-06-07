import { describe, it, expect, beforeEach } from 'vitest';
import { QueryParser } from '../query/query-parser';
import { Node, EdgeSet } from '../utils/index';
import { CachedMetadata } from 'obsidian';

describe('Edge Query Regression Tests', () => {
  let parser: QueryParser;
  let metadata: Map<string, CachedMetadata>;
  let edges: EdgeSet;

  beforeEach(() => {
    metadata = new Map();
    edges = new EdgeSet();
    parser = new QueryParser(metadata, edges);
  });

  it('should not break node queries when edge query is present', () => {
    const query = `
edge(default) => color("#FF0000")
default => color("#00FF00")
tagged("important") => size(3)
`;
    
    parser.parseQuery(query);
    
    // Add test data
    const node1: Node = { id: 'test1', label: 'Test1' };
    const node2: Node = { id: 'test2', label: 'Test2' };
    
    metadata.set('test2', {
      tags: [{ tag: '#important', position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 0, offset: 0 } } }]
    } as CachedMetadata);
    
    edges.addSourceTarget('test1', 'test2', 'default');
    
    // Apply rules
    parser.applyRules([node1, node2]);
    parser.applyEdgeRules(edges.values());
    
    // Check that both node and edge rules were applied
    expect(node1.color).toBe('#00FF00'); // default rule should work
    expect(node2.color).toBe('#00FF00'); // default rule should work
    expect(node2.size).toBe(3); // tagged rule should work
    expect(edges.values()[0].color).toBe('#FF0000'); // edge rule should work
  });

  it('should handle edge queries with correct rule ordering', () => {
    const query = `
default => color("#FFFFFF")
orphan => color("#808080")
edge(default) => opacity(0.5)
edge("related") => color("#FF0000")
`;
    
    parser.parseQuery(query);
    
    const orphanNode: Node = { id: 'orphan', label: 'Orphan' };
    const connectedNode: Node = { id: 'connected', label: 'Connected' };
    
    edges.addSourceTarget('connected', 'other', 'default');
    edges.addSourceTarget('connected', 'another', 'property', 'related');
    
    parser.applyRules([orphanNode, connectedNode]);
    parser.applyEdgeRules(edges.values());
    
    expect(orphanNode.color).toBe('#808080'); // orphan rule should override default
    expect(connectedNode.color).toBe('#FFFFFF'); // default rule should work
    expect(edges.values()[0].opacity).toBe(0.5); // default edge rule
    expect(edges.values()[1].color).toBe('#FF0000'); // property edge rule
  });

  it('should handle mixed queries in any order', () => {
    const query = `
default => color("#000000")
edge(default) => color("#FF0000")
tagged("blue") => color("#0000FF")
edge("special") => width(3)
orphan => shape("cube")
`;
    
    parser.parseQuery(query);
    
    const normalNode: Node = { id: 'normal', label: 'Normal' };
    const blueNode: Node = { id: 'blue', label: 'Blue' };
    const orphanNode: Node = { id: 'orphan', label: 'Orphan' };
    
    metadata.set('blue', {
      tags: [{ tag: '#blue', position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 0, offset: 0 } } }]
    } as CachedMetadata);
    
    edges.addSourceTarget('normal', 'blue', 'default');
    edges.addSourceTarget('normal', 'blue', 'property', 'special');
    
    parser.applyRules([normalNode, blueNode, orphanNode]);
    parser.applyEdgeRules(edges.values());
    
    // All node rules should work
    expect(normalNode.color).toBe('#000000');
    expect(blueNode.color).toBe('#0000FF');
    expect(orphanNode.color).toBe('#000000');
    expect(orphanNode.shape).toBe('cube');
    
    // All edge rules should work
    expect(edges.values()[0].color).toBe('#FF0000');
    expect(edges.values()[1].width).toBe(3);
  });

  it('should parse edge queries with methods correctly', () => {
    const query = `
edge(default).includes("main") => color("#FF0000")
default => color("#00FF00")
`;
    
    const errors = parser.getParseErrors(query);
    expect(errors).toEqual([]);
    
    parser.parseQuery(query);
    
    const node: Node = { id: 'main', label: 'Main' };
    edges.addSourceTarget('main', 'other', 'default');
    
    parser.applyRules([node]);
    parser.applyEdgeRules(edges.values());
    
    expect(node.color).toBe('#00FF00');
    expect(edges.values()[0].color).toBe('#FF0000');
  });
});