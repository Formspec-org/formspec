/**
 * Answer Type Picker — the most prominent control in the field inspector.
 * Maps user-friendly answer types to the spec's dataType + component pairing.
 */
import { useState } from 'preact/hooks';

/** Canonical answer type definition for the picker. */
export interface AnswerTypeOption {
  id: string;
  label: string;
  icon: string;
  dataType: string;
  component: string;
  /** When true, shown in the primary strip; otherwise in "More types..." */
  primary: boolean;
}

const ANSWER_TYPES: AnswerTypeOption[] = [
  { id: 'short-text',   label: 'Short text',    icon: 'Aa',  dataType: 'string',      component: 'TextInput',      primary: true },
  { id: 'long-text',    label: 'Long text',     icon: '¶',   dataType: 'text',        component: 'TextInput',      primary: true },
  { id: 'number',       label: 'Number',        icon: '#',   dataType: 'decimal',     component: 'NumberInput',    primary: true },
  { id: 'choice',       label: 'Choice',        icon: '○',   dataType: 'choice',      component: 'Select',         primary: true },
  { id: 'multi-select', label: 'Multi-select',  icon: '☑',   dataType: 'multiChoice', component: 'CheckboxGroup',  primary: true },
  { id: 'date',         label: 'Date',          icon: '📅',  dataType: 'date',        component: 'DatePicker',     primary: true },
  { id: 'toggle',       label: 'Toggle',        icon: '⊘',   dataType: 'boolean',     component: 'Toggle',         primary: true },
  { id: 'file-upload',  label: 'File upload',   icon: '↑',   dataType: 'attachment',  component: 'FileUpload',     primary: true },
  // Secondary types
  { id: 'integer',      label: 'Integer',       icon: '1',   dataType: 'integer',     component: 'NumberInput',    primary: false },
  { id: 'rating',       label: 'Rating',        icon: '★',   dataType: 'integer',     component: 'Rating',         primary: false },
  { id: 'slider',       label: 'Slider',        icon: '—',   dataType: 'decimal',     component: 'Slider',         primary: false },
  { id: 'radio',        label: 'Radio buttons', icon: '◉',   dataType: 'choice',      component: 'RadioGroup',     primary: false },
  { id: 'checkbox',     label: 'Checkbox',      icon: '☐',   dataType: 'boolean',     component: 'Checkbox',       primary: false },
  { id: 'date-time',    label: 'Date & time',   icon: '🕐',  dataType: 'dateTime',    component: 'DatePicker',     primary: false },
  { id: 'time',         label: 'Time',          icon: '⏱',   dataType: 'time',        component: 'DatePicker',     primary: false },
  { id: 'money',        label: 'Money',         icon: '$',   dataType: 'money',       component: 'MoneyInput',     primary: false },
  { id: 'signature',    label: 'Signature',     icon: '✎',   dataType: 'attachment',  component: 'Signature',      primary: false },
  { id: 'url',          label: 'URL',           icon: '🔗',  dataType: 'uri',         component: 'TextInput',      primary: false },
];

/** Resolve current answer type ID from dataType + component. */
export function resolveAnswerTypeId(dataType: string | undefined, component: string | undefined): string {
  const dt = dataType ?? 'string';
  const comp = component ?? '';
  // Try exact match first
  const exact = ANSWER_TYPES.find((at) => at.dataType === dt && at.component === comp);
  if (exact) return exact.id;
  // Fall back to dataType match
  const byType = ANSWER_TYPES.find((at) => at.dataType === dt);
  return byType?.id ?? 'short-text';
}

/** Look up answer type definition by ID. */
export function getAnswerType(id: string): AnswerTypeOption | undefined {
  return ANSWER_TYPES.find((at) => at.id === id);
}

interface AnswerTypePickerProps {
  currentDataType: string | undefined;
  currentComponent: string | undefined;
  onChange: (dataType: string, component: string) => void;
}

export function AnswerTypePicker(props: AnswerTypePickerProps) {
  const [showMore, setShowMore] = useState(false);
  const currentId = resolveAnswerTypeId(props.currentDataType, props.currentComponent);

  const primaryTypes = ANSWER_TYPES.filter((at) => at.primary);
  const secondaryTypes = ANSWER_TYPES.filter((at) => !at.primary);

  const handleSelect = (at: AnswerTypeOption) => {
    if (at.id !== currentId) {
      props.onChange(at.dataType, at.component);
    }
    setShowMore(false);
  };

  return (
    <div class="answer-type-picker" data-testid="answer-type-picker">
      <span class="answer-type-picker__label">Answer type</span>
      <div class="answer-type-picker__strip">
        {primaryTypes.map((at) => (
          <button
            key={at.id}
            type="button"
            class={`answer-type-picker__btn${currentId === at.id ? ' is-active' : ''}`}
            data-testid={`answer-type-${at.id}`}
            title={at.label}
            onClick={() => handleSelect(at)}
          >
            <span class="answer-type-picker__icon">{at.icon}</span>
            <span class="answer-type-picker__text">{at.label}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        class="answer-type-picker__more-btn"
        data-testid="answer-type-more"
        onClick={() => setShowMore(!showMore)}
      >
        {showMore ? 'Less types' : 'More types...'}
      </button>
      {showMore ? (
        <div class="answer-type-picker__expanded" data-testid="answer-type-expanded">
          {secondaryTypes.map((at) => (
            <button
              key={at.id}
              type="button"
              class={`answer-type-picker__btn answer-type-picker__btn--secondary${currentId === at.id ? ' is-active' : ''}`}
              data-testid={`answer-type-${at.id}`}
              onClick={() => handleSelect(at)}
            >
              <span class="answer-type-picker__icon">{at.icon}</span>
              <span class="answer-type-picker__text">{at.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
