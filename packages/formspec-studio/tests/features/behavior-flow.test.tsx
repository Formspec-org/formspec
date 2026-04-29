import { render, screen, act, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createProject } from '@formspec-org/studio-core';
import { ProjectProvider } from '../../src/state/ProjectContext';
import { SelectionProvider, useSelection } from '../../src/state/useSelection';
import { LogicTab } from '../../src/workspaces/logic/LogicTab';
import { EditorPropertiesPanel } from '../../src/workspaces/editor/properties/EditorPropertiesPanel';

const testDef = {
  $formspec: '1.0', url: 'urn:test', version: '1.0.0',
  items: [
    { key: 'name', type: 'field', dataType: 'string', label: 'Full Name' },
    { key: 'age', type: 'field', dataType: 'integer', label: 'Age' },
    { key: 'email', type: 'field', dataType: 'string', label: 'Email' },
  ],
  binds: [
    { path: 'name', required: 'true' }
  ],
};

function SelectionProbe() {
  const { primaryKey, select } = useSelection();
  return (
    <>
      <div data-testid="selected-key">{primaryKey || ''}</div>
      <button data-testid="select-age" onClick={() => select('age', 'field', { tab: 'editor' })}>Select Age</button>
      <button data-testid="select-name" onClick={() => select('name', 'field', { tab: 'editor' })}>Select Name</button>
    </>
  );
}

describe('Behavior Flow Integration', () => {
  let project: any;
  let updateItemSpy: any;

  beforeEach(() => {
    project = createProject({ seed: { definition: testDef as any } });
    updateItemSpy = vi.spyOn(project, 'updateItem');
  });

  function renderApp(component: React.ReactNode) {
    return render(
      <ProjectProvider project={project}>
        <SelectionProvider>
          {component}
          <SelectionProbe />
        </SelectionProvider>
      </ProjectProvider>
    );
  }

  describe('Logic Tab - Add Logic Flow', () => {
    it('shows fields without binds in the "Add Logic" list', async () => {
      renderApp(<LogicTab />);
      
      const addBtn = screen.getByText(/Add Logic to Field/i);
      expect(addBtn).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(addBtn);
      });

      // DOM Check: The "Select Field" header should appear
      expect(screen.getByText(/Select Field/i)).toBeInTheDocument();
      expect(screen.getByText('age')).toBeInTheDocument();
      expect(screen.getByText('email')).toBeInTheDocument();
    });

    it('adds a bind when a field and type are selected from the list', async () => {
      renderApp(<LogicTab />);
      
      await act(async () => {
        fireEvent.click(screen.getByText(/Add Logic to Field/i));
      });

      await act(async () => {
        fireEvent.click(screen.getByText('age'));
      });

      // DOM Check: Should now show behavior types for 'age'
      expect(screen.getByText(/Add Behavior to age/i)).toBeInTheDocument();
      const relevantBtn = screen.getByRole('button', { name: /^relevant$/i });
      
      await act(async () => {
        fireEvent.click(relevantBtn);
      });

      // Side Effect Check: BindsSection calls project.updateItem(path, { type: initialValue })
      expect(updateItemSpy).toHaveBeenCalledWith('age', { relevant: 'true' });

      // Selection Check
      expect(screen.getByTestId('selected-key')).toHaveTextContent('age');
    });
    it('allows adding new rule types to existing field binds', async () => {
      renderApp(<LogicTab />);
      
      // Select Behavior rules tab to reduce noise? No, let's just be specific.
      const nameHeader = screen.getByRole('button', { name: /^name$/ });
      const parentContainer = nameHeader.closest('div.space-y-1\\.5') as HTMLElement;
      const addBehaviorBtn = within(parentContainer).getByRole('button', { name: /Add behavior rule/i });
      
      await act(async () => {
        fireEvent.click(addBehaviorBtn);
      });

      // The menu is a sibling or child. Let's look for it specifically.
      // We'll use within(parentContainer) to look for the menu items.
      const menu = within(parentContainer);
      expect(menu.getByRole('button', { name: /Calculate/i })).toBeInTheDocument();
      expect(menu.getByRole('button', { name: /Readonly/i })).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(menu.getByRole('button', { name: /Calculate/i }));
      });

      // BindsSection calls project.updateItem(path, { calculate: '' }) for calculate type
      expect(updateItemSpy).toHaveBeenCalledWith('name', { calculate: '' });

      // DOM Check: Ideally, we'd check if the card is there, but since we are mocking dispatch
      // and not re-rendering with a new definition, we rely on the dispatch spy.
      // Wait, renderApp uses ProjectProvider with the project. If dispatch actually updates the state,
      // it should re-render.
    });
  });

  describe('Properties Panel - Behavior Rules', () => {
    it('shows "Add behavior rule" button and allows adding rules', async () => {
      renderApp(<EditorPropertiesPanel />);
      
      await act(async () => {
        screen.getByTestId('select-age').click();
      });

      // DOM Check: "Behavior Rules" section
      const behaviorSection = screen.getByText(/Behavior Rules/i).closest('div') as HTMLElement;
      expect(behaviorSection).toBeInTheDocument();
      
      const addBtn = within(behaviorSection).getByRole('button', { name: /Add behavior rule/i });
      expect(addBtn).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(addBtn);
      });

      // DOM Check: Menu items
      expect(within(behaviorSection).getByRole('button', { name: /Relevant/i })).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(within(behaviorSection).getByRole('button', { name: /Relevant/i }));
      });

      // SelectedItemProperties calls project.updateItem(path, { relevant: 'true' })
      expect(updateItemSpy).toHaveBeenCalledWith('age', { relevant: 'true' });
    });

    it('allows removing a behavior rule', async () => {
      renderApp(<EditorPropertiesPanel />);
      
      await act(async () => {
        screen.getByTestId('select-name').click();
      });

      const behaviorSection = screen.getByRole('button', { name: /Behavior Rules/i }).closest('div[class*="rounded-"]') as HTMLElement;
      
      // DOM Check: 'required' bind card (verb-intent label: MUST FILL, title: required)
      const requiredCard = within(behaviorSection).getByText(/must fill/i).closest('div[class*="border-l-accent"]') as HTMLElement;
      expect(requiredCard).toBeInTheDocument();
      
      const removeBtn = within(requiredCard).getByTitle(/Remove required/i);
      expect(removeBtn).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(removeBtn);
      });

      // SelectedItemProperties calls project.updateItem(path, { required: null }) to remove
      expect(updateItemSpy).toHaveBeenCalledWith('name', { required: null });

      // DOM Check: The card should be gone
      expect(screen.queryByText(/required/i)).toBeNull();
    });
  });

  describe('Pre-population Flow', () => {
    it('allows adding pre-population from the behaviors menu', async () => {
      renderApp(<EditorPropertiesPanel />);
      
      await act(async () => {
        screen.getByTestId('select-age').click();
      });

      const configSection = screen.getByText(/Field Config/i).closest('div') as HTMLElement;
      const addBtn = within(configSection).getByRole('button', { name: /Add Calculation/i });

      await act(async () => {
        fireEvent.click(addBtn);
      });

      // DOM Check: Should show "Pre-populate" in the menu
      const prePopOption = screen.getByRole('button', { name: /Pre-populate/i });
      expect(prePopOption).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(prePopOption);
      });

      // Side Effect Check: FieldConfigSection calls project.updateItem with prePopulate
      expect(updateItemSpy).toHaveBeenCalledWith('age', { prePopulate: { instance: '', path: '' } });
    });

    it('shows a pre-populate card when configured', async () => {
      // Seed with pre-populate
      project = createProject({ seed: { definition: {
        ...testDef,
        items: testDef.items.map(i => i.key === 'age' ? { ...i, prePopulate: { instance: 'db', path: 'user_age' } } : i)
      } as any } });
      updateItemSpy = vi.spyOn(project, 'updateItem');
      
      renderApp(<EditorPropertiesPanel />);
      
      await act(async () => {
        screen.getByTestId('select-age').click();
      });

      // DOM Check: Should show pre-populate card
      expect(screen.getByText(/pre-populate/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue('db')).toBeInTheDocument();
      expect(screen.getByDisplayValue('user_age')).toBeInTheDocument();
    });

    it('shows pre-population rules in the Logic Tab', async () => {
      // Seed with pre-populate
      project = createProject({ seed: { definition: {
        ...testDef,
        items: testDef.items.map(i => i.key === 'email' ? { ...i, prePopulate: { instance: 'api', path: 'user.email' } } : i)
      } as any } });
      
      renderApp(<LogicTab />);

      // DOM Check: Should show 'email' field and its 'pre-populate' card
      expect(screen.getByText('email')).toBeInTheDocument();
      expect(screen.getAllByText(/pre-populate/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByDisplayValue('api')).toBeInTheDocument();
      expect(screen.getByText(/instance/i)).toBeInTheDocument();
    });
  });
});
