import { describe, it, expect } from 'vitest';
import { HistoryManager } from '../src/history.js';

describe('HistoryManager', () => {
  it('push and popUndo', () => {
    const hm = new HistoryManager<string>();
    hm.push('state-0');
    expect(hm.canUndo).toBe(true);
    const prev = hm.popUndo('state-1');
    expect(prev).toBe('state-0');
    expect(hm.canUndo).toBe(false);
    expect(hm.canRedo).toBe(true);
  });

  it('popRedo after undo', () => {
    const hm = new HistoryManager<string>();
    hm.push('state-0');
    hm.popUndo('state-1');
    const next = hm.popRedo('state-0');
    expect(next).toBe('state-1');
    expect(hm.canRedo).toBe(false);
  });

  it('returns null when nothing to undo/redo', () => {
    const hm = new HistoryManager<string>();
    expect(hm.popUndo('current')).toBeNull();
    expect(hm.popRedo('current')).toBeNull();
  });

  it('clears redo on push', () => {
    const hm = new HistoryManager<string>();
    hm.push('a');
    hm.popUndo('b');
    expect(hm.canRedo).toBe(true);
    hm.push('c');
    expect(hm.canRedo).toBe(false);
  });

  it('respects maxDepth', () => {
    const hm = new HistoryManager<string>(2);
    hm.push('a');
    hm.push('b');
    hm.push('c'); // 'a' pruned
    expect(hm.popUndo('d')).toBe('c');
    expect(hm.popUndo('c')).toBe('b');
    expect(hm.popUndo('b')).toBeNull(); // 'a' was pruned
  });

  it('clear wipes both stacks', () => {
    const hm = new HistoryManager<string>();
    hm.push('a');
    hm.push('b');
    hm.popUndo('c');
    hm.clear();
    expect(hm.canUndo).toBe(false);
    expect(hm.canRedo).toBe(false);
  });

  it('clearRedo wipes only the redo stack', () => {
    const hm = new HistoryManager<string>();
    hm.push('a');
    hm.push('b');
    hm.popUndo('c');
    expect(hm.canRedo).toBe(true);
    expect(hm.canUndo).toBe(true);
    hm.clearRedo();
    expect(hm.canRedo).toBe(false);
    expect(hm.canUndo).toBe(true);
  });

  it('appendLog and get log', () => {
    const hm = new HistoryManager<string>();
    hm.appendLog({ command: { type: 'test', payload: {} }, timestamp: 123 });
    expect(hm.log).toHaveLength(1);
    expect(hm.log[0].command.type).toBe('test');
  });

  it('clearLog wipes the log', () => {
    const hm = new HistoryManager<string>();
    hm.appendLog({ command: { type: 'test', payload: {} }, timestamp: 123 });
    hm.clearLog();
    expect(hm.log).toHaveLength(0);
  });
});
