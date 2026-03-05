import type { FormspecItem } from 'formspec-engine';
import { DragHandle } from './DragHandle';
import { InlineEditableText } from './InlineEditableText';

export interface DisplayBlockProps {
  item: FormspecItem;
  path: string;
  labelFocusToken?: number;
  onLabelCommit: (value: string) => void;
  onDescriptionCommit: (value: string) => void;
}

export function DisplayBlock(props: DisplayBlockProps) {
  return (
    <div class="display-block">
      <div class="item-block__top-row">
        <DragHandle path={props.path} />
        <span class="item-block__type-pill">Display</span>
      </div>

      <InlineEditableText
        value={props.item.label}
        placeholder="Untitled text"
        className="display-block__label"
        testIdPrefix={`label-${props.path}`}
        startEditingToken={props.labelFocusToken}
        onCommit={props.onLabelCommit}
      />

      <InlineEditableText
        value={props.item.description}
        placeholder="Add display text"
        className="item-block__description"
        testIdPrefix={`description-${props.path}`}
        multiline
        onCommit={props.onDescriptionCommit}
      />
    </div>
  );
}
