#!/usr/bin/env node
/**
 * Generate concise Markdown API docs from TypeScript declaration files.
 *
 * Usage: node scripts/generate-ts-api-markdown.mjs
 *
 * Produces:
 *   - packages/formspec-engine/API.llm.md
 *   - packages/formspec-webcomponent/API.llm.md
 */

import ts from 'typescript';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// No shared output dir needed — each package writes to its own folder.

// ── Helpers ──────────────────────────────────────────────────────────────

/** Extract the JSDoc comment text from a node (first comment block). */
function getJSDoc(node, sourceFile) {
  const jsDocs = ts.getJSDocCommentsAndTags(node);
  for (const doc of jsDocs) {
    if (ts.isJSDoc(doc)) {
      const comment = ts.getTextOfJSDocComment(doc.comment);
      if (comment) return comment.trim();
    }
  }
  // Fallback: scan leading comment ranges for /** ... */
  const text = sourceFile.getFullText();
  const ranges = ts.getLeadingCommentRanges(text, node.getFullStart());
  if (ranges) {
    for (const r of ranges) {
      if (r.kind === ts.SyntaxKind.MultiLineCommentTrivia) {
        const raw = text.slice(r.pos, r.end);
        if (raw.startsWith('/**')) {
          return raw
            .replace(/^\/\*\*\s*/, '')
            .replace(/\s*\*\/$/, '')
            .replace(/^\s*\* ?/gm, '')
            .trim();
        }
      }
    }
  }
  return '';
}

/** Print a type node back to its source text. */
function typeText(typeNode, sourceFile) {
  if (!typeNode) return 'any';
  return typeNode.getText(sourceFile);
}

/** Format a parameter declaration. */
function formatParam(p, sourceFile) {
  const name = p.name.getText(sourceFile);
  const opt = p.questionToken ? '?' : '';
  const type = p.type ? typeText(p.type, sourceFile) : 'any';
  return `${name}${opt}: ${type}`;
}

/** Format a full function/method signature. */
function formatSignature(node, sourceFile) {
  const params = (node.parameters || []).map(p => formatParam(p, sourceFile)).join(', ');
  const ret = node.type ? typeText(node.type, sourceFile) : 'void';
  return `(${params}): ${ret}`;
}

/** Check if a node has the `private` or `#` modifier. */
function isPrivate(node) {
  if (node.modifiers) {
    for (const m of node.modifiers) {
      if (m.kind === ts.SyntaxKind.PrivateKeyword) return true;
    }
  }
  // Private identifier (#name)
  if (node.name && ts.isPrivateIdentifier(node.name)) return true;
  return false;
}

// ── Extraction ───────────────────────────────────────────────────────────

/**
 * Walk a source file and collect exported declarations.
 * Returns { interfaces, typeAliases, classes, functions, constDecls, moduleDoc }.
 */
function extractDeclarations(sourceFile) {
  const interfaces = [];
  const typeAliases = [];
  const classes = [];
  const functions = [];
  const constDecls = [];
  let moduleDoc = '';

  // Check for leading module-level JSDoc (before first statement)
  if (sourceFile.statements.length > 0) {
    const first = sourceFile.statements[0];
    const text = sourceFile.getFullText();
    const ranges = ts.getLeadingCommentRanges(text, 0);
    if (ranges) {
      for (const r of ranges) {
        if (r.kind === ts.SyntaxKind.MultiLineCommentTrivia) {
          const raw = text.slice(r.pos, r.end);
          if (raw.startsWith('/**') && raw.includes('@module')) {
            moduleDoc = raw
              .replace(/^\/\*\*\s*/, '')
              .replace(/\s*\*\/$/, '')
              .replace(/^\s*\* ?/gm, '')
              .replace(/@module\s*/, '')
              .trim();
          }
        }
      }
    }
  }

  ts.forEachChild(sourceFile, node => {
    // Skip non-exported and re-export statements
    if (ts.isExportDeclaration(node)) return;
    if (ts.isImportDeclaration(node)) return;

    if (ts.isInterfaceDeclaration(node)) {
      interfaces.push(extractInterface(node, sourceFile));
    } else if (ts.isTypeAliasDeclaration(node)) {
      typeAliases.push(extractTypeAlias(node, sourceFile));
    } else if (ts.isClassDeclaration(node)) {
      classes.push(extractClass(node, sourceFile));
    } else if (ts.isFunctionDeclaration(node)) {
      functions.push(extractFunction(node, sourceFile));
    } else if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        constDecls.push(extractConst(decl, node, sourceFile));
      }
    }
  });

  return { interfaces, typeAliases, classes, functions, constDecls, moduleDoc };
}

function extractInterface(node, sourceFile) {
  const name = node.name.getText(sourceFile);
  const doc = getJSDoc(node, sourceFile);
  const members = [];

  for (const m of node.members) {
    if (ts.isPropertySignature(m)) {
      const pName = m.name.getText(sourceFile);
      const pDoc = getJSDoc(m, sourceFile);
      const pType = m.type ? typeText(m.type, sourceFile) : 'any';
      const opt = m.questionToken ? '?' : '';
      members.push({ kind: 'property', name: pName, type: pType, optional: !!m.questionToken, doc: pDoc });
    } else if (ts.isMethodSignature(m)) {
      const mName = m.name.getText(sourceFile);
      const mDoc = getJSDoc(m, sourceFile);
      const sig = formatSignature(m, sourceFile);
      members.push({ kind: 'method', name: mName, signature: sig, doc: mDoc });
    }
  }

  return { name, doc, members };
}

function extractTypeAlias(node, sourceFile) {
  const name = node.name.getText(sourceFile);
  const doc = getJSDoc(node, sourceFile);
  const typeStr = typeText(node.type, sourceFile);
  return { name, doc, typeStr };
}

function extractClass(node, sourceFile) {
  const name = node.name ? node.name.getText(sourceFile) : '<anonymous>';
  const doc = getJSDoc(node, sourceFile);
  const properties = [];
  const methods = [];
  let ctorDoc = '';
  let ctorSig = '';

  for (const m of node.members) {
    if (isPrivate(m)) continue;

    if (ts.isConstructorDeclaration(m)) {
      ctorDoc = getJSDoc(m, sourceFile);
      const params = (m.parameters || [])
        .filter(p => !isPrivate(p))
        .map(p => formatParam(p, sourceFile))
        .join(', ');
      const ret = name;
      ctorSig = `(${params})`;
    } else if (ts.isPropertyDeclaration(m)) {
      const pName = m.name.getText(sourceFile);
      const pDoc = getJSDoc(m, sourceFile);
      const pType = m.type ? typeText(m.type, sourceFile) : 'any';
      properties.push({ name: pName, type: pType, doc: pDoc });
    } else if (ts.isMethodDeclaration(m)) {
      const mName = m.name.getText(sourceFile);
      const mDoc = getJSDoc(m, sourceFile);
      const sig = formatSignature(m, sourceFile);
      methods.push({ name: mName, signature: sig, doc: mDoc });
    } else if (ts.isGetAccessorDeclaration(m)) {
      const aName = m.name.getText(sourceFile);
      const aDoc = getJSDoc(m, sourceFile);
      const aType = m.type ? typeText(m.type, sourceFile) : 'any';
      properties.push({ name: aName, type: aType, doc: aDoc, accessor: 'get' });
    } else if (ts.isSetAccessorDeclaration(m)) {
      const aName = m.name.getText(sourceFile);
      const aDoc = getJSDoc(m, sourceFile);
      const paramType = m.parameters[0]?.type ? typeText(m.parameters[0].type, sourceFile) : 'any';
      properties.push({ name: aName, type: paramType, doc: aDoc, accessor: 'set' });
    }
  }

  return { name, doc, properties, methods, ctorDoc, ctorSig };
}

function extractFunction(node, sourceFile) {
  const name = node.name ? node.name.getText(sourceFile) : '<anonymous>';
  const doc = getJSDoc(node, sourceFile);
  const sig = formatSignature(node, sourceFile);
  return { name, doc, signature: sig };
}

function extractConst(decl, stmt, sourceFile) {
  const name = decl.name.getText(sourceFile);
  const doc = getJSDoc(stmt, sourceFile);
  const type = decl.type ? typeText(decl.type, sourceFile) : null;
  return { name, doc, type };
}

// ── Markdown Formatting ──────────────────────────────────────────────────

function writeInterface(lines, iface) {
  lines.push(`#### interface \`${iface.name}\`\n`);
  if (iface.doc) lines.push(`${iface.doc}\n`);

  const docProps = iface.members.filter(m => m.kind === 'property' && m.doc);
  const undocProps = iface.members.filter(m => m.kind === 'property' && !m.doc);
  const methodMembers = iface.members.filter(m => m.kind === 'method');

  if (docProps.length > 0) {
    for (const p of docProps) {
      lines.push(`- **${p.name}** (\`${p.type}\`): ${p.doc}`);
    }
    lines.push('');
  }

  if (undocProps.length > 0 && docProps.length === 0 && methodMembers.length === 0) {
    // For simple interfaces with no docs, list all properties
    for (const p of undocProps) {
      const opt = p.optional ? '?' : '';
      lines.push(`- **${p.name}${opt}**: \`${p.type}\``);
    }
    lines.push('');
  }

  for (const m of methodMembers) {
    lines.push(`##### \`${m.name}${m.signature}\`\n`);
    if (m.doc) lines.push(`${m.doc}\n`);
  }
}

function writeTypeAlias(lines, alias) {
  lines.push(`#### type \`${alias.name}\`\n`);
  if (alias.doc) lines.push(`${alias.doc}\n`);
  // Show the type definition for short types only
  if (alias.typeStr.length < 200) {
    lines.push(`\`\`\`ts\ntype ${alias.name} = ${alias.typeStr};\n\`\`\`\n`);
  }
}

function writeClass(lines, cls) {
  lines.push(`#### class \`${cls.name}\`\n`);
  if (cls.doc) lines.push(`${cls.doc}\n`);

  if (cls.ctorSig) {
    lines.push(`##### \`constructor${cls.ctorSig}\`\n`);
    if (cls.ctorDoc) lines.push(`${cls.ctorDoc}\n`);
  }

  // Properties with docs
  const docProps = cls.properties.filter(p => p.doc);
  if (docProps.length > 0) {
    for (const p of docProps) {
      const prefix = p.accessor === 'get' ? '(get) ' : p.accessor === 'set' ? '(set) ' : '';
      lines.push(`- **${prefix}${p.name}** (\`${p.type}\`): ${p.doc}`);
    }
    lines.push('');
  }

  for (const m of cls.methods) {
    lines.push(`##### \`${m.name}${m.signature}\`\n`);
    if (m.doc) lines.push(`${m.doc}\n`);
  }
}

function writeFunction(lines, func) {
  lines.push(`## \`${func.name}${func.signature}\`\n`);
  if (func.doc) lines.push(`${func.doc}\n`);
}

function writeConst(lines, c) {
  const typeStr = c.type ? `: ${c.type}` : '';
  lines.push(`## \`${c.name}${typeStr}\`\n`);
  if (c.doc) lines.push(`${c.doc}\n`);
}

// ── Packages ─────────────────────────────────────────────────────────────

const packages = [
  {
    name: 'formspec-engine',
    title: 'formspec-engine — API Reference',
    description: 'Core form state management engine. Parses a FormspecDefinition and builds a reactive signal network for field values, relevance, validation, repeat groups, computed variables, and response serialization. Includes FEL expression compilation, definition assembly, and bidirectional runtime mapping.',
    entrypoint: 'packages/formspec-engine/dist/index.d.ts',
    output: 'packages/formspec-engine/API.llm.md',
    extraFiles: [
      'packages/formspec-engine/dist/assembler.d.ts',
      'packages/formspec-engine/dist/runtime-mapping.d.ts',
    ],
  },
  {
    name: 'formspec-webcomponent',
    title: 'formspec-webcomponent — API Reference',
    description: '`<formspec-render>` custom element that binds a FormEngine to the DOM. Provides a component registry, theme cascade resolver, token resolution, responsive breakpoints, and accessibility attributes. Ships with 35 built-in component plugins.',
    entrypoint: 'packages/formspec-webcomponent/dist/index.d.ts',
    output: 'packages/formspec-webcomponent/API.llm.md',
    extraFiles: [
      'packages/formspec-webcomponent/dist/registry.d.ts',
      'packages/formspec-webcomponent/dist/theme-resolver.d.ts',
      'packages/formspec-webcomponent/dist/types.d.ts',
    ],
  },
];

for (const pkg of packages) {
  const lines = [];
  lines.push(`# ${pkg.title}\n`);
  lines.push(`*Auto-generated from TypeScript declarations — do not hand-edit.*\n`);
  lines.push(`${pkg.description}\n`);

  // Collect all files: entrypoint first, then extras (skip re-exported modules already in entrypoint)
  const files = [pkg.entrypoint, ...pkg.extraFiles];
  const seen = new Set();

  for (const relPath of files) {
    const absPath = resolve(ROOT, relPath);
    const sourceFile = ts.createSourceFile(
      absPath,
      readFileSync(absPath, 'utf8'),
      ts.ScriptTarget.Latest,
      /* setParentNodes */ true,
    );

    const decls = extractDeclarations(sourceFile);

    if (decls.moduleDoc) {
      lines.push(`${decls.moduleDoc}\n`);
    }

    for (const f of decls.functions) {
      if (seen.has(`fn:${f.name}`)) continue;
      seen.add(`fn:${f.name}`);
      writeFunction(lines, f);
    }

    for (const c of decls.constDecls) {
      if (seen.has(`const:${c.name}`)) continue;
      seen.add(`const:${c.name}`);
      writeConst(lines, c);
    }

    for (const iface of decls.interfaces) {
      if (seen.has(`iface:${iface.name}`)) continue;
      seen.add(`iface:${iface.name}`);
      writeInterface(lines, iface);
    }

    for (const alias of decls.typeAliases) {
      if (seen.has(`type:${alias.name}`)) continue;
      seen.add(`type:${alias.name}`);
      writeTypeAlias(lines, alias);
    }

    for (const cls of decls.classes) {
      if (seen.has(`class:${cls.name}`)) continue;
      seen.add(`class:${cls.name}`);
      writeClass(lines, cls);
    }
  }

  const outPath = resolve(ROOT, pkg.output);
  writeFileSync(outPath, lines.join('\n') + '\n');
  console.log(`  ${outPath}`);
}

console.log(`Generated ${packages.length} TypeScript API markdown files.`);
