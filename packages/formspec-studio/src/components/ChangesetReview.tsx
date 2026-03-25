/** @filedesc Changeset merge review UI — displays AI proposals with dependency groups for accept/reject. */
import { DependencyGroup } from './DependencyGroup.js';
import type { DependencyGroupEntry } from './DependencyGroup.js';

/** A single AI-proposed change entry. */
export interface ChangesetEntry {
  toolName?: string;
  summary?: string;
  affectedPaths: string[];
  warnings: string[];
}

/** A single user overlay entry. */
export interface UserOverlayEntry {
  summary?: string;
  affectedPaths: string[];
}

/** Dependency group descriptor (indices into aiEntries). */
export interface ChangesetDependencyGroup {
  entries: number[];
  reason: string;
}

/** The changeset data displayed by this component. */
export interface ChangesetReviewData {
  id: string;
  status: string;
  label: string;
  aiEntries: ChangesetEntry[];
  userOverlay: UserOverlayEntry[];
  dependencyGroups: ChangesetDependencyGroup[];
}

export interface ChangesetReviewProps {
  changeset: ChangesetReviewData;
  onAcceptGroup: (groupIndex: number) => void;
  onRejectGroup: (groupIndex: number) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
}

/** Status badge color map. */
const statusStyles: Record<string, string> = {
  open: 'bg-accent/10 text-accent border-accent/20',
  pending: 'bg-amber/10 text-amber border-amber/20',
  merged: 'bg-green/10 text-green border-green/20',
  rejected: 'bg-error/10 text-error border-error/20',
};

/**
 * Changeset merge review UI.
 *
 * Renders a full changeset with:
 * - Header showing changeset ID, label, and lifecycle status
 * - Dependency groups computed by ProposalManager, each expandable
 * - Accept/Reject buttons per group and for the entire changeset
 * - Visual distinction between AI entries (in groups) and user overlay
 */
export function ChangesetReview({
  changeset,
  onAcceptGroup,
  onRejectGroup,
  onAcceptAll,
  onRejectAll,
}: ChangesetReviewProps) {
  const isTerminal = changeset.status === 'merged' || changeset.status === 'rejected';
  const statusClass = statusStyles[changeset.status] ?? statusStyles.pending;

  // Build DependencyGroupEntry arrays from changeset data
  const groupEntries: DependencyGroupEntry[][] = changeset.dependencyGroups.map(
    (group) =>
      group.entries.map((entryIndex) => {
        const entry = changeset.aiEntries[entryIndex];
        return {
          index: entryIndex,
          toolName: entry?.toolName,
          summary: entry?.summary,
          affectedPaths: entry?.affectedPaths ?? [],
          warnings: entry?.warnings ?? [],
        };
      }),
  );

  return (
    <div data-testid="changeset-review" className="flex flex-col gap-4 p-4">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-[15px] font-bold text-ink leading-tight">
              {changeset.label || 'Untitled changeset'}
            </h2>
            <span
              data-testid="changeset-status"
              className={`inline-flex items-center rounded-sm border text-xs px-1.5 py-0 font-semibold uppercase tracking-wider ${statusClass}`}
            >
              {changeset.status}
            </span>
          </div>
          <p className="font-mono text-[10px] text-muted mt-0.5">
            {changeset.id}
          </p>
        </div>
      </div>

      {/* ── Summary stats ───────────────────────────────────────── */}
      <div className="flex items-center gap-3 text-[11px] text-muted font-mono">
        <span>{changeset.aiEntries.length} AI {changeset.aiEntries.length === 1 ? 'entry' : 'entries'}</span>
        <span className="opacity-40">/</span>
        <span>{changeset.dependencyGroups.length} {changeset.dependencyGroups.length === 1 ? 'group' : 'groups'}</span>
        {changeset.userOverlay.length > 0 && (
          <>
            <span className="opacity-40">/</span>
            <span>{changeset.userOverlay.length} user {changeset.userOverlay.length === 1 ? 'edit' : 'edits'}</span>
          </>
        )}
      </div>

      {/* ── Bulk actions ────────────────────────────────────────── */}
      {!isTerminal && changeset.dependencyGroups.length > 0 && (
        <div className="flex gap-2">
          <button
            type="button"
            data-testid="accept-all"
            className="px-3 py-1.5 text-[12px] font-medium rounded-md border border-green/30 bg-green/10 text-green hover:bg-green/20 transition-colors"
            onClick={onAcceptAll}
          >
            Accept All
          </button>
          <button
            type="button"
            data-testid="reject-all"
            className="px-3 py-1.5 text-[12px] font-medium rounded-md border border-error/30 bg-error/10 text-error hover:bg-error/20 transition-colors"
            onClick={onRejectAll}
          >
            Reject All
          </button>
        </div>
      )}

      {/* ── Dependency groups ───────────────────────────────────── */}
      {changeset.dependencyGroups.length > 0 ? (
        <div data-testid="dependency-groups" className="space-y-2">
          <h3 className="font-mono text-[10px] font-bold tracking-[0.15em] uppercase text-muted">
            Dependency Groups
          </h3>
          {changeset.dependencyGroups.map((group, gi) => (
            <DependencyGroup
              key={gi}
              groupIndex={gi}
              reason={group.reason}
              entries={groupEntries[gi]}
              onAccept={onAcceptGroup}
              onReject={onRejectGroup}
              disabled={isTerminal}
            />
          ))}
        </div>
      ) : (
        <p className="text-[13px] text-muted italic">
          No dependency groups — changeset has no AI entries.
        </p>
      )}

      {/* ── User overlay ────────────────────────────────────────── */}
      {changeset.userOverlay.length > 0 && (
        <div data-testid="user-overlay" className="space-y-2">
          <h3 className="font-mono text-[10px] font-bold tracking-[0.15em] uppercase text-muted">
            Your Edits (preserved on merge)
          </h3>
          <div className="border border-border/60 rounded-lg divide-y divide-border/60">
            {changeset.userOverlay.map((entry, i) => (
              <div
                key={i}
                data-testid={`user-overlay-entry-${i}`}
                className="px-3 py-2 space-y-1"
              >
                {entry.summary && (
                  <p className="text-[13px] text-ink leading-snug">
                    {entry.summary}
                  </p>
                )}
                {entry.affectedPaths.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {entry.affectedPaths.map((path, j) => (
                      <span
                        key={j}
                        className="inline-flex items-center rounded-sm border bg-subtle text-muted border-border text-[10px] px-1.5 py-0 font-mono"
                      >
                        {path}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Terminal status message ─────────────────────────────── */}
      {isTerminal && (
        <div
          data-testid="changeset-terminal-status"
          className={`rounded-lg px-3 py-2.5 text-[12px] font-medium ${
            changeset.status === 'merged'
              ? 'bg-green/5 text-green border border-green/20'
              : 'bg-error/5 text-error border border-error/20'
          }`}
        >
          {changeset.status === 'merged'
            ? 'This changeset has been merged into the project.'
            : 'This changeset has been rejected. Changes were rolled back.'}
        </div>
      )}
    </div>
  );
}
