import type { Signal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import { setComponentRegistry } from '../../state/mutations';
import type {
  FormspecCustomComponentDefinition,
  ProjectState
} from '../../state/project';

interface CustomComponentRegistryEditorProps {
  project: Signal<ProjectState>;
}

interface EditingState {
  originalName: string | null;
  name: string;
  params: string;
  tree: string;
  error: string | null;
}

const DEFAULT_COMPONENT_TEMPLATE = {
  component: 'Stack',
  children: []
};

export function CustomComponentRegistryEditor(props: CustomComponentRegistryEditorProps) {
  const registry = props.project.value.component.components ?? {};
  const names = Object.keys(registry).sort();
  const [selectedName, setSelectedName] = useState<string | null>(names[0] ?? null);
  const [editing, setEditing] = useState<EditingState | null>(null);

  useEffect(() => {
    if (editing) {
      return;
    }
    if (selectedName && registry[selectedName]) {
      return;
    }
    setSelectedName(names[0] ?? null);
  }, [editing, names, registry, selectedName]);

  const startCreate = () => {
    setEditing({
      originalName: null,
      name: '',
      params: '',
      tree: JSON.stringify(DEFAULT_COMPONENT_TEMPLATE, null, 2),
      error: null
    });
    setSelectedName(null);
  };

  const startEdit = (name: string) => {
    const definition = registry[name];
    if (!definition) {
      return;
    }
    setSelectedName(name);
    setEditing({
      originalName: name,
      name,
      params: (definition.params ?? []).join(', '),
      tree: JSON.stringify(definition.tree, null, 2),
      error: null
    });
  };

  const saveEdit = () => {
    if (!editing) {
      return;
    }

    const normalizedName = editing.name.trim();
    if (!normalizedName) {
      setEditing({ ...editing, error: 'Component name is required.' });
      return;
    }

    let parsedTree: unknown;
    try {
      parsedTree = JSON.parse(editing.tree);
    } catch {
      setEditing({ ...editing, error: 'Template tree must be valid JSON.' });
      return;
    }

    if (!isRecord(parsedTree)) {
      setEditing({ ...editing, error: 'Template tree must be a JSON object.' });
      return;
    }

    const nextRegistry: Record<string, FormspecCustomComponentDefinition> = { ...registry };
    if (editing.originalName && editing.originalName !== normalizedName) {
      delete nextRegistry[editing.originalName];
    }

    const params = editing.params
      .split(',')
      .map((param) => param.trim())
      .filter(Boolean);

    nextRegistry[normalizedName] = {
      tree: parsedTree,
      ...(params.length > 0 ? { params } : {})
    };

    setComponentRegistry(props.project, nextRegistry);
    setSelectedName(normalizedName);
    setEditing(null);
  };

  const deleteEntry = (name: string) => {
    const nextRegistry = { ...registry };
    delete nextRegistry[name];
    setComponentRegistry(props.project, nextRegistry);
    if (selectedName === name) {
      setSelectedName(null);
    }
    if (editing?.originalName === name) {
      setEditing(null);
    }
  };

  return (
    <div class="component-registry" data-testid="component-registry-editor">
      <button
        type="button"
        class="variables-panel__add"
        data-testid="component-registry-add-button"
        onClick={startCreate}
      >
        + Add custom component
      </button>

      {names.length === 0 && !editing ? <p class="inspector-hint">No custom components registered.</p> : null}

      {names.length > 0 ? (
        <div class="component-registry__list">
          {names.map((name) => (
            <div class={`variables-panel__row${selectedName === name ? ' is-selected' : ''}`} key={name}>
              <button
                type="button"
                class="variables-panel__item"
                data-testid={`component-registry-item-${name}`}
                onClick={() => {
                  startEdit(name);
                }}
              >
                <span class="variables-panel__name">{name}</span>
                <span class="variables-panel__meta">{(registry[name]?.params ?? []).length} params</span>
              </button>
              <button
                type="button"
                class="variables-panel__delete"
                data-testid={`component-registry-delete-${name}`}
                onClick={() => {
                  deleteEntry(name);
                }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {editing ? (
        <div class="component-registry__editor" data-testid="component-registry-form">
          <label class="inspector-control">
            <span class="inspector-control__label">Component name</span>
            <input
              class="inspector-input"
              data-testid="component-registry-name-input"
              type="text"
              value={editing.name}
              placeholder="ApplicantNameField"
              onInput={(event) => {
                setEditing({
                  ...editing,
                  name: (event.currentTarget as HTMLInputElement).value,
                  error: null
                });
              }}
            />
          </label>

          <label class="inspector-control">
            <span class="inspector-control__label">Params (comma-separated)</span>
            <input
              class="inspector-input"
              data-testid="component-registry-params-input"
              type="text"
              value={editing.params}
              placeholder="field, label"
              onInput={(event) => {
                setEditing({
                  ...editing,
                  params: (event.currentTarget as HTMLInputElement).value
                });
              }}
            />
          </label>

          <label class="inspector-control">
            <span class="inspector-control__label">Template tree (JSON)</span>
            <textarea
              class="component-registry__textarea"
              data-testid="component-registry-tree-input"
              value={editing.tree}
              rows={10}
              onInput={(event) => {
                setEditing({
                  ...editing,
                  tree: (event.currentTarget as HTMLTextAreaElement).value,
                  error: null
                });
              }}
            />
          </label>

          {editing.error ? (
            <p class="component-registry__error" data-testid="component-registry-error">
              {editing.error}
            </p>
          ) : null}

          <div class="option-sets-panel__actions">
            <button
              type="button"
              class="toolbar-button"
              data-testid="component-registry-save"
              onClick={saveEdit}
            >
              Save
            </button>
            <button
              type="button"
              class="toolbar-button"
              data-testid="component-registry-cancel"
              onClick={() => {
                setEditing(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
