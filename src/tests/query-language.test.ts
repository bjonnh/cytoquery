import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryParser } from '../query/query-parser';
import type { QueryRule } from '../query/query-parser';
import { Node, EdgeSet } from '../utils/index';
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
tagged("important") => color("#00FF00")`;
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

tagged("test") => color("#00FF00")
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

  describe('tag condition (tag nodes)', () => {
    it('should match tag nodes themselves', () => {
      const query = 'tag("project") => color("orange")';
      parser.parseQuery(query);
      
      const tagNode: Node = { id: 'tag:project', label: '#project' };
      const fileNode: Node = { id: 'note1', label: 'Note1' };
      
      parser.applyRules([tagNode, fileNode]);
      
      expect(tagNode.color).toBe('orange');
      expect(fileNode.color).toBeUndefined();
    });

    it('should handle case-insensitive matching for tag nodes', () => {
      const query = 'tag("Project") => color("orange")';
      parser.parseQuery(query);
      
      const tagNode: Node = { id: 'tag:project', label: '#project' };
      parser.applyRules([tagNode]);
      
      expect(tagNode.color).toBe('orange');
    });
  });

  describe('tagged condition (pages with tags)', () => {
    it('should match nodes with specified tag', () => {
      const query = 'tagged("project") => color("orange")';
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
      const query = 'tagged("project") => color("orange")';
      parser.parseQuery(query);
      
      metadata.set('note1', {
        tags: [{ tag: 'project', position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 0, offset: 0 } } }]
      } as CachedMetadata);
      
      const node: Node = { id: 'note1', label: 'Note1' };
      parser.applyRules([node]);
      
      expect(node.color).toBe('orange');
    });

    it('should handle frontmatter tags', () => {
      const query = 'tagged("project") => color("orange")';
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
      const query = 'tagged("Project") => color("orange")';
      parser.parseQuery(query);
      
      metadata.set('note1', {
        tags: [{ tag: '#project', position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 0, offset: 0 } } }]
      } as CachedMetadata);
      
      const node: Node = { id: 'note1', label: 'Note1' };
      parser.applyRules([node]);
      
      expect(node.color).toBe('orange');
    });
  });

  describe('node name selector', () => {
    it('should match nodes by exact name', () => {
      const query = '"My Note" => color("red"), size(2)';
      parser.parseQuery(query);
      
      const node1: Node = { id: 'path/to/note.md', label: 'My Note' };
      const node2: Node = { id: 'path/to/other.md', label: 'Other Note' };
      
      parser.applyRules([node1, node2]);
      
      expect(node1.color).toBe('red');
      expect(node1.size).toBe(2);
      expect(node2.color).toBeUndefined();
      expect(node2.size).toBeUndefined();
    });

    it('should handle case-insensitive matching for node names', () => {
      const query = '"my note" => color("blue")';
      parser.parseQuery(query);
      
      const node: Node = { id: 'path/to/note.md', label: 'My Note' };
      parser.applyRules([node]);
      
      expect(node.color).toBe('blue');
    });

    it('should match tag nodes by name including hash', () => {
      const query = '"#important" => color("gold"), size(3)';
      parser.parseQuery(query);
      
      const tagNode: Node = { id: 'tag:important', label: '#important' };
      const fileNode: Node = { id: 'file.md', label: 'important' };
      
      parser.applyRules([tagNode, fileNode]);
      
      expect(tagNode.color).toBe('gold');
      expect(tagNode.size).toBe(3);
      expect(fileNode.color).toBeUndefined();
    });

    it('should work with comma-separated conditions', () => {
      const query = '"Note 1", "Note 2" => color("green")';
      parser.parseQuery(query);
      
      const node1: Node = { id: 'note1.md', label: 'Note 1' };
      const node2: Node = { id: 'note2.md', label: 'Note 2' };
      const node3: Node = { id: 'note3.md', label: 'Note 3' };
      
      parser.applyRules([node1, node2, node3]);
      
      expect(node1.color).toBe('green');
      expect(node2.color).toBe('green');
      expect(node3.color).toBeUndefined();
    });

    it('should work in combination with other selectors', () => {
      const query = 'tag("important"), "Special Note" => color("purple"), size(4)';
      parser.parseQuery(query);
      
      const tagNode: Node = { id: 'tag:important', label: '#important' };
      const specialNode: Node = { id: 'special.md', label: 'Special Note' };
      const normalNode: Node = { id: 'normal.md', label: 'Normal Note' };
      
      parser.applyRules([tagNode, specialNode, normalNode]);
      
      expect(tagNode.color).toBe('purple');
      expect(tagNode.size).toBe(4);
      expect(specialNode.color).toBe('purple');
      expect(specialNode.size).toBe(4);
      expect(normalNode.color).toBeUndefined();
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
tagged("important") => color("blue")`;
      parser.parseQuery(query);
      
      metadata.set('test', {
        tags: [{ tag: '#important', position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 0, offset: 0 } } }]
      } as CachedMetadata);
      
      const node: Node = { id: 'test', label: 'Test' };
      parser.applyRules([node]);
      
      expect(node.color).toBe('blue');
    });
  });

  describe('comma-separated conditions', () => {
    it('should handle multiple conditions on same rule', () => {
      const query = 'tagged("important"), tagged("project") => color("green")';
      parser.parseQuery(query);
      
      const node1: Node = { id: 'test1', label: 'Test1' };
      const node2: Node = { id: 'test2', label: 'Test2' };
      const node3: Node = { id: 'test3', label: 'Test3' };
      
      metadata.set('test1', {
        tags: [{ tag: '#important', position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 0, offset: 0 } } }]
      } as CachedMetadata);
      
      metadata.set('test2', {
        tags: [{ tag: '#project', position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 0, offset: 0 } } }]
      } as CachedMetadata);
      
      parser.applyRules([node1, node2, node3]);
      
      expect(node1.color).toBe('green');
      expect(node2.color).toBe('green');
      expect(node3.color).toBeUndefined();
    });

    it('should handle link conditions with comma separation', () => {
      const query = 'link_to("daily"), link_from("index") => color("purple")';
      parser.parseQuery(query);
      
      edges.addSourceTarget('note1', 'daily');
      edges.addSourceTarget('index', 'note2');
      
      const node1: Node = { id: 'note1', label: 'Note1' };
      const node2: Node = { id: 'note2', label: 'Note2' };
      const node3: Node = { id: 'note3', label: 'Note3' };
      
      parser.applyRules([node1, node2, node3]);
      
      expect(node1.color).toBe('purple');
      expect(node2.color).toBe('purple');
      expect(node3.color).toBeUndefined();
    });

    it('should handle mixed condition types', () => {
      const query = 'default, tagged("special") => size(3)';
      parser.parseQuery(query);
      
      metadata.set('test2', {
        tags: [{ tag: '#special', position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 0, offset: 0 } } }]
      } as CachedMetadata);
      
      const node1: Node = { id: 'test1', label: 'Test1' };
      const node2: Node = { id: 'test2', label: 'Test2' };
      
      parser.applyRules([node1, node2]);
      
      expect(node1.size).toBe(3);
      expect(node2.size).toBe(3);
    });
  });

  describe('comma-separated actions', () => {
    it('should apply multiple actions to same node', () => {
      const query = 'default => color("red"), size(2)';
      parser.parseQuery(query);
      
      const node: Node = { id: 'test', label: 'Test' };
      parser.applyRules([node]);
      
      expect(node.color).toBe('red');
      expect(node.size).toBe(2);
    });

    it('should handle multiple actions with different types', () => {
      const query = 'tagged("special") => color("#FF00FF"), shape("cube"), material("glass"), size(5)';
      parser.parseQuery(query);
      
      metadata.set('test', {
        tags: [{ tag: '#special', position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 0, offset: 0 } } }]
      } as CachedMetadata);
      
      const node: Node = { id: 'test', label: 'Test' };
      parser.applyRules([node]);
      
      expect(node.color).toBe('#FF00FF');
      expect(node.shape).toBe('cube');
      expect(node.material).toBe('glass');
      expect(node.size).toBe(5);
    });

    it('should handle actions with numeric and string values', () => {
      const query = 'default => size(1.5), color("blue"), shape("sphere")';
      parser.parseQuery(query);
      
      const node: Node = { id: 'test', label: 'Test' };
      parser.applyRules([node]);
      
      expect(node.size).toBe(1.5);
      expect(node.color).toBe('blue');
      expect(node.shape).toBe('sphere');
    });
  });

  describe('named parameters', () => {
    it('should define and use named parameters', () => {
      const query = `:highlight = color("yellow"), size(3)
tagged("important") => :highlight`;
      parser.parseQuery(query);
      
      metadata.set('test', {
        tags: [{ tag: '#important', position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 0, offset: 0 } } }]
      } as CachedMetadata);
      
      const node: Node = { id: 'test', label: 'Test' };
      parser.applyRules([node]);
      
      expect(node.color).toBe('yellow');
      expect(node.size).toBe(3);
    });

    it('should handle multiple named parameter definitions', () => {
      const query = `:bluethings = color("blue"), shape("sphere")
:redthings = color("red"), shape("cube")
tagged("water") => :bluethings
tagged("fire") => :redthings`;
      parser.parseQuery(query);
      
      const node1: Node = { id: 'test1', label: 'Test1' };
      const node2: Node = { id: 'test2', label: 'Test2' };
      
      metadata.set('test1', {
        tags: [{ tag: '#water', position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 0, offset: 0 } } }]
      } as CachedMetadata);
      
      metadata.set('test2', {
        tags: [{ tag: '#fire', position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 0, offset: 0 } } }]
      } as CachedMetadata);
      
      parser.applyRules([node1, node2]);
      
      expect(node1.color).toBe('blue');
      expect(node1.shape).toBe('sphere');
      expect(node2.color).toBe('red');
      expect(node2.shape).toBe('cube');
    });

    it('should handle named parameters with all action types', () => {
      const query = `:fancy = color("#FFD700"), shape("dodecahedron"), material("metal"), size(8)
link_to("treasure") => :fancy`;
      parser.parseQuery(query);
      
      edges.addSourceTarget('test', 'treasure');
      
      const node: Node = { id: 'test', label: 'Test' };
      parser.applyRules([node]);
      
      expect(node.color).toBe('#FFD700');
      expect(node.shape).toBe('dodecahedron');
      expect(node.material).toBe('metal');
      expect(node.size).toBe(8);
    });

    it('should warn about undefined named parameters', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const query = 'default => :undefined';
      parser.parseQuery(query);
      
      const node: Node = { id: 'test', label: 'Test' };
      parser.applyRules([node]);
      
      expect(consoleSpy).toHaveBeenCalledWith('Unknown named parameter: :undefined');
      consoleSpy.mockRestore();
    });
  });

  describe('complex combinations', () => {
    it('should handle comma-separated conditions with comma-separated actions', () => {
      const query = 'tagged("A"), tagged("B") => color("purple"), size(4)';
      parser.parseQuery(query);
      
      const node1: Node = { id: 'test1', label: 'Test1' };
      const node2: Node = { id: 'test2', label: 'Test2' };
      
      metadata.set('test1', {
        tags: [{ tag: '#A', position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 0, offset: 0 } } }]
      } as CachedMetadata);
      
      metadata.set('test2', {
        tags: [{ tag: '#B', position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 0, offset: 0 } } }]
      } as CachedMetadata);
      
      parser.applyRules([node1, node2]);
      
      expect(node1.color).toBe('purple');
      expect(node1.size).toBe(4);
      expect(node2.color).toBe('purple');
      expect(node2.size).toBe(4);
    });

    it('should handle comma-separated conditions with named parameters', () => {
      const query = `:style = color("green"), shape("torus"), size(2.5)
link_to("hub"), link_from("index") => :style`;
      parser.parseQuery(query);
      
      edges.addSourceTarget('note1', 'hub');
      edges.addSourceTarget('index', 'note2');
      
      const node1: Node = { id: 'note1', label: 'Note1' };
      const node2: Node = { id: 'note2', label: 'Note2' };
      
      parser.applyRules([node1, node2]);
      
      expect(node1.color).toBe('green');
      expect(node1.shape).toBe('torus');
      expect(node1.size).toBe(2.5);
      expect(node2.color).toBe('green');
      expect(node2.shape).toBe('torus');
      expect(node2.size).toBe(2.5);
    });

    it('should handle mixed rules with different syntaxes', () => {
      const query = `:highlight = color("yellow"), size(5)
default => color("gray")
tagged("important") => :highlight
tagged("A"), tagged("B") => color("blue"), shape("cube")`;
      parser.parseQuery(query);
      
      const node1: Node = { id: 'normal', label: 'Normal' };
      const node2: Node = { id: 'important', label: 'Important' };
      const node3: Node = { id: 'a-tag', label: 'A Tag' };
      
      metadata.set('important', {
        tags: [{ tag: '#important', position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 0, offset: 0 } } }]
      } as CachedMetadata);
      
      metadata.set('a-tag', {
        tags: [{ tag: '#A', position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 0, offset: 0 } } }]
      } as CachedMetadata);
      
      parser.applyRules([node1, node2, node3]);
      
      expect(node1.color).toBe('gray');
      expect(node1.size).toBeUndefined();
      
      expect(node2.color).toBe('yellow');
      expect(node2.size).toBe(5);
      
      expect(node3.color).toBe('blue');
      expect(node3.shape).toBe('cube');
    });
  });

  describe('whitespace handling', () => {
    it('should handle spaces in comma-separated lists', () => {
      const query = 'tagged("A") , tagged("B") => color("red") , size(2)';
      parser.parseQuery(query);
      
      metadata.set('test', {
        tags: [{ tag: '#A', position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 0, offset: 0 } } }]
      } as CachedMetadata);
      
      const node: Node = { id: 'test', label: 'Test' };
      parser.applyRules([node]);
      
      expect(node.color).toBe('red');
      expect(node.size).toBe(2);
    });

    it('should handle whitespace around named parameters', () => {
      const query = ' :style = color("blue") , size(3) \ntagged("test") => :style ';
      parser.parseQuery(query);
      
      metadata.set('test', {
        tags: [{ tag: '#test', position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 0, offset: 0 } } }]
      } as CachedMetadata);
      
      const node: Node = { id: 'test', label: 'Test' };
      parser.applyRules([node]);
      
      expect(node.color).toBe('blue');
      expect(node.size).toBe(3);
    });
  });

  describe('getParseErrors method', () => {
    it('should return empty array for valid queries', () => {
      const query = 'default => color("red")';
      const errors = parser.getParseErrors(query);
      expect(errors).toEqual([]);
    });

    it('should return lexing errors for invalid tokens', () => {
      const query = 'default => @invalid';
      const errors = parser.getParseErrors(query);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('Lexing error');
    });

    it('should return parsing errors for invalid syntax', () => {
      const query = 'invalid syntax';
      const errors = parser.getParseErrors(query);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('Parsing error');
    });

    it('should return errors for missing arrow', () => {
      const query = 'default color("red")';
      const errors = parser.getParseErrors(query);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('Parsing error');
    });

    it('should return errors for missing parentheses', () => {
      const query = 'default => color"red"';
      const errors = parser.getParseErrors(query);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('Parsing error');
    });

    it('should validate new syntax features', () => {
      const validQueries = [
        'tagged("A"), tagged("B") => color("red")',
        'default => color("red"), size(2)',
        ':style = color("blue"), size(3)',
        'tagged("test") => :style',
        ':fancy = color("#FFD700"), shape("cube")\ntagged("treasure") => :fancy'
      ];

      validQueries.forEach(query => {
        const errors = parser.getParseErrors(query);
        expect(errors).toEqual([]);
      });
    });
  });

  describe('edge queries', () => {
    it('should parse edge() syntax with default edges', () => {
      const query = 'edge(default) => color("#FF0000")';
      parser.parseQuery(query);
      
      edges.addSourceTarget('node1', 'node2', 'default');
      const edgeList = edges.values();
      
      parser.applyEdgeRules(edgeList);
      
      expect(edgeList[0].color).toBe('#FF0000');
    });

    it('should parse edge() syntax with property edges', () => {
      const query = 'edge("related") => color("#00FF00")';
      parser.parseQuery(query);
      
      edges.addSourceTarget('node1', 'node2', 'property', 'related');
      edges.addSourceTarget('node3', 'node4', 'property', 'other');
      const edgeList = edges.values();
      
      parser.applyEdgeRules(edgeList);
      
      expect(edgeList[0].color).toBe('#00FF00');
      expect(edgeList[1].color).toBeUndefined();
    });

    it('should parse edge() with includes() method', () => {
      const query = 'edge("related").includes("node1") => color("#0000FF")';
      parser.parseQuery(query);
      
      edges.addSourceTarget('node1', 'node2', 'property', 'related');
      edges.addSourceTarget('node3', 'node4', 'property', 'related');
      const edgeList = edges.values();
      
      parser.applyEdgeRules(edgeList);
      
      expect(edgeList[0].color).toBe('#0000FF');
      expect(edgeList[1].color).toBeUndefined();
    });

    it('should parse edge() with not_includes() method', () => {
      const query = 'edge(default).not_includes("test") => color("#FF00FF")';
      parser.parseQuery(query);
      
      edges.addSourceTarget('node1', 'node2', 'default');
      edges.addSourceTarget('test1', 'test2', 'default');
      const edgeList = edges.values();
      
      parser.applyEdgeRules(edgeList);
      
      expect(edgeList[0].color).toBe('#FF00FF');
      expect(edgeList[1].color).toBeUndefined();
    });

    it('should apply multiple edge actions', () => {
      const query = 'edge("important").includes("main") => color("#FF0000"), width(3), opacity(0.8)';
      parser.parseQuery(query);
      
      edges.addSourceTarget('main', 'secondary', 'property', 'important');
      const edgeList = edges.values();
      
      parser.applyEdgeRules(edgeList);
      
      expect(edgeList[0].color).toBe('#FF0000');
      expect(edgeList[0].width).toBe(3);
      expect(edgeList[0].opacity).toBe(0.8);
    });

    it('should combine edge and node queries', () => {
      const query = `
        default => color("#000000")
        edge("link") => color("#FF0000")
        tagged("important") => color("#00FF00")
      `;
      parser.parseQuery(query);
      
      const node: Node = { id: 'test', label: 'Test' };
      edges.addSourceTarget('test', 'other', 'property', 'link');
      
      parser.applyRules([node]);
      parser.applyEdgeRules(edges.values());
      
      expect(node.color).toBe('#000000');
      expect(edges.values()[0].color).toBe('#FF0000');
    });

    it('should validate edge query syntax', () => {
      const validQueries = [
        'edge(default) => color("red")',
        'edge("property") => color("blue")',
        'edge(default).includes("value") => color("green")',
        'edge("prop").not_includes("value") => width(2)',
        'edge("link"), edge(default) => opacity(0.5)'
      ];

      validQueries.forEach(query => {
        const errors = parser.getParseErrors(query);
        expect(errors).toEqual([]);
      });
    });
  });
});
