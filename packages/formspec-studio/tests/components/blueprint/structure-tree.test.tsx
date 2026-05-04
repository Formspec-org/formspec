import { render, screen, act, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createProject } from '@formspec-org/studio-core';
import { ProjectProvider } from '../../../src/state/ProjectContext';
import { SelectionProvider, useSelection } from '../../../src/state/useSelection';
import { ActiveGroupProvider } from '../../../src/state/useActiveGroup';
import { CanvasTargetsProvider, useCanvasTargets } from '../../../src/state/useCanvasTargets';
import { StructureTree } from '../../../src/components/blueprint/StructureTree';

const treeDef = {
  $formspec: '1.0', url: 'urn:test', version: '1.0.0',
  items: [
    { key: 'name', type: 'field', dataType: 'string', label: 'Full Name' },
    {
      key: 'contact', type: 'group', label: 'Contact', children: [
        { key: 'email', type: 'field', dataType: 'string', label: 'Email' },
        { key: 'phone', type: 'field', dataType: 'string', label: 'Phone' },
      ]
    },
    { key: 'notice', type: 'display', label: 'Notice' },
  ],
};

function renderTree(project = createProject({ seed: { definition: treeDef as any } })) {
  return render(
    <ProjectProvider project={project}>
      <SelectionProvider>
        <ActiveGroupProvider>
          <CanvasTargetsProvider>
            <StructureTree />
          </CanvasTargetsProvider>
        </ActiveGroupProvider>
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
  it('renders the full definition tree regardless of page mode', () => {
    renderTree(createProject({
      seed: {
        definition: {
          ...treeDef,
          formPresentation: { pageMode: 'wizard' },
        } as any,
      },
    }));

    expect(screen.getByRole('region', { name: 'Items' })).toBeInTheDocument();
    expect(screen.getByTestId('tree-item-name')).toBeInTheDocument();
    expect(screen.getByTestId('tree-item-contact')).toBeInTheDocument();
    expect(screen.getByTestId('tree-item-contact.email')).toBeInTheDocument();
    expect(screen.getByTestId('tree-item-contact.phone')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Groups' })).not.toBeInTheDocument();
  });

  it('shows type icons and labels', () => {
    renderTree();
    expect(screen.getAllByText('Aa').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Contact')).toBeInTheDocument();
    expect(screen.getByText('Full Name')).toBeInTheDocument();
    expect(screen.getByText('Notice')).toBeInTheDocument();
  });

  it('selecting a node updates selection', async () => {
    renderTree();
    const node = screen.getByTestId('tree-item-name');
    await act(async () => {
      node.click();
    });
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
            <ActiveGroupProvider>
              <CanvasTargetsProvider>
                <>
                  <CanvasTarget path="name" />
                  <StructureTree />
                </>
              </CanvasTargetsProvider>
            </ActiveGroupProvider>
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

  it('adds a new field at the root from the palette and selects it', async () => {
    const project = createProject({
      seed: {
        definition: {
          $formspec: '1.0',
          url: 'urn:structure-root-add',
          version: '1.0.0',
          items: [],
        } as any,
      },
    });

    let capturedSelectedKey: string | null = null;
    function SelectionCapture() {
      const { primaryKey } = useSelection();
      capturedSelectedKey = primaryKey;
      return null;
    }

    render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <ActiveGroupProvider>
            <CanvasTargetsProvider>
              <StructureTree />
              <SelectionCapture />
            </CanvasTargetsProvider>
          </ActiveGroupProvider>
        </SelectionProvider>
      </ProjectProvider>
    );

    await act(async () => {
      screen.getByTitle('Add item').click();
    });

    await act(async () => {
      screen.getByRole('button', { name: /Text Short text/i }).click();
    });

    const insertedItem = project.definition.items.find((item: any) => item.label === 'Text');
    expect(insertedItem).toBeTruthy();
    expect(capturedSelectedKey).toBe(insertedItem!.key);
    expect(screen.getByTestId(`tree-item-${insertedItem!.key}`)).toHaveClass('text-accent');
  });

  it('adds a new field inside the selected group', async () => {
    const project = createProject({
      seed: {
        definition: {
          $formspec: '1.0',
          url: 'urn:structure-group-add',
          version: '1.0.0',
          items: [
            {
              key: 'contact',
              type: 'group',
              label: 'Contact',
              children: [
                { key: 'email', type: 'field', dataType: 'string', label: 'Email' },
              ],
            },
          ],
        } as any,
      },
    });

    render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          <ActiveGroupProvider>
            <CanvasTargetsProvider>
              <StructureTree />
            </CanvasTargetsProvider>
          </ActiveGroupProvider>
        </SelectionProvider>
      </ProjectProvider>
    );

    await act(async () => {
      screen.getByTestId('tree-item-contact').click();
    });

    await act(async () => {
      screen.getByTitle('Add item').click();
    });

    await act(async () => {
      screen.getByRole('button', { name: /Text Short text/i }).click();
    });

    const group = project.definition.items[0] as any;
    const insertedField = group.children.find((item: any) => item.label === 'Text');
    expect(insertedField).toBeTruthy();
    expect(screen.getByTestId(`tree-item-contact.${insertedField.key}`)).toBeInTheDocument();
  });

  it('shows display items in the editor add palette', async () => {
    renderTree();

    await act(async () => {
      screen.getByTitle('Add item').click();
    });

    expect(screen.getByRole('button', { name: /Heading Section heading or title/i })).toBeInTheDocument();
  });

  it('opens the same editor context menu on right-click and can duplicate a field', async () => {
    const project = createProject({ seed: { definition: treeDef as any } });
    renderTree(project);

    const node = screen.getByTestId('tree-item-name');
    fireEvent.contextMenu(node, { clientX: 120, clientY: 160 });

    expect(screen.getByTestId('context-menu')).toBeInTheDocument();
    expect(screen.getByTestId('ctx-duplicate')).toBeInTheDocument();

    await act(async () => {
      screen.getByTestId('ctx-duplicate').click();
    });

    expect(project.definition.items.length).toBe(4);
  });
});
