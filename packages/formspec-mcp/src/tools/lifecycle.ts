/**
 * Lifecycle tools: create, open, save, list, list_autosaved, publish, undo, redo.
 *
 * These manage project creation, persistence, and history operations.
 */

import { createProject, type ProjectBundle } from '@formspec-org/studio-core';
import { ProjectRegistry } from '../registry.js';
import { wrapCall, errorResponse, successResponse, formatToolError } from '../errors.js';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { NON_DESTRUCTIVE } from '../annotations.js';
import {
  readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, statSync,
} from 'node:fs';
import { resolve, basename, join } from 'node:path';

// ── writeBundle (shared by save + publish) ───────────────────────

function writeBundle(
  bundle: ProjectBundle,
  targetPath: string,
): void {
  mkdirSync(targetPath, { recursive: true });
  const dirName = basename(targetPath);

  writeFileSync(
    join(targetPath, `${dirName}.definition.json`),
    JSON.stringify(bundle.definition, null, 2),
    'utf-8',
  );
  writeFileSync(
    join(targetPath, `${dirName}.component.json`),
    JSON.stringify(bundle.component, null, 2),
    'utf-8',
  );

  if (bundle.theme) {
    writeFileSync(
      join(targetPath, `${dirName}.theme.json`),
      JSON.stringify(bundle.theme, null, 2),
      'utf-8',
    );
  }

  if (Object.keys(bundle.mappings).length > 0) {
    for (const [id, mapping] of Object.entries(bundle.mappings)) {
      const suffix = id === 'default' ? '' : `.${id}`;
      writeFileSync(
        join(targetPath, `${dirName}${suffix}.mapping.json`),
        JSON.stringify(mapping, null, 2),
        'utf-8',
      );
    }
  }
}

// ── handleCreate ──────────────────────────────────────────────────

export function handleCreate(
  registry: ProjectRegistry,
): ReturnType<typeof successResponse> | ReturnType<typeof errorResponse> {
  return wrapCall(() => {
    const projectId = registry.newProject();
    const project = createProject();
    registry.transitionToAuthoring(projectId, project);
    return { project_id: projectId, phase: 'authoring' };
  });
}

// ── handleOpen ────────────────────────────────────────────────────

export function handleOpen(
  registry: ProjectRegistry,
  path: string,
): ReturnType<typeof successResponse> | ReturnType<typeof errorResponse> {
  return wrapCall(() => {
    const absPath = resolve(path);

    if (!existsSync(absPath) || !statSync(absPath).isDirectory()) {
      return errorResponse(formatToolError('LOAD_FAILED', `Directory not found: ${absPath}`));
    }

    const files = readdirSync(absPath);
    const defFile = files.find(f => f.endsWith('.definition.json'));
    if (!defFile) {
      return errorResponse(formatToolError('LOAD_FAILED', `No *.definition.json found in ${absPath}`));
    }

    const definition = JSON.parse(readFileSync(join(absPath, defFile), 'utf-8'));

    const bundle: Record<string, unknown> = { definition };

    const compFile = files.find(f => f.endsWith('.component.json'));
    if (compFile) {
      bundle.component = JSON.parse(readFileSync(join(absPath, compFile), 'utf-8'));
    }

    const themeFile = files.find(f => f.endsWith('.theme.json'));
    if (themeFile) {
      bundle.theme = JSON.parse(readFileSync(join(absPath, themeFile), 'utf-8'));
    }

    const mappingFile = files.find(f => f.endsWith('.mapping.json'));
    if (mappingFile) {
      bundle.mapping = JSON.parse(readFileSync(join(absPath, mappingFile), 'utf-8'));
    }

    const project = createProject();
    project.loadBundle(bundle);

    const projectId = registry.registerOpen(absPath, project);

    return { project_id: projectId, phase: 'authoring' };
  }, 'LOAD_FAILED');
}

// ── handleSave ────────────────────────────────────────────────────

export function handleSave(
  registry: ProjectRegistry,
  projectId: string,
  path?: string,
): ReturnType<typeof successResponse> | ReturnType<typeof errorResponse> {
  return wrapCall(() => {
    const project = registry.getProject(projectId);
    const entry = registry.getEntry(projectId);

    const targetPath = path ? resolve(path) : entry.sourcePath;
    if (!targetPath) {
      return errorResponse(formatToolError('SAVE_FAILED', "No save path specified. For newly created projects, provide a path parameter (e.g., formspec_save with path='my-form'). Or use formspec_publish to export the bundle inline."));
    }

    const bundle = project.exportBundle();
    writeBundle(bundle, targetPath);

    return { saved: true, path: targetPath };
  }, 'SAVE_FAILED');
}

// ── handleList ────────────────────────────────────────────────────

export function handleList(
  registry: ProjectRegistry,
  includeAutosaved?: boolean,
  autosaveDir?: string,
): ReturnType<typeof successResponse> {
  const entries = registry.listAll();
  const projects = entries.map(entry => {
    const isAuthoring = entry.project !== null;
    const title = isAuthoring
      ? (entry.project!.state.definition?.title ?? 'Untitled')
      : 'Untitled';
    return {
      project_id: entry.id,
      phase: isAuthoring ? 'authoring' : 'bootstrap',
      title,
      ...(entry.sourcePath ? { sourcePath: entry.sourcePath } : {}),
    };
  });

  if (!includeAutosaved) {
    return successResponse({ projects });
  }

  // Include autosaved entries
  const dir = autosaveDir ?? join(process.env.HOME ?? '', '.formspec', 'autosave');
  let autosavedEntries: Array<{ name: string; path: string }> = [];

  if (existsSync(dir)) {
    try {
      const subdirs = readdirSync(dir).filter(name => {
        const full = join(dir, name);
        return statSync(full).isDirectory();
      });
      autosavedEntries = subdirs.map(name => ({
        name,
        path: join(dir, name),
      }));
    } catch { /* ignore */ }
  }

  return successResponse({ projects, autosaved: autosavedEntries });
}

// ── handlePublish ─────────────────────────────────────────────────

export function handleExportBundle(
  registry: ProjectRegistry,
  projectId: string,
  version: string,
  summary?: string,
  path?: string,
): ReturnType<typeof successResponse> | ReturnType<typeof errorResponse> {
  return wrapCall(() => {
    const project = registry.getProject(projectId);
    const diagnostics = project.diagnose();

    if (diagnostics.counts.error > 0) {
      return errorResponse(formatToolError('PUBLISH_BLOCKED', `Project has ${diagnostics.counts.error} error(s)`, {
        diagnostics: diagnostics.counts,
      }));
    }

    const bundle = project.exportBundle();

    if (path) {
      const targetPath = resolve(path);
      writeBundle(bundle, targetPath);
      return {
        version,
        summary: summary ?? null,
        path: targetPath,
        bundle,
      };
    }

    return {
      version,
      summary: summary ?? null,
      bundle,
    };
  });
}

// ── handleUndo ────────────────────────────────────────────────────

export function handleUndo(
  registry: ProjectRegistry,
  projectId: string,
): ReturnType<typeof successResponse> | ReturnType<typeof errorResponse> {
  return wrapCall(() => {
    const project = registry.getProject(projectId);
    if (!project.canUndo) return { undone: false };
    project.undo();
    return { undone: true };
  });
}

// ── handleRedo ────────────────────────────────────────────────────

export function handleRedo(
  registry: ProjectRegistry,
  projectId: string,
): ReturnType<typeof successResponse> | ReturnType<typeof errorResponse> {
  return wrapCall(() => {
    const project = registry.getProject(projectId);
    if (!project.canRedo) return { redone: false };
    project.redo();
    return { redone: true };
  });
}

export function registerLifecycleTools(server: McpServer, registry: ProjectRegistry): void {
  server.registerTool('formspec_create', {
    title: 'Create Project',
    description: 'Create a new project ready for authoring. For guided creation, call formspec_guide(mode="new") first.',
    inputSchema: {},
    annotations: NON_DESTRUCTIVE,
  }, async () => {
    return handleCreate(registry);
  });

  server.registerTool('formspec_undo', {
    title: 'Undo',
    description: 'Undo the last authoring operation. Returns { undone: true/false }.',
    inputSchema: { project_id: z.string() },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id }) => {
    return handleUndo(registry, project_id);
  });

  server.registerTool('formspec_redo', {
    title: 'Redo',
    description: 'Redo the last undone operation. Returns { redone: true/false }.',
    inputSchema: { project_id: z.string() },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id }) => {
    return handleRedo(registry, project_id);
  });
}
