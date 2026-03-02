import { definition, updateDefinition } from '../state/definition';
import { project } from '../state/project';
import { handleImport, handleExport } from '../logic/import-export-actions';

export function Topbar() {
  const def = project.value.definition;
  const version = def?.version ?? '0.1.0';
  const status = (def as { status?: string } | null)?.status ?? 'draft';

  return (
    <header class="studio-topbar">
      <div class="topbar-brand">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <rect x="1" y="1" width="8" height="8" rx="2" fill="var(--accent)" opacity="1" />
          <rect x="11" y="1" width="8" height="8" rx="2" fill="var(--accent)" opacity="0.6" />
          <rect x="1" y="11" width="8" height="8" rx="2" fill="var(--accent)" opacity="0.6" />
          <rect x="11" y="11" width="8" height="8" rx="2" fill="var(--accent)" opacity="0.3" />
        </svg>
        <span class="topbar-brand-text">
          Formspec{' '}
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontStyle: 'italic',
              color: 'var(--accent)',
            }}
          >
            Studio
          </span>
        </span>
      </div>

      <div class="topbar-center">
        <input
          class="topbar-title-input"
          value={definition.value.title ?? 'Untitled Form'}
          onInput={(event) => {
            const next = (event.target as HTMLInputElement).value;
            updateDefinition((d) => {
              d.title = next;
            });
          }}
          aria-label="Form title"
        />
        <span class="topbar-meta">
          <span class="topbar-dot">·</span>v{version}
          <span class="topbar-dot">·</span>
          {status}
        </span>
      </div>

      <div class="topbar-actions">
        <button
          class="btn-ghost"
          aria-label="Import project"
          onClick={handleImport}
        >
          <span aria-hidden="true">↓</span> Import
        </button>
        <button
          class="btn-primary"
          aria-label="Export project"
          onClick={handleExport}
        >
          <span aria-hidden="true">↑</span> Export
        </button>
      </div>
    </header>
  );
}
