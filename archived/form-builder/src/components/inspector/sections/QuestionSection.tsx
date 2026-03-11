/**
 * QuestionSection — replaces BasicsSection with user-friendly vocabulary.
 * Contains: Question text (label), Help text (hint), Placeholder, Options, Default value.
 * Key, Description, Prefix/Suffix are hidden in Simple mode.
 */
import { useEffect, useState } from 'preact/hooks';
import { Collapsible } from '../../controls/Collapsible';
import { Dropdown } from '../../controls/Dropdown';
import { TextInput } from '../../controls/TextInput';
import type { InspectorTier } from '../Inspector';
import { meetsMinTier } from '../Inspector';
import { InlineHint } from '../InlineHint';

interface QuestionSectionProps {
  testIdPrefix: string;
  open: boolean;
  tier: InspectorTier;
  keyValue: string;
  label: string;
  description?: string;
  hint?: string;
  placeholder?: string;
  prefix?: string;
  suffix?: string;
  defaultValue?: string;
  optionSet?: string;
  availableOptionSets?: string[];
  showPlaceholder?: boolean;
  showPrefixSuffix?: boolean;
  showOptionSet?: boolean;
  canPromoteToOptionSet?: boolean;
  onToggle: (open: boolean) => void;
  onKeyCommit: (value: string) => void;
  onLabelInput: (value: string) => void;
  onDescriptionInput?: (value: string) => void;
  onHintInput?: (value: string) => void;
  onPlaceholderInput?: (value: string) => void;
  onPrefixInput?: (value: string) => void;
  onSuffixInput?: (value: string) => void;
  onDefaultValueInput?: (value: string) => void;
  onOptionSetChange?: (value: string) => void;
  onPromoteToOptionSet?: () => void;
}

export function QuestionSection(props: QuestionSectionProps) {
  const [keyDraft, setKeyDraft] = useState(props.keyValue);

  useEffect(() => {
    setKeyDraft(props.keyValue);
  }, [props.keyValue]);

  const showDescription = meetsMinTier(props.tier, 'advanced');
  const showKey = meetsMinTier(props.tier, 'advanced');
  const showPrefixSuffix = props.showPrefixSuffix && meetsMinTier(props.tier, 'advanced');
  const showDefault = meetsMinTier(props.tier, 'standard');

  const configuredTokens: string[] = [];
  if (props.hint) configuredTokens.push('Help text');
  if (props.placeholder) configuredTokens.push('Placeholder');
  if (props.defaultValue) configuredTokens.push('Default');

  return (
    <Collapsible
      id="question"
      title="Question"
      open={props.open}
      summary={configuredTokens.length ? configuredTokens.join(' · ') : null}
      onToggle={props.onToggle}
    >
      {showKey ? (
        <label class="inspector-control">
          <span class="inspector-control__label">Field ID</span>
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
      ) : null}

      <TextInput
        label="Question text"
        value={props.label}
        testId={`${props.testIdPrefix}-label-input`}
        onInput={props.onLabelInput}
      />

      <TextInput
        label="Help text"
        value={props.hint}
        testId={`${props.testIdPrefix}-hint-input`}
        onInput={(value) => { props.onHintInput?.(value); }}
      />
      <InlineHint tier={props.tier} text="Shown below the question to guide the respondent." />

      {props.showPlaceholder ? (
        <TextInput
          label="Placeholder"
          value={props.placeholder}
          testId={`${props.testIdPrefix}-placeholder-input`}
          onInput={(value) => { props.onPlaceholderInput?.(value); }}
        />
      ) : null}

      {props.showOptionSet ? (
        <>
          <Dropdown
            label="Shared answer choices"
            value={props.optionSet ?? ''}
            testId={`${props.testIdPrefix}-option-set-input`}
            options={[
              { value: '', label: 'Use inline options' },
              ...(props.availableOptionSets ?? []).map((name) => ({ value: name, label: name }))
            ]}
            onChange={(value) => { props.onOptionSetChange?.(value); }}
          />
          {props.canPromoteToOptionSet && !props.optionSet ? (
            <button
              type="button"
              class="basics-section__promote-btn"
              data-testid={`${props.testIdPrefix}-promote-option-set`}
              onClick={() => { props.onPromoteToOptionSet?.(); }}
            >
              Make reusable (promote to shared choices)
            </button>
          ) : null}
        </>
      ) : null}

      {showDefault ? (
        <TextInput
          label="Default value"
          value={props.defaultValue}
          testId={`${props.testIdPrefix}-default-input`}
          onInput={(value) => { props.onDefaultValueInput?.(value); }}
        />
      ) : null}

      {showDescription ? (
        <TextInput
          label="Internal notes"
          value={props.description}
          testId={`${props.testIdPrefix}-description-input`}
          onInput={(value) => { props.onDescriptionInput?.(value); }}
        />
      ) : null}

      {showPrefixSuffix ? (
        <>
          <TextInput
            label="Prefix"
            value={props.prefix}
            testId={`${props.testIdPrefix}-prefix-input`}
            onInput={(value) => { props.onPrefixInput?.(value); }}
          />
          <TextInput
            label="Suffix"
            value={props.suffix}
            testId={`${props.testIdPrefix}-suffix-input`}
            onInput={(value) => { props.onSuffixInput?.(value); }}
          />
        </>
      ) : null}
    </Collapsible>
  );
}
