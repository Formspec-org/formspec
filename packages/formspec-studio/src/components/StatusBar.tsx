/** @filedesc Bottom status bar showing formspec version, form status, field count, and bind/shape counts with interactive enhancements. */
import { useState } from 'react';
import { countDefinitionFields, getStudioIntelligence } from '@formspec-org/studio-core';
import { useProjectState } from '../state/useProjectState';

function plural(n: number, singular: string): string {
  return `${n} ${singular}${n === 1 ? '' : 's'}`;
}

interface StatusBarProps {
  /** Hides intelligence rows that rarely matter before the tabbed workspace. */
  variant?: 'full' | 'assistant';
}

export function StatusBar({ variant = 'full' }: StatusBarProps) {
  const state = useProjectState();
  const { definition } = state;
  const [copied, setCopied] = useState(false);

  const formspecVersion = definition.$formspec ?? '1.0';
  const status = definition.status ?? 'draft';
  const items = definition.items ?? [];
  const fieldCount = countDefinitionFields(items);
  const bindCount = definition.binds?.length ?? 0;
  const shapeCount = definition.shapes?.length ?? 0;
  const intelligence = getStudioIntelligence(state);
  const evidence = intelligence.evidence.coverage;
  const confirmedProvenanceCount = intelligence.provenance.filter((entry) => entry.reviewStatus === 'confirmed').length;
  const openPatchCount = intelligence.patches.filter((patch) => patch.status === 'open').length;
  const layoutDriftCount = intelligence.layouts.reduce(
    (count, layout) => count + layout.drift.filter((entry) => entry.status === 'open').length,
    0,
  );

  const presentation = definition.formPresentation ?? {};
  const pageMode = presentation.pageMode;
  const defaultCurrency = presentation.defaultCurrency;
  const density = presentation.density;

  const statusTone = status === 'active'
    ? 'text-emerald-700 bg-emerald-500/10 border-emerald-500/25 dark:text-emerald-300 dark:bg-emerald-500/10 dark:border-emerald-400/25'
    : status === 'retired'
      ? 'text-slate-600 bg-slate-500/10 border-slate-400/25 dark:text-slate-300 dark:bg-slate-500/10 dark:border-slate-400/25'
      : 'text-amber-700 bg-amber-500/10 border-amber-500/25 dark:text-amber-300 dark:bg-amber-500/10 dark:border-amber-400/25';

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <footer
      data-testid="status-bar"
      className="relative flex min-h-12 items-center justify-between gap-4 border-t border-border/80 bg-[linear-gradient(180deg,rgba(255,252,247,0.98),rgba(248,241,231,0.95))] dark:bg-[linear-gradient(180deg,rgba(26,35,47,0.98),rgba(32,44,59,0.95))] px-4 py-2 font-mono shrink-0"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(39,87,199,0.24),transparent)]" />

      <div className="flex min-w-0 flex-1 items-center gap-4 overflow-x-auto scrollbar-none">
        <div className="flex shrink-0 items-center gap-2">
          <span className="font-display text-[17px] tracking-[-0.04em] text-ink">The Stack</span>
          <span className="text-[11px] uppercase tracking-[0.22em] text-muted">FORMSPEC {formspecVersion}</span>
        </div>

        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${statusTone}`}>
          {status}
        </span>

        <div className="hidden items-center gap-3 text-[11px] text-muted md:flex" aria-label={`Mode ${pageMode || 'standard'}, Currency ${(defaultCurrency as string) || 'USD'}, Density ${(density as string) || 'comfortable'}`}>
          <span className="flex items-center gap-2 uppercase tracking-[0.18em]">
            <span className="text-[16px] leading-none text-brass" aria-hidden="true">◫</span>
            Mode {pageMode || 'standard'}
          </span>
          <span className="text-border" aria-hidden="true">/</span>
          <span className="flex items-center gap-2 uppercase tracking-[0.18em]">
            <span className="text-[14px] leading-none text-teal" aria-hidden="true">$</span>
            Currency {(defaultCurrency as string) || 'USD'}
          </span>
          <span className="text-border" aria-hidden="true">/</span>
          <span className="flex items-center gap-2 uppercase tracking-[0.18em]">
            <span className="text-[15px] leading-none text-accent" aria-hidden="true">⋮⋮</span>
            Density {(density as string) || 'comfortable'}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-4 text-[11px] text-ink/88">
          <span className="flex items-center gap-2 uppercase tracking-[0.18em] text-muted">
            <span className="text-[19px] leading-none text-accent" aria-hidden="true">▦</span>
            <span><span className="text-accent">{plural(fieldCount, 'field')}</span></span>
          </span>
          <span className="hidden items-center gap-2 uppercase tracking-[0.18em] text-muted sm:flex">
            <span className="text-[18px] leading-none text-teal" aria-hidden="true">⇄</span>
            <span>{plural(bindCount, 'bind')}</span>
          </span>
          <span className="hidden items-center gap-2 uppercase tracking-[0.18em] text-muted md:flex">
            <span className="text-[18px] leading-none text-brass" aria-hidden="true">◯</span>
            <span>{plural(shapeCount, 'shape')}</span>
          </span>
          {variant !== 'assistant' && (
            <>
          <span className="hidden items-center gap-2 uppercase tracking-[0.18em] text-muted lg:flex">
            <span className="text-[16px] leading-none text-teal" aria-hidden="true">◬</span>
            <span>Evidence {evidence.linkedFields}/{evidence.totalFields}</span>
          </span>
          <span className="hidden items-center gap-2 uppercase tracking-[0.18em] text-muted xl:flex">
            <span className="text-[16px] leading-none text-accent" aria-hidden="true">◎</span>
            <span>Provenance {confirmedProvenanceCount}</span>
          </span>
          <span className="hidden items-center gap-2 uppercase tracking-[0.18em] text-muted 2xl:flex">
            <span className={`text-[16px] leading-none ${openPatchCount > 0 ? 'text-brass' : 'text-teal'}`} aria-hidden="true">⟟</span>
            <span>Patches open {openPatchCount}</span>
          </span>
          <span className="hidden items-center gap-2 uppercase tracking-[0.18em] text-muted xl:flex">
            <span className={`text-[16px] leading-none ${layoutDriftCount > 0 ? 'text-brass' : 'text-accent'}`} aria-hidden="true">◆</span>
            <span>Layout drift {layoutDriftCount}</span>
          </span>
            </>
          )}
        </div>
      </div>

      {definition.url && (
        <div className="ml-4 hidden min-w-0 shrink-0 items-center gap-2 sm:flex">
          <a
            href={definition.url}
            title={definition.url}
            className="max-w-[260px] truncate text-[11px] uppercase tracking-[0.16em] text-muted hover:text-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 rounded-[2px]"
          >
            {definition.url}
          </a>
          <button
            type="button"
            onClick={() => handleCopyUrl(definition.url)}
            title="Copy URL"
            className="rounded-[4px] border border-border/70 px-2.5 py-1 text-[11px] text-muted hover:bg-surface hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      )}
    </footer>
  );
}
