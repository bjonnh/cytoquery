import { describe, it, expect } from 'vitest';
import { QueryParser } from '../query/query-parser';
import { EdgeSet } from '../utils/index';

describe('Edge Query Improvements', () => {
  it('should support case-insensitive property matching', () => {
    const edges = new EdgeSet();
    const parser = new QueryParser(new Map(), edges);
    
    // Add edges with different case properties
    edges.addSourceTarget('A', 'B', 'property', 'Category');
    edges.addSourceTarget('C', 'D', 'property', 'category');
    edges.addSourceTarget('E', 'F', 'property', 'CATEGORY');
    edges.addSourceTarget('G', 'H', 'default');
    
    // Query with middle case
    parser.parseQuery('edge("CaTeGoRy") => color("#FF0000")');
    parser.applyEdgeRules(edges.values());
    
    const edgeList = edges.values();
    
    // All property edges should match regardless of case
    expect(edgeList[0].color).toBe('#FF0000'); // Category
    expect(edgeList[1].color).toBe('#FF0000'); // category
    expect(edgeList[2].color).toBe('#FF0000'); // CATEGORY
    expect(edgeList[3].color).toBeUndefined(); // default edge
  });

  it('should support edge(*) catch-all syntax', () => {
    const edges = new EdgeSet();
    const parser = new QueryParser(new Map(), edges);
    
    // Add various types of edges
    edges.addSourceTarget('A', 'B', 'default');
    edges.addSourceTarget('C', 'D', 'property', 'related');
    edges.addSourceTarget('E', 'F', 'property', 'references');
    edges.addSourceTarget('G', 'H', 'default');
    
    // Use catch-all syntax
    parser.parseQuery('edge(*) => color("#999999"), opacity(0.5)');
    parser.applyEdgeRules(edges.values());
    
    const edgeList = edges.values();
    
    // All edges should match
    edgeList.forEach((edge, i) => {
      expect(edge.color).toBe('#999999');
      expect(edge.opacity).toBe(0.5);
    });
  });

  it('should support edge(*) with methods', () => {
    const edges = new EdgeSet();
    const parser = new QueryParser(new Map(), edges);
    
    // Add various edges
    edges.addSourceTarget('main', 'page1', 'default');
    edges.addSourceTarget('main', 'page2', 'property', 'related');
    edges.addSourceTarget('test', 'page3', 'property', 'references');
    edges.addSourceTarget('other', 'page4', 'default');
    
    // Use catch-all with includes
    parser.parseQuery('edge(*).includes("main") => color("#FF0000")');
    parser.applyEdgeRules(edges.values());
    
    const edgeList = edges.values();
    
    // Only edges including "main" should match
    expect(edgeList[0].color).toBe('#FF0000'); // main -> page1
    expect(edgeList[1].color).toBe('#FF0000'); // main -> page2
    expect(edgeList[2].color).toBeUndefined(); // test -> page3
    expect(edgeList[3].color).toBeUndefined(); // other -> page4
  });

  it('should validate edge(*) syntax', () => {
    const parser = new QueryParser(new Map(), new EdgeSet());
    
    const validQueries = [
      'edge(*) => color("red")',
      'edge(*).includes("test") => color("blue")',
      'edge(*).not_includes("ignore") => width(2)',
      'edge(*), edge("specific") => opacity(0.8)'
    ];
    
    validQueries.forEach(query => {
      const errors = parser.getParseErrors(query);
      expect(errors).toEqual([]);
    });
  });

  it('should work with mixed edge queries', () => {
    const edges = new EdgeSet();
    const parser = new QueryParser(new Map(), edges);
    
    edges.addSourceTarget('A', 'B', 'default');
    edges.addSourceTarget('C', 'D', 'property', 'Category');
    edges.addSourceTarget('E', 'F', 'property', 'related');
    
    const query = `
edge(*) => opacity(0.3)
edge(default) => color("#666")
edge("category") => color("#0F0"), width(2)
edge("related") => color("#00F")
`;
    
    parser.parseQuery(query);
    parser.applyEdgeRules(edges.values());
    
    const edgeList = edges.values();
    
    // All edges get opacity from edge(*)
    expect(edgeList[0].opacity).toBe(0.3);
    expect(edgeList[1].opacity).toBe(0.3);
    expect(edgeList[2].opacity).toBe(0.3);
    
    // Specific rules override
    expect(edgeList[0].color).toBe('#666'); // default
    expect(edgeList[1].color).toBe('#0F0'); // Category (case-insensitive)
    expect(edgeList[1].width).toBe(2);
    expect(edgeList[2].color).toBe('#00F'); // related
  });
});