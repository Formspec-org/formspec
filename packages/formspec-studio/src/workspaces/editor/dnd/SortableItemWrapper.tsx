/** @filedesc Wrapper that makes a canvas item sortable via dnd-kit, fading the source during drag. */
import type { ReactNode } from 'react';
import { useSortable } from '@dnd-kit/react/sortable';

interface SortableItemWrapperProps {
  id: string;
  index: number;
  group?: string;
  children: ReactNode;
}

export function SortableItemWrapper({ id, index, group, children }: SortableItemWrapperProps) {
  const { ref, isDragSource } = useSortable({
    id,
    index,
    group,
    // Disable optimistic sorting — we handle positioning manually
    transition: null,
  });

  return (
    <div ref={ref} style={{ opacity: isDragSource ? 0.4 : 1 }}>
      {children}
    </div>
  );
}
