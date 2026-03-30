/** @filedesc Standalone unit tests for CollapsibleSection component. */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import { CollapsibleSection } from '../../../src/components/ui/CollapsibleSection';

/** Helper child that tracks mount/unmount via internal state. */
function StatefulChild() {
  const [count, setCount] = useState(0);
  return (
    <div>
      <span data-testid="count">{count}</span>
      <button onClick={() => setCount((c) => c + 1)}>increment</button>
    </div>
  );
}

describe('CollapsibleSection', () => {
  it('starts closed by default (defaultOpen omitted)', () => {
    render(
      <CollapsibleSection title="Section" testId="content">
        <p>body</p>
      </CollapsibleSection>,
    );
    const trigger = screen.getByRole('button', { name: 'Section' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('starts open when defaultOpen is true', () => {
    render(
      <CollapsibleSection title="Section" testId="content" defaultOpen>
        <p>body</p>
      </CollapsibleSection>,
    );
    const trigger = screen.getByRole('button', { name: 'Section' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('content')).toBeVisible();
  });

  it('toggles content visibility on click', () => {
    render(
      <CollapsibleSection title="Section" testId="content">
        <p>body</p>
      </CollapsibleSection>,
    );
    const trigger = screen.getByRole('button', { name: 'Section' });

    // Open
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('content')).toBeVisible();

    // Close
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId('content')).not.toBeVisible();
  });

  it('preserves child state when collapsed (no unmount)', () => {
    render(
      <CollapsibleSection title="Section" testId="content" defaultOpen>
        <StatefulChild />
      </CollapsibleSection>,
    );

    // Increment the counter while open
    fireEvent.click(screen.getByText('increment'));
    fireEvent.click(screen.getByText('increment'));
    expect(screen.getByTestId('count')).toHaveTextContent('2');

    // Collapse
    const trigger = screen.getByRole('button', { name: 'Section' });
    fireEvent.click(trigger);

    // Expand again
    fireEvent.click(trigger);

    // Counter should still be 2 (state preserved)
    expect(screen.getByTestId('count')).toHaveTextContent('2');
  });
});
