/**
 * Lifecycle tools: create, open, save, list, list_autosaved, publish, undo, redo.
 *
 * These manage project creation, persistence, and history operations.
 */

import { createProject, HelperError } from 'formspec-studio-core';
import { ProjectRegistry } from '../registry.js';
import { errorResponse, successResponse, formatToolError } from '../errors.js';
import {
  readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, statSync,
} from 'node:fs';
import { resolve, basename, join } from 'node:path';

// ── handleCreate ──────────────────────────────────────────────────

export function handleCreate(
  registry: ProjectRegistry,
): ReturnType<typeof successResponse> | ReturnType<typeof errorResponse> {
  try {
    const projectId = registry.newProject();
    return successResponse({ project_id: projectId, phase: 'bootstrap' });
  } catch (err) {
    if (err instanceof HelperError) {
      return errorResponse(formatToolError(err.code, err.message, err.detail as Record<string, unknown>));
    }
    throw err;
  }
}

// ── handleOpen ────────────────────────────────────────────────────

export function handleOpen(
  registry: ProjectRegistry,
  path: string,
): ReturnType<typeof successResponse> | ReturnType<typeof errorResponse> {
  try {
    const absPath = resolve(path);

    // Check directory exists
    if (!existsSync(absPath) || !statSync(absPath).isDirectory()) {
      return errorResponse(formatToolError('LOAD_FAILED', `Directory not found: ${absPath}`));
    }

    // Find *.definition.json
    const files = readdirSync(absPath);
    const defFile = files.find(f => f.endsWith('.definition.json'));
    if (!defFile) {
      return errorResponse(formatToolError('LOAD_FAILED', `No *.definition.json found in ${absPath}`));
    }

    const dirName = basename(absPath);

    // Read definition (required)
    const definition = JSON.parse(readFileSync(join(absPath, defFile), 'utf-8'));

    // Build bundle from available artifacts
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

    // Create project and load bundle
    const project = createProject();
    project.loadBundle(bundle);

    // Register (idempotent — returns same id for same path)
    const projectId = registry.registerOpen(absPath, project);

    return successResponse({ project_id: projectId, phase: 'authoring' });
  } catch (err) {
    if (err instanceof HelperError) {
      return errorResponse(formatToolError(err.code, err.message, err.detail as Record<string, unknown>));
    }
    if (err instanceof SyntaxError) {
      return errorResponse(formatToolError('LOAD_FAILED', `Invalid JSON: ${err.message}`));
    }
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(formatToolError('LOAD_FAILED', message));
  }
}

// ── handleSave ────────────────────────────────────────────────────

export function handleSave(
  registry: ProjectRegistry,
  projectId: string,
  path?: string,
): ReturnType<typeof successResponse> | ReturnType<typeof errorResponse> {
  try {
    // getProject throws WRONG_PHASE if in bootstrap
    const project = registry.getProject(projectId);
    const entry = registry.getEntry(projectId);

    // Resolve target path
    const targetPath = path ? resolve(path) : entry.sourcePath;
    if (!targetPath) {
      return errorResponse(formatToolError('SAVE_FAILED', 'No save path specified and project has no source path'));
    }

    // Ensure directory exists
    mkdirSync(targetPath, { recursive: true });

    const dirName = basename(targetPath);
    const bundle = project.export();

    // Write each artifact
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

    if (bundle.mapping) {
      writeFileSync(
        join(targetPath, `${dirName}.mapping.json`),
        JSON.stringify(bundle.mapping, null, 2),
        'utf-8',
      );
    }

    return successResponse({ saved: true, path: targetPath });
  } catch (err) {
    if (err instanceof HelperError) {
      return errorResponse(formatToolError(err.code, err.message, err.detail as Record<string, unknown>));
    }
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(formatToolError('SAVE_FAILED', message));
  }
}

// ── handleList ────────────────────────────────────────────────────

export function handleList(
  registry: ProjectRegistry,
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
  return successResponse({ projects });
}

// ── handleListAutosaved ───────────────────────────────────────────

export function handleListAutosaved(
  autosaveDir?: string,
): ReturnType<typeof successResponse> {
  const dir = autosaveDir ?? join(process.env.HOME ?? '', '.formspec', 'autosave');

  if (!existsSync(dir)) {
    return successResponse({ entries: [] });
  }

  try {
    const subdirs = readdirSync(dir).filter(name => {
      const full = join(dir, name);
      return statSync(full).isDirectory();
    });

    const entries = subdirs.map(name => ({
      name,
      path: join(dir, name),
    }));

    return successResponse({ entries });
  } catch {
    return successResponse({ entries: [] });
  }
}

// ── handlePublish ─────────────────────────────────────────────────

export function handlePublish(
  registry: ProjectRegistry,
  projectId: string,
  version: string,
  summary?: string,
): ReturnType<typeof successResponse> | ReturnType<typeof errorResponse> {
  try {
    const project = registry.getProject(projectId);
    const diagnostics = project.diagnose();

    if (diagnostics.counts.error > 0) {
      return errorResponse(formatToolError('PUBLISH_BLOCKED', `Project has ${diagnostics.counts.error} error(s)`, {
        diagnostics: diagnostics.counts,
      }));
    }

    return successResponse({
      version,
      summary: summary ?? null,
      bundle: project.export(),
    });
  } catch (err) {
    if (err instanceof HelperError) {
      return errorResponse(formatToolError(err.code, err.message, err.detail as Record<string, unknown>));
    }
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(formatToolError('COMMAND_FAILED', message));
  }
}

// ── handleUndo ────────────────────────────────────────────────────

export function handleUndo(
  registry: ProjectRegistry,
  projectId: string,
): ReturnType<typeof successResponse> | ReturnType<typeof errorResponse> {
  try {
    const project = registry.getProject(projectId);
    if (!project.canUndo) {
      return successResponse({ undone: false });
    }
    project.undo();
    return successResponse({ undone: true });
  } catch (err) {
    if (err instanceof HelperError) {
      return errorResponse(formatToolError(err.code, err.message, err.detail as Record<string, unknown>));
    }
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(formatToolError('COMMAND_FAILED', message));
  }
}

// ── handleRedo ────────────────────────────────────────────────────

export function handleRedo(
  registry: ProjectRegistry,
  projectId: string,
): ReturnType<typeof successResponse> | ReturnType<typeof errorResponse> {
  try {
    const project = registry.getProject(projectId);
    if (!project.canRedo) {
      return successResponse({ redone: false });
    }
    project.redo();
    return successResponse({ redone: true });
  } catch (err) {
    if (err instanceof HelperError) {
      return errorResponse(formatToolError(err.code, err.message, err.detail as Record<string, unknown>));
    }
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(formatToolError('COMMAND_FAILED', message));
  }
}
