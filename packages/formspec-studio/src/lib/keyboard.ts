export interface ShortcutHandlers {
  undo: () => void;
  redo: () => void;
  delete: () => void;
  escape: () => void;
  search: () => void;
}

interface ShortcutOptions {
  activeWorkspace?: string;
}

/** Returns true if the event target is a text-editable element. */
function isTextInput(event: KeyboardEvent): boolean {
  const el = event.target;
  if (!(el instanceof HTMLElement)) return false;
  if (el instanceof HTMLInputElement) {
    const textTypes = new Set(['text', 'search', 'url', 'email', 'password', 'number', 'tel']);
    return textTypes.has(el.type);
  }
  return el instanceof HTMLTextAreaElement || el.isContentEditable;
}

function resolveWorkspace(event: KeyboardEvent): string | null {
  const el = event.target;
  if (!(el instanceof HTMLElement)) return null;
  let current: HTMLElement | null = el;
  while (current) {
    const workspace = current.getAttribute('data-workspace');
    if (workspace) return workspace;
    current = current.parentElement;
  }
  return null;
}

export function handleKeyboardShortcut(
  event: KeyboardEvent,
  handlers: ShortcutHandlers,
  options: ShortcutOptions = {},
): void {
  const { key, metaKey, ctrlKey, shiftKey } = event;
  const mod = metaKey || ctrlKey;
  const editing = isTextInput(event);

  // Mod shortcuts that conflict with native text editing (undo/redo)
  if (mod && shiftKey && (key === 'z' || key === 'Z')) {
    if (editing) return; // let native redo work
    event.preventDefault();
    handlers.redo();
    return;
  }
  if (mod && !shiftKey && (key === 'z' || key === 'Z')) {
    if (editing) return; // let native undo work
    event.preventDefault();
    handlers.undo();
    return;
  }

  // Cmd+K — always fires (doesn't conflict with text editing)
  if (mod && key === 'k') {
    event.preventDefault();
    handlers.search();
    return;
  }

  // Escape — always fires
  if (key === 'Escape') {
    handlers.escape();
    return;
  }

  // Delete/Backspace — only when NOT editing text
  if (key === 'Delete' || key === 'Backspace') {
    if (editing) return;
    const workspace = options.activeWorkspace ?? resolveWorkspace(event);
    if (workspace && workspace !== 'Editor') return;
    handlers.delete();
    return;
  }
}
