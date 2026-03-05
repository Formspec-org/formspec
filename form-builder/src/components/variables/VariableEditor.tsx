import type { Signal } from '@preact/signals';
import type { FormspecVariable } from 'formspec-engine';
import { FELEditor } from '../controls/FELEditor';
import type { FELEditorFieldOption } from '../controls/fel-utils';
import { TextInput } from '../controls/TextInput';
import {
  setVariableExpression,
  setVariableName,
  setVariableScope
} from '../../state/mutations';
import type { VariableDependencyEntry } from '../../state/derived';
import type { ProjectState } from '../../state/project';

export interface VariableEditorProps {
  project: Signal<ProjectState>;
  variableIndex: number;
  variable: FormspecVariable;
  dependency: VariableDependencyEntry | null;
  fieldOptions: FELEditorFieldOption[];
}

export function VariableEditor(props: VariableEditorProps) {
  const dependency = props.dependency;
  const scopeValue = props.variable.scope ?? '#';

  return (
    <div class="variable-editor" data-testid="variable-editor">
      <TextInput
        label="Name"
        value={props.variable.name}
        testId="variable-name-input"
        onInput={(value) => {
          setVariableName(props.project, props.variableIndex, value);
        }}
      />

      <TextInput
        label="Scope"
        value={scopeValue}
        placeholder="#"
        testId="variable-scope-input"
        onInput={(value) => {
          setVariableScope(props.project, props.variableIndex, value);
        }}
      />

      <FELEditor
        label="Expression"
        value={props.variable.expression}
        testId="variable-expression-input"
        placeholder="$lineItems[*].amount"
        fieldOptions={props.fieldOptions}
        onInput={(value) => {
          setVariableExpression(props.project, props.variableIndex, value);
        }}
      />

      <div class="variable-editor__dependencies" data-testid="variable-dependencies">
        <div class="variable-editor__dependency-group" data-testid="variable-depends-on-fields">
          <p class="inspector-control__label">Depends On Fields</p>
          {dependency?.dependsOnFields.length ? (
            <ul class="variable-editor__list">
              {dependency.dependsOnFields.map((fieldPath) => (
                <li key={fieldPath}>{fieldPath}</li>
              ))}
            </ul>
          ) : (
            <p class="inspector-hint">No field dependencies.</p>
          )}
        </div>

        <div class="variable-editor__dependency-group" data-testid="variable-depends-on-variables">
          <p class="inspector-control__label">Depends On Variables</p>
          {dependency?.dependsOnVariables.length ? (
            <ul class="variable-editor__list">
              {dependency.dependsOnVariables.map((variableName) => (
                <li key={variableName}>@{variableName}</li>
              ))}
            </ul>
          ) : (
            <p class="inspector-hint">No variable dependencies.</p>
          )}
        </div>

        <div class="variable-editor__dependency-group" data-testid="variable-used-by">
          <p class="inspector-control__label">Used By</p>
          {dependency?.usedBy.length ? (
            <ul class="variable-editor__list">
              {dependency.usedBy.map((usage) => (
                <li key={usage.id}>{usage.label}</li>
              ))}
            </ul>
          ) : (
            <p class="inspector-hint">No references yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
