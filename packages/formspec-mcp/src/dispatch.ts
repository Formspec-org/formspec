/** @filedesc In-process tool dispatch — call MCP tool handlers directly without network transport. */
import type { ProjectRegistry } from './registry.js';

import { handleField, handleContent, handleGroup, handleSubmitButton, handlePage, handlePlace, handleUpdate, handleEdit } from './tools/structure.js';
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
import { handleLocale } from './tools/locale.js';
import { handleOntology } from './tools/ontology.js';
import { handleReference } from './tools/reference.js';
import { handleBehaviorExpanded } from './tools/behavior-expanded.js';
import { handleComposition } from './tools/composition.js';
import { handleResponse } from './tools/response.js';
import { handleMappingExpanded } from './tools/mapping-expanded.js';
import { handleMigration } from './tools/migration.js';
import { handleChangelog } from './tools/changelog.js';
import { handlePublish } from './tools/publish.js';
import {
  handleChangesetOpen, handleChangesetClose, handleChangesetList,
  handleChangesetAccept, handleChangesetReject,
} from './tools/changeset.js';

type Handler = (registry: ProjectRegistry, projectId: string, args: Record<string, any>) => any;

/**
 * Wraps a 4-arg handler (registry, projectId, action, params) into the
 * standard 3-arg dispatch signature by extracting the action key from args.
 */
function wrap4(
  fn: (r: ProjectRegistry, p: string, action: any, params: any) => any,
  actionKey: string,
): Handler {
  return (r, p, args) => {
    const { [actionKey]: action, ...rest } = args;
    return fn(r, p, action, rest);
  };
}

const TOOL_HANDLERS: Record<string, Handler> = {
  // Handlers with standard (registry, projectId, params) signature
  formspec_field: (r, p, a) => handleField(r, p, a as any),
  formspec_content: (r, p, a) => handleContent(r, p, a as any),
  formspec_group: (r, p, a) => handleGroup(r, p, a as any),
  formspec_submit_button: (r, p, a) => handleSubmitButton(r, p, a as any),
  formspec_place: (r, p, a) => handlePlace(r, p, a as any),
  formspec_behavior: (r, p, a) => handleBehavior(r, p, a as any),
  formspec_flow: (r, p, a) => handleFlow(r, p, a as any),
  formspec_style: (r, p, a) => handleStyle(r, p, a as any),
  formspec_data: (r, p, a) => handleData(r, p, a as any),
  formspec_screener: (r, p, a) => handleScreener(r, p, a as any),
  formspec_describe: (r, p, a) => handleDescribe(r, p, a as any),
  formspec_search: (r, p, a) => handleSearch(r, p, a as any),
  formspec_structure: (r, p, a) => handleStructureBatch(r, p, a as any),
  formspec_fel: (r, p, a) => handleFel(r, p, a as any),
  formspec_widget: (r, p, a) => handleWidget(r, p, a as any),
  formspec_audit: (r, p, a) => handleAudit(r, p, a as any),
  formspec_theme: (r, p, a) => handleTheme(r, p, a as any),
  formspec_component: (r, p, a) => handleComponent(r, p, a as any),
  formspec_locale: (r, p, a) => handleLocale(r, p, a as any),
  formspec_ontology: (r, p, a) => handleOntology(r, p, a as any),
  formspec_reference: (r, p, a) => handleReference(r, p, a as any),
  formspec_behavior_expanded: (r, p, a) => handleBehaviorExpanded(r, p, a as any),
  formspec_composition: (r, p, a) => handleComposition(r, p, a as any),
  formspec_response: (r, p, a) => handleResponse(r, p, a as any),
  formspec_mapping: (r, p, a) => handleMappingExpanded(r, p, a as any),
  formspec_migration: (r, p, a) => handleMigration(r, p, a as any),
  formspec_changelog: (r, p, a) => handleChangelog(r, p, a as any),
  formspec_publish: (r, p, a) => (handlePublish as any)(r, p, a),
  // Handlers with (registry, projectId, action/target/mode, params) signature
  formspec_page: wrap4(handlePage, 'action'),
  formspec_update: wrap4(handleUpdate, 'target'),
  formspec_edit: wrap4(handleEdit, 'action'),
  formspec_trace: wrap4(handleTrace, 'mode'),
  formspec_preview: wrap4(handlePreview, 'mode'),
  formspec_changeset_open: (r, p) => handleChangesetOpen(r, p),
  formspec_changeset_close: (r, p, a) => handleChangesetClose(r, p, a.label),
  formspec_changeset_list: (r, p) => handleChangesetList(r, p),
  formspec_changeset_accept: (r, p, a) => handleChangesetAccept(r, p, a.group_indices),
  formspec_changeset_reject: (r, p, a) => handleChangesetReject(r, p, a.group_indices),
};

/** Result of a tool call. */
export interface ToolCallResult {
  content: string;
  isError: boolean;
}

/** Tool declaration for AI consumption. */
export interface ToolDeclaration {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ToolDispatch {
  /** Tool declarations for AI adapter tool lists. */
  declarations: ToolDeclaration[];
  /** Call a tool by name with arguments. Returns the MCP response as a string. */
  call(name: string, args: Record<string, unknown>): ToolCallResult;
}

/**
 * Creates an in-process tool dispatcher for the given project.
 * Calls MCP tool handler functions directly — no transport, no serialization.
 */
export function createToolDispatch(registry: ProjectRegistry, projectId: string): ToolDispatch {
  const declarations: ToolDeclaration[] = Object.keys(TOOL_HANDLERS).map((name) => ({
    name,
    description: `Formspec authoring tool: ${name.replace(/_/g, ' ')}`,
    inputSchema: {},
  }));

  return {
    declarations,
    call(name: string, args: Record<string, unknown>): ToolCallResult {
      const handler = TOOL_HANDLERS[name];
      if (!handler) {
        return { content: `Unknown tool: ${name}`, isError: true };
      }
      try {
        const result = handler(registry, projectId, args);
        if (result && Array.isArray(result.content)) {
          const text = result.content.map((c: any) => c.text ?? '').join('');
          return { content: text, isError: !!result.isError };
        }
        return { content: JSON.stringify(result), isError: false };
      } catch (err) {
        return {
          content: err instanceof Error ? err.message : String(err),
          isError: true,
        };
      }
    },
  };
}
