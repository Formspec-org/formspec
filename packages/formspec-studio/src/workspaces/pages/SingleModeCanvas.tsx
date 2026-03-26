/** @filedesc Single-mode renderer — full-width canvas with no page cards. */
import { useState } from 'react';
import { GridCanvas } from './GridCanvas';
import type { ModeRendererProps } from './mode-renderer-props';

export function SingleModeCanvas({ structure }: ModeRendererProps) {
  const hasPreservedPages = structure.pages.length > 0;
  const [dismissed, setDismissed] = useState(false);

  // In single mode, all items from all pages are shown inline on one canvas.
  // Flatten all page items into a single list.
  const allItems = structure.pages.flatMap((p) => p.items);
  const [selectedItemKey, setSelectedItemKey] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {hasPreservedPages && !dismissed && (
        <div
          data-testid="preserved-pages-notice"
          className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-[13px] text-amber-900"
        >
          <span>
            {structure.pages.length} {structure.pages.length === 1 ? 'page' : 'pages'} preserved.
            Switch to Wizard or Tabs to restore them.
          </span>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="ml-4 rounded px-2 py-0.5 text-[12px] font-semibold text-amber-700 transition-colors hover:bg-amber-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {allItems.length > 0 ? (
        <GridCanvas
          items={allItems}
          activeBreakpoint="base"
          selectedItemKey={selectedItemKey}
          onSelectItem={setSelectedItemKey}
          onRemoveItem={() => {}}
          onSetWidth={() => {}}
          onSetOffset={() => {}}
          onSetResponsive={() => {}}
          onMoveItem={() => {}}
        />
      ) : (
        <p className="text-[13px] text-muted">
          No items yet. Add fields in the Editor tab.
        </p>
      )}
    </div>
  );
}
