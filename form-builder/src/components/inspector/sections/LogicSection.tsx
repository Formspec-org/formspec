import { ConditionBuilder, type ConditionExpression, createDefaultConditionExpression, parseConditionExpression, serializeConditionExpression } from '../../logic/ConditionBuilder';
import { ExpressionToggle } from '../../logic/ExpressionToggle';
import { createDefaultFormulaExpression, FormulaBuilder, parseFormulaExpression, serializeFormulaExpression } from '../../logic/FormulaBuilder';
import type { FELEditorFieldOption } from '../../controls/fel-utils';
import type { LogicFieldOption, LogicGroupOption } from '../../logic/catalog';
import { Collapsible } from '../../controls/Collapsible';

export interface LogicSectionProps {
  testIdPrefix: string;
  open: boolean;
  fields: LogicFieldOption[];
  groups: LogicGroupOption[];
  relevant?: string;
  required?: string;
  calculate?: string;
  readonly?: string;
  showRequired?: boolean;
  showCalculate?: boolean;
  onToggle: (open: boolean) => void;
  onRelevantInput: (value: string) => void;
  onRequiredInput?: (value: string) => void;
  onCalculateInput?: (value: string) => void;
  onReadonlyInput: (value: string) => void;
}

export function LogicSection(props: LogicSectionProps) {
  const felFieldOptions: FELEditorFieldOption[] = props.fields.map((field) => ({
    path: field.path,
    label: field.label
  }));
  const showRequired = props.showRequired ?? true;
  const showCalculate = props.showCalculate ?? true;
  const summaryTokens = [
    props.relevant ? '? Show when' : '',
    showRequired && props.required ? '● Required when' : '',
    showCalculate && props.calculate ? '= Calculate' : '',
    props.readonly ? 'L Readonly when' : ''
  ].filter(Boolean);

  return (
    <Collapsible
      id="logic"
      title="Logic"
      open={props.open}
      summary={summaryTokens.length ? summaryTokens.join(' · ') : null}
      onToggle={props.onToggle}
    >
      <ExpressionToggle
        label="Show when"
        value={props.relevant}
        testIdPrefix={`${props.testIdPrefix}-relevant`}
        felTestId={`${props.testIdPrefix}-relevant-input`}
        felFieldOptions={felFieldOptions}
        otherwise="Otherwise: Hidden"
        onInput={props.onRelevantInput}
        parse={(value) => parseConditionExpression(value, props.fields)}
        serialize={(model) => serializeConditionExpression(model, props.fields)}
        createEmpty={() => createDefaultConditionExpression(props.fields)}
        renderVisual={({ model, testIdPrefix, onChange }) => (
          <ConditionBuilder value={model} fields={props.fields} testIdPrefix={testIdPrefix} onChange={onChange} />
        )}
      />

      {showRequired ? (
        <ExpressionToggle
          label="Required when"
          value={props.required}
          testIdPrefix={`${props.testIdPrefix}-required-when`}
          felTestId={`${props.testIdPrefix}-required-when-input`}
          felFieldOptions={felFieldOptions}
          onInput={(value) => {
            props.onRequiredInput?.(value);
          }}
          parse={(value) => parseConditionExpression(value, props.fields)}
          serialize={(model) => serializeConditionExpression(model, props.fields)}
          createEmpty={() => createDefaultConditionExpression(props.fields)}
          renderVisual={({ model, testIdPrefix, onChange }) => (
            <ConditionBuilder value={model} fields={props.fields} testIdPrefix={testIdPrefix} onChange={onChange} />
          )}
        />
      ) : null}

      {showCalculate ? (
        <ExpressionToggle
          label="Calculate"
          value={props.calculate}
          testIdPrefix={`${props.testIdPrefix}-calculate`}
          felTestId={`${props.testIdPrefix}-calculate-input`}
          felFieldOptions={felFieldOptions}
          onInput={(value) => {
            props.onCalculateInput?.(value);
          }}
          parse={(value) => parseFormulaExpression(value, props.groups)}
          serialize={serializeFormulaExpression}
          createEmpty={() => createDefaultFormulaExpression(props.groups)}
          renderVisual={({ model, testIdPrefix, onChange }) => (
            <FormulaBuilder value={model} groups={props.groups} testIdPrefix={testIdPrefix} onChange={onChange} />
          )}
        />
      ) : null}

      <ExpressionToggle
        label="Readonly when"
        value={props.readonly}
        testIdPrefix={`${props.testIdPrefix}-readonly`}
        felTestId={`${props.testIdPrefix}-readonly-input`}
        felFieldOptions={felFieldOptions}
        onInput={props.onReadonlyInput}
        parse={(value) => parseConditionExpression(value, props.fields)}
        serialize={(model) => serializeConditionExpression(model, props.fields)}
        createEmpty={() => createDefaultConditionExpression(props.fields)}
        renderVisual={({ model, testIdPrefix, onChange }) => (
          <ConditionBuilder value={model} fields={props.fields} testIdPrefix={testIdPrefix} onChange={onChange} />
        )}
      />
    </Collapsible>
  );
}
