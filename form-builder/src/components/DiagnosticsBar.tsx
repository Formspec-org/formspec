import type { CombinedDiagnostics, DiagnosticEntry } from '../state/derived';

export interface DiagnosticsBarProps {
  diagnostics: CombinedDiagnostics;
  expanded: boolean;
  onToggleExpanded: () => void;
  onNavigate: (entry: DiagnosticEntry) => void;
}

function renderDiagnosticsSection(
  title: string,
  testId: string,
  entries: DiagnosticEntry[],
  onNavigate: (entry: DiagnosticEntry) => void
) {
  if (!entries.length) {
    return null;
  }

  return (
    <section class="diagnostics__section" data-testid={testId}>
      <h4>{title}</h4>
      <ul>
        {entries.map((entry) => (
          <li key={entry.id}>
            {entry.navigation ? (
              <button
                type="button"
                class={`diagnostics__entry diagnostics__entry--${entry.severity} diagnostics__entry--action`}
                data-testid="diagnostics-entry-button"
                onClick={() => {
                  onNavigate(entry);
                }}
              >
                <code>{entry.path}</code>
                <span class="diagnostics__entry-source">{entry.source}</span>
                <span>{entry.message}</span>
              </button>
            ) : (
              <div class={`diagnostics__entry diagnostics__entry--${entry.severity}`}>
                <code>{entry.path}</code>
                <span class="diagnostics__entry-source">{entry.source}</span>
                <span>{entry.message}</span>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function DiagnosticsBar(props: DiagnosticsBarProps) {
  const { counts, entries } = props.diagnostics;
  const ajvEntries = entries.filter((entry) => entry.layer === 'ajv');
  const engineEntries = entries.filter((entry) => entry.layer === 'engine');

  return (
    <footer class="diagnostics" data-testid="diagnostics-bar">
      <div class="diagnostics__summary">
        <p>
          <strong>{counts.error}</strong> errors · <strong>{counts.warning}</strong> warnings · <strong>{counts.info}</strong>{' '}
          info
        </p>
        <button
          type="button"
          class="toolbar-button"
          data-testid="toggle-diagnostics"
          onClick={props.onToggleExpanded}
        >
          {props.expanded ? 'Hide details' : 'Show details'}
        </button>
      </div>

      {props.expanded ? (
        <div class="diagnostics__panel" data-testid="diagnostics-panel">
          {renderDiagnosticsSection('Structural (Ajv)', 'diagnostics-section-ajv', ajvEntries, props.onNavigate)}
          {renderDiagnosticsSection('Logical (FormEngine)', 'diagnostics-section-engine', engineEntries, props.onNavigate)}
          {entries.length === 0 ? <p class="diagnostics__empty">No diagnostics.</p> : null}
        </div>
      ) : null}
    </footer>
  );
}
