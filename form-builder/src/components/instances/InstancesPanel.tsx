import type { Signal } from '@preact/signals';
import { useState } from 'preact/hooks';
import {
  addInstance,
  deleteInstance,
  setInstanceProperty,
  renameInstance
} from '../../state/mutations';
import type { ProjectState } from '../../state/project';

export interface InstancesPanelProps {
  project: Signal<ProjectState>;
}

interface EditingState {
  originalName: string | null;
  name: string;
  description: string;
  source: string;
  isStatic: boolean;
}

export function InstancesPanel(props: InstancesPanelProps) {
  const rawInstances = (props.project.value.definition as Record<string, unknown>).instances as
    | Record<string, Record<string, unknown>>
    | undefined;
  const instanceNames = Object.keys(rawInstances ?? {});

  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditingState | null>(null);

  const startCreate = () => {
    setEditing({ originalName: null, name: '', description: '', source: '', isStatic: false });
    setSelectedName(null);
  };

  const startEdit = (name: string) => {
    const entry = rawInstances?.[name] ?? {};
    setEditing({
      originalName: name,
      name,
      description: typeof entry.description === 'string' ? entry.description : '',
      source: typeof entry.source === 'string' ? entry.source : '',
      isStatic: entry.static === true
    });
    setSelectedName(name);
  };

  const saveEdit = () => {
    if (!editing || !editing.name.trim()) {
      return;
    }
    const trimmedName = editing.name.trim();
    if (editing.originalName === null) {
      addInstance(props.project, {
        name: trimmedName,
        description: editing.description,
        source: editing.source,
        isStatic: editing.isStatic
      });
    } else {
      if (editing.originalName !== trimmedName) {
        renameInstance(props.project, editing.originalName, trimmedName);
      }
      setInstanceProperty(props.project, trimmedName, 'description', editing.description || undefined);
      setInstanceProperty(props.project, trimmedName, 'source', editing.source || undefined);
      if (editing.isStatic) {
        setInstanceProperty(props.project, trimmedName, 'static', true);
      } else {
        setInstanceProperty(props.project, trimmedName, 'static', undefined);
      }
    }
    setSelectedName(trimmedName);
    setEditing(null);
  };

  const cancelEdit = () => {
    setEditing(null);
  };

  const getInstanceSummary = (name: string): string => {
    const entry = rawInstances?.[name] ?? {};
    if (typeof entry.source === 'string') {
      return entry.source;
    }
    if (entry.data !== undefined) {
      return 'Inline data';
    }
    return 'No source';
  };

  return (
    <div class="instances-panel" data-testid="instances-panel">
      <button
        type="button"
        class="variables-panel__add"
        data-testid="instance-add-button"
        onClick={startCreate}
      >
        + Add instance
      </button>

      {instanceNames.length === 0 && !editing ? (
        <p class="inspector-hint">
          No secondary data sources. Add one to reference lookup tables or prior-year data in FEL via @instance('name').
        </p>
      ) : null}

      <div class="instances-panel__list">
        {instanceNames.map((name) => (
          <div
            class={`variables-panel__row${selectedName === name ? ' is-selected' : ''}`}
            key={name}
          >
            <button
              type="button"
              class="variables-panel__item"
              data-testid={`instance-item-${name}`}
              onClick={() => { startEdit(name); }}
            >
              <span class="variables-panel__name">{name}</span>
              <span class="variables-panel__meta">{getInstanceSummary(name)}</span>
            </button>
            <button
              type="button"
              class="variables-panel__delete"
              data-testid={`instance-delete-${name}`}
              onClick={() => {
                deleteInstance(props.project, name);
                if (selectedName === name) {
                  setSelectedName(null);
                }
                if (editing?.originalName === name) {
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
        <div class="instances-panel__editor" data-testid="instance-editor">
          <label class="inspector-control">
            <span class="inspector-control__label">Name (identifier)</span>
            <input
              class="inspector-input"
              data-testid="instance-name-input"
              type="text"
              placeholder="e.g. priorYear"
              value={editing.name}
              onInput={(event) => {
                setEditing({ ...editing, name: (event.currentTarget as HTMLInputElement).value });
              }}
            />
          </label>

          <label class="inspector-control">
            <span class="inspector-control__label">Description</span>
            <input
              class="inspector-input"
              data-testid="instance-description-input"
              type="text"
              placeholder="What does this instance contain?"
              value={editing.description}
              onInput={(event) => {
                setEditing({ ...editing, description: (event.currentTarget as HTMLInputElement).value });
              }}
            />
          </label>

          <label class="inspector-control">
            <span class="inspector-control__label">Source URL</span>
            <input
              class="inspector-input"
              data-testid="instance-source-input"
              type="text"
              placeholder="https://api.example.com/data/{{param}}"
              value={editing.source}
              onInput={(event) => {
                setEditing({ ...editing, source: (event.currentTarget as HTMLInputElement).value });
              }}
            />
          </label>

          <label class="inspector-control inspector-control--inline">
            <input
              type="checkbox"
              checked={editing.isStatic}
              data-testid="instance-static-checkbox"
              onChange={(event) => {
                setEditing({ ...editing, isStatic: (event.currentTarget as HTMLInputElement).checked });
              }}
            />
            <span class="inspector-control__label">Static (cache aggressively)</span>
          </label>

          <div class="option-sets-panel__actions">
            <button
              type="button"
              class="toolbar-button"
              data-testid="instance-save"
              onClick={saveEdit}
            >
              Save
            </button>
            <button
              type="button"
              class="toolbar-button"
              data-testid="instance-cancel"
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

