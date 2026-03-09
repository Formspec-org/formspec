import type { FormspecBind, FormspecItem } from 'formspec-engine';
import { useRef, useState } from 'preact/hooks';
import { DragHandle } from './DragHandle';
import { InlineEditableText } from './InlineEditableText';

interface FieldBlockProps {
  item: FormspecItem;
  path: string;
  bind?: FormspecBind;
  selected?: boolean;
  labelFocusToken?: number;
  onDragStart?: (path: string, event: DragEvent) => void;
  onDragEnd?: () => void;
  onLogicBadgeClick?: (badgeKey: FieldLogicBadgeKey) => void;
  onLabelInput?: (value: string) => void;
  onLabelCommit: (value: string) => void;
  onDescriptionCommit: (value: string) => void;
  onOptionsCommit: (options: Array<{ value: string; label: string }>) => void;
  onRequiredToggle?: (required: boolean) => void;
}

export type FieldLogicBadgeKey = 'required' | 'relevant' | 'calculate' | 'constraint' | 'readonly';

export function FieldBlock(props: FieldBlockProps) {
  const options = Array.isArray(props.item.options) ? props.item.options : [];

  return (
    <div class="field-block">
      <div class="item-block__top-row">
        <DragHandle path={props.path} onDragStart={props.onDragStart} onDragEnd={props.onDragEnd} />
        <span class="item-block__type-pill">{friendlyDataType(props.item.dataType)}</span>
        <LogicBadges path={props.path} bind={props.bind} onBadgeClick={props.onLogicBadgeClick} />
        {props.onRequiredToggle ? (
          <button
            type="button"
            class={`field-block__required-toggle${typeof props.bind?.required === 'boolean' && props.bind.required ? ' is-required' : ''}`}
            title={typeof props.bind?.required === 'boolean' && props.bind.required ? 'Remove required' : 'Mark required'}
            aria-label={typeof props.bind?.required === 'boolean' && props.bind.required ? 'Remove required' : 'Mark required'}
            data-testid={`required-toggle-${props.path}`}
            onClick={(event) => {
              event.stopPropagation();
              const isCurrentlyRequired = typeof props.bind?.required === 'boolean' && props.bind.required;
              props.onRequiredToggle?.(!isCurrentlyRequired);
            }}
          >
            *
          </button>
        ) : null}
      </div>

      <InlineEditableText
        value={props.item.label}
        placeholder="Untitled field"
        className="item-block__label"
        testIdPrefix={`label-${props.path}`}
        startEditingToken={props.labelFocusToken}
        editEnabled={props.selected}
        onInput={props.onLabelInput}
        onCommit={props.onLabelCommit}
      />

      <InlineEditableText
        value={props.item.description}
        placeholder="Add description"
        className="item-block__description"
        testIdPrefix={`description-${props.path}`}
        multiline
        editEnabled={props.selected}
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

type DraftOption = { label: string; value: string; _id: number };

function ChoiceOptionsEditor(props: {
  path: string;
  options: Array<{ value: string; label: string }>;
  onCommit: (options: Array<{ value: string; label: string }>) => void;
}) {
  const nextId = useRef(0);
  const makeDraft = (opts: Array<{ value: string; label: string }>): DraftOption[] =>
    opts.map((o) => ({ ...o, _id: nextId.current++ }));

  const [draft, setDraft] = useState<DraftOption[]>(() => makeDraft(props.options));
  const dragIndex = useRef<number | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const justAddedRef = useRef(false);

  // Sync from props when they change externally (undo/redo), but not while the user
  // has pending new empty rows in the editor.
  const lastPropsRef = useRef(props.options);
  if (props.options !== lastPropsRef.current) {
    lastPropsRef.current = props.options;
    const hasPending = draft.some((d) => d.label === '' && d.value === '');
    if (!hasPending) {
      setDraft(makeDraft(props.options));
    }
  }

  const stripIds = (d: DraftOption[]): Array<{ value: string; label: string }> =>
    d.map(({ label, value }) => ({ label, value }));

  const commitDraft = (next: DraftOption[]) => {
    setDraft(next);
    props.onCommit(stripIds(next));
  };

  const handleDragStart = (index: number) => {
    dragIndex.current = index;
  };

  const handleDragOver = (event: DragEvent, index: number) => {
    event.preventDefault();
    setDropTarget(index);
  };

  const handleDrop = (event: DragEvent, dropIndex: number) => {
    event.preventDefault();
    const from = dragIndex.current;
    if (from === null || from === dropIndex) {
      dragIndex.current = null;
      setDropTarget(null);
      return;
    }
    const next = [...draft];
    const [moved] = next.splice(from, 1);
    next.splice(dropIndex, 0, moved);
    commitDraft(next);
    dragIndex.current = null;
    setDropTarget(null);
  };

  const handleDragEnd = () => {
    dragIndex.current = null;
    setDropTarget(null);
  };

  return (
    <div class="field-options-editor" data-testid={`field-options-${props.path}`}>
      <p class="field-options-editor__title">Options</p>
      {draft.length > 0 ? (
        <ul class="field-options-editor__list">
          {draft.map((option, index) => (
            <li
              class={`field-options-editor__row${dropTarget === index ? ' is-drag-target' : ''}`}
              key={option._id}
              draggable
              onDragStart={(event) => {
                event.stopPropagation();
                handleDragStart(index);
              }}
              onDragOver={(event) => {
                event.stopPropagation();
                handleDragOver(event as unknown as DragEvent, index);
              }}
              onDrop={(event) => {
                event.stopPropagation();
                handleDrop(event as unknown as DragEvent, index);
              }}
              onDragEnd={(event) => {
                event.stopPropagation();
                handleDragEnd();
              }}
            >
              <span class="field-options-editor__drag-grip" aria-hidden>⠿</span>
              <input
                type="text"
                class="field-options-editor__input"
                value={option.label}
                aria-label="Option label"
                placeholder="Label"
                ref={(el) => {
                  if (el && justAddedRef.current && index === draft.length - 1 && option.label === '' && option.value === '') {
                    justAddedRef.current = false;
                    el.focus();
                  }
                }}
                onClick={(event) => {
                  event.stopPropagation();
                }}
                onInput={(event) => {
                  const newLabel = (event.currentTarget as HTMLInputElement).value;
                  setDraft(draft.map((o, i) => i === index ? { ...o, label: newLabel } : o));
                }}
                onBlur={() => {
                  props.onCommit(stripIds(draft));
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    props.onCommit(stripIds(draft));
                    justAddedRef.current = true;
                    setDraft([...draft, { value: '', label: '', _id: nextId.current++ }]);
                  }
                }}
              />
              <input
                type="text"
                class="field-options-editor__input"
                value={option.value}
                aria-label="Option value"
                placeholder="Value (optional)"
                onClick={(event) => {
                  event.stopPropagation();
                }}
                onInput={(event) => {
                  const newValue = (event.currentTarget as HTMLInputElement).value;
                  setDraft(draft.map((o, i) => i === index ? { ...o, value: newValue } : o));
                }}
                onBlur={() => {
                  props.onCommit(stripIds(draft));
                }}
              />
              <button
                type="button"
                class="field-options-editor__remove"
                aria-label="Remove option"
                onClick={(event) => {
                  event.stopPropagation();
                  commitDraft(draft.filter((_, candidateIndex) => candidateIndex !== index));
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
          justAddedRef.current = true;
          setDraft([...draft, { value: '', label: '', _id: nextId.current++ }]);
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
    badges.push({ key: 'required', label: '✱', title: 'Required' });
  }
  if (hasLogicValue(props.bind?.relevant)) {
    badges.push({ key: 'relevant', label: '👁', title: 'Conditionally visible — has "show when" condition' });
  }
  if (hasLogicValue(props.bind?.calculate)) {
    badges.push({ key: 'calculate', label: '⚡', title: 'Has logic — auto-calculated value' });
  }
  if (hasLogicValue(props.bind?.constraint)) {
    badges.push({ key: 'constraint', label: '✓', title: 'Has validation rules' });
  }
  if (hasLogicValue(props.bind?.readonly)) {
    badges.push({ key: 'readonly', label: '🔒', title: 'Locked when — has readonly condition' });
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

const DATA_TYPE_LABELS: Record<string, string> = {
  string: 'Text',
  text: 'Text',
  number: 'Number',
  integer: 'Integer',
  decimal: 'Decimal',
  boolean: 'Yes/No',
  date: 'Date',
  dateTime: 'Date & Time',
  time: 'Time',
  choice: 'Choice',
  multiChoice: 'Multi-choice',
  money: 'Money',
  attachment: 'File',
  uri: 'URL'
};

function friendlyDataType(dataType: string | undefined): string {
  if (!dataType) {
    return 'Text';
  }
  return DATA_TYPE_LABELS[dataType] ?? dataType;
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
