/** @filedesc Registers a Pragmatic `dropTarget` for layout `container-drop` zones (empty container, collapsible header). */
import { useEffect } from 'react';
import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { LAYOUT_PDND_KIND } from './layout-pdnd';
import { isRecord } from '../shared/runtime-guards';

export function useLayoutPragmaticContainerDrop(args: {
  element: HTMLElement | null;
  enabled: boolean;
  nodeRef: { bind?: string; nodeId?: string };
}): void {
  const { element, enabled, nodeRef } = args;

  useEffect(() => {
    if (!enabled || !element) return;

    return dropTargetForElements({
      element,
      canDrop: ({ source }) => {
        const d = source.data;
        if (!isRecord(d)) return false;
        return d.kind === LAYOUT_PDND_KIND;
      },
      getData: () => ({
        kind: LAYOUT_PDND_KIND,
        type: 'container-drop',
        nodeRef,
      }),
    });
  }, [element, enabled, nodeRef.bind, nodeRef.nodeId]);
}
