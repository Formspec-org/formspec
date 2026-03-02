import { beforeEach, describe, expect, test } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { resetState } from './setup';
import { FieldProperties } from '../components/properties/field-properties';
import { findItemByKey, setDefinition, createEmptyDefinition } from '../state/definition';
import type { FormspecItem } from 'formspec-engine';

const baseItem: FormspecItem = {
  key: 'testField',
  type: 'field',
  label: 'Test Field',
  dataType: 'string',
} as FormspecItem;

function clickTab(name: string) {
  const tab = screen.getByRole('tab', { name });
  fireEvent.click(tab);
}

describe('FieldProperties', () => {
  beforeEach(() => {
    resetState();
  });

  // General tab (default)
  test('renders Key label on General tab', () => {
    render(<FieldProperties item={baseItem} />);
    expect(screen.getByText('Key')).toBeTruthy();
  });

  test('renders Label label on General tab', () => {
    render(<FieldProperties item={baseItem} />);
    expect(screen.getByText('Label')).toBeTruthy();
  });

  test('renders Key input with item key value', () => {
    render(<FieldProperties item={baseItem} />);
    const inputs = document.querySelectorAll('input');
    const keyInput = Array.from(inputs).find((el) => el.value === 'testField');
    expect(keyInput).toBeTruthy();
  });

  test('renders Label input with item label value', () => {
    render(<FieldProperties item={baseItem} />);
    const inputs = document.querySelectorAll('input');
    const labelInput = Array.from(inputs).find((el) => el.value === 'Test Field');
    expect(labelInput).toBeTruthy();
  });

  test('renders Placeholder label on General tab', () => {
    render(<FieldProperties item={baseItem} />);
    expect(screen.getByText('Placeholder')).toBeTruthy();
  });

  test('renders Relevant label on General tab', () => {
    render(<FieldProperties item={baseItem} />);
    expect(screen.getByText('Relevant (Conditional)')).toBeTruthy();
  });

  test('does not show Options section for string dataType', () => {
    render(<FieldProperties item={baseItem} />);
    clickTab('Data & Validation');
    const optionsSections = document.querySelectorAll('.options-editor');
    expect(optionsSections.length).toBe(0);
  });
});
