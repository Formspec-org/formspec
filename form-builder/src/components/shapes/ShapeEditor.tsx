import type { Signal } from '@preact/signals';
import type { FormspecShape } from 'formspec-engine';
import { useMemo } from 'preact/hooks';
import { Collapsible } from '../controls/Collapsible';
import { Dropdown } from '../controls/Dropdown';
import { FELEditor } from '../controls/FELEditor';
import type { FELEditorFieldOption } from '../controls/fel-utils';
import { TextInput } from '../controls/TextInput';
import {
  renameShapeId,
  setInspectorSectionOpen,
  setShapeComposition,
  setShapeProperty,
  type ShapeCompositionMode
} from '../../state/mutations';
import type { ProjectState } from '../../state/project';
import { CompositionBuilder } from './CompositionBuilder';

interface ShapeEditorProps {
  project: Signal<ProjectState>;
  shape: FormspecShape;
  allShapes: FormspecShape[];
  fieldOptions: FELEditorFieldOption[];
}

export function ShapeEditor(props: ShapeEditorProps) {
  const composition = useMemo(() => getShapeComposition(props.shape), [props.shape]);
  const targetMode = inferTargetMode(props.shape.target);
  const advancedOpen = props.project.value.uiState.inspectorSections['form:rules-advanced'] ?? false;

  const contextEntries = Object.entries(props.shape.context ?? {});

  return (
    <div class="shape-editor" data-testid="shape-editor">
      <TextInput
        label="Name"
        value={toDisplayName(props.shape.id)}
        testId="shape-name-input"
        onInput={(value) => {
          renameShapeId(props.project, props.shape.id, value);
        }}
      />

      <p class="inspector-hint" data-testid="shape-id-display">
        ID: {props.shape.id}
      </p>

      <Dropdown
        label="Applies to"
        value={targetMode}
        testId="shape-target-mode-input"
        options={[
          { value: 'form', label: 'Entire form' },
          { value: 'field', label: 'Specific field' },
          { value: 'each', label: 'Each instance path' }
        ]}
        onChange={(value) => {
          if (value === 'form') {
            setShapeProperty(props.project, props.shape.id, 'target', '#');
            return;
          }

          if (value === 'field') {
            const nextTarget = props.fieldOptions[0]?.path ?? '#';
            setShapeProperty(props.project, props.shape.id, 'target', nextTarget);
            return;
          }

          const nextTarget = props.shape.target.includes('[*]')
            ? props.shape.target
            : 'group[*].field';
          setShapeProperty(props.project, props.shape.id, 'target', nextTarget);
        }}
      />

      {targetMode === 'field' ? (
        <Dropdown
          label="Field"
          value={props.shape.target}
          testId="shape-target-field-input"
          options={props.fieldOptions.length > 0
            ? props.fieldOptions.map((option) => ({
                value: option.path,
                label: `${option.label} (${option.path})`
              }))
            : [{ value: '#', label: 'No fields available' }]}
          onChange={(value) => {
            setShapeProperty(props.project, props.shape.id, 'target', value);
          }}
        />
      ) : null}

      {targetMode === 'each' ? (
        <TextInput
          label="Instance target"
          value={props.shape.target}
          testId="shape-target-repeat-input"
          placeholder="group[*].field"
          onInput={(value) => {
            setShapeProperty(props.project, props.shape.id, 'target', value);
          }}
        />
      ) : null}

      <Dropdown
        label="Severity"
        value={props.shape.severity ?? 'error'}
        testId="shape-severity-input"
        options={[
          { value: 'error', label: 'Error' },
          { value: 'warning', label: 'Warning' },
          { value: 'info', label: 'Info' }
        ]}
        onChange={(value) => {
          setShapeProperty(props.project, props.shape.id, 'severity', value as FormspecShape['severity']);
        }}
      />

      <FELEditor
        label="Condition"
        value={props.shape.constraint}
        testId="shape-constraint-input"
        placeholder="$totalBudget = $awardAmount"
        fieldOptions={props.fieldOptions}
        onInput={(value) => {
          setShapeProperty(props.project, props.shape.id, 'constraint', value);
        }}
      />

      <TextInput
        label="Message"
        value={props.shape.message}
        testId="shape-message-input"
        placeholder="e.g. Total must equal {{$budgetAmount}}"
        onInput={(value) => {
          setShapeProperty(props.project, props.shape.id, 'message', value);
        }}
      />
      <p class="inspector-hint" data-testid="shape-message-hint">
        Use <code>{'{{$fieldPath}}'}</code> to interpolate field values in the message.
      </p>

      <CompositionBuilder
        mode={composition.mode}
        entries={composition.entries}
        currentShapeId={props.shape.id}
        availableShapeIds={props.allShapes.map((shape) => shape.id)}
        fieldOptions={props.fieldOptions}
        onChange={(mode, entries) => {
          setShapeComposition(props.project, props.shape.id, mode, entries);
        }}
      />

      <Collapsible
        id="shape-advanced"
        title="Advanced"
        open={advancedOpen}
        summary={props.shape.timing || props.shape.code || props.shape.activeWhen || contextEntries.length
          ? 'configured'
          : null}
        onToggle={(open) => {
          setInspectorSectionOpen(props.project, 'form:rules-advanced', open);
        }}
      >
        <Dropdown
          label="Timing"
          value={props.shape.timing ?? 'continuous'}
          testId="shape-timing-input"
          options={[
            { value: 'continuous', label: 'Continuous' },
            { value: 'submit', label: 'Submit' },
            { value: 'demand', label: 'Demand' }
          ]}
          onChange={(value) => {
            setShapeProperty(props.project, props.shape.id, 'timing', value as FormspecShape['timing']);
          }}
        />

        <TextInput
          label="Code"
          value={props.shape.code}
          testId="shape-code-input"
          onInput={(value) => {
            setShapeProperty(props.project, props.shape.id, 'code', value);
          }}
        />

        <FELEditor
          label="Active when"
          value={props.shape.activeWhen}
          testId="shape-active-when-input"
          placeholder="$status = 'submitted'"
          fieldOptions={props.fieldOptions}
          onInput={(value) => {
            setShapeProperty(props.project, props.shape.id, 'activeWhen', value);
          }}
        />

        <div class="shape-context" data-testid="shape-context-editor">
          <p class="inspector-control__label">Context</p>
          {contextEntries.length === 0 ? <p class="inspector-hint">No context entries.</p> : null}

          {contextEntries.map(([key, expression], index) => (
            <div class="shape-context__row" key={`${key}-${index}`}>
              <TextInput
                label="Key"
                value={key}
                testId={`shape-context-key-${index}`}
                onInput={(value) => {
                  const nextContext = { ...(props.shape.context ?? {}) };
                  delete nextContext[key];
                  const normalizedKey = value.trim();
                  if (normalizedKey) {
                    nextContext[normalizedKey] = expression;
                  }
                  setShapeProperty(props.project, props.shape.id, 'context', nextContext);
                }}
              />

              <FELEditor
                label="Expression"
                value={expression}
                testId={`shape-context-expression-${index}`}
                fieldOptions={props.fieldOptions}
                onInput={(value) => {
                  const nextContext = { ...(props.shape.context ?? {}) };
                  nextContext[key] = value;
                  setShapeProperty(props.project, props.shape.id, 'context', nextContext);
                }}
              />

              <button
                type="button"
                class="shape-context__remove"
                data-testid={`shape-context-remove-${index}`}
                onClick={() => {
                  const nextContext = { ...(props.shape.context ?? {}) };
                  delete nextContext[key];
                  setShapeProperty(props.project, props.shape.id, 'context', nextContext);
                }}
              >
                Remove context entry
              </button>
            </div>
          ))}

          <button
            type="button"
            class="shape-context__add"
            data-testid="shape-context-add"
            onClick={() => {
              const nextContext = { ...(props.shape.context ?? {}) };
              let nextKey = 'value';
              let keyIndex = 2;
              while (nextContext[nextKey] !== undefined) {
                nextKey = `value${keyIndex}`;
                keyIndex += 1;
              }
              nextContext[nextKey] = '$';
              setShapeProperty(props.project, props.shape.id, 'context', nextContext);
            }}
          >
            + Add context entry
          </button>
        </div>
      </Collapsible>
    </div>
  );
}

function inferTargetMode(target: string): 'form' | 'field' | 'each' {
  if (target === '#') {
    return 'form';
  }
  if (target.includes('[*]')) {
    return 'each';
  }
  return 'field';
}

function getShapeComposition(shape: FormspecShape): { mode: ShapeCompositionMode; entries: string[] } {
  if (shape.and?.length) {
    return { mode: 'and', entries: shape.and };
  }
  if (shape.or?.length) {
    return { mode: 'or', entries: shape.or };
  }
  if (shape.xone?.length) {
    return { mode: 'xone', entries: shape.xone };
  }
  if (shape.not) {
    return { mode: 'not', entries: [shape.not] };
  }
  return { mode: 'none', entries: [] };
}

function toDisplayName(shapeId: string): string {
  if (!shapeId) {
    return '';
  }

  return shapeId
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}
