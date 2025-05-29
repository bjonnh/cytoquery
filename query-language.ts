import { createToken, Lexer, CstParser, IToken } from 'chevrotain';
import { CachedMetadata } from 'obsidian';
import { Node, EdgeSet } from './utils';

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
    Identifier: IToken[];
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
    this.CONSUME(Identifier);
    this.OPTION(() => {
      this.CONSUME(LParen);
      this.CONSUME(StringLiteral);
      this.CONSUME(RParen);
    });
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
      console.error("Lexing errors:", lexResult.errors);
      return;
    }

    // Parse
    parser.input = lexResult.tokens;
    const cst = parser.query() as unknown as QueryCstNode;

    if (parser.errors.length > 0) {
      console.error("Parsing errors:", parser.errors);
      return;
    }

    // Transform CST to named parameters and rules
    // First process named parameter definitions
    if (cst.children.namedParamDefinition) {
      for (const namedParamCst of cst.children.namedParamDefinition) {
        this.transformNamedParamDefinition(namedParamCst);
      }
    }

    // Then process rules
    if (cst.children.rule) {
      for (const ruleCst of cst.children.rule) {
        const rules = this.transformRule(ruleCst);
        this.rules.push(...rules);
      }
    }
  }

  private transformNamedParamDefinition(namedParamCst: NamedParamDefinitionCstNode): void {
    const paramName = namedParamCst.children.NamedParameter[0].image;
    const actions = this.extractActions(namedParamCst.children.actionList[0]);
    this.namedParameters.set(paramName, actions);
  }

  private extractActions(actionListCst: ActionListCstNode): { type: string; value: string }[] {
    const actions: { type: string; value: string }[] = [];

    if (actionListCst.children.action) {
      for (const actionCst of actionListCst.children.action) {
        const actionType = actionCst.children.Identifier[0].image;
        const actionValue = actionCst.children.StringLiteral?.[0]?.image.slice(1, -1) || // Remove quotes from string
                           actionCst.children.NumberLiteral?.[0]?.image || ''; // Use number as-is
        actions.push({ type: actionType, value: actionValue });
      }
    }

    return actions;
  }

  private transformRule(ruleCst: RuleCstNode): QueryRule[] {
    const conditionListCst = ruleCst.children.conditionList[0];
    const actionListCst = ruleCst.children.actionList[0];

    // Extract all conditions
    const conditions: Array<{ type: string; value?: string }> = [];
    if (conditionListCst.children.condition) {
      for (const conditionCst of conditionListCst.children.condition) {
        const conditionType = conditionCst.children.Identifier[0].image;
        const conditionValue = conditionCst.children.StringLiteral?.[0]?.image.slice(1, -1); // Remove quotes
        conditions.push({ type: conditionType, value: conditionValue });
      }
    }

    // Extract all actions (including named parameters)
    const actions: { type: string; value: string }[] = [];
    
    // Check for named parameter reference
    if (actionListCst.children.namedParam && actionListCst.children.namedParam.length > 0) {
      const namedParamRef = actionListCst.children.namedParam[0].children.NamedParameter[0].image;
      const namedActions = this.namedParameters.get(namedParamRef);
      if (namedActions) {
        actions.push(...namedActions);
      } else {
        console.warn(`Unknown named parameter: ${namedParamRef}`);
      }
    } else {
      // Regular actions
      actions.push(...this.extractActions(actionListCst));
    }

    // Create rules for each condition
    const rules: QueryRule[] = [];
    for (const conditionDef of conditions) {
      // Create condition function
      let condition: (node: Node, metadata: Map<string, CachedMetadata>) => boolean;

      switch (conditionDef.type) {
        case 'default':
          condition = () => true;
          break;
        case 'link_to':
          condition = (node, metadata) => this.link_to(node, conditionDef.value!, metadata);
          break;
        case 'link_from':
          condition = (node, metadata) => this.link_from(node, conditionDef.value!, metadata);
          break;
        case 'link':
          condition = (node, metadata) => this.link(node, conditionDef.value!, metadata);
          break;
        case 'tag':
          condition = (node, metadata) => this.hasTag(node, conditionDef.value!, metadata);
          break;
        default:
          console.warn(`Unknown condition type: ${conditionDef.type}`);
          continue;
      }

      // Create action function that applies all actions
      const action = (node: Node) => {
        for (const actionDef of actions) {
          this.applyAction(node, actionDef.type, actionDef.value);
        }
      };

      rules.push({ condition, action });
    }

    return rules;
  }

  applyRules(nodes: Node[]): void {
    // Apply rules to each node
    for (const node of nodes) {
      for (const rule of this.rules) {
        if (rule.condition(node, this.metadata)) {
          rule.action(node);
        }
      }
    }
  }

  private link_to(node: Node, targetName: string, _metadata: Map<string, CachedMetadata>): boolean {
    // Use the edges instead of querying metadata
    return this.edges.values().some(edge => {
      // Check if the current node is the source of any edge
      if (edge.source === node.id) {
        // Get the target node's label (usually the basename)
        const targetId = edge.target;
        const targetLabel = targetId.split('/').pop()?.replace('.md', '') || targetId;
        // Check if the target's label includes the targetName
        return targetLabel.toLowerCase() === targetName.toLowerCase();
      }
      return false;
    });
  }

  private link_from(node: Node, targetName: string, _metadata: Map<string, CachedMetadata>): boolean {
    // Use the edges instead of querying metadata
    return this.edges.values().some(edge => {
      // Check if the current node is the target of any edge
      if (edge.target === node.id) {
        // If targetName is provided, check if the source matches
        if (targetName) {
          // Get the source node's label (usually the basename)
          const sourceId = edge.source;
          const sourceName = sourceId.split('/').pop()?.replace('.md', '') || sourceId;
          return sourceName.toLowerCase() === targetName.toLowerCase();
        } else {
          return true;
        }
      }
      return false;
    });
  }

  private link(node: Node, targetName: string, metadata: Map<string, CachedMetadata>): boolean {
    // Check for links to or from the node
    return this.link_to(node, targetName, metadata) || this.link_from(node, targetName, metadata);
  }

  private hasTag(node: Node, tagName: string, metadata: Map<string, CachedMetadata>): boolean {
    const meta = metadata.get(node.id);
    if (!meta) return false;

    if (meta.frontmatter && meta.frontmatter["tags"]) {
      return meta.frontmatter["tags"].some((tag: string) =>
        tag && (tag.toLowerCase() === tagName.toLowerCase() ||
          tag.toLowerCase() === '#' + tagName.toLowerCase())
      );
    }

    if (!meta.tags) return false;

    return meta.tags.some(tag =>
      tag.tag.toLowerCase() === tagName.toLowerCase() ||
      tag.tag.toLowerCase() === '#' + tagName.toLowerCase()
    );
  }

  private applyAction(node: Node, actionType: string, actionValue: string): void {
    // Remove quotes if present
    const cleanValue = actionValue.replace(/["']/g, '').toLowerCase();
    
    if (actionType === 'color') {
      node.color = actionValue.replace(/["']/g, '');
    } else if (actionType === 'shape') {
      // Validate shape values
      const validShapes = ['sphere', 'cube', 'cylinder', 'cone', 'torus', 'tetrahedron', 'octahedron', 'dodecahedron', 'icosahedron'];
      if (validShapes.includes(cleanValue)) {
        node.shape = cleanValue as any;
      }
    } else if (actionType === 'material' || actionType === 'texture') {
      // Validate material values
      const validMaterials = ['default', 'glass', 'metal', 'plastic'];
      if (validMaterials.includes(cleanValue)) {
        node.material = cleanValue as any;
      }
    } else if (actionType === 'size') {
      // Parse size as a number
      const sizeValue = parseFloat(actionValue.replace(/["']/g, ''));
      if (!isNaN(sizeValue) && sizeValue > 0) {
        // Clamp size between 0.1 and 10 for reasonable limits
        node.size = Math.max(0.1, Math.min(10, sizeValue));
      }
    }
  }

  // Additional method to get parse errors for better error handling
  getParseErrors(queryText: string): string[] {
    const errors: string[] = [];
    
    const lexResult = queryLexer.tokenize(queryText);
    if (lexResult.errors.length > 0) {
      errors.push(...lexResult.errors.map(e => `Lexing error: ${e.message}`));
      return errors;
    }

    parser.input = lexResult.tokens;
    parser.query();
    
    if (parser.errors.length > 0) {
      errors.push(...parser.errors.map(e => `Parsing error: ${e.message}`));
    }

    return errors;
  }
}
