import type { ComponentChildren } from 'preact';
import type { FormspecItem } from 'formspec-engine';
import { useState } from 'preact/hooks';
import { LinkedBadge } from '../subform/LinkedBadge';
import { DragHandle } from './DragHandle';
import { InlineEditableText } from './InlineEditableText';

export interface GroupBlockProps {
  item: FormspecItem;
  path: string;
  selected?: boolean;
  childrenContent: ComponentChildren;
  labelFocusToken?: number;
  onDragStart?: (path: string, event: DragEvent) => void;
  onDragEnd?: () => void;
  onLabelInput?: (value: string) => void;
  onLabelCommit: (value: string) => void;
  onDescriptionCommit: (value: string) => void;
}

export function GroupBlock(props: GroupBlockProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <section class="group-block">
      <div class="item-block__top-row">
        <DragHandle path={props.path} onDragStart={props.onDragStart} onDragEnd={props.onDragEnd} />
        <span class="item-block__type-pill">Group</span>
        <LinkedBadge item={props.item} path={props.path} />
        {props.item.repeatable ? <span class="group-block__repeat-pill">Repeatable</span> : null}
        <button
          type="button"
          class="group-block__collapse-button"
          onClick={(event) => {
            event.stopPropagation();
            setCollapsed((value) => !value);
          }}
        >
          {collapsed ? 'Expand' : 'Collapse'}
        </button>
      </div>

      <InlineEditableText
        value={props.item.label}
        placeholder="Untitled group"
        className="item-block__label"
        testIdPrefix={`label-${props.path}`}
        startEditingToken={props.labelFocusToken}
        editEnabled={props.selected}
        onInput={props.onLabelInput}
        onCommit={props.onLabelCommit}
      />

      <InlineEditableText
        value={props.item.description}
        placeholder="Add group description"
        className="item-block__description"
        testIdPrefix={`description-${props.path}`}
        multiline
        editEnabled={props.selected}
        onCommit={props.onDescriptionCommit}
      />

      {collapsed ? null : <div class="group-block__children">{props.childrenContent}</div>}
    </section>
  );
}
