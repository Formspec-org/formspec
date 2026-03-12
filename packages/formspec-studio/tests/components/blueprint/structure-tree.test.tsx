import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { createProject } from 'formspec-studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { SelectionProvider } from '../../../src/state/useSelection';
import { ActivePageProvider } from '../../../src/state/useActivePage';
import { CanvasTargetsProvider, useCanvasTargets } from '../../../src/state/useCanvasTargets';
import { StructureTree } from '../../../src/components/blueprint/StructureTree';

const treeDef = {
  $formspec: '1.0', url: 'urn:test', version: '1.0.0',
  items: [
    { key: 'name', type: 'field', dataType: 'string', label: 'Full Name' },
    { key: 'contact', type: 'group', label: 'Contact', children: [
      { key: 'email', type: 'field', dataType: 'string' },
      { key: 'phone', type: 'field', dataType: 'string' },
    ]},
    { key: 'notice', type: 'display', label: 'Notice' },
  ],
};

function renderTree() {
  const project = createProject({ seed: { definition: treeDef as any } });
  return render(
    <ProjectProvider project={project}>
      <SelectionProvider>
        <ActivePageProvider>
          <CanvasTargetsProvider>
            <StructureTree />
          </CanvasTargetsProvider>
        </ActivePageProvider>
      </SelectionProvider>
    </ProjectProvider>
  );
}

function CanvasTarget({ path }: { path: string }) {
  const { registerTarget } = useCanvasTargets();

  return (
    <div
      data-item-path={path}
      data-item-type="field"
      ref={(element) => registerTarget(path, element)}
    />
  );
}

describe('StructureTree', () => {
  it('renders items as indented tree', () => {
    renderTree();
    // Check by test-id instead of text, as text might be label instead of key
    expect(screen.getByTestId('tree-item-name')).toBeInTheDocument();
    expect(screen.getByTestId('tree-item-contact.email')).toBeInTheDocument();
    expect(screen.getByTestId('tree-item-contact.phone')).toBeInTheDocument();
  });

  it('shows type icons', () => {
    renderTree();
    // Multiple string fields produce multiple Aa icons
    const icons = screen.getAllByText('Aa');
    expect(icons.length).toBeGreaterThanOrEqual(1);
  });

  it('shows labels', () => {
    renderTree();
    // Group label "Contact" appears twice (Pages and Items), use getAllByText
    expect(screen.getAllByText('Contact').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Full Name')).toBeInTheDocument();
  });

  it('selecting a node updates selection', async () => {
    renderTree();
    const node = screen.getByTestId('tree-item-name');
    await act(async () => {
      node.click();
    });
    // Node should have selected styling (bg-accent/10 text-accent)
    expect(node.className).toContain('text-accent');
  });

  it('scrolls the matching canvas block into view when a structure item is clicked', async () => {
    const project = createProject({ seed: { definition: treeDef as any } });
    const scrollIntoView = HTMLElement.prototype.scrollIntoView;
    const calls: string[] = [];

    HTMLElement.prototype.scrollIntoView = function scrollIntoViewSpy() {
      const itemPath = this.getAttribute('data-item-path');
      if (itemPath) calls.push(itemPath);
    };

    try {
      render(
        <ProjectProvider project={project}>
          <SelectionProvider>
            <ActivePageProvider>
              <CanvasTargetsProvider>
                <>
                  <CanvasTarget path="name" />
                  <StructureTree />
                </>
              </CanvasTargetsProvider>
            </ActivePageProvider>
          </SelectionProvider>
        </ProjectProvider>
      );

      const node = screen.getByTestId('tree-item-name');
      await act(async () => {
        node.click();
      });

      expect(calls).toContain('name');
    } finally {
      HTMLElement.prototype.scrollIntoView = scrollIntoView;
    }
  });

  it('selects the inserted collision-safe page key after adding a page with a colliding generated key', async () => {
    const project = createProject({
      seed: {
        definition: {
          $formspec: '1.0',
          url: 'urn:test',
          version: '1.0.0',
          formPresentation: { pageMode: 'wizard' },
          items: [{ key: 'page1', type: 'group', label: 'Existing Page', children: [] }],
        } as any,
      },
    });
    const requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      });

    try {
      render(
        <ProjectProvider project={project}>
          <SelectionProvider>
            <ActivePageProvider>
              <CanvasTargetsProvider>
                <StructureTree />
              </CanvasTargetsProvider>
            </ActivePageProvider>
          </SelectionProvider>
        </ProjectProvider>
      );

      await act(async () => {
        screen.getByTitle('Add wizard page').click();
      });

      const insertedPage = project.definition.items.find((item: any) => item.label === 'New Page');
      expect(insertedPage?.key).toBe('page1_1');

      const insertedButton = screen.getByRole('button', { name: /new page/i });
      expect(insertedButton.className).toContain('text-accent');
      expect(screen.getByRole('button', { name: /existing page/i }).className).not.toContain('text-accent');
    } finally {
      requestAnimationFrameSpy.mockRestore();
    }
  });

});
