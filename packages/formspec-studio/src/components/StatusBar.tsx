/** @filedesc Bottom status bar showing form status, field count, health chip, and Ask AI with metrics behind an advanced menu. */
import { useState, useEffect, useMemo } from 'react';
import { countDefinitionFields, getStudioIntelligence } from '@formspec-org/studio-core';
import { useProjectState } from '../state/useProjectState';
import { useProject } from '../state/useProject';

function plural(n: number, singular: string): string {
  return `${n} ${singular}${n === 1 ? '' : 's'}`;
}

const ADVANCED_KEY = 'formspec-studio:status-bar-advanced';

function getAdvanced(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(ADVANCED_KEY) === 'true';
}

function setAdvanced(value: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ADVANCED_KEY, String(value));
}

interface StatusBarProps {
  variant?: 'full' | 'assistant';
  onAskAI?: () => void;
}

export function StatusBar({ variant = 'full', onAskAI }: StatusBarProps) {
  const state = useProjectState();
  const project = useProject();
  const [copied, setCopied] = useState(false);
  const [advanced, setAdvancedState] = useState(() => getAdvanced());
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setAdvanced(advanced);
  }, [advanced]);

  const { definition } = state;
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

  // Health computation
  const diagnostics = useMemo(() => project.diagnose(), [project]);
  const validationErrorCount = diagnostics.counts.error;
  const validationWarningCount = diagnostics.counts.warning;
  const evidenceGapCount = evidence.totalFields - evidence.linkedFields;
  const totalIssues = validationErrorCount + validationWarningCount + layoutDriftCount + openPatchCount + evidenceGapCount;

  const statusTone = status === 'active'
    ? 'text-emerald-700 bg-emerald-500/10 border-emerald-500/25 dark:text-emerald-300 dark:bg-emerald-500/10 dark:border-emerald-400/25'
    : status === 'retired'
      ? 'text-slate-600 bg-slate-500/10 border-slate-400/25 dark:text-slate-300 dark:bg-slate-500/10 dark:border-slate-400/25'
      : 'text-amber-700 bg-amber-500/10 border-amber-500/25 dark:text-amber-300 dark:bg-amber-500/10 dark:border-amber-400/25';

  const healthTone = totalIssues === 0
    ? 'text-emerald-700 bg-emerald-500/10 border-emerald-500/25 dark:text-emerald-300 dark:bg-emerald-500/10 dark:border-emerald-400/25'
    : validationErrorCount > 0
      ? 'text-red-700 bg-red-500/10 border-red-500/25 dark:text-red-300 dark:bg-red-500/10 dark:border-red-400/25'
      : 'text-amber-700 bg-amber-500/10 border-amber-500/25 dark:text-amber-300 dark:bg-amber-500/10 dark:border-amber-400/25';

  const healthLabel = totalIssues === 0
    ? 'Healthy'
    : validationErrorCount > 0
      ? `${validationErrorCount} error${validationErrorCount === 1 ? '' : 's'}`
      : `${validationWarningCount + layoutDriftCount + openPatchCount + evidenceGapCount} warning${validationWarningCount + layoutDriftCount + openPatchCount + evidenceGapCount === 1 ? '' : 's'}`;

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenIssues = () => {
    window.dispatchEvent(new CustomEvent('formspec:open-settings'));
  };

  const handleAskAI = () => {
    if (onAskAI) {
      onAskAI();
    } else {
      window.dispatchEvent(new CustomEvent('formspec:open-assistant-workspace'));
    }
  };

  const handleToggleAdvanced = () => {
    const next = !advanced;
    setAdvancedState(next);
    setAdvanced(next);
  };

  return (
    <footer
      data-testid="status-bar"
      className="relative flex min-h-[44px] items-center justify-between gap-4 border-t border-border/60 bg-surface/98 dark:bg-bg-default/98 px-4 py-1 font-ui shrink-0 shadow-premium"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(39,87,199,0.24),transparent)]" />

      <div className="flex min-w-0 flex-1 items-center gap-3 overflow-x-auto scrollbar-none">
        <div className="flex shrink-0 items-center gap-2">
          <span className="font-display text-[16px] tracking-tight text-ink font-semibold">The Stack</span>
          <span className="text-[10.5px] uppercase tracking-wider text-muted/60 font-medium">FS {formspecVersion}</span>
        </div>

        <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider ${statusTone}`}>
          {status}
        </span>

        <span className="flex shrink-0 items-center gap-1.5 uppercase tracking-wider text-muted text-[10.5px] font-medium">
          <span className="text-[16px] leading-none text-accent" aria-hidden="true">▦</span>
          <span className="text-accent/90">{plural(fieldCount, 'field')}</span>
        </span>

        <button
          type="button"
          onClick={handleOpenIssues}
          className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider ${healthTone} hover:opacity-80 transition-all`}
          data-testid="health-chip"
        >
          {healthLabel}
        </button>

        <button
          type="button"
          onClick={handleAskAI}
          className="shrink-0 rounded-full border border-accent/25 bg-accent/5 px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-accent hover:bg-accent/10 transition-all"
        >
          Ask AI
        </button>

        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('formspec:publish-project'))}
          className="shrink-0 rounded-full bg-accent px-3.5 py-1 text-[10.5px] font-bold uppercase tracking-wider text-white hover:bg-accent/90 transition-all shadow-sm active:scale-95"
        >
          Publish
        </button>

        {variant !== 'assistant' && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="shrink-0 rounded-full border border-border px-2 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted hover:bg-subtle hover:text-ink transition-colors"
              aria-label="More metrics"
              aria-expanded={menuOpen}
            >
              ⋯
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute bottom-full left-0 z-50 mb-2 w-56 rounded-lg border border-border bg-surface shadow-lg p-2 space-y-1">
                  <div
                    data-testid="status-metric-binds"
                    className="flex items-center justify-between px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-muted"
                  >
                    <span>Data connections</span>
                    <span className="text-ink">{bindCount}</span>
                  </div>
                  <div
                    data-testid="status-metric-shapes"
                    className="flex items-center justify-between px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-muted"
                  >
                    <span>Cross-field rules</span>
                    <span className="text-ink">{shapeCount}</span>
                  </div>
                  <div className="flex items-center justify-between px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-muted">
                    <span>Documents attached</span>
                    <span className="text-ink">{evidence.linkedFields}/{evidence.totalFields}</span>
                  </div>
                  <div className="flex items-center justify-between px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-muted">
                    <span>AI changes</span>
                    <span className="text-ink">{confirmedProvenanceCount}</span>
                  </div>
                  <div className="flex items-center justify-between px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-muted">
                    <span>Layout warnings</span>
                    <span className={`${layoutDriftCount > 0 ? 'text-brass' : 'text-ink'}`}>{layoutDriftCount}</span>
                  </div>
                  <div className="border-t border-border pt-1">
                    <button
                      type="button"
                      onClick={handleToggleAdvanced}
                      className="w-full text-left px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-muted hover:bg-subtle rounded transition-colors"
                    >
                      {advanced ? 'Hide advanced' : 'Show advanced'}
                    </button>
                  </div>
                  {advanced && (
                    <div className="space-y-1 border-t border-border pt-1">
                      <div className="px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-muted/60">Raw</div>
                      <div className="px-2 py-0.5 text-[11px] font-mono text-ink/70">bind: {bindCount}</div>
                      <div className="px-2 py-0.5 text-[11px] font-mono text-ink/70">shape: {shapeCount}</div>
                      <div className="px-2 py-0.5 text-[11px] font-mono text-ink/70">evidence: {evidence.linkedFields}/{evidence.totalFields}</div>
                      <div className="px-2 py-0.5 text-[11px] font-mono text-ink/70">provenance: {confirmedProvenanceCount}</div>
                      <div className="px-2 py-0.5 text-[11px] font-mono text-ink/70">patches: {openPatchCount}</div>
                      <div className="px-2 py-0.5 text-[11px] font-mono text-ink/70">layout drift: {layoutDriftCount}</div>
                      <div className="px-2 py-0.5 text-[11px] font-mono text-ink/70">validation errors: {validationErrorCount}</div>
                      <div className="px-2 py-0.5 text-[11px] font-mono text-ink/70">validation warnings: {validationWarningCount}</div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {definition.url && (
        <div className="ml-4 hidden min-w-0 shrink-0 items-center gap-2 sm:flex">
          <a
            href={definition.url}
            title={definition.url}
            className="max-w-[260px] truncate text-[10.5px] uppercase tracking-wider text-muted/60 hover:text-accent transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 rounded"
          >
            {definition.url}
          </a>
          <button
            type="button"
            onClick={() => handleCopyUrl(definition.url)}
            title="Copy URL"
            className="rounded-full border border-border/60 px-3 py-1 text-[10.5px] font-medium text-muted hover:bg-surface hover:text-ink transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-95"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      )}
    </footer>
  );
}
