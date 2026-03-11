export interface ShortcutHandlers {
  undo: () => void;
  redo: () => void;
  delete: () => void;
  escape: () => void;
  search: () => void;
}

export function handleKeyboardShortcut(event: KeyboardEvent, handlers: ShortcutHandlers): void {
  const { key, metaKey, ctrlKey, shiftKey } = event;
  const mod = metaKey || ctrlKey;

  if (mod && shiftKey && (key === 'z' || key === 'Z')) {
    event.preventDefault();
    handlers.redo();
    return;
  }
  if (mod && !shiftKey && (key === 'z' || key === 'Z')) {
    event.preventDefault();
    handlers.undo();
    return;
  }
  if (mod && key === 'k') {
    event.preventDefault();
    handlers.search();
    return;
  }
  if (key === 'Escape') {
    handlers.escape();
    return;
  }
  if (key === 'Delete' || key === 'Backspace') {
    handlers.delete();
    return;
  }
}
