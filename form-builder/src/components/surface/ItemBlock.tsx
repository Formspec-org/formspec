import type { ComponentChildren } from 'preact';
import type { FormspecBind, FormspecItem } from 'formspec-engine';
import { DisplayBlock } from './DisplayBlock';
import { FieldBlock, type FieldLogicBadgeKey } from './FieldBlock';
import { GroupBlock } from './GroupBlock';

export interface ItemBlockProps {
  item: FormspecItem;
  path: string;
  selected: boolean;
  bind?: FormspecBind;
  labelFocusToken?: number;
  onDragStart?: (path: string, event: DragEvent) => void;
  onDragEnd?: () => void;
  onSelect: (path: string) => void;
  onLogicBadgeClick: (path: string, badgeKey: FieldLogicBadgeKey) => void;
  onLabelInput?: (path: string, value: string) => void;
  onLabelCommit: (path: string, value: string) => void;
  onDescriptionCommit: (path: string, value: string) => void;
  onOptionsCommit: (path: string, options: Array<{ value: string; label: string }>) => void;
  onRequiredToggle?: (path: string, required: boolean) => void;
  renderChildren: (items: FormspecItem[], parentPath: string) => ComponentChildren;
}

export function ItemBlock(props: ItemBlockProps) {
  const className = `surface-item-block${props.selected ? ' is-selected' : ''}`;

  return (
    <article
      class={className}
      data-item-path={props.path}
      data-testid={`surface-item-${props.path}`}
      onClick={(event) => {
        event.stopPropagation();
        props.onSelect(props.path);
      }}
    >
      {renderItemBody(props)}
    </article>
  );
}

function renderItemBody(props: ItemBlockProps) {
  if (props.item.type === 'field') {
    const fieldChildren = Array.isArray(props.item.children) && props.item.children.length > 0
      ? props.item.children : null;

    return (
      <>
        <FieldBlock
          item={props.item}
          path={props.path}
          bind={props.bind}
          selected={props.selected}
          labelFocusToken={props.labelFocusToken}
          onDragStart={props.onDragStart}
          onDragEnd={props.onDragEnd}
          onLogicBadgeClick={(badgeKey) => {
            props.onLogicBadgeClick(props.path, badgeKey);
          }}
          onLabelInput={(value) => {
            props.onLabelInput?.(props.path, value);
          }}
          onLabelCommit={(value) => {
            props.onLabelCommit(props.path, value);
          }}
          onDescriptionCommit={(value) => {
            props.onDescriptionCommit(props.path, value);
          }}
          onOptionsCommit={(options) => {
            props.onOptionsCommit(props.path, options);
          }}
          onRequiredToggle={props.onRequiredToggle ? (required) => {
            props.onRequiredToggle!(props.path, required);
          } : undefined}
        />
        {fieldChildren ? (
          <div class="field-block__sub-questions">
            {props.renderChildren(fieldChildren, props.path)}
          </div>
        ) : null}
      </>
    );
  }

  if (props.item.type === 'group') {
    return (
      <GroupBlock
        item={props.item}
        path={props.path}
        selected={props.selected}
        labelFocusToken={props.labelFocusToken}
        onDragStart={props.onDragStart}
        onDragEnd={props.onDragEnd}
        onLabelInput={(value) => {
          props.onLabelInput?.(props.path, value);
        }}
        onLabelCommit={(value) => {
          props.onLabelCommit(props.path, value);
        }}
        onDescriptionCommit={(value) => {
          props.onDescriptionCommit(props.path, value);
        }}
        childrenContent={props.renderChildren(props.item.children ?? [], props.path)}
      />
    );
  }

  return (
    <DisplayBlock
      item={props.item}
      path={props.path}
      selected={props.selected}
      labelFocusToken={props.labelFocusToken}
      onDragStart={props.onDragStart}
      onDragEnd={props.onDragEnd}
      onLabelInput={(value) => {
        props.onLabelInput?.(props.path, value);
      }}
      onLabelCommit={(value) => {
        props.onLabelCommit(props.path, value);
      }}
      onDescriptionCommit={(value) => {
        props.onDescriptionCommit(props.path, value);
      }}
    />
  );
}
