import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AddItemPalette, FIELD_TYPE_CATALOG } from '../../src/components/AddItemPalette';

describe('AddItemPalette', () => {
  it('uses a single-column results layout on narrow screens', () => {
    render(
      <AddItemPalette open={true} onClose={vi.fn()} onAdd={vi.fn()} />
    );

    const textCard = screen.getByRole('button', { name: /^Text\b/i });
    const resultsGrid = textCard.parentElement;

    expect(resultsGrid).toHaveClass(/grid-cols-1/);
  });
});
