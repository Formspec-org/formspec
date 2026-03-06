import type { Signal } from '@preact/signals';
import { useState } from 'preact/hooks';
import { setThemeToken } from '../../state/mutations';
import type { ProjectState } from '../../state/project';

interface TokenEditorProps {
  project: Signal<ProjectState>;
}

type TokenCategory = 'color' | 'spacing' | 'typography' | 'border' | 'elevation' | 'custom' | 'other';

interface TokenCategoryMeta {
  id: TokenCategory;
  label: string;
}

interface TokenEntryView {
  key: string;
  value: string | number;
  category: TokenCategory;
  references: string[];
}

const TOKEN_CATEGORIES: TokenCategoryMeta[] = [
  { id: 'color', label: 'Color' },
  { id: 'spacing', label: 'Spacing' },
  { id: 'typography', label: 'Typography' },
  { id: 'border', label: 'Border' },
  { id: 'elevation', label: 'Elevation' },
  { id: 'custom', label: 'Custom' },
  { id: 'other', label: 'Other' }
];

export function TokenEditor(props: TokenEditorProps) {
  const tokens = props.project.value.theme.tokens ?? {};
  const referenceIndex = buildTokenReferenceIndex(props.project.value.theme);
  const entries = Object.entries(tokens)
    .map(([key, value]) => ({
      key,
      value,
      category: resolveTokenCategory(key),
      references: referenceIndex.get(key) ?? []
    }))
    .sort((left, right) => left.key.localeCompare(right.key));
  const groupedEntries = TOKEN_CATEGORIES.map((category) => ({
    ...category,
    entries: entries.filter((entry) => entry.category === category.id)
  })).filter((group) => group.entries.length > 0);
  const [draftKey, setDraftKey] = useState('');
  const [draftValue, setDraftValue] = useState('');
  const canAdd = draftKey.trim().length > 0;

  return (
    <div class="token-editor">
      {entries.length === 0 ? <p class="inspector-hint">No custom tokens yet.</p> : null}
      {groupedEntries.map((group) => (
        <section class="token-editor__group" data-testid={`brand-token-group-${group.id}`} key={group.id}>
          <header class="token-editor__group-header">
            <span class="token-editor__group-title">{group.label}</span>
            <span class="token-editor__group-count">{group.entries.length} token{group.entries.length === 1 ? '' : 's'}</span>
          </header>

          {group.entries.map((entry) => (
            <div class="token-editor__row" key={entry.key}>
              <div class="token-editor__row-header">
                <div class="token-editor__key">{entry.key}</div>
                <button
                  type="button"
                  class="token-editor__remove"
                  data-testid={`brand-token-remove-${entry.key}`}
                  onClick={() => {
                    setThemeToken(props.project, entry.key, null);
                  }}
                >
                  Remove
                </button>
              </div>

              <input
                class="inspector-input token-editor__value"
                type="text"
                value={String(entry.value)}
                data-testid={`brand-token-value-${entry.key}`}
                onInput={(event) => {
                  setThemeToken(props.project, entry.key, (event.currentTarget as HTMLInputElement).value);
                }}
              />

              <div class="token-editor__preview" data-testid={`brand-token-preview-${entry.key}`}>
                {renderTokenPreview(entry)}
              </div>

              <div class="token-editor__references" data-testid={`brand-token-refs-${entry.key}`}>
                {entry.references.length > 0 ? (
                  entry.references.map((reference) => (
                    <span class="token-editor__reference" key={reference}>
                      {reference}
                    </span>
                  ))
                ) : (
                  <span class="token-editor__reference token-editor__reference--empty">Unused</span>
                )}
              </div>
            </div>
          ))}
        </section>
      ))}

      <div class="token-editor__add">
        <input
          class="inspector-input"
          type="text"
          value={draftKey}
          placeholder="token.name"
          data-testid="brand-token-key-input"
          onInput={(event) => {
            setDraftKey((event.currentTarget as HTMLInputElement).value);
          }}
        />
        <input
          class="inspector-input"
          type="text"
          value={draftValue}
          placeholder="value"
          data-testid="brand-token-value-input"
          onInput={(event) => {
            setDraftValue((event.currentTarget as HTMLInputElement).value);
          }}
        />
        <button
          type="button"
          class="token-editor__add-button"
          data-testid="brand-token-add-button"
          disabled={!canAdd}
          onClick={() => {
            if (!canAdd) {
              return;
            }
            setThemeToken(props.project, draftKey, draftValue);
            setDraftKey('');
            setDraftValue('');
          }}
        >
          Add token
        </button>
      </div>
    </div>
  );
}

function resolveTokenCategory(tokenKey: string): TokenCategory {
  const [prefix] = tokenKey.split('.');
  if (prefix === 'color') {
    return 'color';
  }
  if (prefix === 'spacing') {
    return 'spacing';
  }
  if (prefix === 'typography') {
    return 'typography';
  }
  if (prefix === 'border') {
    return 'border';
  }
  if (prefix === 'elevation') {
    return 'elevation';
  }
  if (prefix.startsWith('x-')) {
    return 'custom';
  }
  return 'other';
}

function renderTokenPreview(entry: TokenEntryView) {
  const valueText = String(entry.value);

  if (entry.category === 'color' && isColorValue(valueText)) {
    return (
      <span class="token-editor__preview-color">
        <span class="token-editor__swatch" style={{ backgroundColor: valueText }} />
        <span class="token-editor__preview-value">{valueText}</span>
      </span>
    );
  }

  if (entry.category === 'spacing') {
    const width = spacingToPixels(entry.value);
    return (
      <span class="token-editor__preview-spacing">
        <span class="token-editor__spacing-track">
          <span class="token-editor__spacing-bar" style={{ width: `${width}px` }} />
        </span>
        <span class="token-editor__preview-value">{valueText}</span>
      </span>
    );
  }

  if (entry.category === 'typography') {
    const style: Record<string, string> = {};
    if (entry.key.endsWith('.family')) {
      style.fontFamily = valueText;
    }
    if (entry.key.endsWith('.size')) {
      style.fontSize = valueText;
    }
    if (entry.key.endsWith('.weight')) {
      style.fontWeight = valueText;
    }
    return (
      <span class="token-editor__preview-typography">
        <span class="token-editor__type-sample" style={style}>
          Aa
        </span>
        <span class="token-editor__preview-value">{valueText}</span>
      </span>
    );
  }

  if (entry.category === 'border') {
    const borderValue = typeof entry.value === 'number' ? `${entry.value}px solid #334155` : valueText;
    return (
      <span class="token-editor__preview-border">
        <span class="token-editor__border-sample" style={{ border: borderValue }} />
        <span class="token-editor__preview-value">{valueText}</span>
      </span>
    );
  }

  if (entry.category === 'elevation') {
    const shadowValue = typeof entry.value === 'number' ? `0 ${entry.value}px ${entry.value * 2}px rgba(15, 23, 42, 0.2)` : valueText;
    return (
      <span class="token-editor__preview-elevation">
        <span class="token-editor__elevation-sample" style={{ boxShadow: shadowValue }} />
        <span class="token-editor__preview-value">{valueText}</span>
      </span>
    );
  }

  return <span class="token-editor__preview-value">{valueText}</span>;
}

function isColorValue(value: string): boolean {
  const normalized = value.trim();
  return (
    /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(normalized) ||
    /^rgba?\(/i.test(normalized) ||
    /^hsla?\(/i.test(normalized)
  );
}

function spacingToPixels(value: string | number): number {
  if (typeof value === 'number') {
    return clampSpacing(value);
  }

  const normalized = value.trim().toLowerCase();
  const match = normalized.match(/^(-?\d+(?:\.\d+)?)(px|rem|em)?$/);
  if (!match) {
    return 24;
  }

  const amount = Number(match[1]);
  const unit = match[2] ?? 'px';
  if (!Number.isFinite(amount)) {
    return 24;
  }

  if (unit === 'rem' || unit === 'em') {
    return clampSpacing(amount * 16);
  }
  return clampSpacing(amount);
}

function clampSpacing(value: number): number {
  if (value < 2) {
    return 2;
  }
  if (value > 96) {
    return 96;
  }
  return Math.round(value);
}

function buildTokenReferenceIndex(theme: ProjectState['theme']): Map<string, string[]> {
  const index = new Map<string, Set<string>>();
  walk(theme, '');

  return new Map(
    Array.from(index.entries()).map(([token, locations]) => [token, Array.from(locations).sort((left, right) => left.localeCompare(right))])
  );

  function walk(value: unknown, path: string): void {
    if (path === 'tokens' || path.startsWith('tokens.')) {
      return;
    }

    if (typeof value === 'string') {
      const matches = extractTokenReferences(value);
      for (const token of matches) {
        const current = index.get(token) ?? new Set<string>();
        current.add(path || '(root)');
        index.set(token, current);
      }
      return;
    }

    if (Array.isArray(value)) {
      for (let listIndex = 0; listIndex < value.length; listIndex += 1) {
        const nextPath = `${path}[${listIndex}]`;
        walk(value[listIndex], nextPath);
      }
      return;
    }

    if (!value || typeof value !== 'object') {
      return;
    }

    for (const [key, nestedValue] of Object.entries(value)) {
      const nextPath = path ? `${path}.${key}` : key;
      walk(nestedValue, nextPath);
    }
  }
}

function extractTokenReferences(value: string): string[] {
  const matches: string[] = [];
  const tokenRegex = /\$token\.([a-z0-9._-]+)/gi;
  let match: RegExpExecArray | null = tokenRegex.exec(value);
  while (match) {
    matches.push(match[1]);
    match = tokenRegex.exec(value);
  }
  return matches;
}
