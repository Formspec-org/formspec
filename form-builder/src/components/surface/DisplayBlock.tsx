import type { FormspecItem } from 'formspec-engine';
import { DragHandle } from './DragHandle';
import { InlineEditableText } from './InlineEditableText';

interface DisplayBlockProps {
  item: FormspecItem;
  path: string;
  selected?: boolean;
  labelFocusToken?: number;
  onDragStart?: (path: string, event: DragEvent) => void;
  onDragEnd?: () => void;
  onLabelInput?: (value: string) => void;
  onLabelCommit: (value: string) => void;
  onDescriptionCommit: (value: string) => void;
}

export function DisplayBlock(props: DisplayBlockProps) {
  return (
    <div class="display-block">
      <div class="item-block__top-row">
        <DragHandle path={props.path} onDragStart={props.onDragStart} onDragEnd={props.onDragEnd} />
        <span class="item-block__type-pill">Display</span>
      </div>

      <InlineEditableText
        value={props.item.label}
        placeholder="Untitled text"
        className="display-block__label"
        testIdPrefix={`label-${props.path}`}
        startEditingToken={props.labelFocusToken}
        editEnabled={props.selected}
        onInput={props.onLabelInput}
        onCommit={props.onLabelCommit}
      />

      <InlineEditableText
        value={props.item.description}
        placeholder="Add display text"
        className="item-block__description"
        testIdPrefix={`description-${props.path}`}
        multiline
        editEnabled={props.selected}
        onCommit={props.onDescriptionCommit}
      />
    </div>
  );
}
