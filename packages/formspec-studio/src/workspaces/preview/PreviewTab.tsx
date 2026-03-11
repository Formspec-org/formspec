import { useState } from 'react';
import { useDefinition } from '../../state/useDefinition';
import { ViewportSwitcher, type Viewport } from './ViewportSwitcher';
import { ComponentRenderer } from './ComponentRenderer';

const viewportWidths: Record<Viewport, string> = {
  desktop: '100%',
  tablet: '768px',
  mobile: '375px',
};

export function PreviewTab() {
  const definition = useDefinition();
  const [viewport, setViewport] = useState<Viewport>('desktop');

  const items = definition?.items ?? [];

  return (
    <div className="flex flex-col h-full">
      <ViewportSwitcher active={viewport} onChange={setViewport} />
      <div className="flex-1 overflow-auto flex justify-center p-4 bg-subtle/50">
        <div
          className="bg-surface rounded border border-border p-4 h-fit"
          style={{ width: viewportWidths[viewport], maxWidth: '100%' }}
        >
          {items.length > 0 ? (
            <ComponentRenderer items={items as any} />
          ) : (
            <div className="text-center text-muted text-sm py-8">
              No items to preview
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
