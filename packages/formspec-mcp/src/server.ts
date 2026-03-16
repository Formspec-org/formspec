/**
 * MCP Server entry point — registers 28 consolidated tools, 3 schema resources,
 * and wires up SIGTERM/SIGINT graceful shutdown.
 *
 * Tool consolidation: 65 → 28 (ADR 0040)
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { ProjectRegistry } from './registry.js';
import { initSchemas, initSchemaTexts, getSchemaText } from './schemas.js';
import { READ_ONLY, NON_DESTRUCTIVE, DESTRUCTIVE, FILESYSTEM_IO } from './annotations.js';

import { handleGuide } from './tools/guide.js';
import { handleDraft, handleLoad } from './tools/bootstrap.js';
import * as lifecycle from './tools/lifecycle.js';
import * as structure from './tools/structure.js';
import { handleBehavior } from './tools/behavior.js';
import { handleFlow } from './tools/flow.js';
import { handleStyle } from './tools/style.js';
import { handleData } from './tools/data.js';
import { handleScreener } from './tools/screener.js';
import { handleDescribe, handleSearch, handleTrace, handlePreview } from './tools/query.js';
import { handleFel } from './tools/fel.js';

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

const fieldItemSchema = z.object({
  path: z.string().describe('Item path (e.g., "name", "contact.email", "items[0].amount")'),
  label: z.string(),
  type: z.string().describe('Data type: "string", "text", "number", "integer", "decimal", "boolean", "date", "email", "choice", "object", "array"'),
  props: fieldPropsSchema.optional(),
});

const contentItemSchema = z.object({
  path: z.string().describe('Item path (e.g., "intro_heading", "section1.instructions")'),
  body: z.string().describe('Display text'),
  kind: z.enum(['heading', 'paragraph', 'divider', 'banner']).optional().describe('Display kind. Default: paragraph'),
  props: z.object({
    page: z.string().optional().describe('Page ID to place this item on after creation'),
  }).partial().optional(),
});

const groupItemSchema = z.object({
  path: z.string().describe('Item path (e.g., "contact_info", "items")'),
  label: z.string(),
  props: z.object({
    display: z.enum(['stack', 'dataTable']),
    repeat: z.object({
      min: z.number(),
      max: z.number(),
      addLabel: z.string(),
      removeLabel: z.string(),
    }).partial(),
  }).partial().optional(),
});

const behaviorItemSchema = z.object({
  action: z.enum(['show_when', 'readonly_when', 'require', 'calculate', 'add_rule']),
  target: z.string().describe('Field path to apply behavior to'),
  condition: z.string().optional().describe('FEL condition (for show_when, readonly_when, require)'),
  expression: z.string().optional().describe('FEL expression (for calculate)'),
  rule: z.string().optional().describe('FEL validation expression (for add_rule)'),
  message: z.string().optional().describe('Validation message (for add_rule)'),
  options: z.object({
    timing: z.enum(['continuous', 'submit', 'demand']),
    severity: z.enum(['error', 'warning', 'info']),
    code: z.string(),
    activeWhen: z.string(),
  }).partial().optional(),
});

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
  const server = new McpServer({ name: 'formspec-mcp', version: '0.2.0' });

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
  // 1. formspec_guide — Interactive questionnaire
  // ══════════════════════════════════════════════════════════════════

  server.registerTool('formspec_guide', {
    title: 'Guide',
    description: 'Start a new form or modify an existing one through guided questions. Call this FIRST before using authoring tools. For mode="new", returns a conversational questionnaire to gather requirements. For mode="modify", returns the current form summary and targeted modification questions.',
    inputSchema: {
      mode: z.enum(['new', 'modify']).describe('"new" to create a form from scratch; "modify" to change an existing form'),
      project_id: z.string().optional().describe('Required for mode="modify"'),
      context: z.string().optional().describe('Optional context hint (e.g., "grant application form")'),
    },
    annotations: READ_ONLY,
  }, async ({ mode, project_id, context }) => {
    return handleGuide(registry, mode, project_id, context);
  });

  // ══════════════════════════════════════════════════════════════════
  // 2-3. Bootstrap (5 → 2)
  // ══════════════════════════════════════════════════════════════════

  server.registerTool('formspec_draft', {
    title: 'Draft Artifact',
    description: 'Submit a raw JSON artifact for schema validation during bootstrap phase. Call once per artifact type (definition, component, theme). Read formspec://schema/* resources first to understand the expected JSON structure.',
    inputSchema: {
      project_id: z.string(),
      type: z.enum(['definition', 'component', 'theme']).describe('Which artifact to draft'),
      json: z.record(z.string(), z.unknown()).describe('The JSON document to validate and store'),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, type, json }) => {
    return handleDraft(registry, project_id, type, json);
  });

  server.registerTool('formspec_load', {
    title: 'Load Draft',
    description: 'Validate all drafted artifacts and transition the project from bootstrap to authoring phase. Auto-runs validation first — if errors exist, returns them instead of transitioning. If no definition has been drafted, creates a blank project ready for authoring.',
    inputSchema: {
      project_id: z.string(),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id }) => {
    return handleLoad(registry, project_id);
  });

  // ══════════════════════════════════════════════════════════════════
  // 4-10. Lifecycle (8 → 7)
  // ══════════════════════════════════════════════════════════════════

  server.registerTool('formspec_create', {
    title: 'Create Project',
    description: 'Create a new project in bootstrap phase. To start authoring:\n- If you have pre-built JSON: submit via formspec_draft, then call formspec_load\n- If starting from scratch: call formspec_load immediately to enter authoring phase\n- Use formspec_guide first to gather requirements through a conversational questionnaire',
    inputSchema: {},
    annotations: NON_DESTRUCTIVE,
  }, async () => {
    return lifecycle.handleCreate(registry);
  });

  server.registerTool('formspec_open', {
    title: 'Open Project',
    description: 'Open a formspec project from a directory on disk. The directory must contain a *.definition.json file. Also loads *.component.json, *.theme.json, and *.mapping.json if present.',
    inputSchema: {
      path: z.string().describe('Absolute or relative directory path'),
    },
    annotations: FILESYSTEM_IO,
  }, async ({ path }) => {
    return lifecycle.handleOpen(registry, path);
  });

  server.registerTool('formspec_save', {
    title: 'Save Project',
    description: 'Save project artifacts (definition, component, theme, mapping) to disk as JSON files.',
    inputSchema: {
      project_id: z.string(),
      path: z.string().optional().describe('Directory to save to. Defaults to the path the project was opened from.'),
    },
    annotations: FILESYSTEM_IO,
  }, async ({ project_id, path }) => {
    return lifecycle.handleSave(registry, project_id, path);
  });

  server.registerTool('formspec_list', {
    title: 'List Projects',
    description: 'List all open projects with their phase (bootstrap/authoring) and title. Optionally include autosaved snapshots.',
    inputSchema: {
      include_autosaved: z.boolean().optional().describe('Include autosaved project snapshots in the response'),
    },
    annotations: READ_ONLY,
  }, async ({ include_autosaved }) => {
    return lifecycle.handleList(registry, include_autosaved);
  });

  server.registerTool('formspec_publish', {
    title: 'Publish',
    description: 'Export a finalized project bundle with version metadata. Runs diagnostics first — blocks if any errors are found.',
    inputSchema: {
      project_id: z.string(),
      version: z.string().describe('Semantic version (e.g., "1.0.0")'),
      summary: z.string().optional().describe('Release notes'),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, version, summary }) => {
    return lifecycle.handlePublish(registry, project_id, version, summary);
  });

  server.registerTool('formspec_undo', {
    title: 'Undo',
    description: 'Undo the last authoring operation. Returns { undone: true/false }.',
    inputSchema: {
      project_id: z.string(),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id }) => {
    return lifecycle.handleUndo(registry, project_id);
  });

  server.registerTool('formspec_redo', {
    title: 'Redo',
    description: 'Redo the last undone operation. Returns { redone: true/false }.',
    inputSchema: {
      project_id: z.string(),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id }) => {
    return lifecycle.handleRedo(registry, project_id);
  });

  // ══════════════════════════════════════════════════════════════════
  // 11-13. Structure — Add (3 tools, batch-enabled)
  // ══════════════════════════════════════════════════════════════════

  server.registerTool('formspec_field', {
    title: 'Add Field',
    description: 'Add NEW data-collecting fields to the form. Supports single item or batch via items[] array. To modify an existing field\'s properties, use formspec_update instead.',
    inputSchema: {
      project_id: z.string(),
      // Single item
      path: z.string().optional().describe('Item path (e.g., "name", "contact.email", "items[0].amount")'),
      label: z.string().optional(),
      type: z.string().optional().describe('Data type: "string", "text", "number", "integer", "decimal", "boolean", "date", "email", "choice"'),
      props: fieldPropsSchema.optional(),
      // Batch
      items: z.array(fieldItemSchema).optional().describe('Batch: array of field definitions to add'),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, path, label, type, props, items }) => {
    if (items) {
      return structure.handleField(registry, project_id, { items });
    }
    return structure.handleField(registry, project_id, { path: path!, label: label!, type: type!, props });
  });

  server.registerTool('formspec_content', {
    title: 'Add Content',
    description: 'Add non-data display elements to the form: headings, paragraphs, dividers, or banners. Supports batch via items[] array. For submit buttons, use formspec_submit_button instead.',
    inputSchema: {
      project_id: z.string(),
      // Single item
      path: z.string().optional().describe('Item path (e.g., "intro_heading", "section1.instructions")'),
      body: z.string().optional().describe('Display text'),
      kind: z.enum(['heading', 'paragraph', 'divider', 'banner']).optional().describe('Display kind. Default: paragraph'),
      props: z.object({
        page: z.string().optional().describe('Page ID to place this item on after creation'),
      }).partial().optional(),
      // Batch
      items: z.array(contentItemSchema).optional().describe('Batch: array of content items to add'),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, path, body, kind, props, items }) => {
    if (items) {
      return structure.handleContent(registry, project_id, { items });
    }
    return structure.handleContent(registry, project_id, { path: path!, body: body!, kind, props });
  });

  server.registerTool('formspec_group', {
    title: 'Add Group',
    description: 'Add a logical group container for related items. Supports batch via items[] array. Include repeat config in props to make it repeatable (e.g., props: { repeat: { min: 1, max: 5 } }).',
    inputSchema: {
      project_id: z.string(),
      // Single item
      path: z.string().optional().describe('Item path (e.g., "contact_info", "line_items")'),
      label: z.string().optional(),
      props: groupItemSchema.shape.props.optional(),
      // Batch
      items: z.array(groupItemSchema).optional().describe('Batch: array of group definitions to add'),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, path, label, props, items }) => {
    if (items) {
      return structure.handleGroup(registry, project_id, { items });
    }
    return structure.handleGroup(registry, project_id, { path: path!, label: label!, props });
  });

  server.registerTool('formspec_submit_button', {
    title: 'Add Submit Button',
    description: 'Add a submit button to the form or a specific page.',
    inputSchema: {
      project_id: z.string(),
      label: z.string().optional().describe('Button label (default: "Submit")'),
      page_id: z.string().optional().describe('Page to place the button on'),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, label, page_id }) => {
    return structure.handleSubmitButton(registry, project_id, label, page_id);
  });

  // ══════════════════════════════════════════════════════════════════
  // Structure — Modify (2 tools)
  // ══════════════════════════════════════════════════════════════════

  server.registerTool('formspec_update', {
    title: 'Update',
    description: 'Modify properties on EXISTING items or form-level metadata. To add new items, use formspec_field, formspec_content, or formspec_group. target="item" changes an item\'s label, description, choices, etc. target="metadata" changes form-level title, description, version, etc.',
    inputSchema: {
      project_id: z.string(),
      target: z.enum(['item', 'metadata']).describe('"item" to update a field/group/content; "metadata" for form-level properties'),
      path: z.string().optional().describe('Item path (required when target="item", e.g., "name", "contact.email")'),
      changes: z.record(z.string(), z.unknown()).describe('Properties to change (e.g., { label: "Full Name", description: "..." })'),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, target, path, changes }) => {
    return structure.handleUpdate(registry, project_id, target, { path, changes });
  });

  server.registerTool('formspec_edit', {
    title: 'Edit Structure',
    description: 'Structural tree mutations: remove, move, rename, or copy items. Action "remove" is DESTRUCTIVE — use formspec_undo to reverse.',
    inputSchema: {
      project_id: z.string(),
      action: z.enum(['remove', 'move', 'rename', 'copy']).describe('remove: delete item and descendants; move: relocate in tree; rename: change key; copy: duplicate'),
      path: z.string().describe('Item path to act on (e.g., "old_field", "contact.phone")'),
      // move params
      target_path: z.string().optional().describe('New parent path (for action="move")'),
      index: z.number().optional().describe('Position index (for action="move")'),
      // rename params
      new_key: z.string().optional().describe('New key name (for action="rename")'),
      // copy params
      deep: z.boolean().optional().describe('Deep-copy descendants (for action="copy", default: false)'),
    },
    annotations: DESTRUCTIVE,
  }, async ({ project_id, action, path, target_path, index, new_key, deep }) => {
    return structure.handleEdit(registry, project_id, action, { path, target_path, index, new_key, deep });
  });

  // ══════════════════════════════════════════════════════════════════
  // 16-17. Pages (2 tools)
  // ══════════════════════════════════════════════════════════════════

  server.registerTool('formspec_page', {
    title: 'Page',
    description: 'Manage form pages: add, remove, or reorder. Pages organize form content into navigable sections (wizard steps or tabs).',
    inputSchema: {
      project_id: z.string(),
      action: z.enum(['add', 'remove', 'move']).describe('add: create page; remove: delete page; move: reorder'),
      // add params
      title: z.string().optional().describe('Page title (for action="add")'),
      description: z.string().optional().describe('Page description (for action="add")'),
      // remove/move params
      page_id: z.string().optional().describe('Page ID (for action="remove" or "move")'),
      direction: z.enum(['up', 'down']).optional().describe('Move direction (for action="move")'),
    },
    annotations: DESTRUCTIVE,
  }, async ({ project_id, action, title, description, page_id, direction }) => {
    return structure.handlePage(registry, project_id, action, { title, description, page_id, direction });
  });

  server.registerTool('formspec_place', {
    title: 'Place on Page',
    description: 'Assign or unassign items to/from pages. action="place" puts an item on a page; action="unplace" removes it from the page (but does NOT delete the item).',
    inputSchema: {
      project_id: z.string(),
      action: z.enum(['place', 'unplace']).describe('place: assign to page; unplace: remove from page'),
      target: z.string().describe('Item path to place/unplace'),
      page_id: z.string().describe('Page ID'),
      options: z.object({ span: z.number() }).optional().describe('Layout options (for action="place")'),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, action, target, page_id, options }) => {
    return structure.handlePlace(registry, project_id, action, target, page_id, options);
  });

  // ══════════════════════════════════════════════════════════════════
  // 18. formspec_behavior — Logic (5 → 1, batch-enabled)
  // ══════════════════════════════════════════════════════════════════

  server.registerTool('formspec_behavior', {
    title: 'Behavior',
    description: 'Set field logic: visibility conditions, readonly conditions, required state, calculated values, and validation rules. Supports batch via items[] array.\n\nActions:\n- show_when: Show item when FEL condition is true\n- readonly_when: Make field readonly when condition is true\n- require: Mark field as required (optionally conditional)\n- calculate: Bind a computed FEL value directly to a field. For reusable named values across multiple fields, use formspec_data(variable) instead.\n- add_rule: Add validation constraint with message',
    inputSchema: {
      project_id: z.string(),
      // Single item
      action: z.enum(['show_when', 'readonly_when', 'require', 'calculate', 'add_rule']).optional().describe('Behavior type'),
      target: z.string().optional().describe('Field path (e.g., "email", "contact.phone")'),
      condition: z.string().optional().describe('FEL condition (for show_when, readonly_when, require)'),
      expression: z.string().optional().describe('FEL expression (for calculate)'),
      rule: z.string().optional().describe('FEL validation expression (for add_rule)'),
      message: z.string().optional().describe('Validation error message (for add_rule)'),
      options: z.object({
        timing: z.enum(['continuous', 'submit', 'demand']),
        severity: z.enum(['error', 'warning', 'info']),
        code: z.string(),
        activeWhen: z.string(),
      }).partial().optional(),
      // Batch
      items: z.array(behaviorItemSchema).optional().describe('Batch: array of behavior actions to apply'),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, action, target, condition, expression, rule, message, options, items }) => {
    if (items) {
      return handleBehavior(registry, project_id, { items });
    }
    return handleBehavior(registry, project_id, { action: action!, target: target!, condition, expression, rule, message, options });
  });

  // ══════════════════════════════════════════════════════════════════
  // 19. formspec_flow — Navigation
  // ══════════════════════════════════════════════════════════════════

  server.registerTool('formspec_flow', {
    title: 'Flow',
    description: 'Set form navigation mode or add conditional branching.\n\nActions:\n- set_mode: Choose single page, wizard (multi-step), or tabs\n- branch: Show/hide items based on a field\'s value (conditional logic)',
    inputSchema: {
      project_id: z.string(),
      action: z.enum(['set_mode', 'branch']).describe('set_mode: change navigation; branch: add conditional paths'),
      // set_mode params
      mode: z.enum(['single', 'wizard', 'tabs']).optional().describe('Navigation mode (for action="set_mode")'),
      props: z.object({
        showProgress: z.boolean(),
        allowSkip: z.boolean(),
      }).partial().optional().describe('Flow properties (for action="set_mode")'),
      // branch params
      on: z.string().optional().describe('Field path to branch on (for action="branch")'),
      paths: z.array(z.object({
        when: z.union([z.string(), z.number(), z.boolean()]),
        show: z.union([z.string(), z.array(z.string())]),
        mode: z.enum(['equals', 'contains']).optional(),
      })).optional().describe('Branch arms (for action="branch")'),
      otherwise: z.union([z.string(), z.array(z.string())]).optional().describe('Default items to show (for action="branch")'),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, action, mode, props, on, paths, otherwise }) => {
    return handleFlow(registry, project_id, { action, mode, props, on, paths, otherwise });
  });

  // ══════════════════════════════════════════════════════════════════
  // 20. formspec_style — Presentation (3 → 1)
  // ══════════════════════════════════════════════════════════════════

  server.registerTool('formspec_style', {
    title: 'Style',
    description: 'Apply visual styling: layout arrangements, item-level style properties, or form-wide style defaults.\n\nActions:\n- layout: Apply arrangement (columns-2/3/4, card, sidebar, inline) to items\n- style: Set CSS-like properties on a specific item\n- style_all: Apply properties to all items, optionally filtered by type or data type',
    inputSchema: {
      project_id: z.string(),
      action: z.enum(['layout', 'style', 'style_all']).describe('layout: arrange items; style: style one item; style_all: style all/filtered items'),
      // layout params
      target: z.union([z.string(), z.array(z.string())]).optional().describe('Item path(s) to arrange (for action="layout")'),
      arrangement: z.enum(['columns-2', 'columns-3', 'columns-4', 'card', 'sidebar', 'inline']).optional(),
      // style params
      path: z.string().optional().describe('Item path (for action="style")'),
      properties: z.record(z.string(), z.unknown()).optional().describe('Style properties to apply'),
      // style_all filters
      target_type: z.string().optional().describe('Filter by item type: "group", "field", "display" (for action="style_all")'),
      target_data_type: z.string().optional().describe('Filter by data type: "string", "number", etc. (for action="style_all")'),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, action, target, arrangement, path, properties, target_type, target_data_type }) => {
    return handleStyle(registry, project_id, { action, target, arrangement, path, properties, target_type, target_data_type });
  });

  // ══════════════════════════════════════════════════════════════════
  // 21. formspec_data — Data sources (9 → 1)
  // ══════════════════════════════════════════════════════════════════

  server.registerTool('formspec_data', {
    title: 'Data',
    description: 'Manage reusable choice lists, computed variables, and external data instances.\n\nResources:\n- choices: Reusable option lists referenced by fields via choicesFrom\n- variable: Named computed values (FEL expressions) referenced across multiple fields. For binding a computed value to a single field, use formspec_behavior(calculate) instead.\n- instance: External data sources (e.g., API endpoint, static JSON lookup table) that fields reference for dynamic choices via choicesFrom',
    inputSchema: {
      project_id: z.string(),
      resource: z.enum(['choices', 'variable', 'instance']).describe('What kind of data to manage'),
      action: z.enum(['add', 'update', 'remove', 'rename']).describe('choices only supports "add"'),
      name: z.string().describe('Name/identifier of the resource'),
      // choices
      options: z.array(z.object({ value: z.string(), label: z.string() })).optional().describe('Choice options (for resource="choices", action="add")'),
      // variable
      expression: z.string().optional().describe('FEL expression (for resource="variable", action="add"/"update")'),
      scope: z.string().optional().describe('Scope path (for resource="variable", action="add")'),
      // instance
      props: z.object({
        source: z.string(),
        data: z.unknown(),
        schema: z.record(z.string(), z.unknown()),
        static: z.boolean(),
        readonly: z.boolean(),
        description: z.string(),
      }).partial().optional().describe('Instance configuration (for resource="instance", action="add")'),
      changes: z.object({
        source: z.string(),
        data: z.unknown(),
        schema: z.record(z.string(), z.unknown()),
        static: z.boolean(),
        readonly: z.boolean(),
        description: z.string(),
      }).partial().optional().describe('Properties to update (for resource="instance", action="update")'),
      // rename
      new_name: z.string().optional().describe('New name (for action="rename")'),
    },
    annotations: DESTRUCTIVE,
  }, async ({ project_id, resource, action, name, options, expression, scope, props, changes, new_name }) => {
    return handleData(registry, project_id, { resource, action, name, options, expression, scope, props, changes, new_name });
  });

  // ══════════════════════════════════════════════════════════════════
  // 22. formspec_screener — Pre-form screening (7 → 1)
  // ══════════════════════════════════════════════════════════════════

  server.registerTool('formspec_screener', {
    title: 'Screener',
    description: 'Manage the pre-form screening section: enable/disable, add/remove screening fields, and configure routing rules that direct respondents based on their answers.',
    inputSchema: {
      project_id: z.string(),
      action: z.enum(['enable', 'add_field', 'remove_field', 'add_route', 'update_route', 'reorder_route', 'remove_route'])
        .describe('enable: toggle screener on/off; add_field/remove_field: manage screening questions; add_route/update_route/reorder_route/remove_route: manage routing rules'),
      // enable
      enabled: z.boolean().optional(),
      // add_field
      key: z.string().optional().describe('Field key (for add_field/remove_field)'),
      label: z.string().optional().describe('Field label (for add_field)'),
      type: z.string().optional().describe('Field data type (for add_field)'),
      props: fieldPropsSchema.optional(),
      // routes
      condition: z.string().optional().describe('FEL condition (for add_route)'),
      target: z.string().optional().describe('Route target (for add_route)'),
      route_index: z.number().optional().describe('Route index (for update_route, reorder_route, remove_route)'),
      changes: z.object({
        condition: z.string(),
        target: z.string(),
        label: z.string(),
      }).partial().optional().describe('Route changes (for update_route)'),
      direction: z.enum(['up', 'down']).optional().describe('Reorder direction (for reorder_route)'),
    },
    annotations: DESTRUCTIVE,
  }, async ({ project_id, action, enabled, key, label, type, props, condition, target, route_index, changes, direction }) => {
    return handleScreener(registry, project_id, {
      action, enabled, key, label, type, props, condition, target, route_index, changes, direction,
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // 23-25. Query tools (7 → 3)
  // ══════════════════════════════════════════════════════════════════

  server.registerTool('formspec_describe', {
    title: 'Describe',
    description: 'Introspect the form. mode="structure": returns form statistics and field list, or details for a specific item path. mode="audit": runs diagnostics returning all warnings, errors, and categorized issues.',
    inputSchema: {
      project_id: z.string(),
      mode: z.enum(['structure', 'audit']).optional().default('structure').describe('"structure" for form overview/item details; "audit" for diagnostics'),
      target: z.string().optional().describe('Item path to describe (for mode="structure" only, e.g., "name", "contact.email")'),
    },
    annotations: READ_ONLY,
  }, async ({ project_id, mode, target }) => {
    return handleDescribe(registry, project_id, mode ?? 'structure', target);
  });

  server.registerTool('formspec_search', {
    title: 'Search',
    description: 'Search for items by type, data type, label, or extension. Returns matching items from the form tree.',
    inputSchema: {
      project_id: z.string(),
      filter: z.object({
        type: z.enum(['group', 'field', 'display']).optional(),
        dataType: z.string().optional(),
        label: z.string().optional(),
        hasExtension: z.string().optional(),
      }).describe('Filter criteria (all optional, combine for narrower results)'),
    },
    annotations: READ_ONLY,
  }, async ({ project_id, filter }) => {
    return handleSearch(registry, project_id, filter);
  });

  server.registerTool('formspec_trace', {
    title: 'Trace',
    description: 'Analyze dependencies. mode="trace": given a FEL expression, returns its field dependencies; given a field path, returns what depends on it (binds, shapes, variables). mode="changelog": returns project change history.',
    inputSchema: {
      project_id: z.string(),
      mode: z.enum(['trace', 'changelog']).optional().default('trace'),
      expression_or_field: z.string().optional().describe('FEL expression (e.g., "$qty * $price") or field path (e.g., "qty"). Required for mode="trace".'),
      from_version: z.string().optional().describe('Starting version for changelog range (for mode="changelog")'),
    },
    annotations: READ_ONLY,
  }, async ({ project_id, mode, expression_or_field, from_version }) => {
    return handleTrace(registry, project_id, mode ?? 'trace', { expression_or_field, from_version });
  });

  // ══════════════════════════════════════════════════════════════════
  // 26. formspec_preview — Preview & validate
  // ══════════════════════════════════════════════════════════════════

  server.registerTool('formspec_preview', {
    title: 'Preview',
    description: 'Preview or validate the form. mode="preview": generates a runtime preview showing visible fields, current values, required state, and validation. mode="validate": validates a response object against the form definition.',
    inputSchema: {
      project_id: z.string(),
      mode: z.enum(['preview', 'validate']).optional().default('preview'),
      scenario: z.record(z.string(), z.unknown()).optional().describe('Scenario values to inject (for mode="preview")'),
      response: z.record(z.string(), z.unknown()).optional().describe('Response object to validate (required for mode="validate")'),
    },
    annotations: READ_ONLY,
  }, async ({ project_id, mode, scenario, response }) => {
    return handlePreview(registry, project_id, mode ?? 'preview', { scenario, response });
  });

  // ══════════════════════════════════════════════════════════════════
  // 27. formspec_fel — FEL utilities
  // ══════════════════════════════════════════════════════════════════

  server.registerTool('formspec_fel', {
    title: 'FEL',
    description: 'FEL (Formspec Expression Language) utilities for writing expressions.\n\nActions:\n- context: List available references (fields, variables, instances) scoped to a path\n- functions: List all available FEL functions with signatures\n- check: Parse and validate a FEL expression, returning errors, dependencies, and functions used',
    inputSchema: {
      project_id: z.string(),
      action: z.enum(['context', 'functions', 'check']).describe('context: available refs; functions: function catalog; check: validate expression'),
      path: z.string().optional().describe('Scope path for context-aware results (for action="context")'),
      expression: z.string().optional().describe('FEL expression to check (for action="check", e.g., "$qty * $price")'),
      context_path: z.string().optional().describe('Scope path for check (for action="check")'),
    },
    annotations: READ_ONLY,
  }, async ({ project_id, action, path, expression, context_path }) => {
    return handleFel(registry, project_id, { action, path, expression, context_path });
  });

  // ══════════════════════════════════════════════════════════════════
  // Graceful shutdown
  // ══════════════════════════════════════════════════════════════════

  const shutdown = async () => {
    for (const { id, sourcePath } of registry.authoringProjects()) {
      if (!sourcePath) continue; // No save path — nothing to autosave
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
