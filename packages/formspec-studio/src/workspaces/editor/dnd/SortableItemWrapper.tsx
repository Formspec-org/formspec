/** @filedesc Wrapper that makes a canvas item sortable via dnd-kit, fading the source during drag. */
import { cloneElement, isValidElement, type ReactElement } from 'react';
import { useSortable } from '@dnd-kit/react/sortable';

interface SortableItemWrapperProps {
  id: string;
  index: number;
  group?: string;
  children: ReactElement;
}

export function SortableItemWrapper({ id, index, group, children }: SortableItemWrapperProps) {
  const { ref, handleRef, isDragSource } = useSortable({
    id,
    index,
    group,
  });

  const child = isValidElement(children)
    ? cloneElement(children, {
      dragHandleRef: handleRef,
      isDragSource,
    } as Record<string, unknown>)
    : children;

  return (
    <div ref={ref} className="py-0.5" style={{ opacity: isDragSource ? 0.4 : 1 }}>
      {child}
    </div>
  );
}
