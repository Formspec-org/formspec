/**
 * MCP Server entry point — registers all 65 tools, 3 schema resources,
 * and wires up SIGTERM/SIGINT graceful shutdown.
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { ProjectRegistry } from './registry.js';
import { initSchemas, initSchemaTexts, getSchemaText } from './schemas.js';
import { READ_ONLY, NON_DESTRUCTIVE, DESTRUCTIVE, FILESYSTEM_IO } from './annotations.js';

import * as bootstrap from './tools/bootstrap.js';
import * as lifecycle from './tools/lifecycle.js';
import * as structure from './tools/structure.js';
import * as flow from './tools/flow.js';
import * as behavior from './tools/behavior.js';
import * as presentation from './tools/presentation.js';
import * as data from './tools/data.js';
import * as screener from './tools/screener.js';
import * as query from './tools/query.js';
import * as fel from './tools/fel.js';

// ── Shared Zod fragments ────────────────────────────────────────────

const fieldPropsSchema = z.object({
  placeholder: z.string(),
  hint: z.string(),
  description: z.string(),
  ariaLabel: z.string(),
  choices: z.array(z.object({ value: z.string(), label: z.string() })),
  choicesFrom: z.string(),
  widget: z.string(),
  page: z.string(),
  required: z.boolean(),
  readonly: z.boolean(),
  initialValue: z.unknown(),
  insertIndex: z.number(),
  parentPath: z.string(),
}).partial();

// ── Main ─────────────────────────────────────────────────────────────

export async function main() {
  // Locate schemas directory
  const schemaDirs = [
    resolve(process.cwd(), 'schemas'),
    resolve(process.cwd(), '../../schemas'),  // from packages/formspec-mcp/
  ];
  const actualSchemasDir = schemaDirs.find(d => existsSync(d));
  if (!actualSchemasDir) {
    console.error('Fatal: schemas/ directory not found');
    process.exit(1);
  }

  initSchemas(actualSchemasDir);
  initSchemaTexts(actualSchemasDir);

  const registry = new ProjectRegistry();
  const server = new McpServer({ name: 'formspec-mcp', version: '0.1.0' });

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
  // Bootstrap Tools (5)
  // ══════════════════════════════════════════════════════════════════

  server.registerTool('formspec_draft_definition', {
    title: 'Draft Definition',
    description: 'Submit a raw definition JSON for schema validation during bootstrap',
    inputSchema: {
      project_id: z.string(),
      json: z.record(z.string(), z.unknown()),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, json }) => {
    return bootstrap.handleDraftDefinition(registry, project_id, json);
  });

  server.registerTool('formspec_draft_component', {
    title: 'Draft Component',
    description: 'Submit a raw component JSON for schema validation during bootstrap',
    inputSchema: {
      project_id: z.string(),
      json: z.record(z.string(), z.unknown()),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, json }) => {
    return bootstrap.handleDraftComponent(registry, project_id, json);
  });

  server.registerTool('formspec_draft_theme', {
    title: 'Draft Theme',
    description: 'Submit a raw theme JSON for schema validation during bootstrap',
    inputSchema: {
      project_id: z.string(),
      json: z.record(z.string(), z.unknown()),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, json }) => {
    return bootstrap.handleDraftTheme(registry, project_id, json);
  });

  server.registerTool('formspec_validate_draft', {
    title: 'Validate Draft',
    description: 'Check all submitted draft artifacts for unresolved schema errors',
    inputSchema: {
      project_id: z.string(),
    },
    annotations: READ_ONLY,
  }, async ({ project_id }) => {
    return bootstrap.handleValidateDraft(registry, project_id);
  });

  server.registerTool('formspec_load_draft', {
    title: 'Load Draft',
    description: 'Transition project from bootstrap to authoring phase',
    inputSchema: {
      project_id: z.string(),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id }) => {
    return bootstrap.handleLoadDraft(registry, project_id);
  });

  // ══════════════════════════════════════════════════════════════════
  // Lifecycle Tools (8)
  // ══════════════════════════════════════════════════════════════════

  server.registerTool('formspec_create', {
    title: 'Create Project',
    description: 'Create a new formspec project in bootstrap phase',
    inputSchema: {
      registries: z.array(z.record(z.string(), z.unknown())).optional(),
    },
    annotations: NON_DESTRUCTIVE,
  }, async () => {
    return lifecycle.handleCreate(registry);
  });

  server.registerTool('formspec_open', {
    title: 'Open Project',
    description: 'Open a formspec project from a directory on disk',
    inputSchema: {
      path: z.string(),
    },
    annotations: FILESYSTEM_IO,
  }, async ({ path }) => {
    return lifecycle.handleOpen(registry, path);
  });

  server.registerTool('formspec_save', {
    title: 'Save Project',
    description: 'Save project artifacts to disk',
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
    description: 'List all open projects',
    inputSchema: {},
    annotations: READ_ONLY,
  }, async () => {
    return lifecycle.handleList(registry);
  });

  server.registerTool('formspec_list_autosaved', {
    title: 'List Autosaved',
    description: 'List autosaved project snapshots',
    inputSchema: {},
    annotations: READ_ONLY,
  }, async () => {
    return lifecycle.handleListAutosaved();
  });

  server.registerTool('formspec_publish', {
    title: 'Publish',
    description: 'Export a finalized project bundle with version metadata',
    inputSchema: {
      project_id: z.string(),
      version: z.string(),
      summary: z.string().optional(),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, version, summary }) => {
    return lifecycle.handlePublish(registry, project_id, version, summary);
  });

  server.registerTool('formspec_undo', {
    title: 'Undo',
    description: 'Undo the last operation on a project',
    inputSchema: {
      project_id: z.string(),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id }) => {
    return lifecycle.handleUndo(registry, project_id);
  });

  server.registerTool('formspec_redo', {
    title: 'Redo',
    description: 'Redo the last undone operation on a project',
    inputSchema: {
      project_id: z.string(),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id }) => {
    return lifecycle.handleRedo(registry, project_id);
  });

  // ══════════════════════════════════════════════════════════════════
  // Structure Tools (14)
  // ══════════════════════════════════════════════════════════════════

  server.registerTool('formspec_field', {
    title: 'Add Field',
    description: 'Add a data-collecting field to the form',
    inputSchema: {
      project_id: z.string(),
      path: z.string(),
      label: z.string(),
      type: z.string(),
      props: fieldPropsSchema.optional(),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, path, label, type, props }) => {
    return structure.handleField(registry, project_id, path, label, type, props);
  });

  server.registerTool('formspec_content', {
    title: 'Add Content',
    description: 'Add a non-data display element (heading, paragraph, divider, etc.)',
    inputSchema: {
      project_id: z.string(),
      path: z.string(),
      body: z.string(),
      kind: z.enum(['heading', 'instructions', 'paragraph', 'alert', 'banner', 'divider']).optional(),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, path, body, kind }) => {
    return structure.handleContent(registry, project_id, path, body, kind);
  });

  server.registerTool('formspec_group', {
    title: 'Add Group',
    description: 'Add a logical group container for related items',
    inputSchema: {
      project_id: z.string(),
      path: z.string(),
      label: z.string(),
      props: z.object({ display: z.enum(['stack', 'dataTable']) }).partial().optional(),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, path, label, props }) => {
    return structure.handleGroup(registry, project_id, path, label, props);
  });

  server.registerTool('formspec_repeat', {
    title: 'Make Repeatable',
    description: 'Make a group repeatable with min/max cardinality',
    inputSchema: {
      project_id: z.string(),
      target: z.string(),
      props: z.object({
        min: z.number(),
        max: z.number(),
        addLabel: z.string(),
        removeLabel: z.string(),
      }).partial().optional(),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, target, props }) => {
    return structure.handleRepeat(registry, project_id, target, props);
  });

  server.registerTool('formspec_page', {
    title: 'Add Page',
    description: 'Add a new page to the form',
    inputSchema: {
      project_id: z.string(),
      title: z.string(),
      description: z.string().optional(),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, title, description }) => {
    return structure.handlePage(registry, project_id, title, description);
  });

  server.registerTool('formspec_remove_page', {
    title: 'Remove Page',
    description: 'Remove a page from the form',
    inputSchema: {
      project_id: z.string(),
      page_id: z.string(),
    },
    annotations: DESTRUCTIVE,
  }, async ({ project_id, page_id }) => {
    return structure.handleRemovePage(registry, project_id, page_id);
  });

  server.registerTool('formspec_move_page', {
    title: 'Move Page',
    description: 'Reorder a page up or down in the page list',
    inputSchema: {
      project_id: z.string(),
      page_id: z.string(),
      direction: z.enum(['up', 'down']),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, page_id, direction }) => {
    return structure.handleMovePage(registry, project_id, page_id, direction);
  });

  server.registerTool('formspec_place', {
    title: 'Place on Page',
    description: 'Place an item on a page',
    inputSchema: {
      project_id: z.string(),
      target: z.string(),
      page_id: z.string(),
      options: z.object({ span: z.number() }).optional(),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, target, page_id, options }) => {
    return structure.handlePlace(registry, project_id, target, page_id, options);
  });

  server.registerTool('formspec_unplace', {
    title: 'Unplace from Page',
    description: 'Remove an item from a page without deleting it',
    inputSchema: {
      project_id: z.string(),
      target: z.string(),
      page_id: z.string(),
    },
    annotations: DESTRUCTIVE,
  }, async ({ project_id, target, page_id }) => {
    return structure.handleUnplace(registry, project_id, target, page_id);
  });

  server.registerTool('formspec_update', {
    title: 'Update Item',
    description: 'Update properties of an existing item',
    inputSchema: {
      project_id: z.string(),
      path: z.string(),
      changes: z.record(z.string(), z.unknown()),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, path, changes }) => {
    return structure.handleUpdate(registry, project_id, path, changes);
  });

  server.registerTool('formspec_remove', {
    title: 'Remove Item',
    description: 'Remove an item and its descendants from the form',
    inputSchema: {
      project_id: z.string(),
      path: z.string(),
    },
    annotations: DESTRUCTIVE,
  }, async ({ project_id, path }) => {
    return structure.handleRemove(registry, project_id, path);
  });

  server.registerTool('formspec_copy', {
    title: 'Copy Item',
    description: 'Duplicate an item (optionally deep-copy descendants)',
    inputSchema: {
      project_id: z.string(),
      path: z.string(),
      deep: z.boolean().optional(),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, path, deep }) => {
    return structure.handleCopy(registry, project_id, path, deep);
  });

  server.registerTool('formspec_metadata', {
    title: 'Set Metadata',
    description: 'Update form metadata (title, description, version, etc.)',
    inputSchema: {
      project_id: z.string(),
      changes: z.record(z.string(), z.unknown()),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, changes }) => {
    return structure.handleMetadata(registry, project_id, changes);
  });

  server.registerTool('formspec_submit_button', {
    title: 'Add Submit Button',
    description: 'Add a submit button to the form or a specific page',
    inputSchema: {
      project_id: z.string(),
      label: z.string().optional(),
      page_id: z.string().optional(),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, label, page_id }) => {
    return structure.handleSubmitButton(registry, project_id, label, page_id);
  });

  // ══════════════════════════════════════════════════════════════════
  // Flow Tools (4)
  // ══════════════════════════════════════════════════════════════════

  server.registerTool('formspec_flow', {
    title: 'Set Flow Mode',
    description: 'Set the form navigation mode (single page, wizard, or tabs)',
    inputSchema: {
      project_id: z.string(),
      mode: z.enum(['single', 'wizard', 'tabs']),
      props: z.object({
        showProgress: z.boolean(),
        allowSkip: z.boolean(),
      }).partial().optional(),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, mode, props }) => {
    return flow.handleFlow(registry, project_id, mode, props);
  });

  server.registerTool('formspec_branch', {
    title: 'Add Branch',
    description: 'Add conditional branching logic based on a field value',
    inputSchema: {
      project_id: z.string(),
      on: z.string(),
      paths: z.array(z.object({
        when: z.union([z.string(), z.number(), z.boolean()]),
        show: z.union([z.string(), z.array(z.string())]),
        mode: z.enum(['equals', 'contains']).optional(),
      })),
      otherwise: z.union([z.string(), z.array(z.string())]).optional(),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, on, paths, otherwise }) => {
    return flow.handleBranch(registry, project_id, on, paths, otherwise);
  });

  server.registerTool('formspec_move', {
    title: 'Move Item',
    description: 'Move an item to a new location in the tree',
    inputSchema: {
      project_id: z.string(),
      path: z.string(),
      target_path: z.string().optional(),
      index: z.number().optional(),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, path, target_path, index }) => {
    return flow.handleMove(registry, project_id, path, target_path, index);
  });

  server.registerTool('formspec_rename', {
    title: 'Rename Item',
    description: 'Change the key of an item in the definition',
    inputSchema: {
      project_id: z.string(),
      path: z.string(),
      new_key: z.string(),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, path, new_key }) => {
    return flow.handleRename(registry, project_id, path, new_key);
  });

  // ══════════════════════════════════════════════════════════════════
  // Behavior Tools (5)
  // ══════════════════════════════════════════════════════════════════

  server.registerTool('formspec_show_when', {
    title: 'Show When',
    description: 'Set a FEL condition that controls when an item is visible',
    inputSchema: {
      project_id: z.string(),
      target: z.string(),
      condition: z.string(),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, target, condition }) => {
    return behavior.handleShowWhen(registry, project_id, target, condition);
  });

  server.registerTool('formspec_readonly_when', {
    title: 'Readonly When',
    description: 'Set a FEL condition that controls when a field is read-only',
    inputSchema: {
      project_id: z.string(),
      target: z.string(),
      condition: z.string(),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, target, condition }) => {
    return behavior.handleReadonlyWhen(registry, project_id, target, condition);
  });

  server.registerTool('formspec_require', {
    title: 'Require',
    description: 'Make a field required, optionally with a FEL condition',
    inputSchema: {
      project_id: z.string(),
      target: z.string(),
      condition: z.string().optional(),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, target, condition }) => {
    return behavior.handleRequire(registry, project_id, target, condition);
  });

  server.registerTool('formspec_calculate', {
    title: 'Calculate',
    description: 'Set a computed value on a field using a FEL expression',
    inputSchema: {
      project_id: z.string(),
      target: z.string(),
      expression: z.string(),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, target, expression }) => {
    return behavior.handleCalculate(registry, project_id, target, expression);
  });

  server.registerTool('formspec_add_rule', {
    title: 'Add Validation Rule',
    description: 'Add a validation constraint to a field or the form',
    inputSchema: {
      project_id: z.string(),
      target: z.string(),
      rule: z.string(),
      message: z.string(),
      options: z.object({
        timing: z.enum(['continuous', 'submit', 'demand']),
        severity: z.enum(['error', 'warning', 'info']),
        code: z.string(),
        activeWhen: z.string(),
      }).partial().optional(),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, target, rule, message, options }) => {
    return behavior.handleAddRule(registry, project_id, target, rule, message, options);
  });

  // ══════════════════════════════════════════════════════════════════
  // Presentation Tools (3)
  // ══════════════════════════════════════════════════════════════════

  server.registerTool('formspec_layout', {
    title: 'Apply Layout',
    description: 'Apply a layout arrangement to one or more items',
    inputSchema: {
      project_id: z.string(),
      target: z.union([z.string(), z.array(z.string())]),
      arrangement: z.enum(['columns-2', 'columns-3', 'columns-4', 'card', 'sidebar', 'inline']),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, target, arrangement }) => {
    return presentation.handleLayout(registry, project_id, target, arrangement);
  });

  server.registerTool('formspec_style', {
    title: 'Style Item',
    description: 'Apply style properties to a specific item',
    inputSchema: {
      project_id: z.string(),
      path: z.string(),
      properties: z.record(z.string(), z.unknown()),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, path, properties }) => {
    return presentation.handleStyle(registry, project_id, path, properties);
  });

  server.registerTool('formspec_style_all', {
    title: 'Style All',
    description: 'Apply style properties to all items, optionally filtered by type or data type',
    inputSchema: {
      project_id: z.string(),
      properties: z.record(z.string(), z.unknown()),
      target_type: z.string().optional(),
      target_data_type: z.string().optional(),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, properties, target_type, target_data_type }) => {
    // Translate flat MCP params → handleStyleAll's target union
    let target: 'form' | { type: 'group' | 'field' | 'display' } | { dataType: string } = 'form';
    if (target_data_type) {
      target = { dataType: target_data_type };
    } else if (target_type) {
      target = { type: target_type as 'group' | 'field' | 'display' };
    }
    return presentation.handleStyleAll(registry, project_id, properties, target);
  });

  // ══════════════════════════════════════════════════════════════════
  // Data Tools (9)
  // ══════════════════════════════════════════════════════════════════

  server.registerTool('formspec_define_choices', {
    title: 'Define Choices',
    description: 'Define a reusable set of choice options',
    inputSchema: {
      project_id: z.string(),
      name: z.string(),
      options: z.array(z.object({ value: z.string(), label: z.string() })),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, name, options }) => {
    return data.handleDefineChoices(registry, project_id, name, options);
  });

  server.registerTool('formspec_variable', {
    title: 'Add Variable',
    description: 'Define a computed variable with a FEL expression',
    inputSchema: {
      project_id: z.string(),
      name: z.string(),
      expression: z.string(),
      scope: z.string().optional(),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, name, expression, scope }) => {
    return data.handleVariable(registry, project_id, name, expression, scope);
  });

  server.registerTool('formspec_update_variable', {
    title: 'Update Variable',
    description: 'Update the expression of an existing variable',
    inputSchema: {
      project_id: z.string(),
      name: z.string(),
      expression: z.string(),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, name, expression }) => {
    return data.handleUpdateVariable(registry, project_id, name, expression);
  });

  server.registerTool('formspec_remove_variable', {
    title: 'Remove Variable',
    description: 'Remove a variable from the form',
    inputSchema: {
      project_id: z.string(),
      name: z.string(),
    },
    annotations: DESTRUCTIVE,
  }, async ({ project_id, name }) => {
    return data.handleRemoveVariable(registry, project_id, name);
  });

  server.registerTool('formspec_rename_variable', {
    title: 'Rename Variable',
    description: 'Rename a variable and update all references',
    inputSchema: {
      project_id: z.string(),
      name: z.string(),
      new_name: z.string(),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, name, new_name }) => {
    return data.handleRenameVariable(registry, project_id, name, new_name);
  });

  server.registerTool('formspec_instance', {
    title: 'Add Instance',
    description: 'Define an external data source instance',
    inputSchema: {
      project_id: z.string(),
      name: z.string(),
      props: z.object({
        source: z.string(),
        data: z.unknown(),
        schema: z.record(z.string(), z.unknown()),
        static: z.boolean(),
        readonly: z.boolean(),
        description: z.string(),
      }).partial(),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, name, props }) => {
    return data.handleInstance(registry, project_id, name, props);
  });

  server.registerTool('formspec_update_instance', {
    title: 'Update Instance',
    description: 'Update properties of an existing data source instance',
    inputSchema: {
      project_id: z.string(),
      name: z.string(),
      changes: z.object({
        source: z.string(),
        data: z.unknown(),
        schema: z.record(z.string(), z.unknown()),
        static: z.boolean(),
        readonly: z.boolean(),
        description: z.string(),
      }).partial(),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, name, changes }) => {
    return data.handleUpdateInstance(registry, project_id, name, changes);
  });

  server.registerTool('formspec_rename_instance', {
    title: 'Rename Instance',
    description: 'Rename a data source instance',
    inputSchema: {
      project_id: z.string(),
      name: z.string(),
      new_name: z.string(),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, name, new_name }) => {
    return data.handleRenameInstance(registry, project_id, name, new_name);
  });

  server.registerTool('formspec_remove_instance', {
    title: 'Remove Instance',
    description: 'Remove a data source instance',
    inputSchema: {
      project_id: z.string(),
      name: z.string(),
    },
    annotations: DESTRUCTIVE,
  }, async ({ project_id, name }) => {
    return data.handleRemoveInstance(registry, project_id, name);
  });

  // ══════════════════════════════════════════════════════════════════
  // Screener Tools (7)
  // ══════════════════════════════════════════════════════════════════

  server.registerTool('formspec_screener', {
    title: 'Set Screener',
    description: 'Enable or disable the pre-form screener section',
    inputSchema: {
      project_id: z.string(),
      enabled: z.boolean(),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, enabled }) => {
    return screener.handleScreener(registry, project_id, enabled);
  });

  server.registerTool('formspec_screen_field', {
    title: 'Add Screen Field',
    description: 'Add a field to the screener section',
    inputSchema: {
      project_id: z.string(),
      key: z.string(),
      label: z.string(),
      type: z.string(),
      props: fieldPropsSchema.optional(),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, key, label, type, props }) => {
    return screener.handleScreenField(registry, project_id, key, label, type, props);
  });

  server.registerTool('formspec_remove_screen_field', {
    title: 'Remove Screen Field',
    description: 'Remove a field from the screener section',
    inputSchema: {
      project_id: z.string(),
      key: z.string(),
    },
    annotations: DESTRUCTIVE,
  }, async ({ project_id, key }) => {
    return screener.handleRemoveScreenField(registry, project_id, key);
  });

  server.registerTool('formspec_screen_route', {
    title: 'Add Screen Route',
    description: 'Add a conditional routing rule to the screener',
    inputSchema: {
      project_id: z.string(),
      condition: z.string(),
      target: z.string(),
      label: z.string().optional(),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, condition, target, label }) => {
    return screener.handleScreenRoute(registry, project_id, condition, target, label);
  });

  server.registerTool('formspec_update_screen_route', {
    title: 'Update Screen Route',
    description: 'Update a screener routing rule by index',
    inputSchema: {
      project_id: z.string(),
      route_index: z.number(),
      changes: z.object({
        condition: z.string(),
        target: z.string(),
        label: z.string(),
      }).partial(),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, route_index, changes }) => {
    return screener.handleUpdateScreenRoute(registry, project_id, route_index, changes);
  });

  server.registerTool('formspec_reorder_screen_route', {
    title: 'Reorder Screen Route',
    description: 'Move a screener routing rule up or down',
    inputSchema: {
      project_id: z.string(),
      route_index: z.number(),
      direction: z.enum(['up', 'down']),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, route_index, direction }) => {
    return screener.handleReorderScreenRoute(registry, project_id, route_index, direction);
  });

  server.registerTool('formspec_remove_screen_route', {
    title: 'Remove Screen Route',
    description: 'Remove a screener routing rule by index',
    inputSchema: {
      project_id: z.string(),
      route_index: z.number(),
    },
    annotations: DESTRUCTIVE,
  }, async ({ project_id, route_index }) => {
    return screener.handleRemoveScreenRoute(registry, project_id, route_index);
  });

  // ══════════════════════════════════════════════════════════════════
  // Query Tools (7)
  // ══════════════════════════════════════════════════════════════════

  server.registerTool('formspec_preview', {
    title: 'Preview Form',
    description: 'Generate a preview of the form with optional scenario data',
    inputSchema: {
      project_id: z.string(),
      scenario: z.record(z.string(), z.unknown()).optional(),
    },
    annotations: READ_ONLY,
  }, async ({ project_id, scenario }) => {
    return query.handlePreview(registry, project_id, scenario);
  });

  server.registerTool('formspec_audit', {
    title: 'Audit',
    description: 'Run diagnostics and return all warnings and errors',
    inputSchema: {
      project_id: z.string(),
    },
    annotations: READ_ONLY,
  }, async ({ project_id }) => {
    return query.handleAudit(registry, project_id);
  });

  server.registerTool('formspec_describe', {
    title: 'Describe',
    description: 'Describe the form structure or a specific item',
    inputSchema: {
      project_id: z.string(),
      target: z.string().optional(),
    },
    annotations: READ_ONLY,
  }, async ({ project_id, target }) => {
    return query.handleDescribe(registry, project_id, target);
  });

  server.registerTool('formspec_trace', {
    title: 'Trace',
    description: 'Trace dependencies for a FEL expression or field path',
    inputSchema: {
      project_id: z.string(),
      expression_or_field: z.string(),
    },
    annotations: READ_ONLY,
  }, async ({ project_id, expression_or_field }) => {
    return query.handleTrace(registry, project_id, expression_or_field);
  });

  server.registerTool('formspec_validate_response', {
    title: 'Validate Response',
    description: 'Validate a response object against the form definition',
    inputSchema: {
      project_id: z.string(),
      response: z.record(z.string(), z.unknown()),
    },
    annotations: READ_ONLY,
  }, async ({ project_id, response }) => {
    return query.handleValidateResponse(registry, project_id, response);
  });

  server.registerTool('formspec_search', {
    title: 'Search Items',
    description: 'Search for items by type, data type, label, or extension',
    inputSchema: {
      project_id: z.string(),
      filter: z.object({
        type: z.enum(['group', 'field', 'display']),
        dataType: z.string(),
        label: z.string(),
        hasExtension: z.string(),
      }).partial(),
    },
    annotations: READ_ONLY,
  }, async ({ project_id, filter }) => {
    return query.handleSearch(registry, project_id, filter);
  });

  server.registerTool('formspec_changelog', {
    title: 'Changelog',
    description: 'Generate a changelog from the project history',
    inputSchema: {
      project_id: z.string(),
      from_version: z.string().optional(),
    },
    annotations: READ_ONLY,
  }, async ({ project_id, from_version }) => {
    return query.handleChangelog(registry, project_id, from_version);
  });

  // ══════════════════════════════════════════════════════════════════
  // FEL Tools (3)
  // ══════════════════════════════════════════════════════════════════

  server.registerTool('formspec_fel_context', {
    title: 'FEL Context',
    description: 'List available FEL references (fields, variables, instances) scoped to a path',
    inputSchema: {
      project_id: z.string(),
      path: z.string().optional(),
    },
    annotations: READ_ONLY,
  }, async ({ project_id, path }) => {
    return fel.handleFelContext(registry, project_id, path);
  });

  server.registerTool('formspec_fel_functions', {
    title: 'FEL Functions',
    description: 'List all available FEL functions',
    inputSchema: {
      project_id: z.string(),
    },
    annotations: READ_ONLY,
  }, async ({ project_id }) => {
    return fel.handleFelFunctions(registry, project_id);
  });

  server.registerTool('formspec_fel_check', {
    title: 'FEL Check',
    description: 'Parse and validate a FEL expression, returning errors and dependencies',
    inputSchema: {
      project_id: z.string(),
      expression: z.string(),
      context_path: z.string().optional(),
    },
    annotations: READ_ONLY,
  }, async ({ project_id, expression, context_path }) => {
    return fel.handleFelCheck(registry, project_id, expression, context_path);
  });

  // ══════════════════════════════════════════════════════════════════
  // Graceful shutdown
  // ══════════════════════════════════════════════════════════════════

  const shutdown = async () => {
    for (const { id, sourcePath } of registry.authoringProjects()) {
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
}
