/** @filedesc Live form preview panel that runs the FormEngine with scenario data and renders at a given viewport. */
import { useMemo, useState } from 'react';
import { createFormEngine } from '@formspec-org/engine';
import type { IFormEngine } from '@formspec-org/engine/render';
import type { FormDefinition } from '@formspec-org/types';
import { applyResponseDataToEngine } from '@formspec-org/webcomponent';
import { useProjectState } from '../../state/useProjectState';
import { normalizeDefinitionDoc } from '@formspec-org/studio-core';
import type { ResolvedTheme } from '../../hooks/useColorScheme';
import { FormspecPreviewHost } from '../../workspaces/preview/FormspecPreviewHost';
import type { Viewport } from '../../workspaces/preview/ViewportSwitcher';

const viewportWidths: Record<Viewport, string> = {
  desktop: '100%',
  tablet: '768px',
  mobile: '375px',
};

interface SimulationResult {
  parseError?: string;
  snapshot?: ReturnType<IFormEngine['getDiagnosticsSnapshot']>;
  response?: unknown;
}

type ParsedScenario =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error: string };

function parseScenarioText(text: string): ParsedScenario {
  const trimmed = text.trim();
  if (!trimmed) return { ok: true, data: {} };
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, error: 'Scenario must be a JSON object' };
    }
    return { ok: true, data: parsed as Record<string, unknown> };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Invalid JSON',
    };
  }
}

/** Headless engine run using the same hydration path as `<formspec-render>` + {@link applyResponseDataToEngine}. */
function buildSimulation(definition: unknown, scenarioData: Record<string, unknown>): SimulationResult {
  try {
    const normalizedDefinition = normalizeDefinitionDoc(definition) as FormDefinition;
    const engine = createFormEngine(normalizedDefinition);
    applyResponseDataToEngine(engine, scenarioData as Record<string, any>);
    return {
      snapshot: engine.getDiagnosticsSnapshot({ mode: 'continuous' }),
      response: engine.getResponse({ mode: 'continuous' }),
    };
  } catch (error) {
    return {
      parseError: error instanceof Error ? error.message : 'Unknown simulation error',
    };
  }
}

interface BehaviorPreviewProps {
  viewport?: Viewport;
  appearance?: ResolvedTheme;
}

export function BehaviorPreview({ viewport = 'desktop', appearance }: BehaviorPreviewProps = {}) {
  const state = useProjectState();
  const [scenarioText, setScenarioText] = useState<string>('{}');
  const parsedScenario = useMemo(() => parseScenarioText(scenarioText), [scenarioText]);

  const simulation = useMemo(() => {
    if (!parsedScenario.ok) {
      return { parseError: parsedScenario.error };
    }
    return buildSimulation(state.definition, parsedScenario.data);
  }, [parsedScenario, state.definition]);

  const fields = Object.entries(simulation.snapshot?.mips ?? {});

  const scenarioForHost: Record<string, unknown> | null = parsedScenario.ok ? parsedScenario.data : null;

  return (
    <div className="grid h-full min-h-0 gap-3 p-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
      <div className="min-h-0 overflow-auto rounded border border-border bg-subtle/50 p-2">
        <div
          className="mx-auto rounded border border-border bg-surface p-4"
          style={{
            width: viewportWidths[viewport],
            maxWidth: '100%',
            minWidth: viewport === 'desktop' ? '800px' : undefined,
          }}
        >
          <FormspecPreviewHost
            width={viewportWidths[viewport]}
            appearance={appearance}
            scenarioData={scenarioForHost}
          />
        </div>
      </div>

      <div className="flex min-h-0 flex-col gap-3 overflow-auto">
        <section className="rounded border border-border bg-surface p-3">
          <div className="mb-2 text-sm font-semibold">Scenario JSON</div>
          <textarea
            data-testid="behavior-scenario-input"
            className="min-h-[140px] w-full rounded border border-border bg-bg-default p-2 font-mono text-xs outline-none focus:border-accent"
            value={scenarioText}
            onChange={(event) => setScenarioText(event.target.value)}
            aria-label="Scenario JSON"
          />
          <p className="mt-2 text-xs text-muted">
            Same nested shape as response <code className="text-[11px]">data</code> — applied to the live preview and
            the behavior snapshot.
          </p>
        </section>

        <section className="rounded border border-border bg-surface p-3">
          <div className="mb-2 text-sm font-semibold">Behavior Snapshot</div>
          {simulation.parseError ? (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {simulation.parseError}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-4 gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
                <span>Field</span>
                <span>Relevant</span>
                <span>Required</span>
                <span>Readonly</span>
              </div>
              {fields.length === 0 ? (
                <div className="text-sm text-muted">No field diagnostics available.</div>
              ) : null}
              {fields.map(([path, mips]) => (
                <div key={path} className="grid grid-cols-4 gap-2 rounded border border-border/70 px-2 py-2 text-sm">
                  <span className="font-mono text-xs">{path}</span>
                  <span>{mips.relevant ? 'Yes' : 'No'}</span>
                  <span>{mips.required ? 'Yes' : 'No'}</span>
                  <span>{mips.readonly ? 'Yes' : 'No'}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded border border-border bg-surface p-3">
          <div className="mb-2 text-sm font-semibold">Response Shape</div>
          <pre className="max-h-[240px] overflow-auto rounded bg-bg-default p-2 text-xs">
            {simulation.response ? JSON.stringify(simulation.response, null, 2) : '{}'}
          </pre>
        </section>
      </div>
    </div>
  );
}
