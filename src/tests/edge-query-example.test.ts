import { describe, it, expect } from 'vitest';
import { QueryParser } from '../query/query-parser';
import { Node, EdgeSet } from '../utils/index';
import { CachedMetadata } from 'obsidian';

describe('Edge Query Example', () => {
  it('should demonstrate edge and node queries working together', () => {
    const metadata = new Map<string, CachedMetadata>();
    const edges = new EdgeSet();
    const parser = new QueryParser(metadata, edges);
    
    // A comprehensive query with both node and edge styling
    const query = `
default => color("#CCCCCC")
orphan => color("#808080"), shape("cube")
tagged("important") => color("#FFD700"), size(2)
tagged("deprecated") => opacity(0.5)
edge(default) => color("#666666"), opacity(0.3)
edge("related") => color("#00FF00"), width(2)
edge("references").includes("page") => color("#FF0000"), width(3)
edge(default).not_includes("test") => opacity(0.8)
`;
    
    parser.parseQuery(query);
    
    // Create test nodes
    const nodes: Node[] = [
      { id: 'index', label: 'Index' },
      { id: 'page1', label: 'Page 1' },
      { id: 'page2', label: 'Page 2' },
      { id: 'orphan', label: 'Orphan Page' },
      { id: 'test', label: 'Test Page' }
    ];
    
    // Add metadata for tags
    metadata.set('page1', {
      tags: [{ tag: '#important', position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 0, offset: 0 } } }]
    } as CachedMetadata);
    
    metadata.set('page2', {
      tags: [{ tag: '#deprecated', position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 0, offset: 0 } } }]
    } as CachedMetadata);
    
    // Create edges
    edges.addSourceTarget('index', 'page1', 'default');
    edges.addSourceTarget('index', 'page2', 'property', 'related');
    edges.addSourceTarget('page1', 'page2', 'property', 'references');
    edges.addSourceTarget('test', 'page1', 'default');
    
    // Apply rules
    parser.applyRules(nodes);
    parser.applyEdgeRules(edges.values());
    
    // Verify node styling
    expect(nodes[0].color).toBe('#CCCCCC'); // index - default
    expect(nodes[1].color).toBe('#FFD700'); // page1 - tagged important
    expect(nodes[1].size).toBe(2);
    expect(nodes[2].color).toBe('#CCCCCC'); // page2 - default (opacity doesn't override color)
    expect(nodes[3].color).toBe('#808080'); // orphan
    expect(nodes[3].shape).toBe('cube');
    expect(nodes[4].color).toBe('#CCCCCC'); // test - default
    
    // Verify edge styling
    const edgeList = edges.values();
    
    // index -> page1 (default edge, not including "test")
    expect(edgeList[0].color).toBe('#666666');
    expect(edgeList[0].opacity).toBe(0.8); // not_includes("test") overrides default opacity
    
    // index -> page2 (property: related)
    expect(edgeList[1].color).toBe('#00FF00');
    expect(edgeList[1].width).toBe(2);
    
    // page1 -> page2 (property: references, includes "index")
    expect(edgeList[2].color).toBe('#FF0000');
    expect(edgeList[2].width).toBe(3);
    
    // test -> page1 (default edge, includes "test")
    expect(edgeList[3].color).toBe('#666666');
    expect(edgeList[3].opacity).toBe(0.3); // default opacity (not_includes doesn't match)
  });
});