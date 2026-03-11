interface DragHandleProps {
  path: string;
  onDragStart?: (path: string, event: DragEvent) => void;
  onDragEnd?: () => void;
}

export function DragHandle(props: DragHandleProps) {
  return (
    <button
      type="button"
      class="drag-handle"
      data-testid={`drag-handle-${props.path}`}
      aria-label="Drag item"
      title="Drag handle"
      draggable
      onClick={(event) => {
        event.stopPropagation();
      }}
      onDragStart={(event) => {
        event.stopPropagation();
        event.dataTransfer?.setData('text/plain', props.path);
        props.onDragStart?.(props.path, event as DragEvent);
      }}
      onDragEnd={(event) => {
        event.stopPropagation();
        props.onDragEnd?.();
      }}
    >
      ⋮⋮
    </button>
  );
}
