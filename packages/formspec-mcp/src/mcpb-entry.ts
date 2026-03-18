/**
 * @filedesc MCPB entry point — exports a configured McpServer for Claude Desktop's built-in Node.js runner.
 *
 * Unlike server.ts (which connects its own StdioServerTransport), this module
 * exports the server so the host environment can connect its own transport.
 */

import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

import { ProjectRegistry } from './registry.js';
import { initSchemas, initSchemaTexts, getSchemaText } from './schemas.js';
import { NON_DESTRUCTIVE, FILESYSTEM_IO, READ_ONLY } from './annotations.js';

import { handleDraft, handleLoad } from './tools/bootstrap.js';
import * as lifecycle from './tools/lifecycle.js';

import { createFormspecServer } from './create-server.js';

// ── Locate schemas ──────────────────────────────────────────────────

const schemaDirs = [
  resolve(process.cwd(), 'schemas'),
  resolve(process.cwd(), 'lib/schemas'),
  resolve(process.cwd(), '../../schemas'),
];

const actualSchemasDir = schemaDirs.find(d => existsSync(d));
if (actualSchemasDir) {
  initSchemas(actualSchemasDir);
  initSchemaTexts(actualSchemasDir);
}

// ── Build server ────────────────────────────────────────────────────

const registry = new ProjectRegistry();
const server = createFormspecServer(registry);

// Schema resources
if (actualSchemasDir) {
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
}

// Node.js-only tools
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

// ── Export ───────────────────────────────────────────────────────────

export default server;
