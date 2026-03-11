import { describe, it, expect, vi } from 'vitest';
import { handleKeyboardShortcut, type ShortcutHandlers } from '../../src/lib/keyboard';

describe('handleKeyboardShortcut', () => {
  it('triggers undo on Cmd+Z', () => {
    const handlers: ShortcutHandlers = { undo: vi.fn(), redo: vi.fn(), delete: vi.fn(), escape: vi.fn(), search: vi.fn() };
    const event = new KeyboardEvent('keydown', { key: 'z', metaKey: true });
    handleKeyboardShortcut(event, handlers);
    expect(handlers.undo).toHaveBeenCalled();
  });

  it('triggers redo on Cmd+Shift+Z', () => {
    const handlers: ShortcutHandlers = { undo: vi.fn(), redo: vi.fn(), delete: vi.fn(), escape: vi.fn(), search: vi.fn() };
    const event = new KeyboardEvent('keydown', { key: 'z', metaKey: true, shiftKey: true });
    handleKeyboardShortcut(event, handlers);
    expect(handlers.redo).toHaveBeenCalled();
  });

  it('triggers escape on Escape key', () => {
    const handlers: ShortcutHandlers = { undo: vi.fn(), redo: vi.fn(), delete: vi.fn(), escape: vi.fn(), search: vi.fn() };
    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    handleKeyboardShortcut(event, handlers);
    expect(handlers.escape).toHaveBeenCalled();
  });

  it('triggers search on Cmd+K', () => {
    const handlers: ShortcutHandlers = { undo: vi.fn(), redo: vi.fn(), delete: vi.fn(), escape: vi.fn(), search: vi.fn() };
    const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true });
    handleKeyboardShortcut(event, handlers);
    expect(handlers.search).toHaveBeenCalled();
  });

  it('triggers delete on Delete/Backspace', () => {
    const handlers: ShortcutHandlers = { undo: vi.fn(), redo: vi.fn(), delete: vi.fn(), escape: vi.fn(), search: vi.fn() };
    const event = new KeyboardEvent('keydown', { key: 'Delete' });
    handleKeyboardShortcut(event, handlers);
    expect(handlers.delete).toHaveBeenCalled();
  });
});
