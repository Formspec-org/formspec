import type { Signal } from '@preact/signals';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { collectLogicCatalog } from '../logic/catalog';
import { addVariable, deleteVariable } from '../../state/mutations';
import type { VariableDependencyEntry } from '../../state/derived';
import type { ProjectState } from '../../state/project';
import { VariableEditor } from './VariableEditor';

export interface VariablesPanelProps {
  project: Signal<ProjectState>;
  dependencies: VariableDependencyEntry[];
}

export function VariablesPanel(props: VariablesPanelProps) {
  const variables = props.project.value.definition.variables ?? [];
  const [selectedVariableIndex, setSelectedVariableIndex] = useState<number | null>(
    variables.length > 0 ? 0 : null
  );

  useEffect(() => {
    if (variables.length === 0) {
      setSelectedVariableIndex(null);
      return;
    }

    if (selectedVariableIndex === null || selectedVariableIndex >= variables.length) {
      setSelectedVariableIndex(0);
    }
  }, [selectedVariableIndex, variables.length]);

  const dependencyByIndex = useMemo(() => {
    const lookup = new Map<number, VariableDependencyEntry>();
    for (const dependency of props.dependencies) {
      lookup.set(dependency.index, dependency);
    }
    return lookup;
  }, [props.dependencies]);

  const logicCatalog = useMemo(
    () => collectLogicCatalog(props.project.value.definition.items),
    [props.project.value.definition.items]
  );
  const fieldOptions = useMemo(
    () =>
      logicCatalog.fields.map((field) => ({
        path: field.path,
        label: field.label
      })),
    [logicCatalog.fields]
  );

  const selectedVariable = selectedVariableIndex === null ? null : variables[selectedVariableIndex] ?? null;

  return (
    <div class="variables-panel" data-testid="variables-panel">
      <button
        type="button"
        class="variables-panel__add"
        data-testid="variable-add-button"
        onClick={() => {
          const nextVariableIndex = addVariable(props.project, { name: 'variable', expression: 'null' });
          setSelectedVariableIndex(nextVariableIndex);
        }}
      >
        + Add variable
      </button>

      {variables.length === 0 ? <p class="inspector-hint">No variables defined.</p> : null}

      {variables.length > 0 ? (
        <div class="variables-panel__list" data-testid="variables-list">
          {variables.map((variable, index) => {
            const dependency = dependencyByIndex.get(index) ?? null;
            const selected = selectedVariableIndex === index;
            const name = variable.name || '(unnamed variable)';
            const usedByCount = dependency?.usedBy.length ?? 0;

            return (
              <div class={`variables-panel__row ${selected ? 'is-selected' : ''}`} key={`${name}-${index}`}>
                <button
                  type="button"
                  class="variables-panel__item"
                  data-testid={`variable-item-${index}`}
                  onClick={() => {
                    setSelectedVariableIndex(index);
                  }}
                >
                  <span class="variables-panel__name">{name}</span>
                  <span class="variables-panel__meta">{usedByCount} used-by</span>
                </button>

                <button
                  type="button"
                  class="variables-panel__delete"
                  data-testid={`variable-delete-${index}`}
                  onClick={() => {
                    deleteVariable(props.project, index);
                    if (selectedVariableIndex === index) {
                      setSelectedVariableIndex(null);
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            );
          })}
        </div>
      ) : null}

      {selectedVariableIndex !== null && selectedVariable ? (
        <VariableEditor
          project={props.project}
          variableIndex={selectedVariableIndex}
          variable={selectedVariable}
          dependency={dependencyByIndex.get(selectedVariableIndex) ?? null}
          fieldOptions={fieldOptions}
        />
      ) : null}
    </div>
  );
}
