import { createToken, Lexer, CstParser, IToken } from 'chevrotain';
import { CachedMetadata } from 'obsidian';
import { Node, EdgeSet } from '../utils';

// Define tokens
const NamedParameter = createToken({ name: "NamedParameter", pattern: /:[a-zA-Z_]\w*/ });
const Identifier = createToken({ name: "Identifier", pattern: /[a-zA-Z_]\w*/ });
const StringLiteral = createToken({ name: "StringLiteral", pattern: /"[^"]*"|'[^']*'/ });
const NumberLiteral = createToken({ name: "NumberLiteral", pattern: /\d+(\.\d+)?/ });
const Arrow = createToken({ name: "Arrow", pattern: /=>/ });
const Equals = createToken({ name: "Equals", pattern: /=/ });
const LParen = createToken({ name: "LParen", pattern: /\(/ });
const RParen = createToken({ name: "RParen", pattern: /\)/ });
const Comma = createToken({ name: "Comma", pattern: /,/ });
const WhiteSpace = createToken({ name: "WhiteSpace", pattern: /\s+/, group: Lexer.SKIPPED });

// Token array
const allTokens = [
  WhiteSpace,
  Arrow, // Must come before other patterns that might match '='
  Equals,
  NumberLiteral,
  LParen,
  RParen,
  StringLiteral,
  Comma,
  NamedParameter, // Must come before Identifier to properly match :name patterns
  Identifier
];

// Create lexer
const queryLexer = new Lexer(allTokens);

// CST Node interfaces
interface RuleCstNode {
  children: {
    conditionList: ConditionListCstNode[];
    Arrow: IToken[];
    actionList: ActionListCstNode[];
  };
}

interface NamedParamDefinitionCstNode {
  children: {
    NamedParameter: IToken[];
    Equals: IToken[];
    actionList: ActionListCstNode[];
  };
}

interface ConditionListCstNode {
  children: {
    condition: ConditionCstNode[];
    Comma?: IToken[];
  };
}

interface ConditionCstNode {
  children: {
    Identifier?: IToken[];
    LParen?: IToken[];
    StringLiteral?: IToken[];
    RParen?: IToken[];
  };
}

interface ActionListCstNode {
  children: {
    action: ActionCstNode[];
    namedParam?: NamedParamRefCstNode[];
    Comma?: IToken[];
  };
}

interface ActionCstNode {
  children: {
    Identifier: IToken[];
    LParen: IToken[];
    StringLiteral?: IToken[];
    NumberLiteral?: IToken[];
    RParen: IToken[];
  };
}

interface NamedParamRefCstNode {
  children: {
    NamedParameter: IToken[];
  };
}

interface QueryCstNode {
  children: {
    rule?: RuleCstNode[];
    namedParamDefinition?: NamedParamDefinitionCstNode[];
  };
}

// Parser
class QueryGrammar extends CstParser {
  constructor() {
    super(allTokens);
    this.performSelfAnalysis();
  }

  public query = this.RULE("query", () => {
    this.MANY(() => {
      this.OR([
        { ALT: () => this.SUBRULE(this.rule) },
        { ALT: () => this.SUBRULE(this.namedParamDefinition) }
      ]);
    });
  });

  private rule = this.RULE("rule", () => {
    this.SUBRULE(this.conditionList, { LABEL: "conditionList" });
    this.CONSUME(Arrow);
    this.SUBRULE(this.actionList, { LABEL: "actionList" });
  });

  private namedParamDefinition = this.RULE("namedParamDefinition", () => {
    this.CONSUME(NamedParameter);
    this.CONSUME(Equals);
    this.SUBRULE(this.actionList, { LABEL: "actionList" });
  });

  private conditionList = this.RULE("conditionList", () => {
    this.SUBRULE(this.condition, { LABEL: "condition" });
    this.MANY(() => {
      this.CONSUME(Comma);
      this.SUBRULE2(this.condition, { LABEL: "condition" });
    });
  });

  private condition = this.RULE("condition", () => {
    this.OR([
      { ALT: () => {
        // Regular condition: identifier with optional parameters
        this.CONSUME(Identifier);
        this.OPTION(() => {
          this.CONSUME(LParen);
          this.CONSUME(StringLiteral);
          this.CONSUME(RParen);
        });
      }},
      { ALT: () => {
        // Node name selector: just a string literal
        this.CONSUME2(StringLiteral);
      }}
    ]);
  });

  private actionList = this.RULE("actionList", () => {
    this.OR([
      { ALT: () => {
        this.SUBRULE(this.action, { LABEL: "action" });
        this.MANY(() => {
          this.CONSUME(Comma);
          this.SUBRULE2(this.action, { LABEL: "action" });
        });
      }},
      { ALT: () => this.SUBRULE(this.namedParamRef, { LABEL: "namedParam" }) }
    ]);
  });

  private action = this.RULE("action", () => {
    this.CONSUME(Identifier);
    this.CONSUME(LParen);
    this.OR([
      { ALT: () => this.CONSUME(StringLiteral) },
      { ALT: () => this.CONSUME(NumberLiteral) }
    ]);
    this.CONSUME(RParen);
  });

  private namedParamRef = this.RULE("namedParamRef", () => {
    this.CONSUME(NamedParameter);
  });
}

// Create parser instance
const parser = new QueryGrammar();

// Query rule interface
export interface QueryRule {
  condition: (node: Node, metadata: Map<string, CachedMetadata>) => boolean;
  action: (node: Node) => void;
}

// Enhanced Query Parser using Chevrotain
export class QueryParser {
  private rules: QueryRule[] = [];
  private namedParameters: Map<string, { type: string; value: string }[]> = new Map();
  private metadata: Map<string, CachedMetadata>;
  private edges: EdgeSet;

  constructor(metadata: Map<string, CachedMetadata>, edges: EdgeSet) {
    this.metadata = metadata;
    this.edges = edges;
  }

  parseQuery(queryText: string): void {
    // Clear existing rules and named parameters
    this.rules = [];
    this.namedParameters.clear();

    // Tokenize
    const lexResult = queryLexer.tokenize(queryText);
    
    if (lexResult.errors.length > 0) {
      console.error('Lexing errors:', lexResult.errors);
      return;
    }

    // Parse
    parser.input = lexResult.tokens;
    const cst = parser.query() as QueryCstNode;

    if (parser.errors.length > 0) {
      console.error('Parsing errors:', parser.errors);
      return;
    }

    // Process named parameter definitions first
    if (cst.children.namedParamDefinition) {
      cst.children.namedParamDefinition.forEach(paramDef => {
        const paramName = paramDef.children.NamedParameter[0].image;
        const actions = this.extractActions(paramDef.children.actionList[0]);
        this.namedParameters.set(paramName, actions);
      });
    }

    // Process rules
    if (cst.children.rule) {
      cst.children.rule.forEach(rule => {
        this.processRule(rule);
      });
    }
  }

  private processRule(rule: RuleCstNode): void {
    const conditions = this.extractConditions(rule.children.conditionList[0]);
    const actions = this.extractActionsFromList(rule.children.actionList[0]);

    const queryRule: QueryRule = {
      condition: (node: Node, metadata: Map<string, CachedMetadata>) => {
        return this.evaluateConditions(node, conditions, metadata);
      },
      action: (node: Node) => {
        this.applyActions(node, actions);
      }
    };

    this.rules.push(queryRule);
  }

  private extractConditions(conditionList: ConditionListCstNode): Array<{ type: string; value?: string }> {
    const conditions: Array<{ type: string; value?: string }> = [];
    
    if (conditionList.children.condition) {
      conditionList.children.condition.forEach(cond => {
        // Check if it's a string literal condition (node name selector)
        // It will be in StringLiteral2 due to CONSUME2
        const stringLiterals = cond.children.StringLiteral || [];
        const hasNodeNameSelector = stringLiterals.length > 0 && !cond.children.Identifier;
        
        if (hasNodeNameSelector) {
          const stringValue = stringLiterals[0].image;
          conditions.push({ type: stringValue, value: undefined });
        } else if (cond.children.Identifier && cond.children.Identifier[0]) {
          // Regular identifier-based condition
          const type = cond.children.Identifier[0].image;
          let value: string | undefined;
          
          if (stringLiterals.length > 0) {
            value = stringLiterals[0].image.slice(1, -1); // Remove quotes
          }
          
          conditions.push({ type, value });
        }
      });
    }
    
    return conditions;
  }

  private extractActions(actionList: ActionListCstNode): Array<{ type: string; value: string }> {
    const actions: Array<{ type: string; value: string }> = [];
    
    if (actionList.children.action) {
      actionList.children.action.forEach(act => {
        const type = act.children.Identifier[0].image;
        let value = '';
        
        if (act.children.StringLiteral && act.children.StringLiteral[0]) {
          value = act.children.StringLiteral[0].image.slice(1, -1); // Remove quotes
        } else if (act.children.NumberLiteral && act.children.NumberLiteral[0]) {
          value = act.children.NumberLiteral[0].image;
        }
        
        actions.push({ type, value });
      });
    }
    
    return actions;
  }

  private extractActionsFromList(actionList: ActionListCstNode): Array<{ type: string; value: string }> {
    // Check if it's a named parameter reference
    if (actionList.children.namedParam) {
      const paramName = actionList.children.namedParam[0].children.NamedParameter[0].image;
      const paramActions = this.namedParameters.get(paramName);
      if (!paramActions) {
        console.warn(`Unknown named parameter: ${paramName}`);
        return [];
      }
      return paramActions;
    }
    
    // Otherwise extract regular actions
    return this.extractActions(actionList);
  }

  private evaluateConditions(node: Node, conditions: Array<{ type: string; value?: string }>, metadata: Map<string, CachedMetadata>): boolean {
    // Comma-separated conditions use OR logic - any match triggers the action
    return conditions.some(condition => {
      switch (condition.type) {
        case 'any':
        case 'default':
          return true;
        case 'orphan':
          return !this.hasIncomingLinks(node.id) && !this.hasOutgoingLinks(node.id);
        case 'tag':
          // tag() matches tag nodes themselves
          return this.isTagNode(node.id, condition.value || '');
        case 'tagged':
          // tagged() matches pages that have this tag
          return this.hasTag(node.id, condition.value || '', metadata);
        case 'hasIncomingLinks':
          return this.hasIncomingLinks(node.id);
        case 'hasOutgoingLinks':
          return this.hasOutgoingLinks(node.id);
        case 'folder':
          return this.inFolder(node.id, condition.value || '');
        case 'link_to':
          return this.hasLinkTo(node.id, condition.value || '');
        case 'link_from':
          return this.hasLinkFrom(node.id, condition.value || '');
        case 'link':
          return this.hasLinkTo(node.id, condition.value || '') || 
                 this.hasLinkFrom(node.id, condition.value || '');
        default:
          // Check if it's a quoted string (node name selector)
          if (condition.type.startsWith('"') && condition.type.endsWith('"')) {
            const nodeName = condition.type.slice(1, -1);
            return this.matchesNodeName(node, nodeName);
          }
          return false;
      }
    });
  }

  private applyActions(node: Node, actions: Array<{ type: string; value: string }>): void {
    actions.forEach(action => {
      switch (action.type) {
        case 'color':
          node.color = action.value;
          break;
        case 'shape':
          const validShapes = ['sphere', 'cube', 'cylinder', 'cone', 'torus', 'tetrahedron', 'octahedron', 'dodecahedron', 'icosahedron'];
          if (validShapes.includes(action.value)) {
            node.shape = action.value as any;
          }
          break;
        case 'material':
        case 'texture':
          const validMaterials = ['default', 'glass', 'metal', 'plastic'];
          if (validMaterials.includes(action.value)) {
            node.material = action.value as any;
          }
          break;
        case 'size':
          const size = parseFloat(action.value);
          if (!isNaN(size)) {
            node.size = Math.max(0.1, Math.min(10, size));
          }
          break;
      }
    });
  }

  private hasTag(nodeId: string, tag: string, metadata: Map<string, CachedMetadata>): boolean {
    const meta = metadata.get(nodeId);
    if (!meta) return false;
    
    const normalizedTag = tag.toLowerCase();
    
    // Check regular tags
    if (meta.tags) {
      if (meta.tags.some(t => {
        const tagValue = t.tag.toLowerCase();
        return tagValue === `#${normalizedTag}` || tagValue === normalizedTag;
      })) {
        return true;
      }
    }
    
    // Check frontmatter tags
    if (meta.frontmatter?.tags) {
      const frontmatterTags = Array.isArray(meta.frontmatter.tags) 
        ? meta.frontmatter.tags 
        : [meta.frontmatter.tags];
      
      return frontmatterTags.some(t => t && typeof t === 'string' && t.toLowerCase() === normalizedTag);
    }
    
    return false;
  }

  private hasIncomingLinks(nodeId: string): boolean {
    return this.edges.values().some(edge => edge.target === nodeId);
  }

  private hasOutgoingLinks(nodeId: string): boolean {
    return this.edges.values().some(edge => edge.source === nodeId);
  }

  private hasLinkTo(nodeId: string, target: string): boolean {
    const normalizedTarget = target.toLowerCase();
    
    return this.edges.values().some(edge => {
      if (edge.source !== nodeId) return false;
      
      const edgeTarget = edge.target.toLowerCase();
      const edgeTargetWithoutExt = edgeTarget.replace(/\.md$/, '');
      const targetWithoutExt = normalizedTarget.replace(/\.md$/, '');
      
      return edgeTarget === normalizedTarget || 
             edgeTargetWithoutExt === targetWithoutExt ||
             edgeTarget.endsWith('/' + normalizedTarget) ||
             edgeTargetWithoutExt.endsWith('/' + targetWithoutExt);
    });
  }

  private hasLinkFrom(nodeId: string, source: string): boolean {
    const normalizedSource = source.toLowerCase();
    
    return this.edges.values().some(edge => {
      if (edge.target !== nodeId) return false;
      
      const edgeSource = edge.source.toLowerCase();
      const edgeSourceWithoutExt = edgeSource.replace(/\.md$/, '');
      const sourceWithoutExt = normalizedSource.replace(/\.md$/, '');
      
      return edgeSource === normalizedSource || 
             edgeSourceWithoutExt === sourceWithoutExt ||
             edgeSource.endsWith('/' + normalizedSource) ||
             edgeSourceWithoutExt.endsWith('/' + sourceWithoutExt);
    });
  }

  private inFolder(nodeId: string, folder: string): boolean {
    return nodeId.startsWith(folder + '/');
  }

  private isTagNode(nodeId: string, tagName: string): boolean {
    const normalizedTag = tagName.toLowerCase();
    const expectedId = `tag:${normalizedTag}`;
    return nodeId.toLowerCase() === expectedId;
  }

  private matchesNodeName(node: Node, nodeName: string): boolean {
    // Match by label (which includes # for tags)
    return node.label.toLowerCase() === nodeName.toLowerCase();
  }

  applyRules(nodes: Node[]): void {
    nodes.forEach(node => {
      this.rules.forEach(rule => {
        if (rule.condition(node, this.metadata)) {
          rule.action(node);
        }
      });
    });
  }

  getParseErrors(queryText: string): string[] {
    const errors: string[] = [];
    
    // Tokenize
    const lexResult = queryLexer.tokenize(queryText);
    
    if (lexResult.errors.length > 0) {
      lexResult.errors.forEach(error => {
        errors.push(`Lexing error at line ${error.line}, column ${error.column}: ${error.message}`);
      });
      return errors;
    }

    // Parse
    parser.input = lexResult.tokens;
    parser.query();

    if (parser.errors.length > 0) {
      parser.errors.forEach(error => {
        errors.push(`Parsing error: ${error.message}`);
      });
    }

    return errors;
  }
}