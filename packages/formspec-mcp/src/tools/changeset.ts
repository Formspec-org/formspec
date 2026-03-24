/** @filedesc MCP tools for changeset lifecycle management. */
import type { ProjectRegistry } from '../registry.js';
import { successResponse, errorResponse, formatToolError } from '../errors.js';
import type { Project, ProposalManager, Changeset, MergeResult } from 'formspec-studio-core';

/**
 * Handle formspec_changeset_open: start a new changeset.
 */
export function handleChangesetOpen(registry: ProjectRegistry, projectId: string) {
  try {
    const project = registry.getProject(projectId);
    const pm = getProposalManager(project);
    const id = pm.openChangeset();
    return successResponse({
      changeset_id: id,
      status: 'open',
      message: 'Changeset opened. All subsequent mutations are recorded as proposals.',
    });
  } catch (err) {
    return errorResponse(formatToolError(
      'CHANGESET_OPEN_FAILED',
      err instanceof Error ? err.message : String(err),
    ));
  }
}

/**
 * Handle formspec_changeset_close: seal the changeset and compute dependency groups.
 */
export function handleChangesetClose(registry: ProjectRegistry, projectId: string, label: string) {
  try {
    const project = registry.getProject(projectId);
    const pm = getProposalManager(project);
    pm.closeChangeset(label);

    const cs = pm.changeset!;
    return successResponse({
      changeset_id: cs.id,
      status: 'pending',
      label: cs.label,
      ai_entry_count: cs.aiEntries.length,
      user_overlay_count: cs.userOverlay.length,
      dependency_groups: cs.dependencyGroups.map((g, i) => ({
        index: i,
        entry_count: g.entries.length,
        reason: g.reason,
      })),
    });
  } catch (err) {
    return errorResponse(formatToolError(
      'CHANGESET_CLOSE_FAILED',
      err instanceof Error ? err.message : String(err),
    ));
  }
}

/**
 * Handle formspec_changeset_list: list changesets with status and summaries.
 */
export function handleChangesetList(registry: ProjectRegistry, projectId: string) {
  try {
    const project = registry.getProject(projectId);
    const pm = getProposalManager(project);
    const cs = pm.changeset;

    if (!cs) {
      return successResponse({ changesets: [] });
    }

    return successResponse({
      changesets: [formatChangesetSummary(cs)],
    });
  } catch (err) {
    return errorResponse(formatToolError(
      'CHANGESET_LIST_FAILED',
      err instanceof Error ? err.message : String(err),
    ));
  }
}

/**
 * Handle formspec_changeset_accept: accept a pending changeset.
 */
export function handleChangesetAccept(
  registry: ProjectRegistry,
  projectId: string,
  groupIndices?: number[],
) {
  try {
    const project = registry.getProject(projectId);
    const pm = getProposalManager(project);
    const result = pm.acceptChangeset(groupIndices);

    return formatMergeResult(result, pm.changeset!);
  } catch (err) {
    return errorResponse(formatToolError(
      'CHANGESET_ACCEPT_FAILED',
      err instanceof Error ? err.message : String(err),
    ));
  }
}

/**
 * Handle formspec_changeset_reject: reject a pending changeset.
 */
export function handleChangesetReject(registry: ProjectRegistry, projectId: string) {
  try {
    const project = registry.getProject(projectId);
    const pm = getProposalManager(project);
    const result = pm.rejectChangeset();

    return formatMergeResult(result, pm.changeset!);
  } catch (err) {
    return errorResponse(formatToolError(
      'CHANGESET_REJECT_FAILED',
      err instanceof Error ? err.message : String(err),
    ));
  }
}

/**
 * Wraps a mutation tool handler to auto-bracket with beginEntry/endEntry
 * when a changeset is open. This ensures all MCP tool mutations are
 * properly tracked in the changeset's AI entries.
 *
 * When no changeset is open, the handler executes directly.
 */
export function withChangesetBracket<T>(
  project: Project,
  toolName: string,
  fn: () => T,
): T {
  const pm = project.proposals;
  if (!pm || !pm.changeset || pm.changeset.status !== 'open') {
    return fn();
  }

  pm.beginEntry(toolName);
  try {
    const result = fn();
    // Extract summary from HelperResult if applicable
    const summary = (result && typeof result === 'object' && 'summary' in (result as any))
      ? (result as any).summary
      : `${toolName} executed`;
    const warnings = (result && typeof result === 'object' && 'warnings' in (result as any))
      ? ((result as any).warnings ?? []).map((w: any) => typeof w === 'string' ? w : w.message ?? String(w))
      : [];
    pm.endEntry(summary, warnings);
    return result;
  } catch (err) {
    // Still end the entry on error so actor is reset to 'user'
    pm.endEntry(`${toolName} failed: ${err instanceof Error ? err.message : String(err)}`);
    throw err;
  }
}

// ── Helpers ─────────────────────────────────────────────────────────

function getProposalManager(project: Project): ProposalManager {
  const pm = project.proposals;
  if (!pm) {
    throw new Error('Changeset support is not enabled for this project');
  }
  return pm;
}

function formatChangesetSummary(cs: Readonly<Changeset>) {
  return {
    id: cs.id,
    status: cs.status,
    label: cs.label,
    ai_entry_count: cs.aiEntries.length,
    user_overlay_count: cs.userOverlay.length,
    ai_entries: cs.aiEntries.map((e, i) => ({
      index: i,
      toolName: e.toolName,
      summary: e.summary,
      affectedPaths: e.affectedPaths,
      warnings: e.warnings,
    })),
    dependency_groups: cs.dependencyGroups.map((g, i) => ({
      index: i,
      entry_count: g.entries.length,
      reason: g.reason,
      entries: g.entries,
    })),
  };
}

function formatMergeResult(result: MergeResult, cs: Readonly<Changeset>) {
  if (result.ok) {
    const diag = result.diagnostics;
    return successResponse({
      status: cs.status,
      ok: true,
      diagnostics: {
        error_count: diag.counts.error,
        warning_count: diag.counts.warning,
        info_count: diag.counts.info,
      },
    });
  }

  if ('replayFailure' in result) {
    return errorResponse(formatToolError(
      'REPLAY_FAILED',
      `Replay failed during ${result.replayFailure.phase} phase at entry ${result.replayFailure.entryIndex}: ${result.replayFailure.error.message}`,
      {
        phase: result.replayFailure.phase,
        entryIndex: result.replayFailure.entryIndex,
      },
    ));
  }

  // Validation failure
  const diag = result.diagnostics;
  return errorResponse(formatToolError(
    'VALIDATION_FAILED',
    `Merge blocked by ${diag.counts.error} structural error(s)`,
    {
      errors: diag.structural.filter(d => d.severity === 'error'),
    },
  ));
}
