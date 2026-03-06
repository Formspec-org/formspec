import { Collapsible } from '../../controls/Collapsible';
import { Dropdown } from '../../controls/Dropdown';
import { NumberInput } from '../../controls/NumberInput';
import { TextInput } from '../../controls/TextInput';
import { Toggle } from '../../controls/Toggle';

export interface AdvancedSectionLabels {
  short?: string;
  pdf?: string;
  csv?: string;
  accessibility?: string;
}

export interface PrePopulateValue {
  instance: string;
  path: string;
  editable?: boolean;
}

export interface AdvancedSectionProps {
  testIdPrefix: string;
  open: boolean;
  defaultValue?: string;
  initialValue?: string;
  whitespace?: string;
  excludedValue?: string;
  nonRelevantBehavior?: string;
  disabledDisplay?: string;
  precision?: number;
  remoteOptions?: string;
  semanticType?: string;
  currency?: string;
  labels?: AdvancedSectionLabels;
  prePopulate?: PrePopulateValue;
  onToggle: (open: boolean) => void;
  onDefaultValueInput: (value: string) => void;
  onInitialValueInput: (value: string) => void;
  onWhitespaceChange: (value: string) => void;
  onExcludedValueChange: (value: string) => void;
  onNonRelevantBehaviorChange: (value: string) => void;
  onDisabledDisplayChange: (value: string) => void;
  onPrecisionInput: (value: number | undefined) => void;
  onRemoteOptionsInput: (value: string) => void;
  onSemanticTypeInput: (value: string) => void;
  onCurrencyInput: (value: string) => void;
  onLabelsInput: (key: keyof AdvancedSectionLabels, value: string) => void;
  onPrePopulateChange: (value: PrePopulateValue | undefined) => void;
}

export function AdvancedSection(props: AdvancedSectionProps) {
  return (
    <Collapsible
      id="advanced"
      title="Advanced"
      open={props.open}
      summary={props.defaultValue || props.remoteOptions ? 'Customized' : null}
      onToggle={props.onToggle}
    >
      <TextInput
        label="Default value"
        value={props.defaultValue}
        testId={`${props.testIdPrefix}-default-input`}
        onInput={props.onDefaultValueInput}
      />
      <TextInput
        label="Initial value (set once on create)"
        value={props.initialValue}
        testId={`${props.testIdPrefix}-initial-value-input`}
        onInput={props.onInitialValueInput}
      />
      <Dropdown
        label="Whitespace handling"
        value={props.whitespace}
        testId={`${props.testIdPrefix}-whitespace-input`}
        options={[
          { value: '', label: 'Default' },
          { value: 'preserve', label: 'Preserve as entered' },
          { value: 'trim', label: 'Trim edges' },
          { value: 'normalize', label: 'Normalize spaces' },
          { value: 'remove', label: 'Strip all whitespace' }
        ]}
        onChange={props.onWhitespaceChange}
      />
      <Dropdown
        label="Empty value handling"
        value={props.excludedValue}
        testId={`${props.testIdPrefix}-excluded-value-input`}
        options={[
          { value: '', label: 'Default' },
          { value: 'preserve', label: 'Keep empty string' },
          { value: 'null', label: 'Store as null' }
        ]}
        onChange={props.onExcludedValueChange}
      />
      <Dropdown
        label="When hidden"
        value={props.nonRelevantBehavior}
        testId={`${props.testIdPrefix}-non-relevant-input`}
        options={[
          { value: '', label: 'Default' },
          { value: 'remove', label: 'Exclude from response' },
          { value: 'empty', label: 'Submit as empty' },
          { value: 'keep', label: 'Keep last value' }
        ]}
        onChange={props.onNonRelevantBehaviorChange}
      />
      <Dropdown
        label="Read-only display"
        value={props.disabledDisplay}
        testId={`${props.testIdPrefix}-disabled-display-input`}
        options={[
          { value: '', label: 'Default' },
          { value: 'hidden', label: 'Hidden' },
          { value: 'protected', label: 'Shown but locked' }
        ]}
        onChange={props.onDisabledDisplayChange}
      />
      <NumberInput
        label="Precision"
        value={props.precision}
        min={0}
        step={1}
        testId={`${props.testIdPrefix}-precision-input`}
        onInput={props.onPrecisionInput}
      />
      <TextInput
        label="Remote options URL"
        value={props.remoteOptions}
        testId={`${props.testIdPrefix}-remote-options-input`}
        onInput={props.onRemoteOptionsInput}
      />
      <TextInput
        label="Semantic type (e.g. ietf:email)"
        value={props.semanticType}
        testId={`${props.testIdPrefix}-semantic-type-input`}
        onInput={props.onSemanticTypeInput}
      />
      <TextInput
        label="Currency (ISO 4217, e.g. USD)"
        value={props.currency}
        testId={`${props.testIdPrefix}-currency-input`}
        onInput={props.onCurrencyInput}
      />
      <TextInput
        label="Label (short)"
        value={props.labels?.short}
        testId={`${props.testIdPrefix}-label-short-input`}
        onInput={(value) => { props.onLabelsInput('short', value); }}
      />
      <TextInput
        label="Label (PDF)"
        value={props.labels?.pdf}
        testId={`${props.testIdPrefix}-label-pdf-input`}
        onInput={(value) => { props.onLabelsInput('pdf', value); }}
      />
      <TextInput
        label="Label (CSV header)"
        value={props.labels?.csv}
        testId={`${props.testIdPrefix}-label-csv-input`}
        onInput={(value) => { props.onLabelsInput('csv', value); }}
      />
      <TextInput
        label="Label (accessibility)"
        value={props.labels?.accessibility}
        testId={`${props.testIdPrefix}-label-accessibility-input`}
        onInput={(value) => { props.onLabelsInput('accessibility', value); }}
      />

      <div class="inspector-subsection-header">Pre-populate from instance</div>
      <TextInput
        label="Instance name"
        value={props.prePopulate?.instance ?? ''}
        testId={`${props.testIdPrefix}-prepopulate-instance-input`}
        onInput={(value) => {
          const instance = value.trim();
          if (!instance) {
            props.onPrePopulateChange(undefined);
          } else {
            props.onPrePopulateChange({
              instance,
              path: props.prePopulate?.path ?? '',
              editable: props.prePopulate?.editable
            });
          }
        }}
      />
      {props.prePopulate?.instance ? (
        <>
          <TextInput
            label="Path within instance"
            value={props.prePopulate?.path ?? ''}
            testId={`${props.testIdPrefix}-prepopulate-path-input`}
            onInput={(value) => {
              props.onPrePopulateChange({
                instance: props.prePopulate?.instance ?? '',
                path: value,
                editable: props.prePopulate?.editable
              });
            }}
          />
          <Toggle
            label="Editable after pre-population"
            checked={props.prePopulate?.editable !== false}
            testId={`${props.testIdPrefix}-prepopulate-editable-toggle`}
            onToggle={(value) => {
              props.onPrePopulateChange({
                instance: props.prePopulate?.instance ?? '',
                path: props.prePopulate?.path ?? '',
                editable: value
              });
            }}
          />
        </>
      ) : null}
    </Collapsible>
  );
}
