/** @filedesc Tests for core-owned Studio keyboard shortcut handling. */
import { describe, expect, it, vi } from 'vitest';
import { handleKeyboardShortcut, type ShortcutHandlers } from '../src/keyboard';

function makeHandlers(): ShortcutHandlers {
  return {
    undo: vi.fn(),
    redo: vi.fn(),
    delete: vi.fn(),
    escape: vi.fn(),
    search: vi.fn(),
  };
}

function fireKey(element: object, options: KeyboardEventInit): KeyboardEvent {
  return {
    ...options,
    target: element,
    preventDefault: vi.fn(),
  } as KeyboardEvent;
}

function makeElement(tagName: string, props: Record<string, unknown> = {}, parentElement: any = null) {
  return {
    tagName,
    parentElement,
    getAttribute: (name: string) => {
      const attrs = (props.attributes ?? {}) as Record<string, string>;
      return attrs[name] ?? null;
    },
    ...props,
  } as any;
}

describe('handleKeyboardShortcut', () => {
  it('triggers undo on Cmd+Z', () => {
    const handlers = makeHandlers();
    handleKeyboardShortcut(fireKey(makeElement('BODY'), { key: 'z', metaKey: true }), handlers);
    expect(handlers.undo).toHaveBeenCalled();
  });

  it('triggers redo on Cmd+Shift+Z', () => {
    const handlers = makeHandlers();
    handleKeyboardShortcut(fireKey(makeElement('BODY'), { key: 'z', metaKey: true, shiftKey: true }), handlers);
    expect(handlers.redo).toHaveBeenCalled();
  });

  it('triggers escape on Escape', () => {
    const handlers = makeHandlers();
    handleKeyboardShortcut(fireKey(makeElement('BODY'), { key: 'Escape' }), handlers);
    expect(handlers.escape).toHaveBeenCalled();
  });

  it('triggers search on Cmd+K', () => {
    const handlers = makeHandlers();
    handleKeyboardShortcut(fireKey(makeElement('BODY'), { key: 'k', metaKey: true }), handlers);
    expect(handlers.search).toHaveBeenCalled();
  });

  it('triggers delete on Delete/Backspace when not editing', () => {
    const handlers = makeHandlers();
    handleKeyboardShortcut(fireKey(makeElement('BODY'), { key: 'Delete' }), handlers);
    expect(handlers.delete).toHaveBeenCalled();
  });

  describe('when focus is inside a text input', () => {
    it('suppresses Delete/Backspace', () => {
      const input = makeElement('INPUT', { type: 'text' });
      const handlers = makeHandlers();
      handleKeyboardShortcut(fireKey(input, { key: 'Backspace' }), handlers);
      expect(handlers.delete).not.toHaveBeenCalled();
    });

    it('suppresses Cmd+Z', () => {
      const input = makeElement('INPUT', { type: 'text' });
      const handlers = makeHandlers();
      handleKeyboardShortcut(fireKey(input, { key: 'z', metaKey: true }), handlers);
      expect(handlers.undo).not.toHaveBeenCalled();
    });

    it('suppresses Cmd+Shift+Z', () => {
      const input = makeElement('INPUT', { type: 'text' });
      const handlers = makeHandlers();
      handleKeyboardShortcut(fireKey(input, { key: 'z', metaKey: true, shiftKey: true }), handlers);
      expect(handlers.redo).not.toHaveBeenCalled();
    });

    it('still fires Escape', () => {
      const input = makeElement('INPUT', { type: 'text' });
      const handlers = makeHandlers();
      handleKeyboardShortcut(fireKey(input, { key: 'Escape' }), handlers);
      expect(handlers.escape).toHaveBeenCalled();
    });

    it('still fires Cmd+K', () => {
      const input = makeElement('INPUT', { type: 'text' });
      const handlers = makeHandlers();
      handleKeyboardShortcut(fireKey(input, { key: 'k', metaKey: true }), handlers);
      expect(handlers.search).toHaveBeenCalled();
    });

    it('suppresses textarea editing keys', () => {
      const textarea = makeElement('TEXTAREA');
      const handlers = makeHandlers();
      handleKeyboardShortcut(fireKey(textarea, { key: 'Backspace' }), handlers);
      expect(handlers.delete).not.toHaveBeenCalled();
    });

    it('does not suppress non-text inputs', () => {
      const checkbox = makeElement('INPUT', { type: 'checkbox' });
      const handlers = makeHandlers();
      handleKeyboardShortcut(fireKey(checkbox, { key: 'Backspace' }), handlers);
      expect(handlers.delete).toHaveBeenCalled();
    });
  });

  it('suppresses delete outside the Editor workspace', () => {
    const workspace = makeElement('DIV', { attributes: { 'data-workspace': 'Data' } });
    const child = makeElement('BUTTON', {}, workspace);
    const handlers = makeHandlers();

    handleKeyboardShortcut(fireKey(child, { key: 'Delete' }), handlers);

    expect(handlers.delete).not.toHaveBeenCalled();
  });
});
