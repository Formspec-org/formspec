import { Collapsible } from '../../controls/Collapsible';
import { Dropdown } from '../../controls/Dropdown';
import { NumberInput } from '../../controls/NumberInput';
import { TextInput } from '../../controls/TextInput';
import { Toggle } from '../../controls/Toggle';

interface WidgetPropsSectionProps {
  testIdPrefix: string;
  open: boolean;
  component: string;
  componentNode: Record<string, unknown>;
  onToggle: (open: boolean) => void;
  onChange: (property: string, value: unknown) => void;
}

export function WidgetPropsSection(props: WidgetPropsSectionProps) {
  const { component, componentNode, onChange } = props;
  const fields = resolveWidgetFields(component);

  if (!fields.length) {
    return null;
  }

  const hasSomething = fields.some((f) => componentNode[f.key] !== undefined);

  return (
    <Collapsible
      id="widget-props"
      title={`${component} Options`}
      open={props.open}
      summary={hasSomething ? 'Configured' : null}
      onToggle={props.onToggle}
    >
      {fields.map((field) => renderField(field, componentNode, onChange, props.testIdPrefix))}
    </Collapsible>
  );
}

type WidgetField =
  | { type: 'text'; key: string; label: string }
  | { type: 'number'; key: string; label: string; min?: number; max?: number; step?: number }
  | { type: 'toggle'; key: string; label: string }
  | { type: 'dropdown'; key: string; label: string; options: Array<{ value: string; label: string }> };

function renderField(
  field: WidgetField,
  node: Record<string, unknown>,
  onChange: (property: string, value: unknown) => void,
  testIdPrefix: string
): preact.JSX.Element {
  const testId = `${testIdPrefix}-wp-${field.key}`;
  if (field.type === 'text') {
    return (
      <TextInput
        key={field.key}
        label={field.label}
        value={typeof node[field.key] === 'string' ? (node[field.key] as string) : undefined}
        testId={testId}
        onInput={(value) => { onChange(field.key, value || undefined); }}
      />
    );
  }
  if (field.type === 'number') {
    return (
      <NumberInput
        key={field.key}
        label={field.label}
        value={typeof node[field.key] === 'number' ? (node[field.key] as number) : undefined}
        min={field.min}
        max={field.max}
        step={field.step}
        testId={testId}
        onInput={(value) => { onChange(field.key, value); }}
      />
    );
  }
  if (field.type === 'toggle') {
    return (
      <Toggle
        key={field.key}
        label={field.label}
        checked={Boolean(node[field.key])}
        testId={testId}
        onToggle={(value) => { onChange(field.key, value || undefined); }}
      />
    );
  }
  return (
    <Dropdown
      key={field.key}
      label={field.label}
      value={typeof node[field.key] === 'string' ? (node[field.key] as string) : ''}
      options={field.options}
      testId={testId}
      onChange={(value) => { onChange(field.key, value || undefined); }}
    />
  );
}

function resolveWidgetFields(component: string): WidgetField[] {
  switch (component) {
    case 'TextInput':
      return [
        { type: 'number', key: 'maxLines', label: 'Max lines (>1 = textarea)', min: 1 },
        {
          type: 'dropdown', key: 'inputMode', label: 'Input mode',
          options: [
            { value: '', label: 'Default' },
            { value: 'email', label: 'Email' },
            { value: 'tel', label: 'Phone' },
            { value: 'url', label: 'URL' },
            { value: 'search', label: 'Search' },
            { value: 'numeric', label: 'Numeric' }
          ]
        },
        { type: 'text', key: 'prefix', label: 'Prefix' },
        { type: 'text', key: 'suffix', label: 'Suffix' },
        { type: 'text', key: 'placeholder', label: 'Placeholder' }
      ];
    case 'NumberInput':
      return [
        { type: 'number', key: 'min', label: 'Minimum' },
        { type: 'number', key: 'max', label: 'Maximum' },
        { type: 'number', key: 'step', label: 'Step' },
        { type: 'toggle', key: 'showStepper', label: 'Show stepper buttons' }
      ];
    case 'DatePicker':
      return [
        { type: 'text', key: 'format', label: 'Date format (e.g. YYYY-MM-DD)' },
        { type: 'text', key: 'minDate', label: 'Min date' },
        { type: 'text', key: 'maxDate', label: 'Max date' },
        { type: 'toggle', key: 'showTime', label: 'Show time picker' }
      ];
    case 'Select':
      return [
        { type: 'toggle', key: 'searchable', label: 'Searchable' },
        { type: 'toggle', key: 'clearable', label: 'Clearable' },
        { type: 'text', key: 'placeholder', label: 'Placeholder' }
      ];
    case 'RadioGroup':
      return [
        { type: 'number', key: 'columns', label: 'Columns', min: 1, max: 6 },
        {
          type: 'dropdown', key: 'orientation', label: 'Orientation',
          options: [
            { value: '', label: 'Default' },
            { value: 'vertical', label: 'Vertical' },
            { value: 'horizontal', label: 'Horizontal' }
          ]
        }
      ];
    case 'CheckboxGroup':
      return [
        { type: 'number', key: 'columns', label: 'Columns', min: 1, max: 6 },
        { type: 'toggle', key: 'selectAll', label: 'Show "Select all"' }
      ];
    case 'Toggle':
      return [
        { type: 'text', key: 'onLabel', label: 'On label' },
        { type: 'text', key: 'offLabel', label: 'Off label' }
      ];
    case 'Slider':
      return [
        { type: 'number', key: 'min', label: 'Minimum' },
        { type: 'number', key: 'max', label: 'Maximum' },
        { type: 'number', key: 'step', label: 'Step' },
        { type: 'toggle', key: 'showValue', label: 'Show current value' },
        { type: 'toggle', key: 'showTicks', label: 'Show ticks' }
      ];
    case 'Rating':
      return [
        { type: 'number', key: 'max', label: 'Max stars', min: 1, max: 10 },
        {
          type: 'dropdown', key: 'icon', label: 'Icon',
          options: [
            { value: '', label: 'Default (star)' },
            { value: 'star', label: 'Star' },
            { value: 'heart', label: 'Heart' },
            { value: 'circle', label: 'Circle' }
          ]
        },
        { type: 'toggle', key: 'allowHalf', label: 'Allow half values' }
      ];
    case 'MoneyInput':
      return [
        { type: 'text', key: 'currency', label: 'Currency (ISO 4217)' },
        { type: 'toggle', key: 'showCurrency', label: 'Show currency symbol' },
        { type: 'number', key: 'min', label: 'Minimum' },
        { type: 'number', key: 'max', label: 'Maximum' },
        { type: 'number', key: 'step', label: 'Step' }
      ];
    case 'FileUpload':
      return [
        { type: 'text', key: 'accept', label: 'Accepted types (e.g. .pdf,.docx)' },
        { type: 'number', key: 'maxSize', label: 'Max size (bytes)' },
        { type: 'toggle', key: 'multiple', label: 'Allow multiple files' },
        { type: 'toggle', key: 'dragDrop', label: 'Drag & drop zone' }
      ];
    case 'Signature':
      return [
        { type: 'text', key: 'strokeColor', label: 'Stroke color (CSS)' },
        { type: 'number', key: 'height', label: 'Height (px)', min: 80 },
        { type: 'number', key: 'penWidth', label: 'Pen width (px)', min: 1 },
        { type: 'toggle', key: 'clearable', label: 'Clearable' }
      ];
    default:
      return [];
  }
}
