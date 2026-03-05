import type { FormspecItem } from 'formspec-engine';

const TEXT_INPUT_DATA_TYPES = new Set(['string', 'text', 'uri']);
const NUMBER_INPUT_DATA_TYPES = new Set(['integer', 'decimal', 'number']);

const FIELD_WIDGET_MATRIX: Record<string, string[]> = {
  string: ['TextInput', 'Select', 'RadioGroup'],
  text: ['TextInput'],
  decimal: ['NumberInput', 'Slider', 'Rating', 'TextInput'],
  integer: ['NumberInput', 'Slider', 'Rating', 'TextInput'],
  boolean: ['Toggle', 'Checkbox'],
  date: ['DatePicker', 'TextInput'],
  dateTime: ['DatePicker', 'TextInput'],
  time: ['DatePicker', 'TextInput'],
  uri: ['TextInput'],
  choice: ['Select', 'RadioGroup', 'TextInput'],
  multiChoice: ['CheckboxGroup'],
  attachment: ['FileUpload', 'Signature'],
  money: ['MoneyInput', 'NumberInput', 'TextInput']
};

const FIELD_WIDGET_LABELS: Record<string, string> = {
  TextInput: 'Text Input',
  NumberInput: 'Number Input',
  Select: 'Dropdown',
  Toggle: 'Toggle',
  Checkbox: 'Checkbox',
  DatePicker: 'Date Picker',
  RadioGroup: 'Radio Group',
  CheckboxGroup: 'Checkbox Group',
  Slider: 'Slider',
  Rating: 'Rating',
  FileUpload: 'File Upload',
  Signature: 'Signature',
  MoneyInput: 'Money Input'
};

export interface FieldWidgetOption {
  value: string;
  label: string;
}

export function resolveDefaultFieldWidget(dataType: FormspecItem['dataType'] | undefined): string {
  const normalizedDataType = dataType ?? 'string';

  if (normalizedDataType === 'boolean') {
    return 'Toggle';
  }
  if (normalizedDataType === 'choice') {
    return 'Select';
  }
  if (normalizedDataType === 'multiChoice') {
    return 'CheckboxGroup';
  }
  if (normalizedDataType === 'attachment') {
    return 'FileUpload';
  }
  if (normalizedDataType === 'money') {
    return 'MoneyInput';
  }
  if (normalizedDataType === 'date' || normalizedDataType === 'dateTime' || normalizedDataType === 'time') {
    return 'DatePicker';
  }
  if (NUMBER_INPUT_DATA_TYPES.has(normalizedDataType)) {
    return 'NumberInput';
  }
  if (TEXT_INPUT_DATA_TYPES.has(normalizedDataType)) {
    return 'TextInput';
  }

  return 'TextInput';
}

export function getSupportedFieldWidgets(dataType: FormspecItem['dataType'] | undefined): string[] {
  const normalizedDataType = dataType ?? 'string';
  return FIELD_WIDGET_MATRIX[normalizedDataType] ?? ['TextInput'];
}

export function resolveFieldWidgetSelection(
  dataType: FormspecItem['dataType'] | undefined,
  widget: string
): string {
  const normalizedWidget = widget.trim();
  const fallback = resolveDefaultFieldWidget(dataType);
  if (!normalizedWidget) {
    return fallback;
  }

  const supported = getSupportedFieldWidgets(dataType);
  if (supported.includes(normalizedWidget)) {
    return normalizedWidget;
  }

  return fallback;
}

export function getFieldWidgetOptions(
  dataType: FormspecItem['dataType'] | undefined,
  currentWidget?: string
): FieldWidgetOption[] {
  const supported = [...getSupportedFieldWidgets(dataType)];
  if (currentWidget && !supported.includes(currentWidget)) {
    supported.unshift(currentWidget);
  }

  return [
    { value: '', label: 'Auto' },
    ...supported.map((widget) => ({
      value: widget,
      label: FIELD_WIDGET_LABELS[widget] ?? widget
    }))
  ];
}
