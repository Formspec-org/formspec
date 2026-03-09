/**
 * DataHandlingSection — Advanced-only section grouping data handling controls
 * from the old AdvancedSection: whitespace, excluded value, precision,
 * non-relevant behavior, initial value, remote options, semantic type,
 * currency, export labels, pre-populate.
 */
import { Collapsible } from '../../controls/Collapsible';
import { Dropdown } from '../../controls/Dropdown';
import { NumberInput } from '../../controls/NumberInput';
import { TextInput } from '../../controls/TextInput';
import { Toggle } from '../../controls/Toggle';

interface AdvancedSectionLabels {
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

interface DataHandlingSectionProps {
  testIdPrefix: string;
  open: boolean;
  // Data handling
  initialValue?: string;
  whitespace?: string;
  excludedValue?: string;
  nonRelevantBehavior?: string;
  precision?: number;
  // Remote / external
  remoteOptions?: string;
  semanticType?: string;
  currency?: string;
  // Labels
  labels?: AdvancedSectionLabels;
  // Pre-populate
  prePopulate?: PrePopulateValue;
  // Callbacks
  onToggle: (open: boolean) => void;
  onInitialValueInput: (value: string) => void;
  onWhitespaceChange: (value: string) => void;
  onExcludedValueChange: (value: string) => void;
  onNonRelevantBehaviorChange: (value: string) => void;
  onPrecisionInput: (value: number | undefined) => void;
  onRemoteOptionsInput: (value: string) => void;
  onSemanticTypeInput: (value: string) => void;
  onCurrencyInput: (value: string) => void;
  onLabelsInput: (key: keyof AdvancedSectionLabels, value: string) => void;
  onPrePopulateChange: (value: PrePopulateValue | undefined) => void;
}

export function DataHandlingSection(props: DataHandlingSectionProps) {
  const hasConfig = !!(
    props.initialValue || props.whitespace || props.excludedValue
    || props.nonRelevantBehavior || props.precision !== undefined
    || props.remoteOptions || props.semanticType || props.currency
    || props.prePopulate?.instance
  );

  return (
    <Collapsible
      id="data-handling"
      title="Data Handling"
      open={props.open}
      summary={hasConfig ? 'Configured' : null}
      onToggle={props.onToggle}
    >
      <TextInput
        label="Initial value (set once on create)"
        value={props.initialValue}
        testId={`${props.testIdPrefix}-initial-value-input`}
        onInput={props.onInitialValueInput}
      />

      <Dropdown
        label="Text trimming"
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
        label="Treat as empty when"
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
        label="When hidden, answer is..."
        value={props.nonRelevantBehavior}
        testId={`${props.testIdPrefix}-non-relevant-input`}
        options={[
          { value: '', label: 'Default' },
          { value: 'remove', label: 'Excluded from response' },
          { value: 'empty', label: 'Submitted as empty' },
          { value: 'keep', label: 'Kept (last value)' }
        ]}
        onChange={props.onNonRelevantBehaviorChange}
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

      {/* Export labels */}
      <div class="inspector-subsection-header">Export labels</div>
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

      {/* Pre-populate */}
      <div class="inspector-subsection-header">Data sources</div>
      <TextInput
        label="Pre-populate from instance"
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
