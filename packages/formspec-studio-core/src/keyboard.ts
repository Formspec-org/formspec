/** @filedesc Global Studio keyboard shortcut policy for undo/redo, delete, escape, and search. */

export type WorkspaceName = 'Editor' | 'Layout';

const DELETE_ALLOWED_WORKSPACES = new Set<string>(['Editor', 'Layout']);

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

interface KeyboardTargetLike {
  type?: string;
  isContentEditable?: boolean;
  parentElement?: KeyboardTargetLike | null;
  getAttribute?: (name: string) => string | null;
  tagName?: string;
}

function isTextInput(event: KeyboardEvent): boolean {
  const element = event.target as KeyboardTargetLike | null;
  if (!element) return false;

  const tagName = element.tagName?.toUpperCase();
  if (tagName === 'INPUT') {
    const textTypes = new Set(['text', 'search', 'url', 'email', 'password', 'number', 'tel']);
    return textTypes.has(String(element.type ?? '').toLowerCase());
  }
  return tagName === 'TEXTAREA' || element.isContentEditable === true;
}

function resolveWorkspace(event: KeyboardEvent): string | null {
  let current: KeyboardTargetLike | null = (event.target as KeyboardTargetLike | null) ?? null;
  while (current) {
    const workspace = current.getAttribute?.('data-workspace');
    if (workspace) return workspace;
    current = current.parentElement ?? null;
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

  if (mod && shiftKey && (key === 'z' || key === 'Z')) {
    if (editing) return;
    event.preventDefault();
    handlers.redo();
    return;
  }
  if (mod && !shiftKey && (key === 'z' || key === 'Z')) {
    if (editing) return;
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
    if (editing) return;
    const workspace = options.activeWorkspace ?? resolveWorkspace(event);
    if (workspace && !DELETE_ALLOWED_WORKSPACES.has(workspace)) return;
    handlers.delete();
  }
}
