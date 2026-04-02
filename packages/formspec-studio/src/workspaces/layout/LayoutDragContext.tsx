/** @filedesc Context exposing current drag-active state from LayoutDndProvider to all layout canvas children. */
import { createContext, useContext } from 'react';

export const LayoutDragContext = createContext<{ isDragActive: boolean }>({ isDragActive: false });

export function useLayoutDragActive(): boolean {
  return useContext(LayoutDragContext).isDragActive;
}
