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

describe('FieldProperties', () => {
  beforeEach(() => {
    resetState();
  });

  test('renders section title Identity', () => {
    render(<FieldProperties item={baseItem} />);
    expect(screen.getByText('Identity')).toBeTruthy();
  });

  test('renders section title Data', () => {
    render(<FieldProperties item={baseItem} />);
    expect(screen.getByText('Data')).toBeTruthy();
  });

  test('renders section title Behavior', () => {
    render(<FieldProperties item={baseItem} />);
    expect(screen.getByText('Behavior')).toBeTruthy();
  });

  test('renders section title Validation', () => {
    render(<FieldProperties item={baseItem} />);
    expect(screen.getByText('Validation')).toBeTruthy();
  });

  test('renders Key label', () => {
    render(<FieldProperties item={baseItem} />);
    expect(screen.getByText('Key')).toBeTruthy();
  });

  test('renders Label label', () => {
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

  test('renders Data Type select with item dataType value', () => {
    render(<FieldProperties item={baseItem} />);
    const select = document.querySelector('select') as HTMLSelectElement;
    expect(select).toBeTruthy();
    expect(select.value).toBe('string');
  });

  test('renders all 14 data type options', () => {
    render(<FieldProperties item={baseItem} />);
    const select = document.querySelector('select') as HTMLSelectElement;
    const options = Array.from(select.options).map((o) => o.value);
    const expected = [
      'string',
      'text',
      'integer',
      'decimal',
      'number',
      'boolean',
      'date',
      'dateTime',
      'time',
      'choice',
      'multiChoice',
      'money',
      'uri',
      'attachment',
    ];
    expect(options).toEqual(expected);
  });

  test('renders Placeholder label', () => {
    render(<FieldProperties item={baseItem} />);
    expect(screen.getByText('Placeholder')).toBeTruthy();
  });

  test('renders Required label', () => {
    render(<FieldProperties item={baseItem} />);
    expect(screen.getByText('Required')).toBeTruthy();
  });

  test('renders Read Only label', () => {
    render(<FieldProperties item={baseItem} />);
    expect(screen.getByText('Read Only')).toBeTruthy();
  });

  test('renders Calculate label', () => {
    render(<FieldProperties item={baseItem} />);
    expect(screen.getByText('Calculate')).toBeTruthy();
  });

  test('renders Relevant label', () => {
    render(<FieldProperties item={baseItem} />);
    expect(screen.getByText('Relevant')).toBeTruthy();
  });

  test('renders Constraint label', () => {
    render(<FieldProperties item={baseItem} />);
    expect(screen.getByText('Constraint')).toBeTruthy();
  });

  test('renders Message label', () => {
    render(<FieldProperties item={baseItem} />);
    expect(screen.getByText('Message')).toBeTruthy();
  });

  // Options editor — only visible for choice / multiChoice
  test('does not show Options section for string dataType', () => {
    render(<FieldProperties item={baseItem} />);
    const optionsSections = document.querySelectorAll('.options-editor');
    expect(optionsSections.length).toBe(0);
  });

  test('shows Options section for choice dataType', () => {
    const choiceItem: FormspecItem = {
      key: 'choiceField',
      type: 'field',
      label: 'Pick One',
      dataType: 'choice',
    } as FormspecItem;
    render(<FieldProperties item={choiceItem} />);
    expect(document.querySelector('.options-editor')).toBeTruthy();
    expect(screen.getByText('Options')).toBeTruthy();
  });

  test('shows Options section for multiChoice dataType', () => {
    const multiItem: FormspecItem = {
      key: 'multiField',
      type: 'field',
      label: 'Pick Many',
      dataType: 'multiChoice',
    } as FormspecItem;
    render(<FieldProperties item={multiItem} />);
    expect(document.querySelector('.options-editor')).toBeTruthy();
    expect(screen.getByText('Options')).toBeTruthy();
  });

  test('renders existing options as editable rows', () => {
    const choiceItem = {
      key: 'choiceField',
      type: 'field',
      label: 'Pick One',
      dataType: 'choice',
      options: [
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' },
      ],
    } as unknown as FormspecItem;
    render(<FieldProperties item={choiceItem} />);
    const valueInputs = screen.getAllByRole('textbox', { name: /Option \d+ value/ });
    expect(valueInputs.length).toBe(2);
    expect((valueInputs[0] as HTMLInputElement).value).toBe('yes');
    expect((valueInputs[1] as HTMLInputElement).value).toBe('no');
    const labelInputs = screen.getAllByRole('textbox', { name: /Option \d+ label/ });
    expect((labelInputs[0] as HTMLInputElement).value).toBe('Yes');
    expect((labelInputs[1] as HTMLInputElement).value).toBe('No');
  });

  test('shows Add Option button for choice field', () => {
    const choiceItem: FormspecItem = {
      key: 'choiceField',
      type: 'field',
      label: 'Pick One',
      dataType: 'choice',
    } as FormspecItem;
    render(<FieldProperties item={choiceItem} />);
    expect(screen.getByText('+ Add Option')).toBeTruthy();
  });

  test('clicking Add Option adds an option to definition', () => {
    const def = createEmptyDefinition();
    const choiceItem = {
      key: 'choiceField',
      type: 'field',
      label: 'Pick One',
      dataType: 'choice',
    };
    def.items = [choiceItem as FormspecItem];
    setDefinition(def);

    render(<FieldProperties item={choiceItem as FormspecItem} />);
    const addBtn = screen.getByText('+ Add Option');
    fireEvent.click(addBtn);

    const { item } = findItemByKey('choiceField')!;
    const opts = (item as any).options as { value: string; label?: string }[];
    expect(opts).toBeTruthy();
    expect(opts.length).toBe(1);
  });

  test('clicking Remove button removes the option from definition', () => {
    const def = createEmptyDefinition();
    const choiceItem = {
      key: 'choiceField',
      type: 'field',
      label: 'Pick One',
      dataType: 'choice',
      options: [
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' },
      ],
    };
    def.items = [choiceItem as unknown as FormspecItem];
    setDefinition(def);

    render(<FieldProperties item={choiceItem as unknown as FormspecItem} />);
    const removeBtns = screen.getAllByRole('button', { name: /Remove option/ });
    expect(removeBtns.length).toBe(2);
    fireEvent.click(removeBtns[0]);

    const { item } = findItemByKey('choiceField')!;
    const opts = (item as any).options as { value: string; label?: string }[];
    expect(opts.length).toBe(1);
    expect(opts[0].value).toBe('no');
  });

  test('editing option value input updates definition', () => {
    const def = createEmptyDefinition();
    const choiceItem = {
      key: 'choiceField',
      type: 'field',
      label: 'Pick One',
      dataType: 'choice',
      options: [{ value: 'old', label: 'Old Label' }],
    };
    def.items = [choiceItem as unknown as FormspecItem];
    setDefinition(def);

    render(<FieldProperties item={choiceItem as unknown as FormspecItem} />);
    const valueInput = screen.getByRole('textbox', { name: 'Option 1 value' }) as HTMLInputElement;
    fireEvent.input(valueInput, { target: { value: 'new' } });

    const { item } = findItemByKey('choiceField')!;
    const opts = (item as any).options as { value: string; label?: string }[];
    expect(opts[0].value).toBe('new');
  });

  test('FEL autocomplete suggests $ variables and inserts selection', () => {
    const def = createEmptyDefinition();
    def.items = [
      {
        key: 'targetField',
        type: 'field',
        label: 'Target',
        dataType: 'string',
      } as FormspecItem,
      {
        key: 'organizationName',
        type: 'field',
        label: 'Organization',
        dataType: 'string',
      } as FormspecItem,
    ];
    setDefinition(def);
    const selected = findItemByKey('targetField')!.item;

    render(<FieldProperties item={selected} />);

    const relevantLabel = screen.getByText('Relevant');
    const relevantRow = relevantLabel.closest('.property-row') as HTMLElement;
    const relevantInput = relevantRow.querySelector('.fel-input-wrap input') as HTMLInputElement;

    relevantInput.focus();
    relevantInput.value = '$org';
    relevantInput.setSelectionRange(4, 4);
    fireEvent.input(relevantInput, { target: { value: '$org' } });

    const option = screen.getByText('$organizationName').closest('[role="option"]') as HTMLElement;
    fireEvent.mouseDown(option);

    const { item } = findItemByKey('targetField')!;
    expect((item as Record<string, unknown>).relevant).toBe('$organizationName');
  });

  test('FEL autocomplete suggests @ functions and inserts call syntax', () => {
    const def = createEmptyDefinition();
    def.items = [
      {
        key: 'targetField',
        type: 'field',
        label: 'Target',
        dataType: 'string',
      } as FormspecItem,
    ];
    setDefinition(def);
    const selected = findItemByKey('targetField')!.item;

    render(<FieldProperties item={selected} />);

    const relevantLabel = screen.getByText('Relevant');
    const relevantRow = relevantLabel.closest('.property-row') as HTMLElement;
    const relevantInput = relevantRow.querySelector('.fel-input-wrap input') as HTMLInputElement;

    relevantInput.focus();
    relevantInput.value = '@su';
    relevantInput.setSelectionRange(3, 3);
    fireEvent.input(relevantInput, { target: { value: '@su' } });

    const option = screen.getByText('@sum').closest('[role="option"]') as HTMLElement;
    fireEvent.mouseDown(option);

    const { item } = findItemByKey('targetField')!;
    expect((item as Record<string, unknown>).relevant).toBe('sum()');
  });
});
