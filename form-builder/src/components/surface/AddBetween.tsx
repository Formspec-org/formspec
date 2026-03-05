export interface AddBetweenProps {
  parentPath: string | null;
  index: number;
  onAdd: (parentPath: string | null, index: number, anchor: HTMLElement | null) => void;
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
      class="add-between"
      data-testid={`add-between-slot-${idSegment(props.parentPath)}-${props.index}`}
      onClick={(event) => {
        event.stopPropagation();
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
