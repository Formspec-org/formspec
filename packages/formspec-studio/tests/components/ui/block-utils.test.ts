import { describe, it, expect, vi } from 'vitest';
import { blockIndent, blockRef } from '../../../src/components/ui/block-utils';

describe('blockIndent', () => {
  it('returns 0 for depth 0', () => {
    expect(blockIndent(0)).toBe(0);
  });

  it('returns 20px per depth level', () => {
    expect(blockIndent(1)).toBe(20);
    expect(blockIndent(3)).toBe(60);
  });

  it('returns 0 for negative depth', () => {
    expect(blockIndent(-1)).toBe(0);
  });
});

describe('blockRef', () => {
  it('returns a callback that calls registerTarget with path and element', () => {
    const register = vi.fn();
    const cb = blockRef('items.name', register);
    const el = document.createElement('div');
    cb(el);
    expect(register).toHaveBeenCalledWith('items.name', el);
  });

  it('passes null when element is removed', () => {
    const register = vi.fn();
    const cb = blockRef('items.name', register);
    cb(null);
    expect(register).toHaveBeenCalledWith('items.name', null);
  });
});
