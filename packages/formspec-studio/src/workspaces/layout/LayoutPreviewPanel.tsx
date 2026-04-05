/** @filedesc Live preview sidebar panel for the Layout workspace — wraps FormspecPreviewHost with a header. */
import { FormspecPreviewHost } from '../preview/FormspecPreviewHost';
import { useOptionalLayoutMode } from './LayoutModeContext';

interface LayoutPreviewPanelProps {
  /** Width passed through to FormspecPreviewHost. Defaults to '100%'. */
  width?: string | number;
}

export function LayoutPreviewPanel({ width = '100%' }: LayoutPreviewPanelProps) {
  const layoutMode = useOptionalLayoutMode();

  return (
    <div className="flex flex-col h-full min-h-0">
      <div
        data-testid="layout-preview-header"
        className="shrink-0 border-b border-border/60 px-3 py-2 flex items-center justify-between"
      >
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          Live Preview
        </span>
        {layoutMode && (
          <button
            type="button"
            data-testid="preview-customize-appearance"
            onClick={() => {
              if (layoutMode.requestLayoutModeChange) {
                layoutMode.requestLayoutModeChange('theme');
              } else {
                layoutMode.setLayoutMode('theme');
              }
            }}
            className="text-[11px] font-semibold text-muted hover:text-accent transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50"
          >
            Customize appearance →
          </button>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <FormspecPreviewHost width={width} />
      </div>
    </div>
  );
}
