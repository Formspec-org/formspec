import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ComponentRenderer } from '../../../src/workspaces/preview/ComponentRenderer';

const items = [
  { key: 'name', type: 'field', dataType: 'string', label: 'Full Name' },
  { key: 'section', type: 'group', label: 'Section A', children: [
    { key: 'inner', type: 'field', dataType: 'integer', label: 'Inner Field' },
  ]},
  { key: 'notice', type: 'display', label: 'Notice Text' },
];

const previewFieldItems = [
  { key: 'fullName', type: 'field', dataType: 'string', label: 'Full Name' },
  { key: 'householdSize', type: 'field', dataType: 'integer', label: 'Household Size' },
  { key: 'birthDate', type: 'field', dataType: 'date', label: 'Birth Date' },
  {
    key: 'maritalStatus',
    type: 'field',
    dataType: 'choice',
    label: 'Marital Status',
    options: [
      { value: 'single', label: 'Single' },
      { value: 'married', label: 'Married' },
    ],
  },
];

const repeatableItems = [
  {
    key: 'members',
    type: 'group',
    label: 'Members',
    repeatable: true,
    children: [
      { key: 'memberName', type: 'field', dataType: 'string', label: 'Member Name' },
    ],
  },
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

  it('renders integer, date, and choice fields as actual interactive widgets', () => {
    render(<ComponentRenderer items={previewFieldItems as any} />);

    expect(screen.getByRole('textbox', { name: 'Full Name' })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Household Size' })).toBeInTheDocument();
    expect(screen.getByLabelText('Birth Date')).toHaveAttribute('type', 'date');
    expect(screen.getByRole('combobox', { name: 'Marital Status' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Single' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Married' })).toBeInTheDocument();
  });

  it('supports removing a repeat instance after adding one', () => {
    render(<ComponentRenderer items={repeatableItems as any} />);

    fireEvent.click(screen.getByRole('button', { name: /add members/i }));

    expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument();
  });
});
