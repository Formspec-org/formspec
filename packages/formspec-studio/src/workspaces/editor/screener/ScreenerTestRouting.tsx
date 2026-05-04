/** @filedesc Interactive routing verifier — evaluates routes against sample answers (P5.2). */
import { useState, useMemo, useCallback } from 'react';
import { wasmEvaluateScreenerDocument } from '@formspec-org/engine';
import type { ScreenerDocument, DeterminationRecord, PhaseResult, RouteResult } from '@formspec-org/types';
import { useScreener } from '../../../state/useScreener';
import { ExpandableCard } from '../../../components/shared/ExpandableCard';
import { IconActivity } from '../../../components/icons';

type ScreenerItem = { key: string; type: string; dataType?: string; label?: string; choices?: { value: string; label?: string }[]; [k: string]: unknown };

function inputForItem(item: ScreenerItem): React.ReactNode {
  const dataType = item.dataType ?? inferDataType(item.type);
  switch (dataType) {
    case 'boolean':
      return 'boolean';
    case 'choice':
      return 'choice';
    case 'integer':
    case 'money':
      return 'number';
    case 'date':
      return 'date';
    default:
      return 'text';
  }
}

function inferDataType(type: string): string {
  if (type === 'field') return 'string';
  return type;
}

function BooleanInput({ value, onChange }: { value: boolean | undefined; onChange: (v: boolean) => void }) {
  return (
    <div className="flex gap-1">
      <button
        type="button"
        className={`px-3 py-1 rounded-md text-[12px] font-medium transition-colors ${value === true ? 'bg-accent text-white' : 'bg-surface border border-border text-muted hover:border-muted'}`}
        onClick={() => onChange(true)}
      >
        Yes
      </button>
      <button
        type="button"
        className={`px-3 py-1 rounded-md text-[12px] font-medium transition-colors ${value === false ? 'bg-accent text-white' : 'bg-surface border border-border text-muted hover:border-muted'}`}
        onClick={() => onChange(false)}
      >
        No
      </button>
    </div>
  );
}

function ChoiceInput({ value, choices, onChange }: { value: string | undefined; choices: { value: string; label?: string }[]; onChange: (v: string) => void }) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className="bg-transparent border border-border rounded-lg px-2 py-1 text-[12px] text-ink outline-none focus:border-accent"
    >
      <option value="">—</option>
      {choices.map((c) => (
        <option key={c.value} value={c.value}>{c.label ?? c.value}</option>
      ))}
    </select>
  );
}

function NumberInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="0"
      className="w-24 bg-transparent border border-border rounded-lg px-2 py-1 text-[12px] text-ink outline-none focus:border-accent"
    />
  );
}

function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-transparent border border-border rounded-lg px-2 py-1 text-[12px] text-ink outline-none focus:border-accent"
    />
  );
}

function TextInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Enter value"
      className="w-40 bg-transparent border border-border rounded-lg px-2 py-1 text-[12px] text-ink outline-none focus:border-accent"
    />
  );
}

function RouteHighlight({ route, matched }: { route: RouteResult | null; matched: boolean }) {
  if (!route) {
    return (
      <div className={`rounded-lg px-3 py-2 text-[12px] ${matched ? 'bg-amber/10 border border-amber/30 text-ink' : 'bg-surface border border-border text-muted'}`}>
        No match
      </div>
    );
  }
  return (
    <div className={`rounded-lg px-3 py-2 text-[12px] transition-colors ${matched ? 'bg-accent/10 border border-accent/30 text-ink' : 'bg-surface border border-border text-muted'}`}>
      <span className="font-semibold">{route.label ?? route.target}</span>
      {route.message && <span className="ml-2 text-muted">— {route.message}</span>}
      <div className="mt-0.5 text-[10px] text-muted font-mono">{route.target}</div>
      {route.score !== undefined && <div className="mt-0.5 text-[10px]">Score: {route.score}</div>}
    </div>
  );
}

export function ScreenerTestRouting() {
  const screener = useScreener() as ScreenerDocument | null;
  const items = (screener?.items ?? []) as ScreenerItem[];
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [isOpen, setIsOpen] = useState(false);

  const setAnswer = useCallback((key: string, value: unknown) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }, []);

  const clearAnswers = useCallback(() => {
    setAnswers({});
  }, []);

  const determination = useMemo<DeterminationRecord | null>(() => {
    if (!screener || items.length === 0) return null;
    try {
      return wasmEvaluateScreenerDocument(screener, answers);
    } catch {
      return null;
    }
  }, [screener, items, answers]);

  const firstMatchPerPhase = useMemo(() => {
    if (!determination) return new Map<string, RouteResult | null>();
    const map = new Map<string, RouteResult | null>();
    for (const phase of determination.phases) {
      map.set(phase.id, phase.matched[0] ?? null);
    }
    return map;
  }, [determination]);

  if (!screener || items.length === 0) return null;

  const hasAnyAnswer = Object.keys(answers).some((k) => answers[k] !== undefined && answers[k] !== '');

  return (
    <ExpandableCard
      data-testid="screener-test-routing"
      expanded={isOpen}
      onToggle={() => setIsOpen(!isOpen)}
      header={
        <div className="flex items-center gap-2">
          <IconActivity className="w-4 h-4 text-accent" />
          <span className="text-[13px] font-semibold text-ink">Test Routing</span>
          {determination?.status && (
            <span className="text-[10px] font-mono text-muted uppercase">{determination.status}</span>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-[12px] text-muted">
          Answer the screening questions to see which route would match.
        </p>

        <div className="space-y-3">
          {items.map((item) => {
            const inputType = inputForItem(item);
            const rawValue = answers[item.key];
            return (
              <div key={item.key} className="flex items-center justify-between gap-3">
                <label className="text-[12px] text-ink min-w-0 flex-1">
                  {item.label ?? item.key}
                </label>
                {inputType === 'boolean' && (
                  <BooleanInput value={rawValue as boolean | undefined} onChange={(v) => setAnswer(item.key, v)} />
                )}
                {inputType === 'choice' && (
                  <ChoiceInput
                    value={rawValue as string | undefined}
                    choices={(item.choices as { value: string; label?: string }[]) ?? []}
                    onChange={(v) => setAnswer(item.key, v)}
                  />
                )}
                {inputType === 'number' && (
                  <NumberInput value={rawValue != null ? String(rawValue) : ''} onChange={(v) => setAnswer(item.key, v === '' ? undefined : Number(v))} />
                )}
                {inputType === 'date' && (
                  <DateInput value={rawValue as string ?? ''} onChange={(v) => setAnswer(item.key, v === '' ? undefined : v)} />
                )}
                {inputType === 'text' && (
                  <TextInput value={rawValue as string ?? ''} onChange={(v) => setAnswer(item.key, v === '' ? undefined : v)} />
                )}
              </div>
            );
          })}
        </div>

        {hasAnyAnswer && (
          <button
            type="button"
            onClick={clearAnswers}
            className="text-[11px] text-muted hover:text-ink transition-colors"
          >
            Clear answers
          </button>
        )}

        {hasAnyAnswer && determination && (
          <div className="border-t border-border pt-3 space-y-2">
            <h4 className="text-[11px] font-bold text-muted uppercase tracking-wider">Results</h4>

            {determination.overrides.matched.length > 0 && (
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-amber uppercase">Override</span>
                {determination.overrides.matched.map((r, i) => (
                  <RouteHighlight key={i} route={r} matched />
                ))}
              </div>
            )}

            {determination.phases.map((phase) => {
              const matched = firstMatchPerPhase.get(phase.id);
              const allPhaseRoutes = screener.evaluation?.find((p) => p.id === phase.id)?.routes ?? [];
              return (
                <div key={phase.id} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-muted uppercase">{phase.id}</span>
                    <span className="text-[10px] text-muted">{phase.strategy}</span>
                    {phase.status !== 'evaluated' && (
                      <span className="text-[10px] text-amber font-mono">{phase.status}</span>
                    )}
                  </div>
                  {allPhaseRoutes.map((route, i) => {
                    const isMatch = matched != null && matched.target === route.target && phase.matched.some((m) => m.target === route.target);
                    const eliminated = phase.eliminated.find((e) => e.target === route.target);
                    return (
                      <div key={`${route.target}-${i}`} className="flex items-center gap-2">
                        <RouteHighlight route={isMatch ? matched : eliminated ?? null} matched={isMatch} />
                        {eliminated?.reason && !isMatch && (
                          <span className="text-[10px] text-muted font-mono">{eliminated.reason}</span>
                        )}
                      </div>
                    );
                  })}
                  {phase.matched.length === 0 && allPhaseRoutes.length > 0 && (
                    <div className="text-[11px] text-amber">No route matched</div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!hasAnyAnswer && (
          <div className="text-[11px] text-muted italic border-t border-border pt-3">
            Fill in answers above to see routing results.
          </div>
        )}
      </div>
    </ExpandableCard>
  );
}
