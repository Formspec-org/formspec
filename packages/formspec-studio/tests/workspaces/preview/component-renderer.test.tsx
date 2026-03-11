import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ComponentRenderer } from '../../../src/workspaces/preview/ComponentRenderer';

const items = [
  { key: 'name', type: 'field', dataType: 'string', label: 'Full Name' },
  { key: 'section', type: 'group', label: 'Section A', children: [
    { key: 'inner', type: 'field', dataType: 'integer', label: 'Inner Field' },
  ]},
  { key: 'notice', type: 'display', label: 'Notice Text' },
];

describe('ComponentRenderer', () => {
  it('renders input fields with labels', () => {
    render(<ComponentRenderer items={items as any} />);
    expect(screen.getByText('Full Name')).toBeInTheDocument();
  });

  it('renders group containers', () => {
    render(<ComponentRenderer items={items as any} />);
    expect(screen.getByText('Section A')).toBeInTheDocument();
    expect(screen.getByText('Inner Field')).toBeInTheDocument();
  });

  it('renders display items', () => {
    render(<ComponentRenderer items={items as any} />);
    expect(screen.getByText('Notice Text')).toBeInTheDocument();
  });
});
