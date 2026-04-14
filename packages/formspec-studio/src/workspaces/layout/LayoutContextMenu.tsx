/** @filedesc Context menu for the Layout canvas — layout-tier actions only (no definition mutations). */
import type { LayoutContextMenuItem } from '@formspec-org/studio-core';

interface LayoutContextMenuProps {
  items: LayoutContextMenuItem[];
  onAction: (action: string) => void;
  onClose: () => void;
}

export function LayoutContextMenu({ items, onAction, onClose }: LayoutContextMenuProps) {
  if (items.length === 0) return null;

  return (
    <div
      data-testid="layout-context-menu"
      className="bg-surface/95 backdrop-blur-[2px] border border-border/70 rounded-[8px] shadow-[0_4px_16px_rgba(0,0,0,0.08)] py-1.5 min-w-[180px] z-50 flex flex-col"
      role="menu"
    >
      {items.map(({ label, action, separator }) => (
        <div key={action}>
          {separator && (
            <div role="separator" className="h-px bg-border my-1" />
          )}
          <button
            role="menuitem"
            data-testid={`layout-ctx-${action}`}
            className="w-full text-left px-3.5 py-1.5 text-[13px] font-medium text-ink hover:bg-accent/10 hover:text-accent focus:bg-accent/10 focus:text-accent transition-colors focus-visible:outline-none"
            onClick={() => {
              onAction(action);
              onClose();
            }}
          >
            {label}
          </button>
        </div>
      ))}
    </div>
  );
}
