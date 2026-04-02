/** @filedesc MCP tool for component tree management: list, add, set property, remove nodes. */
import type { ProjectRegistry } from '../registry.js';
import { successResponse, errorResponse, formatToolError } from '../errors.js';
import { HelperError } from '@formspec-org/studio-core';
import type { Project } from '@formspec-org/studio-core';

type ComponentAction = 'list_nodes' | 'set_node_property' | 'add_node' | 'remove_node';

interface NodeRef {
  bind?: string;
  nodeId?: string;
}

interface ComponentParams {
  action: ComponentAction;
  // For add_node
  parent?: NodeRef;
  component?: string;
  bind?: string;
  props?: Record<string, unknown>;
  // For set_node_property
  node?: NodeRef;
  property?: string;
  value?: unknown;
}

export function handleComponent(
  registry: ProjectRegistry,
  projectId: string,
  params: ComponentParams,
) {
  try {
    const project = registry.getProject(projectId);

    switch (params.action) {
      case 'list_nodes':
        return listNodes(project);

      case 'add_node':
        return addNode(project, params);

      case 'set_node_property':
        return setNodeProperty(project, params);

      case 'remove_node':
        return removeNode(project, params);
    }
  } catch (err) {
    if (err instanceof HelperError) {
      return errorResponse(formatToolError(err.code, err.message, err.detail as Record<string, unknown>));
    }
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(formatToolError('COMMAND_FAILED', message));
  }
}

// ── Internal helpers ─────────────────────────────────────────────────

function listNodes(project: Project) {
  const componentDoc = project.component;
  const tree = (componentDoc as any)?.tree ?? null;
  return successResponse({ tree });
}

function addNode(project: Project, params: ComponentParams) {
  try {
    const payload: Record<string, unknown> = {
      parent: params.parent!,
      component: params.component!,
    };
    if (params.bind) payload.bind = params.bind;
    if (params.props) payload.props = params.props;

    const result = (project as any).core.dispatch({ type: 'component.addNode', payload });
    return successResponse({
      summary: `Added ${params.component} node`,
      nodeRef: result?.nodeRef,
      affectedPaths: [],
      warnings: [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(formatToolError('COMMAND_FAILED', message));
  }
}

function setNodeProperty(project: Project, params: ComponentParams) {
  try {
    (project as any).core.dispatch({
      type: 'component.setNodeProperty',
      payload: {
        node: params.node!,
        property: params.property!,
        value: params.value,
      },
    });
    return successResponse({
      summary: `Set ${params.property} on node`,
      affectedPaths: [],
      warnings: [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(formatToolError('COMMAND_FAILED', message));
  }
}

function removeNode(project: Project, params: ComponentParams) {
  try {
    (project as any).core.dispatch({
      type: 'component.deleteNode',
      payload: { node: params.node! },
    });
    return successResponse({
      summary: `Removed node`,
      affectedPaths: [],
      warnings: [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(formatToolError('COMMAND_FAILED', message));
  }
}
