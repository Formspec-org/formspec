import { signal } from '@preact/signals';
import { activeArtifact, project } from '../state/project';
import type { ArtifactKind } from '../types';

const expanded = signal(false);

const TABS: Array<{ kind: ArtifactKind; icon: string; label: string }> = [
  { kind: 'definition', icon: '◆', label: 'Definition' },
  { kind: 'component', icon: '◇', label: 'Component' },
  { kind: 'theme', icon: '◈', label: 'Theme' },
  { kind: 'mapping', icon: '⬡', label: 'Mapping' },
  { kind: 'registry', icon: '▢', label: 'Registry' },
  { kind: 'changelog', icon: '▤', label: 'Changelog' },
];

function isConfigured(kind: ArtifactKind): boolean {
  const current = project.value;
  if (kind === 'definition') {
    return current.definition !== null;
  }
  return current[kind] !== null;
}

export function Sidebar() {
  return (
    <nav
      class={`studio-sidebar ${expanded.value ? 'expanded' : ''}`}
      onMouseEnter={() => {
        expanded.value = true;
      }}
      onMouseLeave={() => {
        expanded.value = false;
      }}
      role="tablist"
      aria-label="Artifact tabs"
      aria-orientation="vertical"
    >
      {TABS.map((tab) => {
        const active = activeArtifact.value === tab.kind;
        const configured = isConfigured(tab.kind);
        return (
          <button
            key={tab.kind}
            role="tab"
            aria-selected={active}
            class="sidebar-tab"
            data-active={active || undefined}
            onClick={() => {
              activeArtifact.value = tab.kind;
            }}
            title={tab.label}
          >
            <span
              class="sidebar-tab-icon"
              style={{ color: active ? 'var(--accent)' : 'var(--text-1)' }}
            >
              {tab.icon}
            </span>
            {expanded.value && <span class="sidebar-tab-label">{tab.label}</span>}
            {expanded.value && tab.kind !== 'definition' && (
              <span
                class="sidebar-tab-status"
                style={{ color: configured ? 'var(--success)' : 'var(--text-3)' }}
              >
                {configured ? '✓' : '—'}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
