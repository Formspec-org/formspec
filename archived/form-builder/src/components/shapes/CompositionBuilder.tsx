import { Dropdown } from '../controls/Dropdown';
import { FELEditor } from '../controls/FELEditor';
import type { FELEditorFieldOption } from '../controls/fel-utils';
import type { ShapeCompositionMode } from '../../state/mutations';

interface CompositionBuilderProps {
  mode: ShapeCompositionMode;
  entries: string[];
  currentShapeId: string;
  availableShapeIds: string[];
  fieldOptions: FELEditorFieldOption[];
  onChange: (mode: ShapeCompositionMode, entries: string[]) => void;
}

export function CompositionBuilder(props: CompositionBuilderProps) {
  const operator = props.mode;
  const entryValues = ensureEntries(props.mode, props.entries);
  const shapeOptions = props.availableShapeIds
    .filter((shapeId) => shapeId !== props.currentShapeId)
    .map((shapeId) => ({
      value: shapeId,
      label: shapeId
    }));

  return (
    <div class="shape-composition" data-testid="shape-composition-builder">
      <Dropdown
        label="Composition"
        value={operator}
        testId="shape-composition-mode-input"
        options={[
          { value: 'none', label: 'None' },
          { value: 'and', label: 'ALL' },
          { value: 'or', label: 'ANY' },
          { value: 'xone', label: 'EXACTLY ONE' },
          { value: 'not', label: 'NOT' }
        ]}
        onChange={(value) => {
          const nextMode = value as ShapeCompositionMode;
          if (nextMode === 'none') {
            props.onChange('none', []);
            return;
          }

          if (nextMode === 'not') {
            const nextEntry = entryValues[0] ?? shapeOptions[0]?.value ?? 'true';
            props.onChange('not', [nextEntry]);
            return;
          }

          if (operator === nextMode && entryValues.length > 0) {
            props.onChange(nextMode, entryValues);
            return;
          }

          const firstEntry = shapeOptions[0]?.value ?? 'true';
          props.onChange(nextMode, [firstEntry]);
        }}
      />

      {operator === 'none' ? (
        <p class="inspector-hint">No composition set.</p>
      ) : (
        <div class="shape-composition__entries">
          {entryValues.map((entry, index) => {
            const entryType = shapeOptions.some((option) => option.value === entry)
              ? 'shape'
              : 'expression';

            return (
              <div class="shape-composition__entry" key={`composition-${index}`}>
                <Dropdown
                  label={`Entry ${index + 1} type`}
                  value={entryType}
                  testId={`shape-composition-entry-type-${index}`}
                  options={[
                    { value: 'shape', label: 'Rule reference' },
                    { value: 'expression', label: 'Inline FEL' }
                  ]}
                  onChange={(value) => {
                    const nextEntries = [...entryValues];
                    if (value === 'shape') {
                      nextEntries[index] = shapeOptions[0]?.value ?? '';
                    } else {
                      nextEntries[index] = '';
                    }
                    props.onChange(operator, nextEntries);
                  }}
                />

                {entryType === 'shape' ? (
                  <Dropdown
                    label={`Rule ${index + 1}`}
                    value={entry}
                    testId={`shape-composition-entry-shape-${index}`}
                    options={shapeOptions.length > 0
                      ? shapeOptions
                      : [{ value: '', label: 'No other rules available' }]}
                    onChange={(value) => {
                      const nextEntries = [...entryValues];
                      nextEntries[index] = value;
                      props.onChange(operator, nextEntries);
                    }}
                  />
                ) : (
                  <FELEditor
                    label={`Expression ${index + 1}`}
                    value={entry}
                    testId={`shape-composition-entry-expression-${index}`}
                    placeholder="$total > $limit"
                    fieldOptions={props.fieldOptions}
                    onInput={(value) => {
                      const nextEntries = [...entryValues];
                      nextEntries[index] = value;
                      props.onChange(operator, nextEntries);
                    }}
                  />
                )}

                <button
                  type="button"
                  class="shape-composition__remove"
                  data-testid={`shape-composition-remove-${index}`}
                  onClick={() => {
                    const nextEntries = entryValues.filter((_value, valueIndex) => valueIndex !== index);
                    props.onChange(operator, nextEntries);
                  }}
                >
                  Remove entry
                </button>
              </div>
            );
          })}

          {operator !== 'not' ? (
            <button
              type="button"
              class="shape-composition__add"
              data-testid="shape-composition-add-entry"
              onClick={() => {
                const nextEntries = [...entryValues, shapeOptions[0]?.value ?? 'true'];
                props.onChange(operator, nextEntries);
              }}
            >
              + Add entry
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

function ensureEntries(mode: ShapeCompositionMode, entries: string[]): string[] {
  if (mode === 'none') {
    return [];
  }

  if (entries.length > 0) {
    return entries;
  }

  if (mode === 'not') {
    return [''];
  }

  return [''];
}
