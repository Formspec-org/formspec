import { describe, it, expect, vi } from 'vitest';
import { handleKeyboardShortcut, type ShortcutHandlers } from '../../src/lib/keyboard';

function makeHandlers(): ShortcutHandlers {
  return { undo: vi.fn(), redo: vi.fn(), delete: vi.fn(), escape: vi.fn(), search: vi.fn() };
}

/** Dispatch a KeyboardEvent whose target is the given element. */
function fireKey(el: HTMLElement, opts: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { ...opts, bubbles: true });
  Object.defineProperty(event, 'target', { value: el });
  return event;
}

describe('handleKeyboardShortcut', () => {
  it('triggers undo on Cmd+Z', () => {
    const h = makeHandlers();
    handleKeyboardShortcut(fireKey(document.body, { key: 'z', metaKey: true }), h);
    expect(h.undo).toHaveBeenCalled();
  });

  it('triggers redo on Cmd+Shift+Z', () => {
    const h = makeHandlers();
    handleKeyboardShortcut(fireKey(document.body, { key: 'z', metaKey: true, shiftKey: true }), h);
    expect(h.redo).toHaveBeenCalled();
  });

  it('triggers escape on Escape key', () => {
    const h = makeHandlers();
    handleKeyboardShortcut(fireKey(document.body, { key: 'Escape' }), h);
    expect(h.escape).toHaveBeenCalled();
  });

  it('triggers search on Cmd+K', () => {
    const h = makeHandlers();
    handleKeyboardShortcut(fireKey(document.body, { key: 'k', metaKey: true }), h);
    expect(h.search).toHaveBeenCalled();
  });

  it('triggers delete on Delete/Backspace', () => {
    const h = makeHandlers();
    handleKeyboardShortcut(fireKey(document.body, { key: 'Delete' }), h);
    expect(h.delete).toHaveBeenCalled();
  });

  describe('when focus is inside a text input', () => {
    it('suppresses Delete/Backspace', () => {
      const input = document.createElement('input');
      input.type = 'text';
      const h = makeHandlers();
      handleKeyboardShortcut(fireKey(input, { key: 'Backspace' }), h);
      expect(h.delete).not.toHaveBeenCalled();
    });

    it('suppresses Cmd+Z (undo)', () => {
      const input = document.createElement('input');
      input.type = 'text';
      const h = makeHandlers();
      handleKeyboardShortcut(fireKey(input, { key: 'z', metaKey: true }), h);
      expect(h.undo).not.toHaveBeenCalled();
    });

    it('suppresses Cmd+Shift+Z (redo)', () => {
      const input = document.createElement('input');
      input.type = 'text';
      const h = makeHandlers();
      handleKeyboardShortcut(fireKey(input, { key: 'z', metaKey: true, shiftKey: true }), h);
      expect(h.redo).not.toHaveBeenCalled();
    });

    it('still fires Escape', () => {
      const input = document.createElement('input');
      input.type = 'text';
      const h = makeHandlers();
      handleKeyboardShortcut(fireKey(input, { key: 'Escape' }), h);
      expect(h.escape).toHaveBeenCalled();
    });

    it('still fires Cmd+K (search)', () => {
      const input = document.createElement('input');
      input.type = 'text';
      const h = makeHandlers();
      handleKeyboardShortcut(fireKey(input, { key: 'k', metaKey: true }), h);
      expect(h.search).toHaveBeenCalled();
    });

    it('suppresses for textarea elements', () => {
      const textarea = document.createElement('textarea');
      const h = makeHandlers();
      handleKeyboardShortcut(fireKey(textarea, { key: 'Backspace' }), h);
      expect(h.delete).not.toHaveBeenCalled();
    });

    it('does not suppress for non-text input types (checkbox)', () => {
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      const h = makeHandlers();
      handleKeyboardShortcut(fireKey(checkbox, { key: 'Backspace' }), h);
      expect(h.delete).toHaveBeenCalled();
    });
  });

  it('suppresses delete shortcuts when the active workspace is not Editor', () => {
    const workspace = document.createElement('div');
    workspace.setAttribute('data-workspace', 'Data');
    const child = document.createElement('button');
    workspace.appendChild(child);
    const h = makeHandlers();

    handleKeyboardShortcut(fireKey(child, { key: 'Delete' }), h);

    expect(h.delete).not.toHaveBeenCalled();
  });
});
