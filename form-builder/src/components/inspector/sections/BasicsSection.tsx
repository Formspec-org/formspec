import { useEffect, useState } from 'preact/hooks';
import { Collapsible } from '../../controls/Collapsible';
import { TextInput } from '../../controls/TextInput';
import { Toggle } from '../../controls/Toggle';

export interface BasicsSectionProps {
  testIdPrefix: string;
  open: boolean;
  keyValue: string;
  label: string;
  description?: string;
  hint?: string;
  placeholder?: string;
  required?: boolean;
  showDescription?: boolean;
  showHint?: boolean;
  showPlaceholder?: boolean;
  showRequired?: boolean;
  onToggle: (open: boolean) => void;
  onKeyCommit: (value: string) => void;
  onLabelInput: (value: string) => void;
  onDescriptionInput?: (value: string) => void;
  onHintInput?: (value: string) => void;
  onPlaceholderInput?: (value: string) => void;
  onRequiredToggle?: (value: boolean) => void;
}

export function BasicsSection(props: BasicsSectionProps) {
  const [keyDraft, setKeyDraft] = useState(props.keyValue);

  useEffect(() => {
    setKeyDraft(props.keyValue);
  }, [props.keyValue]);

  const hasSummary = props.required || props.hint || props.placeholder;

  return (
    <Collapsible
      id="basics"
      title="Basics"
      open={props.open}
      summary={hasSummary ? 'Configured' : null}
      onToggle={props.onToggle}
    >
      <label class="inspector-control">
        <span class="inspector-control__label">Key</span>
        <input
          class="inspector-input"
          data-testid={`${props.testIdPrefix}-key-input`}
          type="text"
          value={keyDraft}
          onInput={(event) => {
            setKeyDraft((event.currentTarget as HTMLInputElement).value);
          }}
          onBlur={(event) => {
            props.onKeyCommit((event.currentTarget as HTMLInputElement).value);
          }}
        />
      </label>

      <TextInput
        label="Label"
        value={props.label}
        testId={`${props.testIdPrefix}-label-input`}
        onInput={props.onLabelInput}
      />

      {props.showDescription ? (
        <TextInput
          label="Description"
          value={props.description}
          testId={`${props.testIdPrefix}-description-input`}
          onInput={(value) => {
            props.onDescriptionInput?.(value);
          }}
        />
      ) : null}

      {props.showHint ? (
        <TextInput
          label="Hint"
          value={props.hint}
          testId={`${props.testIdPrefix}-hint-input`}
          onInput={(value) => {
            props.onHintInput?.(value);
          }}
        />
      ) : null}

      {props.showPlaceholder ? (
        <TextInput
          label="Placeholder"
          value={props.placeholder}
          testId={`${props.testIdPrefix}-placeholder-input`}
          onInput={(value) => {
            props.onPlaceholderInput?.(value);
          }}
        />
      ) : null}

      {props.showRequired ? (
        <Toggle
          label="Required"
          checked={Boolean(props.required)}
          testId={`${props.testIdPrefix}-required-toggle`}
          onToggle={(value) => {
            props.onRequiredToggle?.(value);
          }}
        />
      ) : null}
    </Collapsible>
  );
}
