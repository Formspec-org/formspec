import { useEffect, useMemo, useState } from 'preact/hooks';
import { Collapsible } from '../../controls/Collapsible';
import { TextInput } from '../../controls/TextInput';
import {
  ConstraintBuilder,
  createDefaultConstraintExpression,
  parseConstraintExpression,
  serializeConstraintExpression
} from '../../logic/ConstraintBuilder';
import { ExpressionToggle } from '../../logic/ExpressionToggle';
import type { FELEditorFieldOption } from '../../controls/fel-utils';
import type { LogicFieldDataType, LogicFieldOption } from '../../logic/catalog';

export interface ValidationSectionProps {
  testIdPrefix: string;
  open: boolean;
  dataType: LogicFieldDataType;
  fields: LogicFieldOption[];
  constraint?: string;
  message?: string;
  customConstraints?: Array<{
    name: string;
    label: string;
    status: string;
    invocation: string;
  }>;
  onToggle: (open: boolean) => void;
  onConstraintInput: (value: string) => void;
  onMessageInput: (value: string) => void;
}

export function ValidationSection(props: ValidationSectionProps) {
  const customConstraints = props.customConstraints ?? [];
  const [selectedCustomConstraintName, setSelectedCustomConstraintName] = useState('');

  const felFieldOptions: FELEditorFieldOption[] = props.fields.map((field) => ({
    path: field.path,
    label: field.label
  }));
  const selectedConstraint = useMemo(
    () => customConstraints.find((constraint) => constraint.name === selectedCustomConstraintName),
    [customConstraints, selectedCustomConstraintName]
  );

  useEffect(() => {
    if (!customConstraints.length) {
      setSelectedCustomConstraintName('');
      return;
    }

    const exists = customConstraints.some((constraint) => constraint.name === selectedCustomConstraintName);
    if (!exists) {
      setSelectedCustomConstraintName(customConstraints[0].name);
    }
  }, [customConstraints, selectedCustomConstraintName]);

  return (
    <Collapsible
      id="validation"
      title="Validation"
      open={props.open}
      summary={props.constraint ? '! Constraint set' : null}
      onToggle={props.onToggle}
    >
      <ExpressionToggle
        label="Constraint"
        value={props.constraint}
        testIdPrefix={`${props.testIdPrefix}-constraint`}
        felTestId={`${props.testIdPrefix}-constraint-input`}
        felFieldOptions={felFieldOptions}
        onInput={props.onConstraintInput}
        parse={(value) => parseConstraintExpression(value, props.dataType)}
        serialize={(model) => serializeConstraintExpression(model, props.dataType)}
        createEmpty={() => createDefaultConstraintExpression(props.dataType)}
        renderVisual={({ model, testIdPrefix, onChange }) => (
          <ConstraintBuilder value={model} dataType={props.dataType} testIdPrefix={testIdPrefix} onChange={onChange} />
        )}
      />

      <TextInput
        label="Message"
        value={props.message}
        testId={`${props.testIdPrefix}-constraint-message-input`}
        onInput={props.onMessageInput}
      />

      {customConstraints.length ? (
        <label class="inspector-control">
          <span class="inspector-control__label">Custom constraint</span>
          <div class="validation-section__custom-constraint">
            <select
              class="inspector-input"
              data-testid={`${props.testIdPrefix}-custom-constraint-input`}
              value={selectedCustomConstraintName}
              onChange={(event) => {
                setSelectedCustomConstraintName((event.currentTarget as HTMLSelectElement).value);
              }}
            >
              {customConstraints.map((customConstraint) => (
                <option value={customConstraint.name} key={customConstraint.name}>
                  {customConstraint.label} ({customConstraint.status})
                </option>
              ))}
            </select>
            <button
              type="button"
              class="validation-section__apply-custom-constraint"
              data-testid={`${props.testIdPrefix}-custom-constraint-apply`}
              disabled={!selectedConstraint}
              onClick={() => {
                if (!selectedConstraint) {
                  return;
                }
                props.onConstraintInput(selectedConstraint.invocation);
              }}
            >
              Apply
            </button>
          </div>
        </label>
      ) : null}
    </Collapsible>
  );
}
