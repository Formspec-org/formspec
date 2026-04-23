import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, '../../src');

function readFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return readFiles(fullPath);
    if (!/\.(ts)$/.test(entry.name)) return [];
    return [fullPath];
  });
}

function fileText(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

function posixRelativeFromSrcRoot(absFilePath: string): string {
  return path.relative(srcRoot, absFilePath).split(path.sep).join('/');
}

/** First directory under `src/workspaces/`, or null if the path is not inside a workspace bucket. */
function workspaceBucket(absPath: string): string | null {
  const normalized = absPath.replace(/\\/g, '/');
  const m = normalized.match(/\/src\/workspaces\/([^/]+)\//);
  return m ? m[1]! : null;
}

function extractRelativeImportSpecifiers(source: string): string[] {
  const specs: string[] = [];
  const fromRe = /\bfrom\s+['"](\.[^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = fromRe.exec(source)) !== null) {
    specs.push(m[1]!);
  }
  const sideEffectRe = /^\s*import\s+['"](\.[^'"]+)['"]/gm;
  while ((m = sideEffectRe.exec(source)) !== null) {
    specs.push(m[1]!);
  }
  return specs;
}

function sourceImportsFormspecCore(source: string): boolean {
  if (/\bfrom\s+['"]@formspec-org\/core(?:\/[^'"]*)?['"]/.test(source)) return true;
  if (/\bimport\s*\(\s*['"]@formspec-org\/core(?:\/[^'"]*)?['"]/.test(source)) return true;
  if (/^\s*import\s+['"]@formspec-org\/core(?:\/[^'"]*)?['"]/m.test(source)) return true;
  return false;
}

/**
 * Cross-bucket imports under `workspaces/<bucket>/` bypass the `shared` hub.
 * Prefer moving shared types/UI into `workspaces/shared` or composing at `components/` / `studio-app/`.
 * Each entry documents an intentional edge until refactored.
 */
const ALLOWED_CROSS_WORKSPACE_IMPORTS: Record<string, readonly string[]> = {
  'workspaces/layout/LayoutLivePreviewSection': ['../preview/FormspecPreviewHost'],
  'workspaces/editor/ManageView': [
    '../logic/VariablesSection',
    '../logic/BindsSection',
    '../logic/ShapesSection',
    '../logic/FilterBar',
  ],
  'workspaces/data/DataTab': ['../editor/DataSources', '../editor/OptionSets'],
};

describe('import boundaries', () => {
  it('feature modules do not import app shells', () => {
    const featureFiles = readFiles(path.join(srcRoot, 'features'));
    for (const filePath of featureFiles) {
      const text = fileText(filePath);
      expect(text, filePath).not.toMatch(/studio-app\//);
    }
  });

  it('workspaces and state do not import @formspec-org/core (use @formspec-org/studio-core)', () => {
    const dirs = [path.join(srcRoot, 'workspaces'), path.join(srcRoot, 'state')];
    const violations: string[] = [];
    for (const dir of dirs) {
      for (const filePath of readFiles(dir)) {
        if (sourceImportsFormspecCore(fileText(filePath))) {
          violations.push(posixRelativeFromSrcRoot(filePath));
        }
      }
    }
    expect(violations, `Offenders:\n${violations.join('\n')}`).toEqual([]);
  });

  it('state does not import workspaces (keep shell hooks free of workspace UI modules)', () => {
    const violations: string[] = [];
    for (const filePath of readFiles(path.join(srcRoot, 'state'))) {
      const dir = path.dirname(filePath);
      for (const spec of extractRelativeImportSpecifiers(fileText(filePath))) {
        if (!spec.startsWith('.')) continue;
        const resolved = path.normalize(path.join(dir, spec));
        if (workspaceBucket(resolved)) {
          violations.push(`${posixRelativeFromSrcRoot(filePath)} → ${spec}`);
        }
      }
    }
    expect(violations, `Offenders:\n${violations.join('\n')}`).toEqual([]);
  });

  it('workspace buckets do not import sibling buckets except via shared (allowlisted exceptions)', () => {
    const violations: string[] = [];
    for (const filePath of readFiles(path.join(srcRoot, 'workspaces'))) {
      const text = fileText(filePath);
      const fileBucket = workspaceBucket(filePath);
      if (!fileBucket) continue;

      const relKey = posixRelativeFromSrcRoot(filePath);
      const allowedForFile = new Set(ALLOWED_CROSS_WORKSPACE_IMPORTS[relKey] ?? []);

      const dir = path.dirname(filePath);
      for (const spec of extractRelativeImportSpecifiers(text)) {
        if (!spec.startsWith('.')) continue;
        const resolved = path.normalize(path.join(dir, spec));
        const importBucket = workspaceBucket(resolved);
        if (!importBucket) continue;

        if (importBucket === 'shared') continue;

        if (fileBucket === 'shared' && importBucket !== 'shared') {
          violations.push(`${relKey}: shared must not import workspace bucket "${importBucket}" (${spec})`);
          continue;
        }

        if (importBucket === fileBucket) continue;

        if (!allowedForFile.has(spec)) {
          violations.push(`${relKey}: bucket "${fileBucket}" must not import sibling "${importBucket}" (${spec})`);
        }
      }
    }
    expect(violations, `Offenders:\n${violations.join('\n')}`).toEqual([]);
  });
});
