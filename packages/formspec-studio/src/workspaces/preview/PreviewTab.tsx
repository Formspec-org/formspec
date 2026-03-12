import { useState } from 'react';
import { useDefinition } from '../../state/useDefinition';
import { ViewportSwitcher, type Viewport } from './ViewportSwitcher';
import { FormspecPreviewHost } from './FormspecPreviewHost';
import { JsonDocumentsView } from './JsonDocumentsView';

const viewportWidths: Record<Viewport, string> = {
  desktop: '100%',
  tablet: '768px',
  mobile: '375px',
};

export type PreviewMode = 'form' | 'json';

interface PreviewTabProps {
  viewport?: Viewport;
  onViewportChange?: (viewport: Viewport) => void;
  mode?: PreviewMode;
  onModeChange?: (mode: PreviewMode) => void;
}

export function PreviewTab({
  viewport,
  onViewportChange,
  mode,
  onModeChange,
}: PreviewTabProps = {}) {
  const definition = useDefinition();
  const [internalViewport, setInternalViewport] = useState<Viewport>('desktop');
  const [internalMode, setInternalMode] = useState<PreviewMode>('form');
  const activeViewport = viewport ?? internalViewport;
  const setViewport = onViewportChange ?? setInternalViewport;
  const activeMode = mode ?? internalMode;
  const setMode = onModeChange ?? setInternalMode;

  const items = definition?.items ?? [];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-2 p-2 border-b border-border">
        <div className="flex gap-1">
          {(['form', 'json'] as const).map((m) => (
            <button
              key={m}
              type="button"
              className={`px-3 py-1 text-sm rounded capitalize ${
                activeMode === m
                  ? 'bg-accent text-white'
                  : 'text-muted hover:text-ink hover:bg-subtle'
              }`}
              onClick={() => setMode(m)}
              data-testid={`preview-mode-${m}`}
            >
              {m}
            </button>
          ))}
        </div>
        {activeMode === 'form' && (
          <ViewportSwitcher active={activeViewport} onChange={setViewport} />
        )}
      </div>
      {activeMode === 'form' ? (
        <div className="flex-1 overflow-auto flex justify-center p-2 bg-subtle/50">
          <div
            className="bg-surface rounded border border-border p-4 h-fit"
            style={{
              width: viewportWidths[activeViewport],
              maxWidth: '100%',
              minWidth: activeViewport === 'desktop' ? '800px' : undefined,
            }}
          >
            {items.length > 0 ? (
              <FormspecPreviewHost width={viewportWidths[activeViewport]} />
            ) : (
              <div className="text-center text-muted text-sm py-8">
                No items to preview
              </div>
            )}
          </div>
        </div>
      ) : (
        <JsonDocumentsView />
      )}
    </div>
  );
}
