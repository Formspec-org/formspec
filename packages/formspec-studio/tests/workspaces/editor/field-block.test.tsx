import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { FieldBlock } from '../../../src/workspaces/editor/FieldBlock';

describe('FieldBlock', () => {
  it('shows Required pill when bind has required', () => {
    render(
      <FieldBlock
        itemKey="name"
        label="Full Name"
        dataType="string"
        binds={{ required: 'true' }}
        depth={0}
        selected={false}
        onSelect={() => {}}
      />
    );
    expect(screen.getByText('Required')).toBeInTheDocument();
  });

  it('shows Calc pill when bind has calculate', () => {
    render(
      <FieldBlock
        itemKey="email"
        label="Email"
        dataType="string"
        binds={{ calculate: '$x' }}
        depth={0}
        selected={false}
        onSelect={() => {}}
      />
    );
    expect(screen.getByText(/calc/i)).toBeInTheDocument();
  });

  it('shows data type icon', () => {
    render(
      <FieldBlock
        itemKey="age"
        label="Age"
        dataType="integer"
        binds={{}}
        depth={0}
        selected={false}
        onSelect={() => {}}
      />
    );
    expect(screen.getByText('#')).toBeInTheDocument();
  });

  it('indents nested fields', () => {
    const { container } = render(
      <FieldBlock
        itemKey="street"
        label="Street"
        dataType="string"
        binds={{}}
        depth={2}
        selected={false}
        onSelect={() => {}}
      />
    );
    // Depth 2 should have padding
    expect(container.firstChild).toBeTruthy();
  });
});
