import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { AddBehaviorMenu } from '../../../src/components/ui/AddBehaviorMenu';

describe('AddBehaviorMenu', () => {
  const allTypes = ['relevant', 'required', 'readonly', 'calculate', 'constraint', 'pre-populate'] as const;

  describe('when itemType is undefined or "field"', () => {
    it('shows all allowedTypes that are not in existingTypes', async () => {
      const user = userEvent.setup();
      render(
        <AddBehaviorMenu
          existingTypes={['required']}
          allowedTypes={['relevant', 'required', 'readonly']}
          onAdd={() => {}}
        />,
      );

      await user.click(screen.getByRole('button', { name: /add behavior/i }));

      expect(screen.getByText('Relevant')).toBeInTheDocument();
      expect(screen.getByText('Readonly')).toBeInTheDocument();
      expect(screen.queryByText('Required')).not.toBeInTheDocument();
    });

    it('shows all allowedTypes when itemType is "field"', async () => {
      const user = userEvent.setup();
      render(
        <AddBehaviorMenu
          existingTypes={[]}
          allowedTypes={['relevant', 'required', 'calculate']}
          itemType="field"
          onAdd={() => {}}
        />,
      );

      await user.click(screen.getByRole('button', { name: /add behavior/i }));

      expect(screen.getByText('Relevant')).toBeInTheDocument();
      expect(screen.getByText('Required')).toBeInTheDocument();
      expect(screen.getByText('Calculate')).toBeInTheDocument();
    });
  });

  describe('when itemType is "display"', () => {
    it('only offers "relevant" regardless of allowedTypes (single-option adds on first click)', async () => {
      const user = userEvent.setup();
      const onAdd = vi.fn();
      render(
        <AddBehaviorMenu
          existingTypes={[]}
          allowedTypes={['relevant', 'required', 'readonly', 'calculate', 'constraint']}
          itemType="display"
          onAdd={onAdd}
        />,
      );

      await user.click(screen.getByRole('button', { name: /add behavior/i }));

      expect(onAdd).toHaveBeenCalledTimes(1);
      expect(onAdd).toHaveBeenCalledWith('relevant');
      // No dropdown for a single available type
      expect(screen.queryByText('Required')).not.toBeInTheDocument();
      expect(screen.queryByText('Readonly')).not.toBeInTheDocument();
      expect(screen.queryByText('Calculate')).not.toBeInTheDocument();
      expect(screen.queryByText('Constraint')).not.toBeInTheDocument();
    });

    it('adds "relevant" on first click when allowedTypes is not provided', async () => {
      const user = userEvent.setup();
      const onAdd = vi.fn();
      render(
        <AddBehaviorMenu
          existingTypes={[]}
          itemType="display"
          onAdd={onAdd}
        />,
      );

      await user.click(screen.getByRole('button', { name: /add behavior/i }));

      expect(onAdd).toHaveBeenCalledWith('relevant');
      expect(screen.queryByText('Required')).not.toBeInTheDocument();
    });
  });

  describe('menu interactions', () => {
    it('fires onAdd with the type id when the only option is chosen (instant add)', async () => {
      const user = userEvent.setup();
      const onAdd = vi.fn();
      render(
        <AddBehaviorMenu
          existingTypes={[]}
          allowedTypes={['relevant']}
          onAdd={onAdd}
        />,
      );

      await user.click(screen.getByRole('button', { name: /add behavior/i }));

      expect(onAdd).toHaveBeenCalledWith('relevant');
      expect(onAdd).toHaveBeenCalledTimes(1);
    });

    it('fires onAdd when a dropdown row is clicked (multiple options)', async () => {
      const user = userEvent.setup();
      const onAdd = vi.fn();
      render(
        <AddBehaviorMenu
          existingTypes={[]}
          allowedTypes={['relevant', 'required']}
          onAdd={onAdd}
        />,
      );

      await user.click(screen.getByRole('button', { name: /add behavior/i }));
      await user.click(screen.getByText('Relevant'));

      expect(onAdd).toHaveBeenCalledWith('relevant');
      expect(onAdd).toHaveBeenCalledTimes(1);
    });
  });

  describe('when all types are already existing', () => {
    it('does not render the menu trigger at all', () => {
      const { container } = render(
        <AddBehaviorMenu
          existingTypes={[...allTypes]}
          onAdd={() => {}}
        />,
      );

      expect(container.innerHTML).toBe('');
    });
  });
});
