import { Collapsible } from '../../controls/Collapsible';
import { Dropdown } from '../../controls/Dropdown';
import { NumberInput } from '../../controls/NumberInput';
import { TextInput } from '../../controls/TextInput';

export interface AdvancedSectionProps {
  testIdPrefix: string;
  open: boolean;
  defaultValue?: string;
  whitespace?: string;
  excludedValue?: string;
  nonRelevantBehavior?: string;
  disabledDisplay?: string;
  precision?: number;
  remoteOptions?: string;
  onToggle: (open: boolean) => void;
  onDefaultValueInput: (value: string) => void;
  onWhitespaceChange: (value: string) => void;
  onExcludedValueChange: (value: string) => void;
  onNonRelevantBehaviorChange: (value: string) => void;
  onDisabledDisplayChange: (value: string) => void;
  onPrecisionInput: (value: number | undefined) => void;
  onRemoteOptionsInput: (value: string) => void;
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
      <Dropdown
        label="Whitespace"
        value={props.whitespace}
        testId={`${props.testIdPrefix}-whitespace-input`}
        options={[
          { value: '', label: 'Default' },
          { value: 'preserve', label: 'Preserve' },
          { value: 'trim', label: 'Trim' },
          { value: 'normalize', label: 'Normalize' },
          { value: 'remove', label: 'Remove' }
        ]}
        onChange={props.onWhitespaceChange}
      />
      <Dropdown
        label="Excluded value"
        value={props.excludedValue}
        testId={`${props.testIdPrefix}-excluded-value-input`}
        options={[
          { value: '', label: 'Default' },
          { value: 'preserve', label: 'Preserve' },
          { value: 'null', label: 'Null' }
        ]}
        onChange={props.onExcludedValueChange}
      />
      <Dropdown
        label="Non-relevant behavior"
        value={props.nonRelevantBehavior}
        testId={`${props.testIdPrefix}-non-relevant-input`}
        options={[
          { value: '', label: 'Default' },
          { value: 'remove', label: 'Remove' },
          { value: 'empty', label: 'Empty' },
          { value: 'keep', label: 'Keep' }
        ]}
        onChange={props.onNonRelevantBehaviorChange}
      />
      <Dropdown
        label="Disabled display"
        value={props.disabledDisplay}
        testId={`${props.testIdPrefix}-disabled-display-input`}
        options={[
          { value: '', label: 'Default' },
          { value: 'hidden', label: 'Hidden' },
          { value: 'protected', label: 'Protected' }
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
    </Collapsible>
  );
}
