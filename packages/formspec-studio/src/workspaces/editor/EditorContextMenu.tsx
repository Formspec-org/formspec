interface EditorContextMenuProps {
  itemPath: string;
  itemType: string;
  onAction: (action: string) => void;
  onClose: () => void;
}

interface MenuItem {
  label: string;
  action: string;
}

const MENU_ITEMS: MenuItem[] = [
  { label: 'Duplicate', action: 'duplicate' },
  { label: 'Delete', action: 'delete' },
  { label: 'Move Up', action: 'moveUp' },
  { label: 'Move Down', action: 'moveDown' },
  { label: 'Wrap in Group', action: 'wrapInGroup' },
];

/**
 * Context menu for editor items.
 * Shows actions like duplicate, delete, move, and wrap in group.
 */
export function EditorContextMenu({
  itemPath,
  itemType,
  onAction,
  onClose,
}: EditorContextMenuProps) {
  return (
    <div
      className="bg-surface border border-border rounded shadow-lg py-1 min-w-[160px]"
      role="menu"
    >
      {MENU_ITEMS.map(({ label, action }) => (
        <button
          key={action}
          role="menuitem"
          className="w-full text-left px-3 py-1.5 text-sm hover:bg-surface-hover transition-colors"
          onClick={() => {
            onAction(action);
            onClose();
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
