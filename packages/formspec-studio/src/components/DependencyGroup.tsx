/** @filedesc Collapsible dependency group within the changeset review UI — shows grouped entries with accept/reject. */
import { useState } from 'react';

/** A single entry within a dependency group. */
export interface DependencyGroupEntry {
  index: number;
  toolName?: string;
  summary?: string;
  affectedPaths: string[];
  warnings: string[];
}

export interface DependencyGroupProps {
  /** Zero-based group index. */
  groupIndex: number;
  /** Human-readable reason entries are grouped. */
  reason: string;
  /** Entries within this group. */
  entries: DependencyGroupEntry[];
  /** Called when the user accepts this group. */
  onAccept: (groupIndex: number) => void;
  /** Called when the user rejects this group. */
  onReject: (groupIndex: number) => void;
  /** Whether actions are disabled (e.g. changeset already merged/rejected). */
  disabled?: boolean;
}

/**
 * A single dependency group in the changeset review UI.
 *
 * Shows a header with entry count and reason, plus a collapsible list of
 * entries with their tool names, summaries, and affected paths. Accept and
 * Reject buttons allow the user to act on the entire group atomically.
 */
export function DependencyGroup({
  groupIndex,
  reason,
  entries,
  onAccept,
  onReject,
  disabled = false,
}: DependencyGroupProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      data-testid={`dependency-group-${groupIndex}`}
      className="border border-border rounded-lg overflow-hidden"
    >
      {/* Group header */}
      <button
        type="button"
        data-testid={`dependency-group-header-${groupIndex}`}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-subtle/30 hover:bg-subtle/60 transition-colors cursor-pointer"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <span
          className={`text-[10px] text-muted transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
          aria-hidden="true"
        >
          {expanded ? '\u25BC' : '\u25B6'}
        </span>
        <span className="font-mono text-[10px] font-bold tracking-[0.15em] uppercase text-muted">
          Group {groupIndex + 1}
        </span>
        <span className="inline-flex items-center rounded-sm border bg-subtle text-muted border-border text-xs px-1.5 py-0">
          {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
        </span>
        <span className="flex-1 text-left text-[11px] text-muted truncate">
          {reason}
        </span>
      </button>

      {/* Expanded entry list */}
      {expanded && (
        <div className="border-t border-border">
          <ul className="divide-y divide-border" role="list">
            {entries.map((entry) => (
              <li
                key={entry.index}
                data-testid={`dependency-group-entry-${entry.index}`}
                className="px-3 py-2.5 space-y-1"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-muted/70">
                    #{entry.index}
                  </span>
                  {entry.toolName && (
                    <span className="inline-flex items-center rounded-sm border bg-accent/10 text-accent border-accent/20 text-xs px-1.5 py-0 font-mono">
                      {entry.toolName}
                    </span>
                  )}
                </div>
                {entry.summary && (
                  <p className="text-[13px] text-ink leading-snug">
                    {entry.summary}
                  </p>
                )}
                {entry.affectedPaths.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {entry.affectedPaths.map((path, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center rounded-sm border bg-subtle text-muted border-border text-[10px] px-1.5 py-0 font-mono"
                      >
                        {path}
                      </span>
                    ))}
                  </div>
                )}
                {entry.warnings.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {entry.warnings.map((w, i) => (
                      <p key={i} className="text-[11px] text-amber flex items-center gap-1">
                        <span aria-hidden="true">!</span>
                        {w}
                      </p>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>

          {/* Group action buttons */}
          <div className="flex gap-2 px-3 py-2.5 bg-subtle/20 border-t border-border">
            <button
              type="button"
              data-testid={`accept-group-${groupIndex}`}
              disabled={disabled}
              className="px-3 py-1.5 text-[12px] font-medium rounded-md border border-green/30 bg-green/10 text-green hover:bg-green/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              onClick={() => onAccept(groupIndex)}
            >
              Accept Group
            </button>
            <button
              type="button"
              data-testid={`reject-group-${groupIndex}`}
              disabled={disabled}
              className="px-3 py-1.5 text-[12px] font-medium rounded-md border border-error/30 bg-error/10 text-error hover:bg-error/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              onClick={() => onReject(groupIndex)}
            >
              Reject Group
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
