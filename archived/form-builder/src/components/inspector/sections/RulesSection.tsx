/**
 * RulesSection — merges Logic + Validation + Required into a single section.
 *
 * Simple:   Required toggle, Show when (visual), Validation (visual)
 * Standard: + Auto-calculate, Required when
 * Advanced: + Lock when (readonly), raw FEL editors
 */
import { useMemo } from 'preact/hooks';
import { Collapsible } from '../../controls/Collapsible';
import { TextInput } from '../../controls/TextInput';
import { Toggle } from '../../controls/Toggle';
import {
  ConditionBuilder,
  createDefaultConditionExpression,
  parseConditionExpression,
  serializeConditionExpression
} from '../../logic/ConditionBuilder';
import {
  ConstraintBuilder,
  createDefaultConstraintExpression,
  parseConstraintExpression,
  serializeConstraintExpression
} from '../../logic/ConstraintBuilder';
import {
  createDefaultFormulaExpression,
  FormulaBuilder,
  parseFormulaExpression,
  serializeFormulaExpression
} from '../../logic/FormulaBuilder';
import { ExpressionToggle } from '../../logic/ExpressionToggle';
import type { FELEditorFieldOption } from '../../controls/fel-utils';
import type { LogicFieldDataType, LogicFieldOption, LogicGroupOption } from '../../logic/catalog';
import type { InspectorTier } from '../Inspector';
import { meetsMinTier } from '../Inspector';
import { InlineHint } from '../InlineHint';

interface RulesSectionProps {
  testIdPrefix: string;
  open: boolean;
  tier: InspectorTier;
  // Required
  requiredBoolean: boolean;
  requiredExpression?: string;
  // Show when
  relevant?: string;
  // Validation
  dataType: LogicFieldDataType;
  constraint?: string;
  constraintMessage?: string;
  // Calculate
  calculate?: string;
  // Readonly
  readonly?: string;
  // Catalog
  fields: LogicFieldOption[];
  groups: LogicGroupOption[];
  customConstraints?: Array<{
    name: string;
    label: string;
    status: string;
    invocation: string;
  }>;
  // Callbacks
  onToggle: (open: boolean) => void;
  onRequiredToggle: (value: boolean) => void;
  onRelevantInput: (value: string) => void;
  onRequiredWhenInput: (value: string) => void;
  onConstraintInput: (value: string) => void;
  onConstraintMessageInput: (value: string) => void;
  onCalculateInput: (value: string) => void;
  onReadonlyInput: (value: string) => void;
}

export function RulesSection(props: RulesSectionProps) {
  const felFieldOptions: FELEditorFieldOption[] = props.fields.map((field) => ({
    path: field.path,
    label: field.label
  }));

  const showCalculate = meetsMinTier(props.tier, 'standard');
  const showRequiredWhen = meetsMinTier(props.tier, 'standard');
  const showReadonly = meetsMinTier(props.tier, 'advanced');

  const summaryTokens = [
    props.requiredBoolean ? 'Required' : '',
    props.relevant ? 'Conditional' : '',
    props.constraint ? 'Validated' : '',
    showCalculate && props.calculate ? 'Calculated' : '',
    showRequiredWhen && props.requiredExpression ? 'Required when...' : '',
    showReadonly && props.readonly ? 'Locked when...' : ''
  ].filter(Boolean);

  const customConstraints = props.customConstraints ?? [];
  const selectedConstraint = useMemo(
    () => customConstraints.length ? customConstraints[0] : undefined,
    [customConstraints]
  );

  return (
    <Collapsible
      id="rules"
      title="Rules"
      open={props.open}
      summary={summaryTokens.length ? summaryTokens.join(' · ') : null}
      onToggle={props.onToggle}
    >
      {/* Required toggle — always visible */}
      <Toggle
        label="Required"
        checked={props.requiredBoolean}
        testId={`${props.testIdPrefix}-required-toggle`}
        onToggle={props.onRequiredToggle}
      />

      {/* Show this question when... — always visible */}
      <InlineHint tier={props.tier} text="Only display this question when a condition is met." />
      <ExpressionToggle
        label="Show this question when"
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

      {/* Validation rule — always visible */}
      <InlineHint tier={props.tier} text="Set rules the answer must follow." />
      <ExpressionToggle
        label="Validation rule"
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
      {props.constraint ? (
        <TextInput
          label="Error message"
          value={props.constraintMessage}
          testId={`${props.testIdPrefix}-constraint-message-input`}
          onInput={props.onConstraintMessageInput}
        />
      ) : null}

      {/* Custom constraints — advanced */}
      {meetsMinTier(props.tier, 'advanced') && customConstraints.length ? (
        <label class="inspector-control">
          <span class="inspector-control__label">Custom constraint</span>
          <div class="validation-section__custom-constraint">
            <select
              class="inspector-input"
              data-testid={`${props.testIdPrefix}-custom-constraint-input`}
              onChange={(event) => {
                const name = (event.currentTarget as HTMLSelectElement).value;
                const c = customConstraints.find((cc) => cc.name === name);
                if (c) props.onConstraintInput(c.invocation);
              }}
            >
              {customConstraints.map((cc) => (
                <option value={cc.name} key={cc.name}>
                  {cc.label} ({cc.status})
                </option>
              ))}
            </select>
            <button
              type="button"
              class="validation-section__apply-custom-constraint"
              data-testid={`${props.testIdPrefix}-custom-constraint-apply`}
              disabled={!selectedConstraint}
              onClick={() => {
                if (selectedConstraint) props.onConstraintInput(selectedConstraint.invocation);
              }}
            >
              Apply
            </button>
          </div>
        </label>
      ) : null}

      {/* Standard+ controls in a collapsed sub-group */}
      {showCalculate || showRequiredWhen || showReadonly ? (
        <div class="inspector-subsection-header">More rules</div>
      ) : null}

      {showRequiredWhen ? (
        <ExpressionToggle
          label="Required when"
          value={props.requiredExpression}
          testIdPrefix={`${props.testIdPrefix}-required-when`}
          felTestId={`${props.testIdPrefix}-required-when-input`}
          felFieldOptions={felFieldOptions}
          onInput={props.onRequiredWhenInput}
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
          label="Auto-calculate"
          value={props.calculate}
          testIdPrefix={`${props.testIdPrefix}-calculate`}
          felTestId={`${props.testIdPrefix}-calculate-input`}
          felFieldOptions={felFieldOptions}
          onInput={props.onCalculateInput}
          parse={(value) => parseFormulaExpression(value, props.groups)}
          serialize={serializeFormulaExpression}
          createEmpty={() => createDefaultFormulaExpression(props.groups)}
          renderVisual={({ model, testIdPrefix, onChange }) => (
            <FormulaBuilder value={model} groups={props.groups} testIdPrefix={testIdPrefix} onChange={onChange} />
          )}
        />
      ) : null}

      {showReadonly ? (
        <ExpressionToggle
          label="Lock when"
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
      ) : null}
    </Collapsible>
  );
}
