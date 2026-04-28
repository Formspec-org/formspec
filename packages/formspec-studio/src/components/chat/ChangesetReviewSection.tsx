/** @filedesc Changeset review wrapper with diagnostics and merge message for the studio chat panel. */
import { ChangesetReview, type ChangesetReviewData } from '../ChangesetReview.js';
import { IconTriangleWarning as IconWarning } from '../icons/index.js';
import { MutationProvenancePanel } from './MutationProvenancePanel.js';
import type { Project } from '@formspec-org/studio-core';

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
}

export function ChangesetReviewSection({
  changeset,
  diagnostics,
  mergeMessage,
  onAcceptGroup,
  onRejectGroup,
  onAcceptAll,
  onRejectAll,
  project,
}: ChangesetReviewSectionProps) {
  return (
    <div className="space-y-4">
      <ChangesetReview
        changeset={changeset}
        onAcceptGroup={onAcceptGroup}
        onRejectGroup={onRejectGroup}
        onAcceptAll={onAcceptAll}
        onRejectAll={onRejectAll}
      />

      {project && (
        <MutationProvenancePanel changeset={changeset} project={project} />
      )}

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
    </div>
  );
}
