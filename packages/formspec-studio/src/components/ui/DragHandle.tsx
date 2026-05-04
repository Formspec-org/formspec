/** @filedesc Draggable grip icon for reorderable list items — focusable button used as Pragmatic `dragHandle`. */
import { forwardRef } from 'react';

interface DragHandleProps {
  className?: string;
  label?: string;
}

export const DragHandle = forwardRef<Element, DragHandleProps>(function DragHandle(
  { className = '', label = 'Reorder item' },
  ref,
) {
  return (
    <button
      type="button"
      ref={ref as React.Ref<HTMLButtonElement>}
      data-testid="drag-handle"
      aria-label={label}
      tabIndex={0}
      className={`self-stretch flex items-center justify-center opacity-[0.45] group-hover:opacity-100 group-focus-within:opacity-100 transition-[opacity,color,background-color] cursor-grab shrink-0 rounded-[6px] px-1 text-ink/45 hover:bg-bg-default/55 hover:text-ink/70 focus-visible:opacity-100 focus-ring ${className}`}
    >
      <svg width="6" height="10" viewBox="0 0 6 10" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="1.5" cy="2" r="1" fill="currentColor" />
        <circle cx="4.5" cy="2" r="1" fill="currentColor" />
        <circle cx="1.5" cy="5" r="1" fill="currentColor" />
        <circle cx="4.5" cy="5" r="1" fill="currentColor" />
        <circle cx="1.5" cy="8" r="1" fill="currentColor" />
        <circle cx="4.5" cy="8" r="1" fill="currentColor" />
      </svg>
    </button>
  );
});
