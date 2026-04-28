/** @filedesc "What changes behind the scenes" panel for AI-proposed changesets (ADR 0087). */
import { useMemo } from 'react';
import { getStudioIntelligence, type Project, type MutationClass } from '@formspec-org/studio-core';
import type { ChangesetReviewData } from '../ChangesetReview.js';

const MUTATION_CLASS_LABEL: Record<MutationClass, string> = {
  bind: 'Data connection',
  shape: 'Cross-field rule',
  Variable: 'Calculated value',
  Mapping: 'Field mapping',
  OptionSet: 'Reusable choices',
};

function normalizeRef(ref: string): string {
  return ref.replace(/^definition\./, '');
}

export interface MutationProvenancePanelProps {
  changeset: ChangesetReviewData;
  project: Project;
}

export function MutationProvenancePanel({ changeset, project }: MutationProvenancePanelProps) {
  const intelligence = useMemo(() => getStudioIntelligence(project), [project]);

  const affectedPaths = useMemo(() => {
    const refs = new Set<string>();
    for (const entry of changeset.aiEntries) {
      for (const path of entry.affectedPaths ?? []) refs.add(normalizeRef(path));
    }
    for (const entry of changeset.userOverlay) {
      for (const path of entry.affectedPaths ?? []) refs.add(normalizeRef(path));
    }
    return [...refs];
  }, [changeset]);

  const matchingProvenance = useMemo(() => {
    const sourceRef = `changeset.${changeset.id}`;
    const patchRef = `changeset:${changeset.id}`;
    return intelligence.provenance.filter(
      (p) => {
        if (!p.mutationClass) return false;
        if (!affectedPaths.includes(normalizeRef(p.objectRef))) return false;
        const matchesSource = (p.sourceRefs ?? []).includes(sourceRef);
        const matchesPatch = (p.patchRefs ?? []).includes(patchRef);
        return matchesSource || matchesPatch;
      },
    );
  }, [intelligence, affectedPaths, changeset.id]);

  if (matchingProvenance.length === 0) return null;

  return (
    <div data-testid="mutation-provenance-panel" className="mx-4 rounded-lg border border-border/60 bg-surface/50 p-3 space-y-2">
      <h3 className="font-mono text-[10px] font-bold tracking-[0.15em] uppercase text-muted">
        What changes behind the scenes
      </h3>
      <div className="space-y-1 divide-y divide-border/40">
        {matchingProvenance.map((p, i) => (
          <div key={`${p.objectRef}-${i}`} className="py-1.5">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                {MUTATION_CLASS_LABEL[p.mutationClass]}
              </span>
              <span className="font-mono text-[11px] text-muted">{p.objectRef}</span>
            </div>
            {p.beforeAfterSummary && (
              <p className="mt-1 text-[12px] text-ink">{p.beforeAfterSummary}</p>
            )}
            {p.rationale && (
              <p className="mt-0.5 text-[11px] italic text-muted">“{p.rationale}”</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
