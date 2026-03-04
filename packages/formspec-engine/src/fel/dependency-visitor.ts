/**
 * @module fel/dependency-visitor
 *
 * Lightweight CST walker that extracts field reference names from a parsed FEL expression.
 *
 * This is the fourth component of the FEL pipeline, running in parallel with the
 * interpreter. While the interpreter evaluates values, the dependency visitor
 * performs static analysis — it walks the same CST produced by {@link FelParser}
 * and collects every field path referenced in the expression. The FormEngine uses
 * these paths to wire Preact signal dependencies, ensuring that computed fields
 * and bind expressions automatically re-evaluate when their upstream fields change.
 */
import { parser } from './parser.js';

/**
 * Walks a FEL Concrete Syntax Tree to extract the set of field paths referenced
 * by an expression.
 *
 * Unlike the {@link FelInterpreter}, this class does not evaluate anything — it
 * only performs structural analysis. It recognizes both `$`-prefixed relative
 * references and bare identifier references, reconstructing dotted paths from
 * `pathTail` nodes. The resulting dependency list drives the FormEngine's
 * reactive dependency graph.
 */
export class FelDependencyVisitor {
  constructor() {
  }

  /**
   * Extract all unique field paths referenced in a FEL CST.
   *
   * Recursively walks the tree, collecting paths from `fieldRef` nodes.
   * `$`-prefixed references and bare identifiers are both captured. Dotted
   * paths (e.g. `group.field`) are reconstructed from `pathTail` children.
   *
   * @returns Deduplicated array of field path strings (e.g. `['email', 'budget.total']`).
   */
  public getDependencies(cst: any): string[] {
    const deps: string[] = [];
    this.collect(cst, deps);
    return [...new Set(deps)];
  }

  /**
   * Recursively collects field reference paths from a CST node.
   *
   * When a `fieldRef` node is encountered, the visitor reconstructs the full
   * dotted path from the identifier and any `pathTail` children. For all other
   * nodes, it recurses into their children arrays.
   */
  private collect(node: any, deps: string[]) {
    if (!node) return;
    if (node.name === 'fieldRef') {
        if (node.children.Dollar) {
            let name = node.children.Identifier ? node.children.Identifier[0].image : '';
            if (node.children.pathTail) {
                for (const tail of node.children.pathTail) {
                    if (tail.children.Identifier) {
                        name += (name ? '.' : '') + tail.children.Identifier[0].image;
                    }
                }
            }
            deps.push(name);
        } else if (node.children.Identifier) {
            let name = node.children.Identifier[0].image;
            if (node.children.pathTail) {
                for (const tail of node.children.pathTail) {
                    if (tail.children.Identifier) {
                        name += (name ? '.' : '') + tail.children.Identifier[0].image;
                    }
                }
            }
            deps.push(name);
        }
    }

    for (const key in node.children) {
        const children = node.children[key];
        if (Array.isArray(children)) {
            for (const child of children) {
                if (child.name) {
                    this.collect(child, deps);
                }
            }
        }
    }
  }
}

/**
 * Pre-instantiated dependency visitor singleton.
 *
 * Used by FormEngine when compiling FEL expressions to determine which field
 * signals each expression depends on. Call `dependencyVisitor.getDependencies(cst)`
 * with the CST from `parser.expression()` to get the list of referenced field paths.
 */
export const dependencyVisitor = new FelDependencyVisitor();
