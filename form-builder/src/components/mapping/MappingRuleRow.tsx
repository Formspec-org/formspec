import type { MappingRule } from '../../state/project';

export interface MappingRuleRowProps {
  index: number;
  rule: MappingRule;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onSourcePathInput: (value: string) => void;
  onTargetPathInput: (value: string) => void;
  onTransformChange: (value: string) => void;
}

const TRANSFORM_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'preserve', label: 'Copy as-is' },
  { value: 'drop', label: 'Drop field' },
  { value: 'expression', label: 'Custom expression' },
  { value: 'coerce', label: 'Type coercion' },
  { value: 'valueMap', label: 'Lookup table' },
  { value: 'flatten', label: 'Flatten' },
  { value: 'nest', label: 'Nest' },
  { value: 'constant', label: 'Fixed value' },
  { value: 'concat', label: 'Join values' },
  { value: 'split', label: 'Split value' }
];

export function MappingRuleRow(props: MappingRuleRowProps) {
  return (
    <tr class={`mapping-rule-row ${props.selected ? 'is-selected' : ''}`} onClick={props.onSelect}>
      <td>
        <input
          class="inspector-input mapping-rule-row__input"
          data-testid={`mapping-rule-source-${props.index}`}
          type="text"
          value={props.rule.sourcePath ?? ''}
          placeholder="source.path"
          onInput={(event) => {
            props.onSourcePathInput((event.currentTarget as HTMLInputElement).value);
          }}
        />
      </td>
      <td>
        <input
          class="inspector-input mapping-rule-row__input"
          data-testid={`mapping-rule-target-${props.index}`}
          type="text"
          value={props.rule.targetPath ?? ''}
          placeholder="target.path"
          onInput={(event) => {
            props.onTargetPathInput((event.currentTarget as HTMLInputElement).value);
          }}
        />
      </td>
      <td>
        <select
          class="inspector-input mapping-rule-row__input"
          data-testid={`mapping-rule-transform-${props.index}`}
          value={props.rule.transform}
          onChange={(event) => {
            props.onTransformChange((event.currentTarget as HTMLSelectElement).value);
          }}
        >
          {TRANSFORM_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </td>
      <td>
        <span
          class={`mapping-rule-row__reversible ${resolveReversibleClassName(props.rule)}`}
          data-testid={`mapping-rule-reversible-${props.index}`}
        >
          {resolveReversibleLabel(props.rule)}
        </span>
      </td>
      <td>
        <div class="mapping-rule-row__actions">
          <button
            type="button"
            class="mapping-rule-row__action"
            data-testid={`mapping-rule-edit-${props.index}`}
            onClick={(event) => {
              event.stopPropagation();
              props.onSelect();
            }}
          >
            Edit
          </button>
          <button
            type="button"
            class="mapping-rule-row__action"
            data-testid={`mapping-rule-delete-${props.index}`}
            onClick={(event) => {
              event.stopPropagation();
              props.onDelete();
            }}
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}

export function resolveReversibleLabel(rule: MappingRule): string {
  if (rule.bidirectional === false) {
    return 'No';
  }

  if (
    rule.transform === 'preserve'
    || rule.transform === 'coerce'
    || rule.transform === 'valueMap'
    || rule.transform === 'flatten'
    || rule.transform === 'nest'
  ) {
    return 'Yes';
  }

  if (rule.transform === 'expression') {
    return rule.reverse ? 'Custom' : 'No';
  }

  if (
    rule.transform === 'drop'
    || rule.transform === 'constant'
    || rule.transform === 'concat'
    || rule.transform === 'split'
  ) {
    return rule.reverse ? 'Custom' : 'No';
  }

  return 'Unknown';
}

function resolveReversibleClassName(rule: MappingRule): string {
  const label = resolveReversibleLabel(rule);
  if (label === 'Yes') {
    return 'is-yes';
  }
  if (label === 'Custom') {
    return 'is-custom';
  }
  if (label === 'No') {
    return 'is-no';
  }
  return 'is-unknown';
}
