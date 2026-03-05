import type { FormspecBind, FormspecItem } from 'formspec-engine';
import { DragHandle } from './DragHandle';
import { InlineEditableText } from './InlineEditableText';

export interface FieldBlockProps {
  item: FormspecItem;
  path: string;
  bind?: FormspecBind;
  labelFocusToken?: number;
  onLogicBadgeClick?: (badgeKey: FieldLogicBadgeKey) => void;
  onLabelCommit: (value: string) => void;
  onDescriptionCommit: (value: string) => void;
  onOptionsCommit: (options: Array<{ value: string; label: string }>) => void;
}

export type FieldLogicBadgeKey = 'required' | 'relevant' | 'calculate' | 'constraint' | 'readonly';

export function FieldBlock(props: FieldBlockProps) {
  const options = Array.isArray(props.item.options) ? props.item.options : [];

  return (
    <div class="field-block">
      <div class="item-block__top-row">
        <DragHandle path={props.path} />
        <span class="item-block__type-pill">{props.item.dataType ?? 'string'}</span>
        <LogicBadges path={props.path} bind={props.bind} onBadgeClick={props.onLogicBadgeClick} />
      </div>

      <InlineEditableText
        value={props.item.label}
        placeholder="Untitled field"
        className="item-block__label"
        testIdPrefix={`label-${props.path}`}
        startEditingToken={props.labelFocusToken}
        onCommit={props.onLabelCommit}
      />

      <InlineEditableText
        value={props.item.description}
        placeholder="Add description"
        className="item-block__description"
        testIdPrefix={`description-${props.path}`}
        multiline
        onCommit={props.onDescriptionCommit}
      />

      {props.item.dataType === 'choice' || props.item.dataType === 'multiChoice' ? (
        <ChoiceOptionsEditor
          path={props.path}
          options={options}
          onCommit={props.onOptionsCommit}
        />
      ) : (
        <div class="field-block__input-preview" aria-hidden>
          Input preview
        </div>
      )}
    </div>
  );
}

function ChoiceOptionsEditor(props: {
  path: string;
  options: Array<{ value: string; label: string }>;
  onCommit: (options: Array<{ value: string; label: string }>) => void;
}) {
  const hasOptions = props.options.length > 0;

  return (
    <div class="field-options-editor" data-testid={`field-options-${props.path}`}>
      <p class="field-options-editor__title">Options</p>
      {hasOptions ? (
        <ul class="field-options-editor__list">
          {props.options.map((option, index) => (
            <li class="field-options-editor__row" key={`${option.value}-${index}`}>
              <button
                type="button"
                class="field-options-editor__order-button"
                aria-label="Move option up"
                disabled={index === 0}
                onClick={(event) => {
                  event.stopPropagation();
                  if (index === 0) {
                    return;
                  }
                  const next = [...props.options];
                  const [entry] = next.splice(index, 1);
                  next.splice(index - 1, 0, entry);
                  props.onCommit(next);
                }}
              >
                ↑
              </button>
              <button
                type="button"
                class="field-options-editor__order-button"
                aria-label="Move option down"
                disabled={index === props.options.length - 1}
                onClick={(event) => {
                  event.stopPropagation();
                  if (index >= props.options.length - 1) {
                    return;
                  }
                  const next = [...props.options];
                  const [entry] = next.splice(index, 1);
                  next.splice(index + 1, 0, entry);
                  props.onCommit(next);
                }}
              >
                ↓
              </button>
              <input
                type="text"
                class="field-options-editor__input"
                value={option.label}
                aria-label="Option label"
                onClick={(event) => {
                  event.stopPropagation();
                }}
                onInput={(event) => {
                  const next = [...props.options];
                  next[index] = { ...next[index], label: (event.currentTarget as HTMLInputElement).value };
                  props.onCommit(next);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    props.onCommit([...props.options, { value: '', label: '' }]);
                  }
                }}
              />
              <input
                type="text"
                class="field-options-editor__input"
                value={option.value}
                aria-label="Option value"
                onClick={(event) => {
                  event.stopPropagation();
                }}
                onInput={(event) => {
                  const next = [...props.options];
                  next[index] = { ...next[index], value: (event.currentTarget as HTMLInputElement).value };
                  props.onCommit(next);
                }}
              />
              <button
                type="button"
                class="field-options-editor__remove"
                aria-label="Remove option"
                onClick={(event) => {
                  event.stopPropagation();
                  props.onCommit(props.options.filter((_, candidateIndex) => candidateIndex !== index));
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p class="field-options-editor__empty">No options yet.</p>
      )}
      <button
        type="button"
        class="field-options-editor__add"
        onClick={(event) => {
          event.stopPropagation();
          props.onCommit([...props.options, { value: '', label: '' }]);
        }}
      >
        + Add option
      </button>
    </div>
  );
}

function LogicBadges(props: {
  path: string;
  bind?: FormspecBind;
  onBadgeClick?: (badgeKey: FieldLogicBadgeKey) => void;
}) {
  const badges: Array<{ key: FieldLogicBadgeKey; label: string; title: string }> = [];
  if (hasLogicValue(props.bind?.required)) {
    badges.push({ key: 'required', label: '●', title: 'Required' });
  }
  if (hasLogicValue(props.bind?.relevant)) {
    badges.push({ key: 'relevant', label: '?', title: 'Conditional visibility' });
  }
  if (hasLogicValue(props.bind?.calculate)) {
    badges.push({ key: 'calculate', label: '=', title: 'Calculated value' });
  }
  if (hasLogicValue(props.bind?.constraint)) {
    badges.push({ key: 'constraint', label: '!', title: 'Constraint' });
  }
  if (hasLogicValue(props.bind?.readonly)) {
    badges.push({ key: 'readonly', label: '🔒', title: 'Readonly' });
  }

  if (!badges.length) {
    return null;
  }

  return (
    <div class="logic-badges" aria-label="Field logic badges">
      {badges.map((badge) => (
        <button
          key={badge.key}
          type="button"
          class="logic-badge"
          title={badge.title}
          data-testid={`logic-badge-${props.path}-${badge.key}`}
          aria-label={`Open ${badge.title} settings`}
          onClick={(event) => {
            event.stopPropagation();
            props.onBadgeClick?.(badge.key);
          }}
        >
          {badge.label}
        </button>
      ))}
    </div>
  );
}

function hasLogicValue(value: unknown): boolean {
  if (value === undefined || value === null) {
    return false;
  }
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  return true;
}
