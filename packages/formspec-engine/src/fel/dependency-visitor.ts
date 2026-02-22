import { parser } from './parser';

export class FelDependencyVisitor {
  constructor() {
  }

  public getDependencies(cst: any): string[] {
    const deps: string[] = [];
    this.collect(cst, deps);
    return [...new Set(deps)];
  }

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

export const dependencyVisitor = new FelDependencyVisitor();
