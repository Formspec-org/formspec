/**
 * @filedesc MCP Server CLI entry — extends the browser-safe server with Node.js-only tools
 * (filesystem I/O, schema validation) and connects via stdio transport.
 *
 * Tool consolidation: 65 → 28 (ADR 0040)
 */

import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

// Resolve directory of this file — works in both ESM (dist/) and CJS (esbuild bundle)
/* eslint-disable no-var */
declare var __dirname: string | undefined;
const thisDir = typeof __dirname !== 'undefined'
  ? __dirname
  : dirname(fileURLToPath(import.meta.url));

import { ProjectRegistry } from './registry.js';
import { initSchemas, initSchemaTexts, getSchemaText } from './schemas.js';
import { NON_DESTRUCTIVE, FILESYSTEM_IO, READ_ONLY } from './annotations.js';

import { handleDraft, handleLoad } from './tools/bootstrap.js';
import * as lifecycle from './tools/lifecycle.js';

import { createFormspecServer } from './create-server.js';

// Re-export for backwards compatibility
export { createFormspecServer } from './create-server.js';

// ── Main ─────────────────────────────────────────────────────────────

export async function main() {
  // Locate schemas directory — use __dirname (relative to this file) since
  // CWD is undefined in Claude Desktop (may be / on macOS).
  const schemaDirs = [
    resolve(thisDir, '../lib/schemas'),     // mcpb bundle: bundle/../lib/schemas
    resolve(thisDir, '../schemas'),         // mcpb bundle alt layout
    resolve(thisDir, '../../schemas'),      // monorepo: dist/../../schemas
    resolve(process.cwd(), 'schemas'),        // standalone fallback
    resolve(process.cwd(), 'lib/schemas'),
  ];
  console.error('[formspec-mcp] thisDir:', thisDir);
  console.error('[formspec-mcp] cwd:', process.cwd());
  console.error('[formspec-mcp] Searching for schemas in:', schemaDirs.join(', '));
  const actualSchemasDir = schemaDirs.find(d => existsSync(d));
  if (!actualSchemasDir) {
    console.error('[formspec-mcp] Fatal: schemas/ directory not found in any of:', schemaDirs.join(', '));
    process.exit(1);
  }
  console.error('[formspec-mcp] Found schemas at:', actualSchemasDir);

  initSchemas(actualSchemasDir);
  initSchemaTexts(actualSchemasDir);

  const registry = new ProjectRegistry();
  const server = createFormspecServer(registry);

  // ══════════════════════════════════════════════════════════════════
  // Schema Resources (3)
  // ══════════════════════════════════════════════════════════════════

  server.resource('schema-definition', 'formspec://schema/definition',
    { mimeType: 'application/schema+json' },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: 'application/schema+json', text: getSchemaText('definition') }],
    }),
  );

  server.resource('schema-component', 'formspec://schema/component',
    { mimeType: 'application/schema+json' },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: 'application/schema+json', text: getSchemaText('component') }],
    }),
  );

  server.resource('schema-theme', 'formspec://schema/theme',
    { mimeType: 'application/schema+json' },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: 'application/schema+json', text: getSchemaText('theme') }],
    }),
  );

  // ══════════════════════════════════════════════════════════════════
  // Node.js-only tools: Bootstrap + Filesystem lifecycle
  // ══════════════════════════════════════════════════════════════════

  server.registerTool('formspec_draft', {
    title: 'Draft Artifact',
    description: 'Submit a raw JSON artifact for schema validation during bootstrap phase.',
    inputSchema: {
      project_id: z.string(),
      type: z.enum(['definition', 'component', 'theme']),
      json: z.record(z.string(), z.unknown()),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, type, json }) => {
    return handleDraft(registry, project_id, type, json);
  });

  server.registerTool('formspec_load', {
    title: 'Load Draft',
    description: 'Validate all drafted artifacts and transition to authoring phase.',
    inputSchema: { project_id: z.string() },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id }) => {
    return handleLoad(registry, project_id);
  });

  server.registerTool('formspec_open', {
    title: 'Open Project',
    description: 'Open a formspec project from a directory on disk.',
    inputSchema: { path: z.string() },
    annotations: FILESYSTEM_IO,
  }, async ({ path }) => {
    return lifecycle.handleOpen(registry, path);
  });

  server.registerTool('formspec_save', {
    title: 'Save Project',
    description: 'Save project artifacts to disk.',
    inputSchema: {
      project_id: z.string(),
      path: z.string().optional(),
    },
    annotations: FILESYSTEM_IO,
  }, async ({ project_id, path }) => {
    return lifecycle.handleSave(registry, project_id, path);
  });

  server.registerTool('formspec_list', {
    title: 'List Projects',
    description: 'List all open projects.',
    inputSchema: { include_autosaved: z.boolean().optional() },
    annotations: READ_ONLY,
  }, async ({ include_autosaved }) => {
    return lifecycle.handleList(registry, include_autosaved);
  });

  server.registerTool('formspec_publish', {
    title: 'Publish',
    description: 'Export a finalized project bundle.',
    inputSchema: {
      project_id: z.string(),
      version: z.string(),
      summary: z.string().optional(),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, version, summary }) => {
    return lifecycle.handlePublish(registry, project_id, version, summary);
  });

  // ══════════════════════════════════════════════════════════════════
  // Graceful shutdown
  // ══════════════════════════════════════════════════════════════════

  const shutdown = async () => {
    for (const { id, sourcePath } of registry.authoringProjects()) {
      if (!sourcePath) continue;
      try {
        lifecycle.handleSave(registry, id, sourcePath);
      } catch {
        // Best-effort autosave; swallow errors during shutdown
      }
    }
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // ══════════════════════════════════════════════════════════════════
  // Connect transport
  // ══════════════════════════════════════════════════════════════════

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[formspec-mcp] Server ready');
  process.stdin.resume();
}
