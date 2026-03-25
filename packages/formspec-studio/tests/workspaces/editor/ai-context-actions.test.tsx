/** @filedesc Tests for AI context menu actions on canvas items. */
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { SelectionProvider } from '../../../src/state/useSelection';
import { ActiveGroupProvider } from '../../../src/state/useActiveGroup';
import { EditorCanvas } from '../../../src/workspaces/editor/EditorCanvas';
import {
  buildContextMenuItems,
  type ContextMenuState,
} from '../../../src/workspaces/editor/canvas-operations';
import { editorFixtures, renderEditorCanvas } from './test-utils';

// ── Pure function tests ──────────────────────────────────────────────

describe('buildContextMenuItems — AI actions', () => {
  it('includes AI action items for single field context menu', () => {
    const menu: ContextMenuState = { x: 100, y: 100, kind: 'item', path: 'name', type: 'field' };
    const items = buildContextMenuItems(menu, 1);

    const aiLabels = items.filter((i) => i.label.startsWith('AI:'));
    expect(aiLabels.length).toBeGreaterThanOrEqual(2);
    expect(aiLabels.some((i) => i.label === 'AI: Add validation')).toBe(true);
    expect(aiLabels.some((i) => i.label === 'AI: Generate description')).toBe(true);
  });

  it('includes "AI: Suggest options" for field items', () => {
    const menu: ContextMenuState = { x: 100, y: 100, kind: 'item', path: 'color', type: 'field' };
    const items = buildContextMenuItems(menu, 1);

    expect(items.some((i) => i.label === 'AI: Suggest options')).toBe(true);
  });

  it('does NOT include AI actions for canvas-level menu', () => {
    const menu: ContextMenuState = { x: 100, y: 100, kind: 'canvas' };
    const items = buildContextMenuItems(menu, 1);

    const aiLabels = items.filter((i) => i.label.startsWith('AI:'));
    expect(aiLabels).toHaveLength(0);
  });

  it('does NOT include AI actions for multi-select menu', () => {
    const menu: ContextMenuState = { x: 100, y: 100, kind: 'item', path: 'name', type: 'field' };
    const items = buildContextMenuItems(menu, 3);

    const aiLabels = items.filter((i) => i.label.startsWith('AI:'));
    expect(aiLabels).toHaveLength(0);
  });

  it('does NOT include AI actions for layout items', () => {
    const menu: ContextMenuState = { x: 100, y: 100, kind: 'item', path: '__node:abc', type: 'layout' };
    const items = buildContextMenuItems(menu, 1);

    const aiLabels = items.filter((i) => i.label.startsWith('AI:'));
    expect(aiLabels).toHaveLength(0);
  });

  it('includes AI actions for group items', () => {
    const menu: ContextMenuState = { x: 100, y: 100, kind: 'item', path: 'contact', type: 'group' };
    const items = buildContextMenuItems(menu, 1);

    const aiLabels = items.filter((i) => i.label.startsWith('AI:'));
    expect(aiLabels.length).toBeGreaterThanOrEqual(2);
    // Groups should have validation and description, but not suggest options
    expect(aiLabels.some((i) => i.label === 'AI: Suggest options')).toBe(false);
  });

  it('includes AI actions for display items', () => {
    const menu: ContextMenuState = { x: 100, y: 100, kind: 'item', path: 'notice', type: 'display' };
    const items = buildContextMenuItems(menu, 1);

    const aiLabels = items.filter((i) => i.label.startsWith('AI:'));
    expect(aiLabels.length).toBeGreaterThanOrEqual(1);
    expect(aiLabels.some((i) => i.label === 'AI: Generate description')).toBe(true);
  });

  it('marks the first AI item with a separator', () => {
    const menu: ContextMenuState = { x: 100, y: 100, kind: 'item', path: 'name', type: 'field' };
    const items = buildContextMenuItems(menu, 1);

    const firstAiIndex = items.findIndex((i) => i.label.startsWith('AI:'));
    expect(firstAiIndex).toBeGreaterThan(0);
    expect(items[firstAiIndex].separator).toBe(true);
  });
});

// ── Event dispatch tests ─────────────────────────────────────────────

describe('AI context action event dispatch', () => {
  it('dispatches formspec:ai-action event with prompt for "AI: Add validation"', () => {
    const spy = vi.fn();
    window.addEventListener('formspec:ai-action', spy);

    renderEditorCanvas(editorFixtures.simpleFields);

    fireEvent.contextMenu(screen.getByTestId('field-firstField'));
    fireEvent.click(screen.getByRole('menuitem', { name: /AI: Add validation/i }));

    expect(spy).toHaveBeenCalledTimes(1);
    const detail = (spy.mock.calls[0][0] as CustomEvent).detail;
    expect(detail.prompt).toContain('firstField');
    expect(detail.prompt.toLowerCase()).toContain('validation');
    expect(detail.itemPath).toBe('firstField');

    window.removeEventListener('formspec:ai-action', spy);
  });

  it('dispatches formspec:ai-action event for "AI: Suggest options"', () => {
    const spy = vi.fn();
    window.addEventListener('formspec:ai-action', spy);

    renderEditorCanvas(editorFixtures.simpleFields);

    fireEvent.contextMenu(screen.getByTestId('field-firstField'));
    fireEvent.click(screen.getByRole('menuitem', { name: /AI: Suggest options/i }));

    expect(spy).toHaveBeenCalledTimes(1);
    const detail = (spy.mock.calls[0][0] as CustomEvent).detail;
    expect(detail.prompt).toContain('firstField');
    expect(detail.prompt.toLowerCase()).toContain('option');

    window.removeEventListener('formspec:ai-action', spy);
  });

  it('dispatches formspec:ai-action event for "AI: Generate description"', () => {
    const spy = vi.fn();
    window.addEventListener('formspec:ai-action', spy);

    renderEditorCanvas(editorFixtures.simpleFields);

    fireEvent.contextMenu(screen.getByTestId('field-firstField'));
    fireEvent.click(screen.getByRole('menuitem', { name: /AI: Generate description/i }));

    expect(spy).toHaveBeenCalledTimes(1);
    const detail = (spy.mock.calls[0][0] as CustomEvent).detail;
    expect(detail.prompt).toContain('firstField');
    expect(detail.prompt.toLowerCase()).toContain('description');

    window.removeEventListener('formspec:ai-action', spy);
  });
});

// ── EditorContextMenu separator rendering ────────────────────────────

describe('EditorContextMenu separator rendering', () => {
  it('renders a visual separator before AI actions', () => {
    renderEditorCanvas(editorFixtures.simpleFields);

    fireEvent.contextMenu(screen.getByTestId('field-firstField'));

    // There should be a separator element in the menu
    const menu = screen.getByTestId('context-menu');
    const separators = menu.querySelectorAll('[role="separator"]');
    expect(separators.length).toBeGreaterThanOrEqual(1);
  });
});
