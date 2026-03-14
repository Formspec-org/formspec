import type { InquestSessionV1 } from '../shared/contracts/inquest';
import type { ConnectionResult } from '../shared/contracts/inquest';

/* ── Constants ────────────────────────────────── */

const PHASE_ORDER = ['inputs', 'review', 'refine'] as const;

/* ── Formspec icon ────────────────────────────── */

export function FormspecIcon({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <rect x="2" y="1.5" width="8" height="2" rx=".4" fill={color} />
      <rect x="2" y="5" width="8" height="2" rx=".4" fill={color} fillOpacity=".7" />
      <rect x="2" y="8.5" width="8" height="2" rx=".4" fill={color} fillOpacity=".4" />
    </svg>
  );
}

/* ── Header ───────────────────────────────────── */

interface AppHeaderProps {
  phase: InquestSessionV1['phase'];
  phaseIndex: number;
  sessionTitle: string;
  saveState: 'idle' | 'saving' | 'saved' | 'error';
  connection: ConnectionResult | undefined;
  providerLabel: string;
  onNavigateToPhase?: (phase: InquestSessionV1['phase']) => void;
}

export function AppHeader({
  phase,
  phaseIndex,
  sessionTitle,
  saveState,
  connection,
  providerLabel,
  onNavigateToPhase,
}: AppHeaderProps) {
  return (
    <header className="relative flex h-[60px] shrink-0 items-center justify-between border-b border-warm-border bg-white px-6 shadow-sm">
      {/* Logo + title */}
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent shadow-sm">
          <FormspecIcon size={14} color="white" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight leading-none">Stack Builder</h1>
          {phase === 'inputs' ? (
            <div className="mt-0.5 text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400">
              Formspec AI Assistant
            </div>
          ) : (
            <div className="mt-0.5 max-w-[200px] truncate text-[11px] font-medium text-slate-500">
              {sessionTitle}
            </div>
          )}
        </div>
      </div>

      {/* Phase stepper — centered */}
      <nav className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1" aria-label="Workflow phases">
        {PHASE_ORDER.map((p, i) => {
          const isCurrent = phase === p;
          const isDone = phaseIndex > i;
          const isNavigable = isDone && onNavigateToPhase;
          return (
            <div key={p} className="flex items-center gap-1">
              {i > 0 && (
                <div className={`w-5 h-px transition-colors ${isDone ? 'bg-accent/40' : 'bg-slate-200'}`} />
              )}
              <button
                type="button"
                disabled={!isNavigable}
                onClick={() => isNavigable && onNavigateToPhase(p)}
                className={[
                  'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all',
                  isCurrent ? 'bg-accent/8 text-accent' : isDone ? 'text-slate-400 hover:text-accent cursor-pointer' : 'text-slate-300 cursor-default',
                  isNavigable ? 'hover:bg-accent/5' : '',
                ].join(' ')}
              >
                <div className={[
                  'flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold transition-all',
                  isDone
                    ? 'bg-accent/15 text-accent'
                    : isCurrent
                      ? 'bg-accent text-white'
                      : 'border border-slate-200 text-slate-300',
                ].join(' ')}>
                  {isDone ? '✓' : i + 1}
                </div>
                <span className="capitalize tracking-wide">{p}</span>
              </button>
            </div>
          );
        })}
      </nav>

      {/* Right: save state + provider status */}
      <div className="flex items-center gap-3">
        {saveState === 'saving' && (
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
            <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-200 border-t-slate-400" />
            Saving…
          </span>
        )}
        {saveState === 'saved' && (
          <span className="text-[11px] font-medium text-emerald-500">Saved</span>
        )}
        {saveState === 'error' && (
          <span className="text-[11px] font-medium text-red-500">Save failed</span>
        )}

        <div className="flex items-center gap-2 rounded-full border border-slate-100 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500">
          <div className={`h-1.5 w-1.5 rounded-full transition-colors ${connection?.ok ? 'bg-emerald-400' : 'bg-slate-300'}`} />
          {providerLabel}
        </div>
      </div>
    </header>
  );
}
