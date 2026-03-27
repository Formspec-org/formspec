/** @filedesc Draggable grip icon for reorderable list items. */
import { forwardRef } from 'react';

interface DragHandleProps {
  className?: string;
}

export const DragHandle = forwardRef<Element, DragHandleProps>(function DragHandle(
  { className = '' },
  ref,
) {
  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      data-testid="drag-handle"
      className={`self-stretch flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-grab shrink-0 px-1 ${className}`}
    >
      <svg width="6" height="10" viewBox="0 0 6 10" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="1.5" cy="2" r="1" fill="currentColor" className="text-muted/50" />
        <circle cx="4.5" cy="2" r="1" fill="currentColor" className="text-muted/50" />
        <circle cx="1.5" cy="5" r="1" fill="currentColor" className="text-muted/50" />
        <circle cx="4.5" cy="5" r="1" fill="currentColor" className="text-muted/50" />
        <circle cx="1.5" cy="8" r="1" fill="currentColor" className="text-muted/50" />
        <circle cx="4.5" cy="8" r="1" fill="currentColor" className="text-muted/50" />
      </svg>
    </div>
  );
});
