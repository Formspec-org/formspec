export interface AddBetweenProps {
  parentPath: string | null;
  index: number;
  onAdd: (parentPath: string | null, index: number, anchor: HTMLElement | null) => void;
  active?: boolean;
  isDragging?: boolean;
  onDragOver?: (parentPath: string | null, index: number, event: DragEvent) => void;
  onDragLeave?: (parentPath: string | null, index: number) => void;
  onDrop?: (parentPath: string | null, index: number, event: DragEvent) => void;
}

function idSegment(path: string | null): string {
  if (!path) {
    return 'root';
  }
  return path.replace(/\./g, '_');
}

export function AddBetween(props: AddBetweenProps) {
  return (
    <div
      class={`add-between${props.active ? ' is-drag-target' : ''}${props.isDragging ? ' is-drag-active' : ''}`}
      data-testid={`add-between-slot-${idSegment(props.parentPath)}-${props.index}`}
      onClick={(event) => {
        event.stopPropagation();
      }}
      onDragOver={(event) => {
        props.onDragOver?.(props.parentPath, props.index, event as DragEvent);
      }}
      onDragLeave={() => {
        props.onDragLeave?.(props.parentPath, props.index);
      }}
      onDrop={(event) => {
        props.onDrop?.(props.parentPath, props.index, event as DragEvent);
      }}
    >
      <button
        type="button"
        class="add-between__button"
        data-testid={`add-between-${idSegment(props.parentPath)}-${props.index}`}
        onClick={(event) => {
          event.stopPropagation();
          props.onAdd(props.parentPath, props.index, event.currentTarget as HTMLElement);
        }}
      >
        + Add field
      </button>
    </div>
  );
}
