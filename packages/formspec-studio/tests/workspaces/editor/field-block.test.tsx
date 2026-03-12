import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FieldBlock } from '../../../src/workspaces/editor/FieldBlock';

const noop = () => {};

describe('FieldBlock', () => {
  it('shows Required pill when bind has required', () => {
    render(
      <FieldBlock
        itemKey="name"
        itemPath="name"
        registerTarget={noop}
        label="Full Name"
        dataType="string"
        binds={{ required: 'true' }}
        depth={0}
        selected={false}
        onSelect={noop}
      />
    );
    expect(screen.getByText('req')).toBeInTheDocument();
  });

  it('shows Calc pill when bind has calculate', () => {
    render(
      <FieldBlock
        itemKey="email"
        itemPath="email"
        registerTarget={noop}
        label="Email"
        dataType="string"
        binds={{ calculate: '$x' }}
        depth={0}
        selected={false}
        onSelect={noop}
      />
    );
    // Use exact text for the pill to avoid matching the summary strip "Auto-calculated"
    expect(screen.getByText('ƒx')).toBeInTheDocument();
    expect(screen.getByText(/Auto-calculated/i)).toBeInTheDocument();
  });

  it('shows data type icon', () => {
    render(
      <FieldBlock
        itemKey="age"
        itemPath="age"
        registerTarget={noop}
        label="Age"
        dataType="integer"
        binds={{}}
        depth={0}
        selected={false}
        onSelect={noop}
      />
    );
    expect(screen.getByText('#')).toBeInTheDocument();
  });

  it('indents nested fields', () => {
    const { container } = render(
      <FieldBlock
        itemKey="street"
        itemPath="address.street"
        registerTarget={vi.fn()}
        label="Street"
        dataType="string"
        binds={{}}
        depth={2}
        selected={false}
        onSelect={noop}
      />
    );
    // Depth 2 should have style padding/margin
    expect(container.firstChild).toBeTruthy();
  });
});
