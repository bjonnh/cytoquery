import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryParser, QueryRule } from './query-language';
import { Node, EdgeSet } from './utils';
import { CachedMetadata } from 'obsidian';

describe('QueryParser', () => {
  let parser: QueryParser;
  let metadata: Map<string, CachedMetadata>;
  let edges: EdgeSet;

  beforeEach(() => {
    metadata = new Map();
    edges = new EdgeSet();
    parser = new QueryParser(metadata, edges);
  });

  describe('parseQuery', () => {
    it('should parse a simple default color rule', () => {
      const query = 'default => color("#FF0000")';
      parser.parseQuery(query);
      
      const node: Node = { id: 'test', label: 'Test' };
      parser.applyRules([node]);
      
      expect(node.color).toBe('#FF0000');
    });

    it('should parse multiple rules', () => {
      const query = `default => color("#FF0000")
tag("important") => color("#00FF00")`;
      parser.parseQuery(query);
      
      const node1: Node = { id: 'test1', label: 'Test1' };
      const node2: Node = { id: 'test2', label: 'Test2' };
      
      metadata.set('test2', {
        tags: [{ tag: '#important', position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 0, offset: 0 } } }]
      } as CachedMetadata);
      
      parser.applyRules([node1, node2]);
      
      expect(node1.color).toBe('#FF0000');
      expect(node2.color).toBe('#00FF00');
    });

    it('should ignore empty lines', () => {
      const query = `
default => color("#FF0000")

tag("test") => color("#00FF00")
`;
      parser.parseQuery(query);
      
      const node: Node = { id: 'test', label: 'Test' };
      parser.applyRules([node]);
      
      expect(node.color).toBe('#FF0000');
    });

    it('should handle quotes in rule values', () => {
      const query = `link_to("daily") => color("red")`;
      parser.parseQuery(query);
      
      edges.addSourceTarget('test', 'daily');
      
      const node: Node = { id: 'test', label: 'Test' };
      parser.applyRules([node]);
      
      expect(node.color).toBe('red');
    });

    it('should handle single quotes', () => {
      const query = `link_to('daily') => color('red')`;
      parser.parseQuery(query);
      
      edges.addSourceTarget('test', 'daily');
      
      const node: Node = { id: 'test', label: 'Test' };
      parser.applyRules([node]);
      
      expect(node.color).toBe('red');
    });
  });

  describe('link_to condition', () => {
    it('should match nodes that link to target', () => {
      const query = 'link_to("daily") => color("blue")';
      parser.parseQuery(query);
      
      edges.addSourceTarget('note1', 'daily');
      edges.addSourceTarget('note2', 'weekly');
      
      const node1: Node = { id: 'note1', label: 'Note1' };
      const node2: Node = { id: 'note2', label: 'Note2' };
      
      parser.applyRules([node1, node2]);
      
      expect(node1.color).toBe('blue');
      expect(node2.color).toBeUndefined();
    });

    it('should handle case-insensitive matching', () => {
      const query = 'link_to("Daily") => color("blue")';
      parser.parseQuery(query);
      
      edges.addSourceTarget('note1', 'daily');
      
      const node: Node = { id: 'note1', label: 'Note1' };
      parser.applyRules([node]);
      
      expect(node.color).toBe('blue');
    });

    it('should handle .md extension in edge targets', () => {
      const query = 'link_to("daily") => color("blue")';
      parser.parseQuery(query);
      
      edges.addSourceTarget('note1', 'daily.md');
      
      const node: Node = { id: 'note1', label: 'Note1' };
      parser.applyRules([node]);
      
      expect(node.color).toBe('blue');
    });
  });

  describe('link_from condition', () => {
    it('should match nodes that are linked from target', () => {
      const query = 'link_from("index") => color("green")';
      parser.parseQuery(query);
      
      edges.addSourceTarget('index', 'note1');
      edges.addSourceTarget('other', 'note2');
      
      const node1: Node = { id: 'note1', label: 'Note1' };
      const node2: Node = { id: 'note2', label: 'Note2' };
      
      parser.applyRules([node1, node2]);
      
      expect(node1.color).toBe('green');
      expect(node2.color).toBeUndefined();
    });

    it('should handle case-insensitive matching', () => {
      const query = 'link_from("Index") => color("green")';
      parser.parseQuery(query);
      
      edges.addSourceTarget('index', 'note1');
      
      const node: Node = { id: 'note1', label: 'Note1' };
      parser.applyRules([node]);
      
      expect(node.color).toBe('green');
    });
  });

  describe('link condition', () => {
    it('should match nodes that link to or from target', () => {
      const query = 'link("hub") => color("purple")';
      parser.parseQuery(query);
      
      edges.addSourceTarget('note1', 'hub');
      edges.addSourceTarget('hub', 'note2');
      edges.addSourceTarget('note3', 'other');
      
      const node1: Node = { id: 'note1', label: 'Note1' };
      const node2: Node = { id: 'note2', label: 'Note2' };
      const node3: Node = { id: 'note3', label: 'Note3' };
      
      parser.applyRules([node1, node2, node3]);
      
      expect(node1.color).toBe('purple');
      expect(node2.color).toBe('purple');
      expect(node3.color).toBeUndefined();
    });
  });

  describe('tag condition', () => {
    it('should match nodes with specified tag', () => {
      const query = 'tag("project") => color("orange")';
      parser.parseQuery(query);
      
      metadata.set('note1', {
        tags: [{ tag: '#project', position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 0, offset: 0 } } }]
      } as CachedMetadata);
      
      metadata.set('note2', {
        tags: [{ tag: '#task', position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 0, offset: 0 } } }]
      } as CachedMetadata);
      
      const node1: Node = { id: 'note1', label: 'Note1' };
      const node2: Node = { id: 'note2', label: 'Note2' };
      
      parser.applyRules([node1, node2]);
      
      expect(node1.color).toBe('orange');
      expect(node2.color).toBeUndefined();
    });

    it('should handle tags with or without hash prefix', () => {
      const query = 'tag("project") => color("orange")';
      parser.parseQuery(query);
      
      metadata.set('note1', {
        tags: [{ tag: 'project', position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 0, offset: 0 } } }]
      } as CachedMetadata);
      
      const node: Node = { id: 'note1', label: 'Note1' };
      parser.applyRules([node]);
      
      expect(node.color).toBe('orange');
    });

    it('should handle frontmatter tags', () => {
      const query = 'tag("project") => color("orange")';
      parser.parseQuery(query);
      
      metadata.set('note1', {
        frontmatter: {
          tags: ['project', 'important']
        }
      } as CachedMetadata);
      
      const node: Node = { id: 'note1', label: 'Note1' };
      parser.applyRules([node]);
      
      expect(node.color).toBe('orange');
    });

    it('should handle case-insensitive tag matching', () => {
      const query = 'tag("Project") => color("orange")';
      parser.parseQuery(query);
      
      metadata.set('note1', {
        tags: [{ tag: '#project', position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 0, offset: 0 } } }]
      } as CachedMetadata);
      
      const node: Node = { id: 'note1', label: 'Note1' };
      parser.applyRules([node]);
      
      expect(node.color).toBe('orange');
    });
  });

  describe('applyAction', () => {
    it('should apply color action', () => {
      const query = 'default => color("red")';
      parser.parseQuery(query);
      
      const node: Node = { id: 'test', label: 'Test' };
      parser.applyRules([node]);
      
      expect(node.color).toBe('red');
    });

    it('should apply shape action with valid shapes', () => {
      const query = 'default => shape("cube")';
      parser.parseQuery(query);
      
      const node: Node = { id: 'test', label: 'Test' };
      parser.applyRules([node]);
      
      expect(node.shape).toBe('cube');
    });

    it('should not apply invalid shape values', () => {
      const query = 'default => shape("invalid")';
      parser.parseQuery(query);
      
      const node: Node = { id: 'test', label: 'Test' };
      parser.applyRules([node]);
      
      expect(node.shape).toBeUndefined();
    });

    it('should apply material action with valid materials', () => {
      const query = 'default => material("glass")';
      parser.parseQuery(query);
      
      const node: Node = { id: 'test', label: 'Test' };
      parser.applyRules([node]);
      
      expect(node.material).toBe('glass');
    });

    it('should apply texture action (alias for material)', () => {
      const query = 'default => texture("metal")';
      parser.parseQuery(query);
      
      const node: Node = { id: 'test', label: 'Test' };
      parser.applyRules([node]);
      
      expect(node.material).toBe('metal');
    });

    it('should apply size action with valid numeric values', () => {
      const query = 'default => size("2.5")';
      parser.parseQuery(query);
      
      const node: Node = { id: 'test', label: 'Test' };
      parser.applyRules([node]);
      
      expect(node.size).toBe(2.5);
    });

    it('should apply size action with numeric values without quotes', () => {
      const query = 'default => size(8)';
      parser.parseQuery(query);
      
      const node: Node = { id: 'test', label: 'Test' };
      parser.applyRules([node]);
      
      expect(node.size).toBe(8);
    });

    it('should clamp size values between 0.1 and 10', () => {
      const query1 = 'default => size("0.05")';
      parser.parseQuery(query1);
      
      const node1: Node = { id: 'test1', label: 'Test1' };
      parser.applyRules([node1]);
      
      expect(node1.size).toBe(0.1);
      
      const query2 = 'default => size("15")';
      parser.parseQuery(query2);
      
      const node2: Node = { id: 'test2', label: 'Test2' };
      parser.applyRules([node2]);
      
      expect(node2.size).toBe(10);
    });

    it('should not apply invalid size values', () => {
      const query = 'default => size("invalid")';
      parser.parseQuery(query);
      
      const node: Node = { id: 'test', label: 'Test' };
      parser.applyRules([node]);
      
      expect(node.size).toBeUndefined();
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle invalid query syntax gracefully', () => {
      const query = 'invalid syntax';
      parser.parseQuery(query);
      
      const node: Node = { id: 'test', label: 'Test' };
      parser.applyRules([node]);
      
      expect(node.color).toBeUndefined();
    });

    it('should handle nodes without metadata', () => {
      const query = 'tag("test") => color("red")';
      parser.parseQuery(query);
      
      const node: Node = { id: 'test', label: 'Test' };
      parser.applyRules([node]);
      
      expect(node.color).toBeUndefined();
    });

    it('should handle empty metadata', () => {
      const query = 'tag("test") => color("red")';
      parser.parseQuery(query);
      
      metadata.set('test', {} as CachedMetadata);
      
      const node: Node = { id: 'test', label: 'Test' };
      parser.applyRules([node]);
      
      expect(node.color).toBeUndefined();
    });

    it('should apply rules in order', () => {
      const query = `default => color("red")
tag("important") => color("blue")`;
      parser.parseQuery(query);
      
      metadata.set('test', {
        tags: [{ tag: '#important', position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 0, offset: 0 } } }]
      } as CachedMetadata);
      
      const node: Node = { id: 'test', label: 'Test' };
      parser.applyRules([node]);
      
      expect(node.color).toBe('blue');
    });
  });
});