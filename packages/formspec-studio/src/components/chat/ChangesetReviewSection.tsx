/** @filedesc Changeset review wrapper with diagnostics and merge message for the studio chat panel. */
import { useEffect, useRef, useState } from 'react';
import { ChangesetReview, type ChangesetReviewData } from '../ChangesetReview.js';
import { IconTriangleWarning as IconWarning, IconChevronRight } from '../icons/index.js';
import { MutationProvenancePanel } from './MutationProvenancePanel.js';
import { ProposedArtifactBlock } from './ProposedArtifactBlock.js';
import { Project } from '@formspec-org/studio-core';

interface DiagnosticEntry {
  severity: 'error' | 'warning';
  message: string;
  path?: string;
}

export interface ChangesetReviewSectionProps {
  changeset: ChangesetReviewData;
  diagnostics: DiagnosticEntry[];
  mergeMessage: string | null;
  onAcceptGroup: (groupIndex: number) => void;
  onRejectGroup: (groupIndex: number) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  /** When provided, renders the "What changes behind the scenes" provenance panel (ADR 0087). */
  project?: Project;
  /** Return to the chat thread. */
  onBack?: () => void;
}

const COMPACT_BREAKPOINT_PX = 420;

const isTerminal = (status: string) => status === 'merged' || status === 'rejected';

/** Watch the container's inline-size and report whether it's at-or-below the compact breakpoint. */
function useCompactContainer(threshold: number): [React.RefObject<HTMLDivElement | null>, boolean] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width;
        setCompact(width <= threshold);
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold]);

  return [ref, compact];
}

interface ReviewBodyProps extends Omit<ChangesetReviewSectionProps, 'project'> {
  project?: Project;
}

function ReviewBody({
  changeset,
  diagnostics,
  mergeMessage,
  onAcceptGroup,
  onRejectGroup,
  onAcceptAll,
  onRejectAll,
  project,
}: ReviewBodyProps) {
  return (
    <>
      {project && <div className="mx-4"><ProposedArtifactBlock project={project} changesetId={changeset.id} /></div>}
      
      <ChangesetReview
        changeset={changeset}
        onAcceptGroup={onAcceptGroup}
        onRejectGroup={onRejectGroup}
        onAcceptAll={onAcceptAll}
        onRejectAll={onRejectAll}
      />

      {project && <MutationProvenancePanel changeset={changeset} project={project} />}

      {diagnostics.length > 0 && (
        <div data-testid="merge-diagnostics" className="mx-4 space-y-2">
          <h3 className="font-mono text-[10px] font-bold tracking-[0.15em] uppercase text-muted">
            Diagnostics
          </h3>
          <div className="border border-border/60 rounded-lg divide-y divide-border/60">
            {diagnostics.map((d, i) => (
              <div
                key={i}
                data-testid={`diagnostic-${i}`}
                className={`px-3 py-2 flex items-start gap-2 text-[12px] ${
                  d.severity === 'error' ? 'bg-error/5 text-error' : 'bg-amber/5 text-amber'
                }`}
              >
                <IconWarning />
                <div className="min-w-0">
                  <p className="leading-snug">{d.message}</p>
                  {d.path && <span className="font-mono text-[10px] opacity-70">{d.path}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {mergeMessage && (
        <div
          data-testid="merge-message"
          className="mx-4 px-3 py-2 rounded-lg text-[12px] font-medium bg-subtle text-muted border border-border/40"
        >
          {mergeMessage}
        </div>
      )}
    </>
  );
}

export function ChangesetReviewSection(props: ChangesetReviewSectionProps) {
  const { changeset, onAcceptAll, onRejectAll } = props;
  const terminal = isTerminal(changeset.status);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [containerRef, compact] = useCompactContainer(COMPACT_BREAKPOINT_PX);

  // Auto-dismiss the drawer if the container resizes past the compact threshold.
  useEffect(() => {
    if (!compact && drawerOpen) setDrawerOpen(false);
  }, [compact, drawerOpen]);

  return (
    <div ref={containerRef} className="changeset-review-section">
      {compact ? (
        <div className="changeset-compact-bar">
          <div className="flex items-center gap-2 min-w-0 px-4 py-3">
            <span className="text-[12px] font-semibold text-ink truncate">{changeset.label || 'Changeset'}</span>
            <span className="text-[10px] font-mono text-muted shrink-0">{changeset.aiEntries.length} changes</span>
          </div>
          {!terminal && (
            <div className="flex items-center gap-2 shrink-0 pr-4">
              <button
                type="button"
                data-testid="compact-accept-all"
                className="px-2.5 py-1 text-[11px] font-medium rounded-md border border-green/30 bg-green/10 text-green hover:bg-green/20 transition-colors"
                onClick={onAcceptAll}
              >
                Accept
              </button>
              <button
                type="button"
                data-testid="compact-reject-all"
                className="px-2.5 py-1 text-[11px] font-medium rounded-md border border-error/30 bg-error/10 text-error hover:bg-error/20 transition-colors"
                onClick={onRejectAll}
              >
                Reject
              </button>
              <button
                type="button"
                data-testid="compact-view-details"
                className="px-2.5 py-1 text-[11px] font-medium rounded-md border border-border text-muted hover:text-ink hover:bg-subtle transition-colors flex items-center gap-1"
                onClick={() => setDrawerOpen(true)}
              >
                View <IconChevronRight size={10} />
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="changeset-full-review">
          {props.onBack && (
            <div className="px-4 py-2 border-b border-border/40 bg-bg-default/60 flex items-center gap-2">
              <button
                type="button"
                onClick={props.onBack}
                className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted hover:text-ink flex items-center gap-1 transition-colors"
              >
                ← Back to chat
              </button>
            </div>
          )}
          <ReviewBody {...props} />
        </div>
      )}

      {compact && drawerOpen && (
        <div className="changeset-drawer-overlay" onClick={() => setDrawerOpen(false)}>
          <div className="changeset-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
              <span className="text-[13px] font-semibold text-ink">{changeset.label || 'Changeset'}</span>
              <button
                type="button"
                aria-label="Close details"
                className="panel-close-btn"
                onClick={() => setDrawerOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto max-h-[60vh]">
              <ReviewBody {...props} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
