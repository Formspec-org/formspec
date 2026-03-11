import { describe, it, expect } from 'vitest';
import { createInitialProjectState, createProjectSignal } from '../project';
import {
  addItem,
  addPage,
  deletePage,
  reorderPage,
  setActivePage,
  setFormPresentationProperty
} from '../mutations';
import { getPageItems } from '../wiring';
import type { FormspecItem } from 'formspec-engine';

function makeProject(items: FormspecItem[] = []) {
  return createProjectSignal(
    createInitialProjectState({
      definition: { url: 'test://form', version: '1.0.0', items }
    })
  );
}

function makePageItem(key: string, label: string, children: FormspecItem[] = []): FormspecItem {
  return {
    type: 'group',
    key,
    label,
    children,
    presentation: { widgetHint: 'Page' }
  };
}

describe('page management mutations', () => {
  describe('addPage', () => {
    it('creates a page group at root level', () => {
      const project = makeProject();
      setFormPresentationProperty(project, 'pageMode', 'wizard');

      const pageKey = addPage(project);
      const state = project.value;
      const pages = getPageItems(state.definition);

      expect(pages).toHaveLength(1);
      expect(pages[0].key).toBe(pageKey);
      expect(pages[0].type).toBe('group');
      expect((pages[0].presentation as Record<string, unknown>)?.widgetHint).toBe('Page');
      expect(state.uiState.activePage).toBe(pageKey);
    });

    it('uses custom label when provided', () => {
      const project = makeProject();
      addPage(project, 'Introduction');
      const pages = getPageItems(project.value.definition);
      expect(pages[0].label).toBe('Introduction');
    });

    it('generates sequential page numbers', () => {
      const project = makeProject();
      addPage(project);
      addPage(project);
      const pages = getPageItems(project.value.definition);
      expect(pages[0].label).toBe('Page 1');
      expect(pages[1].label).toBe('Page 2');
    });
  });

  describe('deletePage', () => {
    it('removes the page and its children', () => {
      const project = makeProject([
        makePageItem('p1', 'Page 1', [{ type: 'field', key: 'f1', label: 'Field 1' }]),
        makePageItem('p2', 'Page 2')
      ]);
      setActivePage(project, 'p1');

      const result = deletePage(project, 'p1');
      const state = project.value;

      expect(result).toBe(true);
      expect(getPageItems(state.definition)).toHaveLength(1);
      expect(state.definition.items[0].key).toBe('p2');
    });

    it('prevents deleting the last page', () => {
      const project = makeProject([makePageItem('p1', 'Page 1')]);
      const result = deletePage(project, 'p1');
      expect(result).toBe(false);
      expect(getPageItems(project.value.definition)).toHaveLength(1);
    });

    it('switches activePage to next page on delete', () => {
      const project = makeProject([
        makePageItem('p1', 'Page 1'),
        makePageItem('p2', 'Page 2'),
        makePageItem('p3', 'Page 3')
      ]);
      setActivePage(project, 'p2');

      deletePage(project, 'p2');
      expect(project.value.uiState.activePage).toBe('p3');
    });

    it('switches to previous page when last page deleted', () => {
      const project = makeProject([
        makePageItem('p1', 'Page 1'),
        makePageItem('p2', 'Page 2')
      ]);
      setActivePage(project, 'p2');

      deletePage(project, 'p2');
      expect(project.value.uiState.activePage).toBe('p1');
    });
  });

  describe('reorderPage', () => {
    it('swaps page positions', () => {
      const project = makeProject([
        makePageItem('p1', 'Page 1'),
        makePageItem('p2', 'Page 2'),
        makePageItem('p3', 'Page 3')
      ]);

      reorderPage(project, 'p2', 'up');
      const keys = project.value.definition.items.map((i) => i.key);
      expect(keys).toEqual(['p2', 'p1', 'p3']);
    });

    it('does nothing when moving first page up', () => {
      const project = makeProject([
        makePageItem('p1', 'Page 1'),
        makePageItem('p2', 'Page 2')
      ]);

      reorderPage(project, 'p1', 'up');
      const keys = project.value.definition.items.map((i) => i.key);
      expect(keys).toEqual(['p1', 'p2']);
    });
  });

  describe('auto-wrap on pageMode switch', () => {
    it('wraps root items into Page 1 when switching to wizard', () => {
      const project = makeProject([
        { type: 'field', key: 'name', label: 'Name' },
        { type: 'field', key: 'email', label: 'Email' }
      ]);

      setFormPresentationProperty(project, 'pageMode', 'wizard');
      const state = project.value;
      const pages = getPageItems(state.definition);

      expect(pages).toHaveLength(1);
      expect(pages[0].label).toBe('Page 1');
      expect(pages[0].children).toHaveLength(2);
      expect(pages[0].children![0].key).toBe('name');
      expect(pages[0].children![1].key).toBe('email');
      expect(state.uiState.activePage).toBe(pages[0].key);
    });

    it('skips auto-wrap when page groups already exist', () => {
      const project = makeProject([
        makePageItem('p1', 'Existing Page', [
          { type: 'field', key: 'f1', label: 'Field' }
        ])
      ]);

      setFormPresentationProperty(project, 'pageMode', 'wizard');
      const state = project.value;

      expect(state.definition.items).toHaveLength(1);
      expect(state.definition.items[0].key).toBe('p1');
      expect(state.uiState.activePage).toBe('p1');
    });

    it('clears activePage when switching back to single', () => {
      const project = makeProject([makePageItem('p1', 'Page 1')]);
      setActivePage(project, 'p1');

      setFormPresentationProperty(project, 'pageMode', 'single');
      expect(project.value.uiState.activePage).toBeNull();
    });

    it('works with tabs mode too', () => {
      const project = makeProject([
        { type: 'field', key: 'name', label: 'Name' }
      ]);

      setFormPresentationProperty(project, 'pageMode', 'tabs');
      const pages = getPageItems(project.value.definition);
      expect(pages).toHaveLength(1);
      expect(project.value.uiState.activePage).toBe(pages[0].key);
    });
  });

  describe('setActivePage', () => {
    it('sets and clears activePage', () => {
      const project = makeProject([makePageItem('p1', 'Page 1')]);

      setActivePage(project, 'p1');
      expect(project.value.uiState.activePage).toBe('p1');

      setActivePage(project, null);
      expect(project.value.uiState.activePage).toBeNull();
    });
  });
});
