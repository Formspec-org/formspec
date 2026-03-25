/**
 * @filedesc Browser-safe MCP server factory — registers authoring tools without Node.js dependencies.
 *
 * This module intentionally avoids importing lifecycle.ts, bootstrap.ts, and schemas.ts
 * which depend on node:fs/node:path. Tools that require filesystem access (open, save,
 * draft, load) are registered in server.ts instead.
 */

import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { ProjectRegistry } from './registry.js';
import { READ_ONLY, NON_DESTRUCTIVE, DESTRUCTIVE } from './annotations.js';

import { handleGuide } from './tools/guide.js';
import * as structure from './tools/structure.js';
import { handleBehavior } from './tools/behavior.js';
import { handleFlow } from './tools/flow.js';
import { handleStyle } from './tools/style.js';
import { handleData } from './tools/data.js';
import { handleScreener } from './tools/screener.js';
import { handleDescribe, handleSearch, handleTrace, handlePreview } from './tools/query.js';
import { handleStructureBatch } from './tools/structure-batch.js';
import { handleFel } from './tools/fel.js';
import { handleWidget } from './tools/widget.js';
import { handleAudit } from './tools/audit.js';
import { handleTheme } from './tools/theme.js';
import { handleComponent } from './tools/component.js';
import {
  handleChangesetOpen, handleChangesetClose, handleChangesetList,
  handleChangesetAccept, handleChangesetReject,
  bracketMutation,
} from './tools/changeset.js';
import { successResponse, errorResponse, formatToolError } from './errors.js';
import { HelperError } from 'formspec-studio-core';

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
  required: z.boolean().describe('Shorthand for formspec_behavior(require). Sets unconditionally required. For conditional required, use formspec_behavior instead. Do NOT use both.'),
  readonly: z.boolean().describe('Shorthand for formspec_behavior(readonly_when, condition="true"). For conditional readonly, use formspec_behavior instead. Do NOT use both.'),
  initialValue: z.unknown(),
  insertIndex: z.number(),
  parentPath: z.string(),
}).partial();

const fieldItemSchema = z.object({
  path: z.string().describe('Item path (e.g., "name", "contact.email", "items[0].amount")'),
  label: z.string(),
  type: z.string().describe('Data type: "string" (single-line text), "text" (multi-line textarea), "integer", "decimal", "boolean", "date", "choice". Also accepts aliases: "number" (-> decimal), "email"/"phone" (-> string + validation), "url" (-> uri), "money"/"currency", "file" (-> attachment), "multichoice", "rating" (-> integer + Rating widget), "slider" (-> decimal + Slider widget). For "date" fields, use initialValue: "=today()" to auto-populate with today\'s date'),
  props: fieldPropsSchema.optional(),
});

const contentItemSchema = z.object({
  path: z.string().describe('Item path (e.g., "intro_heading", "section1.instructions")'),
  body: z.string().describe('Display text'),
  kind: z.enum(['heading', 'paragraph', 'divider', 'banner']).optional().describe('Display kind. Default: paragraph'),
  props: z.object({
    page: z.string().optional().describe('Page ID to place this item on after creation'),
    parentPath: z.string().optional().describe('Parent group path to nest this item under'),
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
    parentPath: z.string().describe('Parent group path to nest this group under'),
  }).partial().optional(),
});

const behaviorItemSchema = z.object({
  action: z.enum(['show_when', 'readonly_when', 'require', 'calculate', 'add_rule', 'remove_rule']),
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

// ── Server Factory ───────────────────────────────────────────────────

/**
 * Create an McpServer with browser-safe authoring tools registered.
 *
 * Excludes filesystem-dependent tools (open, save, draft, load).
 * Includes: guide, create (inline), undo/redo (inline), all structure/behavior/flow/
 * style/data/screener/query/fel tools.
 *
 * Does NOT connect any transport or set up shutdown hooks.
 */
export function createFormspecServer(registry: ProjectRegistry): McpServer {
  const server = new McpServer({ name: 'formspec-mcp', version: '0.2.0' });

  // ── Guide ──────────────────────────────────────────────────────────

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

  // ── Create (inline — no fs deps) ──────────────────────────────────

  server.registerTool('formspec_create', {
    title: 'Create Project',
    description: 'Create a new project ready for authoring.',
    inputSchema: {},
    annotations: NON_DESTRUCTIVE,
  }, async () => {
    try {
      const { createProject } = await import('formspec-studio-core');
      const projectId = registry.newProject();
      const project = createProject();
      registry.transitionToAuthoring(projectId, project);
      return successResponse({ project_id: projectId, phase: 'authoring' });
    } catch (err) {
      if (err instanceof HelperError) {
        return errorResponse(formatToolError(err.code, err.message, err.detail as Record<string, unknown>));
      }
      throw err;
    }
  });

  // ── Undo/Redo (inline — no fs deps) ───────────────────────────────

  server.registerTool('formspec_undo', {
    title: 'Undo',
    description: 'Undo the last authoring operation. Returns { undone: true/false }.',
    inputSchema: { project_id: z.string() },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id }) => {
    try {
      const project = registry.getProject(project_id);
      if (!project.canUndo) return successResponse({ undone: false });
      project.undo();
      return successResponse({ undone: true });
    } catch (err) {
      if (err instanceof HelperError) {
        return errorResponse(formatToolError(err.code, err.message, err.detail as Record<string, unknown>));
      }
      throw err;
    }
  });

  server.registerTool('formspec_redo', {
    title: 'Redo',
    description: 'Redo the last undone operation. Returns { redone: true/false }.',
    inputSchema: { project_id: z.string() },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id }) => {
    try {
      const project = registry.getProject(project_id);
      if (!project.canRedo) return successResponse({ redone: false });
      project.redo();
      return successResponse({ redone: true });
    } catch (err) {
      if (err instanceof HelperError) {
        return errorResponse(formatToolError(err.code, err.message, err.detail as Record<string, unknown>));
      }
      throw err;
    }
  });

  // ── Structure — Add ───────────────────────────────────────────────

  server.registerTool('formspec_field', {
    title: 'Add Field',
    description: 'Add NEW data-collecting fields to the form. Supports single item or batch via items[] array. To modify an existing field\'s properties, use formspec_update instead.\n\nPath conventions:\n- Authoring paths use dot notation: "contact.email" (nests under group "contact")\n- FEL expressions use $-prefix: "$contact.email"\n- Runtime/preview uses indexed paths for repeating groups: "items[0].amount"',
    inputSchema: {
      project_id: z.string(),
      path: z.string().optional().describe('Item path (e.g., "name", "contact.email", "items[0].amount")'),
      label: z.string().optional(),
      type: z.string().optional().describe('Data type: "string" (single-line text), "text" (multi-line textarea), "integer", "decimal", "boolean", "date", "choice". Also accepts aliases: "number" (-> decimal), "email"/"phone" (-> string + validation), "url" (-> uri), "money"/"currency", "file" (-> attachment), "multichoice", "rating" (-> integer + Rating widget), "slider" (-> decimal + Slider widget). For "date" fields, use initialValue: "=today()" to auto-populate with today\'s date'),
      props: fieldPropsSchema.optional(),
      items: z.array(fieldItemSchema).optional().describe('Batch: array of field definitions to add'),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, path, label, type, props, items }) => {
    return bracketMutation(registry, project_id, 'formspec_field', () => {
      if (items) return structure.handleField(registry, project_id, { items });
      return structure.handleField(registry, project_id, { path: path!, label: label!, type: type!, props });
    });
  });

  server.registerTool('formspec_content', {
    title: 'Add Content',
    description: 'Add non-data display elements to the form: headings, paragraphs, dividers, or banners. Supports batch via items[] array.',
    inputSchema: {
      project_id: z.string(),
      path: z.string().optional(),
      body: z.string().optional().describe('Display text'),
      kind: z.enum(['heading', 'paragraph', 'divider', 'banner']).optional(),
      props: contentItemSchema.shape.props,
      items: z.array(contentItemSchema).optional(),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, path, body, kind, props, items }) => {
    return bracketMutation(registry, project_id, 'formspec_content', () => {
      if (items) return structure.handleContent(registry, project_id, { items });
      return structure.handleContent(registry, project_id, { path: path!, body: body!, kind, props });
    });
  });

  server.registerTool('formspec_group', {
    title: 'Add Group',
    description: 'Add a logical group container for related items. Supports batch via items[] array.',
    inputSchema: {
      project_id: z.string(),
      path: z.string().optional(),
      label: z.string().optional(),
      props: groupItemSchema.shape.props.optional(),
      items: z.array(groupItemSchema).optional(),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, path, label, props, items }) => {
    return bracketMutation(registry, project_id, 'formspec_group', () => {
      if (items) return structure.handleGroup(registry, project_id, { items });
      return structure.handleGroup(registry, project_id, { path: path!, label: label!, props });
    });
  });

  server.registerTool('formspec_submit_button', {
    title: 'Add Submit Button',
    description: 'Add a submit button to the form or a specific page.',
    inputSchema: {
      project_id: z.string(),
      label: z.string().optional(),
      page_id: z.string().optional(),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, label, page_id }) => {
    return bracketMutation(registry, project_id, 'formspec_submit_button', () =>
      structure.handleSubmitButton(registry, project_id, label, page_id),
    );
  });

  // ── Structure — Modify ────────────────────────────────────────────

  server.registerTool('formspec_update', {
    title: 'Update',
    description: 'Modify properties on EXISTING items or form-level metadata. target="item" changes an item\'s label, description, choices, etc. target="metadata" changes form-level title, description, version, etc.',
    inputSchema: {
      project_id: z.string(),
      target: z.enum(['item', 'metadata']),
      path: z.string().optional(),
      changes: z.record(z.string(), z.unknown()),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, target, path, changes }) => {
    return bracketMutation(registry, project_id, 'formspec_update', () =>
      structure.handleUpdate(registry, project_id, target, { path, changes }),
    );
  });

  server.registerTool('formspec_edit', {
    title: 'Edit Structure',
    description: 'Structural tree mutations: remove, move, rename, or copy items. Action "remove" is DESTRUCTIVE.',
    inputSchema: {
      project_id: z.string(),
      action: z.enum(['remove', 'move', 'rename', 'copy']).optional(),
      path: z.string().optional(),
      target_path: z.string().optional(),
      index: z.number().optional(),
      new_key: z.string().optional(),
      deep: z.boolean().optional(),
      items: z.array(z.object({
        action: z.enum(['remove', 'move', 'rename', 'copy']).optional(),
        path: z.string(),
        target_path: z.string().optional(),
        index: z.number().optional(),
        new_key: z.string().optional(),
        deep: z.boolean().optional(),
      })).optional(),
    },
    annotations: DESTRUCTIVE,
  }, async ({ project_id, action, path, target_path, index, new_key, deep, items }) => {
    return bracketMutation(registry, project_id, 'formspec_edit', () => {
      if (items) return structure.handleEdit(registry, project_id, action ?? 'remove', { items });
      if (!action) return structure.editMissingAction();
      return structure.handleEdit(registry, project_id, action, { path: path!, target_path, index, new_key, deep });
    });
  });

  // ── Structure Batch ──────────────────────────────────────────────

  server.registerTool('formspec_structure_batch', {
    title: 'Structure Batch',
    description: 'Batch structure operations: wrap items in a group, batch delete, or batch duplicate. Action "batch_delete" is DESTRUCTIVE.',
    inputSchema: {
      project_id: z.string(),
      action: z.enum(['wrap_group', 'batch_delete', 'batch_duplicate']),
      paths: z.array(z.string()).describe('Item paths to operate on'),
      groupPath: z.string().optional().describe('Group key for wrap_group action'),
      groupLabel: z.string().optional().describe('Group label for wrap_group action'),
    },
    annotations: DESTRUCTIVE,
  }, async ({ project_id, action, paths, groupPath, groupLabel }) => {
    return bracketMutation(registry, project_id, 'formspec_structure_batch', () =>
      handleStructureBatch(registry, project_id, { action, paths, groupPath, groupLabel }),
    );
  });

  // ── Pages ─────────────────────────────────────────────────────────

  server.registerTool('formspec_page', {
    title: 'Page',
    description: 'Manage form pages: add, remove, reorder, or list.',
    inputSchema: {
      project_id: z.string(),
      action: z.enum(['add', 'remove', 'move', 'list']),
      title: z.string().optional(),
      description: z.string().optional(),
      page_id: z.string().optional(),
      direction: z.enum(['up', 'down']).optional(),
    },
    annotations: DESTRUCTIVE,
  }, async ({ project_id, action, title, description, page_id, direction }) => {
    return bracketMutation(registry, project_id, 'formspec_page', () =>
      structure.handlePage(registry, project_id, action, { title, description, page_id, direction }),
    );
  });

  server.registerTool('formspec_place', {
    title: 'Place on Page',
    description: 'Assign items to pages or change column spans. Supports batch via items[] array.',
    inputSchema: {
      project_id: z.string(),
      action: z.enum(['place', 'unplace']).optional(),
      target: z.string().optional(),
      page_id: z.string().optional(),
      options: z.object({ span: z.number() }).optional(),
      items: z.array(z.object({
        action: z.enum(['place', 'unplace']),
        target: z.string(),
        page_id: z.string(),
        options: z.object({ span: z.number() }).optional(),
      })).optional(),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, action, target, page_id, options, items }) => {
    return bracketMutation(registry, project_id, 'formspec_place', () => {
      if (items) return structure.handlePlace(registry, project_id, { items });
      return structure.handlePlace(registry, project_id, { action: action!, target: target!, page_id: page_id!, options });
    });
  });

  // ── Behavior ──────────────────────────────────────────────────────

  server.registerTool('formspec_behavior', {
    title: 'Behavior',
    description: 'Set field logic: visibility conditions, readonly conditions, required state, calculated values, and validation rules. Supports batch via items[] array.\n\nActions: show_when, readonly_when, require, calculate, add_rule, remove_rule.',
    inputSchema: {
      project_id: z.string(),
      action: z.enum(['show_when', 'readonly_when', 'require', 'calculate', 'add_rule', 'remove_rule']).optional(),
      target: z.string().optional(),
      condition: z.string().optional(),
      expression: z.string().optional(),
      rule: z.string().optional(),
      message: z.string().optional(),
      options: z.object({
        timing: z.enum(['continuous', 'submit', 'demand']),
        severity: z.enum(['error', 'warning', 'info']),
        code: z.string(),
        activeWhen: z.string(),
      }).partial().optional(),
      items: z.array(behaviorItemSchema).optional(),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, action, target, condition, expression, rule, message, options, items }) => {
    return bracketMutation(registry, project_id, 'formspec_behavior', () => {
      if (items) return handleBehavior(registry, project_id, { items });
      return handleBehavior(registry, project_id, { action: action!, target: target!, condition, expression, rule, message, options });
    });
  });

  // ── Flow ──────────────────────────────────────────────────────────

  server.registerTool('formspec_flow', {
    title: 'Flow',
    description: 'Set form navigation mode or add conditional branching.',
    inputSchema: {
      project_id: z.string(),
      action: z.enum(['set_mode', 'branch']),
      mode: z.enum(['single', 'wizard', 'tabs']).optional(),
      props: z.object({ showProgress: z.boolean(), allowSkip: z.boolean() }).partial().optional(),
      on: z.string().optional(),
      paths: z.array(z.object({
        when: z.union([z.string(), z.number(), z.boolean()]),
        show: z.union([z.string(), z.array(z.string())]),
        mode: z.enum(['equals', 'contains']).optional(),
      })).optional(),
      otherwise: z.union([z.string(), z.array(z.string())]).optional(),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, action, mode, props, on, paths, otherwise }) => {
    return bracketMutation(registry, project_id, 'formspec_flow', () =>
      handleFlow(registry, project_id, { action, mode, props, on, paths, otherwise }),
    );
  });

  // ── Style ─────────────────────────────────────────────────────────

  server.registerTool('formspec_style', {
    title: 'Style',
    description: 'Apply visual styling: layout arrangements, item-level style properties, or form-wide style defaults.',
    inputSchema: {
      project_id: z.string(),
      action: z.enum(['layout', 'style', 'style_all']),
      target: z.union([z.string(), z.array(z.string())]).optional(),
      arrangement: z.enum(['columns-2', 'columns-3', 'columns-4', 'card', 'sidebar', 'inline']).optional(),
      path: z.string().optional(),
      properties: z.record(z.string(), z.unknown()).optional(),
      target_type: z.string().optional(),
      target_data_type: z.string().optional(),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, action, target, arrangement, path, properties, target_type, target_data_type }) => {
    return bracketMutation(registry, project_id, 'formspec_style', () =>
      handleStyle(registry, project_id, { action, target, arrangement, path, properties, target_type, target_data_type }),
    );
  });

  // ── Data ──────────────────────────────────────────────────────────

  server.registerTool('formspec_data', {
    title: 'Data',
    description: 'Manage reusable choice lists, computed variables, and external data instances.',
    inputSchema: {
      project_id: z.string(),
      resource: z.enum(['choices', 'variable', 'instance']),
      action: z.enum(['add', 'update', 'remove', 'rename']),
      name: z.string(),
      options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
      expression: z.string().optional(),
      scope: z.string().optional(),
      props: z.object({ source: z.string(), data: z.unknown(), schema: z.record(z.string(), z.unknown()), static: z.boolean(), readonly: z.boolean(), description: z.string() }).partial().optional(),
      changes: z.object({ source: z.string(), data: z.unknown(), schema: z.record(z.string(), z.unknown()), static: z.boolean(), readonly: z.boolean(), description: z.string() }).partial().optional(),
      new_name: z.string().optional(),
    },
    annotations: DESTRUCTIVE,
  }, async ({ project_id, resource, action, name, options, expression, scope, props, changes, new_name }) => {
    return bracketMutation(registry, project_id, 'formspec_data', () =>
      handleData(registry, project_id, { resource, action, name, options, expression, scope, props, changes, new_name }),
    );
  });

  // ── Screener ──────────────────────────────────────────────────────

  server.registerTool('formspec_screener', {
    title: 'Screener',
    description: 'Manage the pre-form screening section.',
    inputSchema: {
      project_id: z.string(),
      action: z.enum(['enable', 'add_field', 'remove_field', 'add_route', 'update_route', 'reorder_route', 'remove_route']),
      enabled: z.boolean().optional(),
      key: z.string().optional(),
      label: z.string().optional(),
      type: z.string().optional(),
      props: fieldPropsSchema.optional(),
      condition: z.string().optional(),
      target: z.string().optional(),
      message: z.string().optional(),
      route_index: z.number().optional(),
      changes: z.object({ condition: z.string(), target: z.string(), label: z.string(), message: z.string() }).partial().optional(),
      direction: z.enum(['up', 'down']).optional(),
    },
    annotations: DESTRUCTIVE,
  }, async ({ project_id, action, enabled, key, label, type, props, condition, target, message, route_index, changes, direction }) => {
    return bracketMutation(registry, project_id, 'formspec_screener', () =>
      handleScreener(registry, project_id, { action, enabled, key, label, type, props, condition, target, message, route_index, changes, direction }),
    );
  });

  // ── Query ─────────────────────────────────────────────────────────

  server.registerTool('formspec_describe', {
    title: 'Describe',
    description: 'Introspect the form. mode="structure": returns form overview. mode="audit": runs diagnostics.',
    inputSchema: {
      project_id: z.string(),
      mode: z.enum(['structure', 'audit']).optional().default('structure'),
      target: z.string().optional(),
    },
    annotations: READ_ONLY,
  }, async ({ project_id, mode, target }) => {
    return handleDescribe(registry, project_id, mode ?? 'structure', target);
  });

  server.registerTool('formspec_search', {
    title: 'Search',
    description: 'Search for items by type, data type, label, or extension.',
    inputSchema: {
      project_id: z.string(),
      filter: z.object({ type: z.enum(['group', 'field', 'display']).optional(), dataType: z.string().optional(), label: z.string().optional(), hasExtension: z.string().optional() }),
    },
    annotations: READ_ONLY,
  }, async ({ project_id, filter }) => {
    return handleSearch(registry, project_id, filter);
  });

  server.registerTool('formspec_trace', {
    title: 'Trace',
    description: 'Analyze dependencies or view changelog.',
    inputSchema: {
      project_id: z.string(),
      mode: z.enum(['trace', 'changelog']).optional().default('trace'),
      expression_or_field: z.string().optional(),
      from_version: z.string().optional(),
    },
    annotations: READ_ONLY,
  }, async ({ project_id, mode, expression_or_field, from_version }) => {
    return handleTrace(registry, project_id, mode ?? 'trace', { expression_or_field, from_version });
  });

  server.registerTool('formspec_preview', {
    title: 'Preview',
    description: 'Preview, validate, generate sample data, or normalize the form definition. mode="preview" shows field visibility/values. mode="validate" checks a response. mode="sample_data" generates plausible values. mode="normalize" returns a cleaned-up definition.',
    inputSchema: {
      project_id: z.string(),
      mode: z.enum(['preview', 'validate', 'sample_data', 'normalize']).optional().default('preview'),
      scenario: z.record(z.string(), z.unknown()).optional(),
      response: z.record(z.string(), z.unknown()).optional(),
    },
    annotations: READ_ONLY,
  }, async ({ project_id, mode, scenario, response }) => {
    return handlePreview(registry, project_id, mode ?? 'preview', { scenario, response });
  });

  // ── FEL ───────────────────────────────────────────────────────────

  server.registerTool('formspec_fel', {
    title: 'FEL',
    description: 'FEL utilities: list available references, function catalog, validate/check an expression, get autocomplete suggestions, or humanize an expression to English.',
    inputSchema: {
      project_id: z.string(),
      action: z.enum(['context', 'functions', 'check', 'validate', 'autocomplete', 'humanize']),
      path: z.string().optional(),
      expression: z.string().optional().describe('FEL expression (for check/validate/humanize) or partial input (for autocomplete)'),
      context_path: z.string().optional().describe('Field path for scope-aware validation and context-specific suggestions'),
    },
    annotations: READ_ONLY,
  }, async ({ project_id, action, path, expression, context_path }) => {
    return handleFel(registry, project_id, { action, path, expression, context_path });
  });

  // ── Widget Vocabulary ────────────────────────────────────────────

  server.registerTool('formspec_widget', {
    title: 'Widget',
    description: 'Query widget vocabulary: list all widgets, find compatible widgets for a data type, or get the field type catalog.',
    inputSchema: {
      project_id: z.string(),
      action: z.enum(['list_widgets', 'compatible', 'field_types']),
      data_type: z.string().optional().describe('Data type to check compatibility for (used with action="compatible")'),
    },
    annotations: READ_ONLY,
  }, async ({ project_id, action, data_type }) => {
    return handleWidget(registry, project_id, { action, dataType: data_type });
  });

  // ── Audit ─────────────────────────────────────────────────────────

  server.registerTool('formspec_audit', {
    title: 'Audit',
    description: 'Audit the form structure. action="classify_items": classify all items by type, data type, and metadata. action="bind_summary": show bind properties for a target field.',
    inputSchema: {
      project_id: z.string(),
      action: z.enum(['classify_items', 'bind_summary']),
      target: z.string().optional().describe('Field path (required for bind_summary)'),
    },
    annotations: READ_ONLY,
  }, async ({ project_id, action, target }) => {
    return handleAudit(registry, project_id, { action, target });
  });

  // ── Theme ───────────────────────────────────────────────────────────

  server.registerTool('formspec_theme', {
    title: 'Theme',
    description: 'Manage theme tokens, defaults, and selectors. Actions: set_token, remove_token, list_tokens, set_default, list_defaults, add_selector, list_selectors.',
    inputSchema: {
      project_id: z.string(),
      action: z.enum(['set_token', 'remove_token', 'list_tokens', 'set_default', 'list_defaults', 'add_selector', 'list_selectors']),
      key: z.string().optional().describe('Token key (for set_token, remove_token)'),
      value: z.unknown().optional().describe('Token or default value (for set_token, set_default)'),
      property: z.string().optional().describe('Default property name (for set_default)'),
      match: z.record(z.string(), z.unknown()).optional().describe('Selector match criteria (for add_selector)'),
      apply: z.record(z.string(), z.unknown()).optional().describe('Selector properties to apply (for add_selector)'),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, action, key, value, property, match, apply }) => {
    const readOnlyActions = ['list_tokens', 'list_defaults', 'list_selectors'];
    if (readOnlyActions.includes(action)) {
      return handleTheme(registry, project_id, { action, key, value, property, match, apply });
    }
    return bracketMutation(registry, project_id, 'formspec_theme', () =>
      handleTheme(registry, project_id, { action, key, value, property, match, apply }),
    );
  });

  // ── Component ──────────────────────────────────────────────────────

  server.registerTool('formspec_component', {
    title: 'Component',
    description: 'Manage the component tree. Actions: list_nodes, add_node, set_node_property, remove_node.',
    inputSchema: {
      project_id: z.string(),
      action: z.enum(['list_nodes', 'add_node', 'set_node_property', 'remove_node']),
      parent: z.object({ bind: z.string().optional(), nodeId: z.string().optional() }).optional().describe('Parent node reference (for add_node)'),
      component: z.string().optional().describe('Component type name (for add_node)'),
      bind: z.string().optional().describe('Bind to definition item key (for add_node)'),
      props: z.record(z.string(), z.unknown()).optional().describe('Component properties (for add_node)'),
      node: z.object({ bind: z.string().optional(), nodeId: z.string().optional() }).optional().describe('Node reference (for set_node_property, remove_node)'),
      property: z.string().optional().describe('Property name (for set_node_property)'),
      value: z.unknown().optional().describe('Property value (for set_node_property)'),
    },
    annotations: DESTRUCTIVE,
  }, async ({ project_id, action, parent, component, bind, props, node, property, value }) => {
    if (action === 'list_nodes') {
      return handleComponent(registry, project_id, { action });
    }
    return bracketMutation(registry, project_id, 'formspec_component', () =>
      handleComponent(registry, project_id, { action, parent, component, bind, props, node, property, value }),
    );
  });

  // ── Changeset Management ─────────────────────────────────────────

  server.registerTool('formspec_changeset_open', {
    title: 'Open Changeset',
    description: 'Start a new changeset. All subsequent mutations are recorded as proposals for review. The user can continue editing the canvas freely while the changeset is open.',
    inputSchema: {
      project_id: z.string(),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id }) => {
    return handleChangesetOpen(registry, project_id);
  });

  server.registerTool('formspec_changeset_close', {
    title: 'Close Changeset',
    description: 'Seal the current changeset. Computes dependency groups for review. Status transitions to "pending".',
    inputSchema: {
      project_id: z.string(),
      label: z.string().describe('Human-readable summary of the changeset (e.g. "Added 3 fields, set validation on email")'),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, label }) => {
    return handleChangesetClose(registry, project_id, label);
  });

  server.registerTool('formspec_changeset_list', {
    title: 'List Changesets',
    description: 'List changesets with status, summaries, and dependency groups.',
    inputSchema: {
      project_id: z.string(),
    },
    annotations: READ_ONLY,
  }, async ({ project_id }) => {
    return handleChangesetList(registry, project_id);
  });

  server.registerTool('formspec_changeset_accept', {
    title: 'Accept Changeset',
    description: 'Accept a pending changeset. Pass group_indices to accept specific dependency groups (partial merge), or omit to accept all.',
    inputSchema: {
      project_id: z.string(),
      group_indices: z.array(z.number()).optional().describe('Dependency group indices to accept. Omit to accept all.'),
    },
    annotations: NON_DESTRUCTIVE,
  }, async ({ project_id, group_indices }) => {
    return handleChangesetAccept(registry, project_id, group_indices);
  });

  server.registerTool('formspec_changeset_reject', {
    title: 'Reject Changeset',
    description: 'Reject a pending changeset. Pass group_indices to reject specific dependency groups (the complement is accepted), or omit to reject all.',
    inputSchema: {
      project_id: z.string(),
      group_indices: z.array(z.number()).optional().describe('Dependency group indices to reject. Omit to reject all.'),
    },
    annotations: DESTRUCTIVE,
  }, async ({ project_id, group_indices }) => {
    return handleChangesetReject(registry, project_id, group_indices);
  });

  return server;
}
