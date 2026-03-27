/** @filedesc Context menu for the Layout canvas — layout-tier actions only (no definition mutations). */
import type { LayoutContextMenuItem } from './layout-context-operations';

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
      className="bg-surface border border-border rounded shadow-lg py-1 min-w-[160px]"
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
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-surface-hover transition-colors"
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
