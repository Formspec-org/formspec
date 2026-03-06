import { useState } from 'preact/hooks';
import type { Signal } from '@preact/signals';
import { setThemeBreakpoint } from '../../state/mutations';
import type { ProjectState } from '../../state/project';

export interface BreakpointEditorProps {
  project: Signal<ProjectState>;
}

const PRESET_BREAKPOINTS: Array<{ name: string; width: number; label: string }> = [
  { name: 'sm', width: 640, label: 'sm (640px)' },
  { name: 'md', width: 768, label: 'md (768px)' },
  { name: 'lg', width: 1024, label: 'lg (1024px)' },
  { name: 'xl', width: 1280, label: 'xl (1280px)' }
];

export function BreakpointEditor(props: BreakpointEditorProps) {
  const breakpoints = props.project.value.theme.breakpoints ?? {};
  const entries = Object.entries(breakpoints).sort(([, a], [, b]) => (a as number) - (b as number));

  const [draftName, setDraftName] = useState('');
  const [draftWidth, setDraftWidth] = useState('');
  const canAdd = draftName.trim().length > 0 && Number.isFinite(Number(draftWidth)) && Number(draftWidth) > 0;

  const addPresets = () => {
    for (const preset of PRESET_BREAKPOINTS) {
      if (breakpoints[preset.name] === undefined) {
        setThemeBreakpoint(props.project, preset.name, preset.width);
      }
    }
  };

  return (
    <div class="breakpoint-editor" data-testid="breakpoint-editor">
      {entries.length === 0 ? (
        <div class="breakpoint-editor__empty">
          <p class="inspector-hint">No breakpoints defined. Responsive overrides are disabled without breakpoints.</p>
          <button
            type="button"
            class="breakpoint-editor__preset-button"
            data-testid="breakpoint-add-presets"
            onClick={addPresets}
          >
            Add common presets (sm / md / lg / xl)
          </button>
        </div>
      ) : (
        <ul class="breakpoint-editor__list">
          {entries.map(([name, minWidth]) => (
            <li key={name} class="breakpoint-editor__row">
              <span class="breakpoint-editor__name">{name}</span>
              <input
                class="inspector-input breakpoint-editor__width"
                type="number"
                min="0"
                step="1"
                value={minWidth as number}
                data-testid={`breakpoint-width-${name}`}
                onInput={(event) => {
                  const raw = (event.currentTarget as HTMLInputElement).valueAsNumber;
                  setThemeBreakpoint(props.project, name, Number.isFinite(raw) ? raw : null);
                }}
              />
              <span class="breakpoint-editor__unit">px</span>
              <button
                type="button"
                class="breakpoint-editor__remove"
                data-testid={`breakpoint-remove-${name}`}
                title={`Remove ${name}`}
                onClick={() => {
                  setThemeBreakpoint(props.project, name, null);
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div class="breakpoint-editor__add-row">
        <input
          class="inspector-input breakpoint-editor__name-input"
          type="text"
          value={draftName}
          placeholder="name"
          data-testid="breakpoint-name-input"
          onInput={(event) => {
            setDraftName((event.currentTarget as HTMLInputElement).value);
          }}
        />
        <input
          class="inspector-input breakpoint-editor__width-input"
          type="number"
          min="0"
          step="1"
          value={draftWidth}
          placeholder="px"
          data-testid="breakpoint-width-input"
          onInput={(event) => {
            setDraftWidth((event.currentTarget as HTMLInputElement).value);
          }}
        />
        <button
          type="button"
          class="breakpoint-editor__add-button"
          data-testid="breakpoint-add-button"
          disabled={!canAdd}
          onClick={() => {
            if (!canAdd) return;
            setThemeBreakpoint(props.project, draftName.trim(), Number(draftWidth));
            setDraftName('');
            setDraftWidth('');
          }}
        >
          +
        </button>
      </div>

      {entries.length > 0 ? (
        <p class="inspector-hint">Min-width thresholds in pixels. Items wider than a breakpoint activate its responsive overrides.</p>
      ) : null}
    </div>
  );
}
