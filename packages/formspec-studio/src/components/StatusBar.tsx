/** @filedesc Bottom status bar showing form status, field count, health chip, and Ask AI with metrics behind an advanced menu. */
import { useState, useEffect, useMemo } from 'react';
import { countDefinitionFields, getStudioIntelligence } from '@formspec-org/studio-core';
import { useProjectState } from '../state/useProjectState';
import { useProject } from '../state/useProject';
import { dispatchStudioEvent, STUDIO_EVENTS } from '../studio-events';

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
    ? 'text-emerald-600 bg-emerald-50 border-emerald-100 dark:text-emerald-400 dark:bg-emerald-950/30 dark:border-emerald-800'
    : status === 'retired'
      ? 'text-slate-500 bg-slate-50 border-slate-100 dark:text-slate-400 dark:bg-slate-900/30 dark:border-slate-800'
      : 'text-amber-600 bg-amber-50 border-amber-100 dark:text-amber-400 dark:bg-amber-950/30 dark:border-amber-800';

  const healthTone = totalIssues === 0
    ? 'text-emerald-600 bg-emerald-50 border-emerald-100 dark:text-emerald-400 dark:bg-emerald-950/30 dark:border-emerald-800'
    : validationErrorCount > 0
      ? 'text-rose-600 bg-rose-50 border-rose-100 dark:text-rose-400 dark:bg-rose-950/30 dark:border-rose-800'
      : 'text-amber-600 bg-amber-50 border-amber-100 dark:text-amber-400 dark:bg-amber-950/30 dark:border-amber-800';

  const healthLabel = totalIssues === 0
    ? 'System Healthy'
    : validationErrorCount > 0
      ? `${validationErrorCount} error${validationErrorCount === 1 ? '' : 's'}`
      : `${validationWarningCount + layoutDriftCount + openPatchCount + evidenceGapCount} warning${validationWarningCount + layoutDriftCount + openPatchCount + evidenceGapCount === 1 ? '' : 's'}`;

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenIssues = () => {
    dispatchStudioEvent(STUDIO_EVENTS.OPEN_SETTINGS);
  };

  const handleAskAI = () => {
    if (onAskAI) {
      onAskAI();
    } else {
      dispatchStudioEvent(STUDIO_EVENTS.OPEN_ASSISTANT_WORKSPACE, {});
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
      className="sticky bottom-0 z-40 flex min-h-[32px] items-center justify-between gap-6 border-t border-border px-3 py-1 font-ui shrink-0 shadow-sm bg-surface"
    >
      <div className="flex min-w-0 flex-1 items-center gap-4 overflow-x-auto scrollbar-none">
        <div className="flex shrink-0 items-center gap-2 mr-2">
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-accent/[0.08] text-accent">
            <span className="font-display text-[11px] font-bold">S</span>
          </div>
          <span className="text-[10px] font-bold tracking-normal text-muted uppercase">FS {formspecVersion}</span>
        </div>

        <span className={`status-chip ${statusTone}`}>
          {status}
        </span>

        <span className="flex shrink-0 items-center gap-1.5 text-[10px] font-bold text-muted group cursor-default">
          <span className="text-[12px] leading-none text-muted group-hover:text-accent transition-colors duration-200" aria-hidden="true">▦</span>
          <span className="text-muted group-hover:text-ink transition-colors duration-200">{plural(fieldCount, 'field')}</span>
        </span>

        <button
          type="button"
          onClick={handleOpenIssues}
          className={`status-chip ${healthTone}`}
          data-testid="health-chip"
        >
          {healthLabel}
        </button>

        <button
          type="button"
          onClick={handleAskAI}
          className="shrink-0 rounded-sm border border-border bg-subtle px-2 py-0.5 text-[9px] font-bold uppercase tracking-normal text-muted hover:text-ink hover:bg-surface transition-all duration-200 shadow-sm"
        >
          Ask AI
        </button>

        <button
          type="button"
          onClick={() => dispatchStudioEvent(STUDIO_EVENTS.PUBLISH_PROJECT)}
          className="shrink-0 rounded-sm bg-accent px-3 py-1 text-[9px] font-bold uppercase tracking-normal text-surface hover:bg-accent/90 shadow-sm"
        >
          Publish
        </button>

        {variant !== 'assistant' && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className={`shrink-0 flex items-center justify-center w-6 h-6 rounded border border-border/60 text-[12px] font-bold transition-all duration-200 ${menuOpen ? 'bg-accent text-surface border-accent' : 'text-muted hover:bg-subtle hover:text-ink'}`}
              aria-label="More metrics"
              aria-expanded={menuOpen}
            >
              <span className={menuOpen ? 'rotate-90' : ''}>⋯</span>
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="bottom-full left-0 mb-2 w-64 dropdown-panel">
                  <div className="p-2 space-y-0.5">
                    <div className="px-1 pb-1 text-[9px] font-bold uppercase tracking-normal text-muted">Intelligence Metrics</div>
                    <div
                      data-testid="status-metric-binds"
                      className="flex items-center justify-between px-2 py-1.5 text-[12px] font-bold text-muted rounded hover:bg-subtle transition-colors"
                    >
                      <span>Data connections</span>
                      <span className="text-ink font-bold">{bindCount}</span>
                    </div>
                    <div
                      data-testid="status-metric-shapes"
                      className="flex items-center justify-between px-2 py-1.5 text-[12px] font-bold text-muted rounded hover:bg-subtle transition-colors"
                    >
                      <span>Cross-field rules</span>
                      <span className="text-ink font-bold">{shapeCount}</span>
                    </div>
                    <div className="flex items-center justify-between px-2 py-1.5 text-[12px] font-bold text-muted rounded hover:bg-subtle transition-colors">
                      <span>Documents linked</span>
                      <span className="text-ink font-bold">{evidence.linkedFields}/{evidence.totalFields}</span>
                    </div>
                    <div className="flex items-center justify-between px-2 py-1.5 text-[12px] font-bold text-muted rounded hover:bg-subtle transition-colors">
                      <span>AI Changes</span>
                      <span className="text-ink font-bold">{confirmedProvenanceCount}</span>
                    </div>
                    <div className="flex items-center justify-between px-2 py-1.5 text-[12px] font-bold text-muted rounded hover:bg-subtle transition-colors">
                      <span>Layout drift</span>
                      <span className={`${layoutDriftCount > 0 ? 'text-amber-600 font-bold' : 'text-ink font-bold'}`}>{layoutDriftCount}</span>
                    </div>
                  </div>
                  
                  <div className="border-t border-border/40 p-1">
                    <button
                      type="button"
                      onClick={handleToggleAdvanced}
                      className="w-full text-center py-1 text-[9px] font-bold uppercase tracking-normal text-muted hover:text-accent hover:bg-accent/[0.04] rounded transition-all"
                    >
                      {advanced ? 'Collapse System Stats' : 'Expand System Stats'}
                    </button>
                  </div>

                  {advanced && (
                    <div className="p-2 space-y-1 border-t border-border/40 bg-subtle/20 rounded-b">
                      <div className="px-1 py-0.5 text-[10px] font-mono text-muted flex justify-between"><span>binds</span><span>{bindCount}</span></div>
                      <div className="px-1 py-0.5 text-[10px] font-mono text-muted flex justify-between"><span>shapes</span><span>{shapeCount}</span></div>
                      <div className="px-1 py-0.5 text-[10px] font-mono text-muted flex justify-between"><span>evidence</span><span>{evidence.linkedFields}/{evidence.totalFields}</span></div>
                      <div className="px-1 py-0.5 text-[10px] font-mono text-muted flex justify-between"><span>errors</span><span className="text-error">{validationErrorCount}</span></div>
                      <div className="px-1 py-0.5 text-[10px] font-mono text-muted flex justify-between"><span>warnings</span><span className="text-amber-500">{validationWarningCount}</span></div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {definition.url && (
        <div className="ml-6 hidden min-w-0 shrink-0 items-center gap-3 lg:flex">
          <div className="flex flex-col items-end -space-y-0.5">
            <span className="text-[8px] font-bold uppercase tracking-normal text-muted">Live Environment</span>
            <a
              href={definition.url}
              target="_blank"
              rel="noopener noreferrer"
              className="max-w-[240px] truncate text-[10px] font-bold text-muted hover:text-accent transition-all focus-ring"
            >
              {definition.url.replace(/^https?:\/\//, '')}
            </a>
          </div>
          <button
            type="button"
            onClick={() => handleCopyUrl(definition.url)}
            className={`rounded-sm border border-border px-2 py-0.5 text-[9px] font-bold uppercase tracking-normal transition-all duration-200 shadow-sm ${copied ? 'bg-emerald-500 border-emerald-500 text-surface' : 'text-muted hover:bg-subtle hover:text-ink hover:border-accent/40'}`}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      )}
    </footer>
  );
}
