/** @filedesc Tests for per-tab selection scoping in useSelection. */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SelectionProvider, useSelection } from '../../src/state/useSelection';
import type { ReactNode } from 'react';

const wrapper = ({ children }: { children: ReactNode }) => (
  <SelectionProvider>{children}</SelectionProvider>
);

describe('per-tab selection scoping', () => {
  it('maintains independent selection per tab scope', () => {
    const { result } = renderHook(() => useSelection(), { wrapper });

    act(() => result.current.select('field1', 'field', { tab: 'editor' }));
    expect(result.current.selectedKeyForTab('editor')).toBe('field1');
    expect(result.current.selectedKeyForTab('layout')).toBeNull();

    // Select in layout scope — editor selection unchanged
    act(() => result.current.select('__node:abc', 'node', { tab: 'layout' }));
    expect(result.current.selectedKeyForTab('editor')).toBe('field1');
    expect(result.current.selectedKeyForTab('layout')).toBe('__node:abc');
  });

  it('select without tab uses default scope and remains backwards-compatible', () => {
    const { result } = renderHook(() => useSelection(), { wrapper });

    act(() => result.current.select('field1', 'field'));
    expect(result.current.selectedKey).toBe('field1');
    expect(result.current.selectedType).toBe('field');
    // Default scope shouldn't leak into named tabs
    expect(result.current.selectedKeyForTab('editor')).toBeNull();
  });

  it('selectedKey reflects the most recently used tab', () => {
    const { result } = renderHook(() => useSelection(), { wrapper });

    act(() => result.current.select('field1', 'field', { tab: 'editor' }));
    expect(result.current.selectedKey).toBe('field1');

    act(() => result.current.select('__node:abc', 'node', { tab: 'layout' }));
    expect(result.current.selectedKey).toBe('__node:abc');

    // Re-selecting in editor updates selectedKey back to editor's selection
    act(() => result.current.select('field2', 'field', { tab: 'editor' }));
    expect(result.current.selectedKey).toBe('field2');
    // Layout still has its own selection
    expect(result.current.selectedKeyForTab('layout')).toBe('__node:abc');
  });

  it('deselect clears all tab scopes', () => {
    const { result } = renderHook(() => useSelection(), { wrapper });

    act(() => result.current.select('field1', 'field', { tab: 'editor' }));
    act(() => result.current.select('__node:abc', 'node', { tab: 'layout' }));
    act(() => result.current.deselect());

    expect(result.current.selectedKey).toBeNull();
    expect(result.current.selectedKeyForTab('editor')).toBeNull();
    expect(result.current.selectedKeyForTab('layout')).toBeNull();
  });

  it('toggleSelect respects tab scope', () => {
    const { result } = renderHook(() => useSelection(), { wrapper });

    act(() => result.current.select('field1', 'field', { tab: 'editor' }));
    act(() => result.current.toggleSelect('field2', 'field', { tab: 'editor' }));

    // Both selected in editor
    expect(result.current.isSelected('field1')).toBe(true);
    expect(result.current.isSelected('field2')).toBe(true);

    // Layout scope is untouched
    expect(result.current.selectedKeyForTab('layout')).toBeNull();
  });

  it('isSelectedForTab and selectedKeysForTab read a named tab regardless of active tab', () => {
    const { result } = renderHook(() => useSelection(), { wrapper });

    act(() => result.current.select('field1', 'field', { tab: 'editor' }));
    act(() => result.current.select('__node:abc', 'layout', { tab: 'layout' }));

    expect(result.current.isSelectedForTab('layout', '__node:abc')).toBe(true);
    expect(result.current.isSelectedForTab('layout', 'field1')).toBe(false);
    expect(result.current.selectedKeysForTab('layout').has('__node:abc')).toBe(true);
  });

  it('selectedTypeForTab returns the primary type for a given tab', () => {
    const { result } = renderHook(() => useSelection(), { wrapper });

    act(() => result.current.select('field1', 'field', { tab: 'editor' }));
    act(() => result.current.select('__node:abc', 'node', { tab: 'layout' }));

    expect(result.current.selectedTypeForTab('editor')).toBe('field');
    expect(result.current.selectedTypeForTab('layout')).toBe('node');
    expect(result.current.selectedTypeForTab('nonexistent')).toBeNull();
  });
});
