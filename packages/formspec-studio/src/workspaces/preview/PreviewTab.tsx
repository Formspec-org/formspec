/** @filedesc Preview workspace tab toggling live form render, behavior lab, and JSON documents view. */
import { useState } from 'react';
import type { ResolvedTheme } from '../../hooks/useColorScheme';
import { useDefinition } from '../../state/useDefinition';
import { ViewportSwitcher, type Viewport } from './ViewportSwitcher';
import { JsonDocumentsView } from './JsonDocumentsView';
import { FormspecPreviewHost } from './FormspecPreviewHost';
import { BehaviorPreview } from '../../features/behavior-preview/BehaviorPreview';

const viewportWidths: Record<Viewport, string> = {
  desktop: '100%',
  tablet: '768px',
  mobile: '375px',
};

export type PreviewMode = 'form' | 'behavior' | 'json';

const PREVIEW_MODES: PreviewMode[] = ['form', 'behavior', 'json'];

const MODE_LABEL: Record<PreviewMode, string> = {
  form: 'Form',
  behavior: 'Behavior',
  json: 'JSON',
};

interface PreviewTabProps {
  viewport?: Viewport;
  onViewportChange?: (viewport: Viewport) => void;
  mode?: PreviewMode;
  onModeChange?: (mode: PreviewMode) => void;
  /** Passed through to `<formspec-render>` so preview matches Studio shell theme. */
  appearance?: ResolvedTheme;
}

export function PreviewTab({
  viewport,
  onViewportChange,
  mode,
  onModeChange,
  appearance,
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
          {PREVIEW_MODES.map((m) => (
            <button
              key={m}
              type="button"
              className={`px-3 py-1 text-sm rounded ${
                activeMode === m
                  ? 'bg-accent text-white'
                  : 'text-muted hover:text-ink hover:bg-subtle'
              }`}
              onClick={() => setMode(m)}
              data-testid={`preview-mode-${m}`}
            >
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>
        {(activeMode === 'form' || activeMode === 'behavior') && (
          <ViewportSwitcher active={activeViewport} onChange={setViewport} />
        )}
      </div>
      {activeMode === 'form' ? (
        items.length > 0 ? (
          <div className="flex-1 overflow-hidden bg-subtle/50">
            <div className="h-full min-h-0 overflow-auto p-2">
              <div
                className="mx-auto rounded border border-border bg-surface p-4"
                style={{
                  width: viewportWidths[activeViewport],
                  maxWidth: '100%',
                  minWidth: activeViewport === 'desktop' ? '800px' : undefined,
                }}
              >
                <FormspecPreviewHost width={viewportWidths[activeViewport]} appearance={appearance} />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center text-center text-muted text-sm py-8">
            No items to preview
          </div>
        )
      ) : activeMode === 'behavior' ? (
        items.length > 0 ? (
          <div className="flex-1 min-h-0 overflow-hidden bg-subtle/50">
            <BehaviorPreview viewport={activeViewport} appearance={appearance} />
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center text-center text-muted text-sm py-8">
            No items to preview
          </div>
        )
      ) : (
        <JsonDocumentsView />
      )}
    </div>
  );
}
