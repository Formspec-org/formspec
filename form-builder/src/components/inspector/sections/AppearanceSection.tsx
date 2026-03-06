import { Collapsible } from '../../controls/Collapsible';
import { Dropdown, type DropdownOption } from '../../controls/Dropdown';
import { FELEditor } from '../../controls/FELEditor';
import type { FELEditorFieldOption } from '../../controls/fel-utils';
import { KeyValueEditor } from '../../controls/KeyValueEditor';
import { TextInput } from '../../controls/TextInput';
import {
  ResponsiveOverrides,
  type ResponsiveOverridePatch,
  type ResponsiveOverrideValue
} from '../../responsive/ResponsiveOverrides';

export interface AccessibilityOverride {
  role?: string;
  description?: string;
  liveRegion?: '' | 'off' | 'polite' | 'assertive';
}

const DEFAULT_WIDGET_OPTIONS: DropdownOption[] = [
  { value: '', label: 'Auto' },
  { value: 'TextInput', label: 'Text Input' },
  { value: 'NumberInput', label: 'Number Input' },
  { value: 'Toggle', label: 'Toggle' },
  { value: 'Checkbox', label: 'Checkbox' },
  { value: 'Select', label: 'Dropdown' },
  { value: 'RadioGroup', label: 'Radio Group' },
  { value: 'CheckboxGroup', label: 'Checkbox Group' },
  { value: 'DatePicker', label: 'Date Picker' },
  { value: 'MoneyInput', label: 'Money Input' },
  { value: 'Heading', label: 'Heading' },
  { value: 'Text', label: 'Text' }
];

const LABEL_POSITION_OPTIONS: DropdownOption[] = [
  { value: '', label: 'Default' },
  { value: 'above', label: 'Above' },
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'hidden', label: 'Hidden' },
  { value: 'placeholder', label: 'Placeholder' }
];

interface AppearanceSectionProps {
  testIdPrefix: string;
  open: boolean;
  widget?: string;
  cssClass?: string;
  labelPosition?: string;
  /** Component-level `when` condition (visual-only; data preserved when hidden). */
  componentWhen?: string;
  /** `accessibility` block — role, description, liveRegion. */
  accessibility?: AccessibilityOverride;
  /** `style` flat CSS-like overrides. */
  style?: Record<string, string | number>;
  /** `widgetConfig` widget-specific config. */
  widgetConfig?: Record<string, string | number>;
  /** `fallback` ordered fallback widget identifiers (comma-separated for UI). */
  fallback?: string[];
  breakpoints: Record<string, number>;
  activeBreakpoint: string;
  responsiveOverride: ResponsiveOverrideValue;
  widgetOptions?: DropdownOption[];
  felFieldOptions?: FELEditorFieldOption[];
  onToggle: (open: boolean) => void;
  onWidgetChange: (value: string) => void;
  onCssClassInput: (value: string) => void;
  onLabelPositionChange?: (value: string) => void;
  onComponentWhenChange?: (value: string) => void;
  onAccessibilityChange?: (value: AccessibilityOverride | undefined) => void;
  onStyleChange?: (value: Record<string, string | number> | undefined) => void;
  onWidgetConfigChange?: (value: Record<string, string | number> | undefined) => void;
  onFallbackChange?: (value: string[] | undefined) => void;
  onBreakpointChange: (value: string) => void;
  onResponsiveOverrideChange: (value: ResponsiveOverridePatch) => void;
}

const LIVE_REGION_OPTIONS: DropdownOption[] = [
  { value: '', label: 'None' },
  { value: 'off', label: 'Off' },
  { value: 'polite', label: 'Polite (idle)' },
  { value: 'assertive', label: 'Assertive (interrupt)' }
];

export function AppearanceSection(props: AppearanceSectionProps) {
  const options = props.widgetOptions ?? DEFAULT_WIDGET_OPTIONS;
  const hasCustomization = !!(
    props.widget || props.cssClass || props.labelPosition || props.componentWhen
    || props.accessibility || props.style || props.widgetConfig || props.fallback?.length
  );
  const a11y = props.accessibility ?? {};
  const fallbackStr = (props.fallback ?? []).join(', ');

  return (
    <Collapsible
      id="appearance"
      title="Appearance"
      open={props.open}
      summary={hasCustomization ? 'Customized' : null}
      onToggle={props.onToggle}
    >
      <Dropdown
        label="Widget override"
        value={props.widget}
        options={options}
        testId={`${props.testIdPrefix}-widget-input`}
        onChange={props.onWidgetChange}
      />
      {props.onLabelPositionChange ? (
        <Dropdown
          label="Label position"
          value={props.labelPosition ?? ''}
          options={LABEL_POSITION_OPTIONS}
          testId={`${props.testIdPrefix}-label-position-input`}
          onChange={props.onLabelPositionChange}
        />
      ) : null}
      <TextInput
        label="CSS class"
        value={props.cssClass}
        testId={`${props.testIdPrefix}-css-class-input`}
        onInput={props.onCssClassInput}
      />
      {props.onComponentWhenChange ? (
        <FELEditor
          label="Display when (visual only)"
          value={props.componentWhen}
          testId={`${props.testIdPrefix}-component-when-input`}
          placeholder="$status = 'active'"
          fieldOptions={props.felFieldOptions ?? []}
          onInput={props.onComponentWhenChange}
        />
      ) : null}
      {props.onWidgetConfigChange ? (
        <KeyValueEditor
          label="Widget config"
          value={props.widgetConfig}
          testId={`${props.testIdPrefix}-widget-config`}
          valuePlaceholder="e.g. 4 or true"
          onInput={props.onWidgetConfigChange}
        />
      ) : null}
      {props.onStyleChange ? (
        <KeyValueEditor
          label="Style overrides"
          value={props.style}
          testId={`${props.testIdPrefix}-style`}
          valuePlaceholder="e.g. $token.color.primary"
          onInput={props.onStyleChange}
        />
      ) : null}
      {props.onFallbackChange ? (
        <TextInput
          label="Fallback widgets (comma-separated)"
          value={fallbackStr}
          testId={`${props.testIdPrefix}-fallback-input`}
          placeholder="e.g. textInput, textarea"
          onInput={(value) => {
            const list = value.split(',').map((s) => s.trim()).filter(Boolean);
            props.onFallbackChange!(list.length > 0 ? list : undefined);
          }}
        />
      ) : null}
      {props.onAccessibilityChange ? (
        <>
          <TextInput
            label="Accessibility: ARIA role"
            value={a11y.role}
            testId={`${props.testIdPrefix}-a11y-role-input`}
            placeholder="e.g. alert, status, region"
            onInput={(value) => {
              const next = { ...a11y, role: value || undefined };
              props.onAccessibilityChange!(toAccessibilityOrUndefined(next));
            }}
          />
          <TextInput
            label="Accessibility: description"
            value={a11y.description}
            testId={`${props.testIdPrefix}-a11y-description-input`}
            placeholder="Screen-reader description"
            onInput={(value) => {
              const next = { ...a11y, description: value || undefined };
              props.onAccessibilityChange!(toAccessibilityOrUndefined(next));
            }}
          />
          <Dropdown
            label="Accessibility: live region"
            value={a11y.liveRegion ?? ''}
            options={LIVE_REGION_OPTIONS}
            testId={`${props.testIdPrefix}-a11y-live-region-input`}
            onChange={(value) => {
              const next = { ...a11y, liveRegion: (value || undefined) as AccessibilityOverride['liveRegion'] };
              props.onAccessibilityChange!(toAccessibilityOrUndefined(next));
            }}
          />
        </>
      ) : null}
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

function toAccessibilityOrUndefined(
  a11y: AccessibilityOverride
): AccessibilityOverride | undefined {
  const hasAny = a11y.role || a11y.description || a11y.liveRegion;
  return hasAny ? a11y : undefined;
}
