import type { Signal } from '@preact/signals';
import { useState } from 'preact/hooks';
import { deleteOptionSet, setOptionSet } from '../../state/mutations';
import type { ProjectState } from '../../state/project';

interface OptionSetsPanelProps {
  project: Signal<ProjectState>;
}

interface EditableOption {
  value: string;
  label: string;
}

interface EditingState {
  name: string;
  options: EditableOption[];
  source: string;
}

export function OptionSetsPanel(props: OptionSetsPanelProps) {
  const optionSets = (props.project.value.definition.optionSets as Record<string, { options: EditableOption[] }> | undefined) ?? {};
  const setNames = Object.keys(optionSets);

  const [selectedSet, setSelectedSet] = useState<string | null>(setNames.length > 0 ? setNames[0] : null);
  const [editing, setEditing] = useState<EditingState | null>(null);

  const startCreate = () => {
    setEditing({ name: '', options: [{ value: '', label: '' }], source: '' });
    setSelectedSet(null);
  };

  const startEdit = (name: string) => {
    const set = optionSets[name];
    const rawSource = (set as unknown as Record<string, unknown> | undefined)?.source;
    setEditing({
      name,
      options: set?.options.map((o) => ({ ...o })) ?? [],
      source: typeof rawSource === 'string' ? rawSource : ''
    });
    setSelectedSet(name);
  };

  const saveEdit = () => {
    if (!editing || !editing.name.trim()) {
      return;
    }
    const cleaned = editing.options.filter((o) => o.value.trim() || o.label.trim());
    setOptionSet(props.project, editing.name.trim(), cleaned, editing.source || undefined);
    setSelectedSet(editing.name.trim());
    setEditing(null);
  };

  const cancelEdit = () => {
    setEditing(null);
  };

  return (
    <div class="option-sets-panel" data-testid="option-sets-panel">
      <button
        type="button"
        class="variables-panel__add"
        data-testid="option-set-add-button"
        onClick={startCreate}
      >
        + Add option set
      </button>

      {setNames.length === 0 && !editing ? (
        <p class="inspector-hint">No option sets defined.</p>
      ) : null}

      <div class="option-sets-panel__list">
        {setNames.map((name) => (
          <div class={`variables-panel__row${selectedSet === name ? ' is-selected' : ''}`} key={name}>
            <button
              type="button"
              class="variables-panel__item"
              data-testid={`option-set-item-${name}`}
              onClick={() => { startEdit(name); }}
            >
              <span class="variables-panel__name">{name}</span>
              <span class="variables-panel__meta">{optionSets[name]?.options.length ?? 0} options</span>
            </button>
            <button
              type="button"
              class="variables-panel__delete"
              data-testid={`option-set-delete-${name}`}
              onClick={() => {
                deleteOptionSet(props.project, name);
                if (selectedSet === name) {
                  setSelectedSet(null);
                }
                if (editing?.name === name) {
                  setEditing(null);
                }
              }}
            >
              Delete
            </button>
          </div>
        ))}
      </div>

      {editing ? (
        <div class="option-sets-panel__editor" data-testid="option-set-editor">
          <label class="inspector-control">
            <span class="inspector-control__label">Name (identifier)</span>
            <input
              class="inspector-input"
              data-testid="option-set-name-input"
              type="text"
              value={editing.name}
              onInput={(event) => {
                setEditing({ ...editing, name: (event.currentTarget as HTMLInputElement).value });
              }}
            />
          </label>

          <label class="inspector-control">
            <span class="inspector-control__label">Source URI (optional)</span>
            <input
              class="inspector-input"
              data-testid="option-set-source-input"
              type="url"
              value={editing.source}
              placeholder="https://example.org/options.json"
              onInput={(event) => {
                setEditing({ ...editing, source: (event.currentTarget as HTMLInputElement).value });
              }}
            />
          </label>

          <p class="inspector-control__label">Options</p>
          {editing.options.map((option, index) => (
            <div class="option-sets-panel__option-row" key={index}>
              <input
                class="inspector-input"
                placeholder="value"
                data-testid={`option-set-value-${index}`}
                type="text"
                value={option.value}
                onInput={(event) => {
                  const next = editing.options.map((o, i) =>
                    i === index ? { ...o, value: (event.currentTarget as HTMLInputElement).value } : o
                  );
                  setEditing({ ...editing, options: next });
                }}
              />
              <input
                class="inspector-input"
                placeholder="label"
                data-testid={`option-set-label-${index}`}
                type="text"
                value={option.label}
                onInput={(event) => {
                  const next = editing.options.map((o, i) =>
                    i === index ? { ...o, label: (event.currentTarget as HTMLInputElement).value } : o
                  );
                  setEditing({ ...editing, options: next });
                }}
              />
              <button
                type="button"
                class="variables-panel__delete"
                onClick={() => {
                  setEditing({ ...editing, options: editing.options.filter((_, i) => i !== index) });
                }}
              >
                ×
              </button>
            </div>
          ))}

          <button
            type="button"
            class="variables-panel__add"
            style="margin-top: 0.35rem;"
            data-testid="option-set-add-option"
            onClick={() => {
              setEditing({ ...editing, options: [...editing.options, { value: '', label: '' }] });
            }}
          >
            + Add option
          </button>

          <div class="option-sets-panel__actions">
            <button
              type="button"
              class="toolbar-button"
              data-testid="option-set-save"
              onClick={saveEdit}
            >
              Save
            </button>
            <button
              type="button"
              class="toolbar-button"
              data-testid="option-set-cancel"
              onClick={cancelEdit}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
