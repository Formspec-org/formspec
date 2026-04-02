/** @filedesc Right-click context menu for canvas items with duplicate, delete, move, wrap, and AI actions. */
import type { ContextMenuItem } from '../../components/ui/context-menu-utils';

interface EditorContextMenuProps {
  itemPath?: string;
  itemType?: string;
  onAction: (action: string) => void;
  onClose: () => void;
  items?: ContextMenuItem[];
  testId?: string;
}

const MENU_ITEMS: ContextMenuItem[] = [
  { label: 'Duplicate', action: 'duplicate' },
  { label: 'Delete', action: 'delete' },
  { label: 'Move Up', action: 'moveUp' },
  { label: 'Move Down', action: 'moveDown' },
  { label: 'Wrap in Group', action: 'wrapInGroup' },
];

function IconSparkle() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="inline-block mr-1.5 -mt-px text-accent">
      <path d="M8 1l1.5 4.5L14 7l-4.5 1.5L8 13l-1.5-4.5L2 7l4.5-1.5L8 1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="currentColor" fillOpacity="0.15" />
    </svg>
  );
}

/**
 * Context menu for editor items.
 * Shows actions like duplicate, delete, move, wrap in group, and AI-powered actions.
 */
export function EditorContextMenu({
  onAction,
  onClose,
  items = MENU_ITEMS,
  testId = 'context-menu',
}: EditorContextMenuProps) {
  const isAIAction = (action: string) => action.startsWith('ai:');

  return (
    <div
      data-testid={testId}
      className="bg-surface border border-border rounded shadow-lg py-1 min-w-[160px]"
      role="menu"
      onMouseDown={(event) => {
        event.stopPropagation();
      }}
    >
      {items.map(({ label, action, separator }) => (
        <div key={action}>
          {separator && (
            <div role="separator" className="h-px bg-border my-1" />
          )}
          <button
            role="menuitem"
            data-testid={`ctx-${action}`}
            className={[
              'w-full text-left px-3 py-1.5 text-sm hover:bg-surface-hover transition-colors',
              isAIAction(action) ? 'text-accent/90' : '',
            ].filter(Boolean).join(' ')}
            onClick={() => {
              onAction(action);
              onClose();
            }}
          >
            {isAIAction(action) && <IconSparkle />}
            {label}
          </button>
        </div>
      ))}
    </div>
  );
}
