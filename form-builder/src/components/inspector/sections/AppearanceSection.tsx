import { Collapsible } from '../../controls/Collapsible';
import { Dropdown, type DropdownOption } from '../../controls/Dropdown';
import { TextInput } from '../../controls/TextInput';
import {
  ResponsiveOverrides,
  type ResponsiveOverridePatch,
  type ResponsiveOverrideValue
} from '../../responsive/ResponsiveOverrides';

const DEFAULT_WIDGET_OPTIONS: DropdownOption[] = [
  { value: '', label: 'Auto' },
  { value: 'textInput', label: 'Text Input' },
  { value: 'textarea', label: 'Textarea' },
  { value: 'numberInput', label: 'Number Input' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'toggle', label: 'Toggle' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'radio', label: 'Radio' },
  { value: 'datePicker', label: 'Date Picker' },
  { value: 'moneyInput', label: 'Money Input' },
  { value: 'heading', label: 'Heading' },
  { value: 'paragraph', label: 'Paragraph' }
];

export interface AppearanceSectionProps {
  testIdPrefix: string;
  open: boolean;
  widget?: string;
  cssClass?: string;
  breakpoints: Record<string, number>;
  activeBreakpoint: string;
  responsiveOverride: ResponsiveOverrideValue;
  widgetOptions?: DropdownOption[];
  onToggle: (open: boolean) => void;
  onWidgetChange: (value: string) => void;
  onCssClassInput: (value: string) => void;
  onBreakpointChange: (value: string) => void;
  onResponsiveOverrideChange: (value: ResponsiveOverridePatch) => void;
}

export function AppearanceSection(props: AppearanceSectionProps) {
  const options = props.widgetOptions ?? DEFAULT_WIDGET_OPTIONS;

  return (
    <Collapsible
      id="appearance"
      title="Appearance"
      open={props.open}
      summary={props.widget || props.cssClass ? 'Customized' : null}
      onToggle={props.onToggle}
    >
      <Dropdown
        label="Widget override"
        value={props.widget}
        options={options}
        testId={`${props.testIdPrefix}-widget-input`}
        onChange={props.onWidgetChange}
      />
      <TextInput
        label="CSS class"
        value={props.cssClass}
        testId={`${props.testIdPrefix}-css-class-input`}
        onInput={props.onCssClassInput}
      />
      <ResponsiveOverrides
        testIdPrefix={props.testIdPrefix}
        breakpoints={props.breakpoints}
        activeBreakpoint={props.activeBreakpoint}
        value={props.responsiveOverride}
        onBreakpointChange={props.onBreakpointChange}
        onOverrideChange={props.onResponsiveOverrideChange}
      />
    </Collapsible>
  );
}
