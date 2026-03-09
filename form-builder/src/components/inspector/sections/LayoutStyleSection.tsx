/**
 * LayoutStyleSection — merges Appearance + Presentation into one section.
 *
 * Sub-groups:
 * - Label position (standard+)
 * - Sizing / responsive (standard+)
 * - Custom styling (advanced)
 * - Accessibility (advanced)
 *
 * Internally still writes to the correct backing store (theme vs definition).
 */
import { Collapsible } from '../../controls/Collapsible';
import { Dropdown, type DropdownOption } from '../../controls/Dropdown';
import { FELEditor } from '../../controls/FELEditor';
import { KeyValueEditor } from '../../controls/KeyValueEditor';
import { NumberInput } from '../../controls/NumberInput';
import { TextInput } from '../../controls/TextInput';
import { Toggle } from '../../controls/Toggle';
import type { FELEditorFieldOption } from '../../controls/fel-utils';
import {
  ResponsiveOverrides,
  type ResponsiveOverridePatch,
  type ResponsiveOverrideValue
} from '../../responsive/ResponsiveOverrides';
import type { InspectorTier } from '../Inspector';
import { meetsMinTier } from '../Inspector';
import { InlineHint } from '../InlineHint';

export interface AccessibilityOverride {
  role?: string;
  description?: string;
  liveRegion?: '' | 'off' | 'polite' | 'assertive';
}

export interface LayoutStylePresentationHints {
  colSpan?: number;
  newRow?: boolean;
  emphasis?: string;
  size?: string;
}

const LABEL_POSITION_OPTIONS: DropdownOption[] = [
  { value: '', label: 'Default' },
  { value: 'above', label: 'Above' },
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'hidden', label: 'Hidden' },
  { value: 'placeholder', label: 'Placeholder' }
];

const LIVE_REGION_OPTIONS: DropdownOption[] = [
  { value: '', label: 'None' },
  { value: 'off', label: 'Off' },
  { value: 'polite', label: 'Polite (idle)' },
  { value: 'assertive', label: 'Assertive (interrupt)' }
];

interface LayoutStyleSectionProps {
  testIdPrefix: string;
  open: boolean;
  tier: InspectorTier;
  // Theme-backed
  labelPosition?: string;
  cssClass?: string;
  style?: Record<string, string | number>;
  accessibility?: AccessibilityOverride;
  widgetConfig?: Record<string, string | number>;
  fallback?: string[];
  // Component-backed
  componentWhen?: string;
  // Definition presentation hints
  presentationHints: LayoutStylePresentationHints;
  // Responsive
  breakpoints: Record<string, number>;
  activeBreakpoint: string;
  responsiveOverride: ResponsiveOverrideValue;
  felFieldOptions: FELEditorFieldOption[];
  // Read-only display setting from Advanced
  disabledDisplay?: string;
  // Callbacks — theme-backed
  onToggle: (open: boolean) => void;
  onLabelPositionChange: (value: string) => void;
  onCssClassInput: (value: string) => void;
  onStyleChange: (value: Record<string, string | number> | undefined) => void;
  onAccessibilityChange: (value: AccessibilityOverride | undefined) => void;
  onWidgetConfigChange?: (value: Record<string, string | number> | undefined) => void;
  onFallbackChange?: (value: string[] | undefined) => void;
  // Callbacks — component-backed
  onComponentWhenChange?: (value: string) => void;
  // Callbacks — definition presentation
  onPresentationChange: (key: string, value: unknown) => void;
  // Callbacks — responsive
  onBreakpointChange: (value: string) => void;
  onResponsiveOverrideChange: (value: ResponsiveOverridePatch) => void;
  // Callback — disabled display
  onDisabledDisplayChange?: (value: string) => void;
}

export function LayoutStyleSection(props: LayoutStyleSectionProps) {
  const showLabelPosition = meetsMinTier(props.tier, 'standard');
  const showResponsive = meetsMinTier(props.tier, 'standard');
  const showCustomStyling = meetsMinTier(props.tier, 'advanced');
  const showAccessibility = meetsMinTier(props.tier, 'advanced');
  const showWidgetConfig = meetsMinTier(props.tier, 'advanced');
  const showFallback = meetsMinTier(props.tier, 'advanced');
  const showComponentWhen = meetsMinTier(props.tier, 'advanced');
  const showDisabledDisplay = meetsMinTier(props.tier, 'advanced');

  const hasConfig = !!(
    props.labelPosition || props.cssClass || props.style || props.accessibility
    || props.widgetConfig || props.fallback?.length || props.componentWhen
  );
  const a11y = props.accessibility ?? {};
  const fallbackStr = (props.fallback ?? []).join(', ');

  return (
    <Collapsible
      id="layout-style"
      title="Layout & Style"
      open={props.open}
      summary={hasConfig ? 'Customized' : null}
      onToggle={props.onToggle}
    >
      <InlineHint tier={props.tier} text="Customize sizing, positioning, or styling." />

      {showLabelPosition ? (
        <Dropdown
          label="Label position"
          value={props.labelPosition ?? ''}
          options={LABEL_POSITION_OPTIONS}
          testId={`${props.testIdPrefix}-label-position-input`}
          onChange={props.onLabelPositionChange}
        />
      ) : null}

      {/* Presentation hints: colSpan, emphasis, size */}
      <NumberInput
        label="Column span (in grid parent)"
        value={props.presentationHints.colSpan}
        testId={`${props.testIdPrefix}-layout-col-span-input`}
        onInput={(value) => { props.onPresentationChange('layout.colSpan', value); }}
      />
      <Dropdown
        label="Emphasis"
        value={props.presentationHints.emphasis ?? ''}
        testId={`${props.testIdPrefix}-style-emphasis-input`}
        options={[
          { value: '', label: 'Default' },
          { value: 'primary', label: 'Primary' },
          { value: 'success', label: 'Success' },
          { value: 'warning', label: 'Warning' },
          { value: 'danger', label: 'Danger' },
          { value: 'muted', label: 'Muted' }
        ]}
        onChange={(value) => { props.onPresentationChange('styleHints.emphasis', value || undefined); }}
      />

      {/* Responsive sizing */}
      {showResponsive ? (
        <ResponsiveOverrides
          testIdPrefix={props.testIdPrefix}
          breakpoints={props.breakpoints}
          activeBreakpoint={props.activeBreakpoint}
          value={props.responsiveOverride}
          onBreakpointChange={props.onBreakpointChange}
          onOverrideChange={props.onResponsiveOverrideChange}
        />
      ) : null}

      {showDisabledDisplay ? (
        <Dropdown
          label="Read-only display"
          value={props.disabledDisplay ?? ''}
          testId={`${props.testIdPrefix}-disabled-display-input`}
          options={[
            { value: '', label: 'Default' },
            { value: 'hidden', label: 'Hidden' },
            { value: 'protected', label: 'Shown but locked' }
          ]}
          onChange={(value) => { props.onDisabledDisplayChange?.(value); }}
        />
      ) : null}

      {/* Custom styling — advanced */}
      {showCustomStyling ? (
        <>
          <div class="inspector-subsection-header">Custom styling</div>
          <TextInput
            label="CSS class"
            value={props.cssClass}
            testId={`${props.testIdPrefix}-css-class-input`}
            onInput={props.onCssClassInput}
          />
          <KeyValueEditor
            label="Custom CSS"
            value={props.style}
            testId={`${props.testIdPrefix}-style`}
            valuePlaceholder="e.g. $token.color.primary"
            onInput={props.onStyleChange}
          />
        </>
      ) : null}

      {showWidgetConfig && props.onWidgetConfigChange ? (
        <KeyValueEditor
          label="Answer type settings"
          value={props.widgetConfig}
          testId={`${props.testIdPrefix}-widget-config`}
          valuePlaceholder="e.g. 4 or true"
          onInput={props.onWidgetConfigChange}
        />
      ) : null}

      {showFallback && props.onFallbackChange ? (
        <TextInput
          label="Fallback answer types (comma-separated)"
          value={fallbackStr}
          testId={`${props.testIdPrefix}-fallback-input`}
          placeholder="e.g. textInput, textarea"
          onInput={(value) => {
            const list = value.split(',').map((s) => s.trim()).filter(Boolean);
            props.onFallbackChange!(list.length > 0 ? list : undefined);
          }}
        />
      ) : null}

      {showComponentWhen && props.onComponentWhenChange ? (
        <FELEditor
          label="Show visually when (data still collected)"
          value={props.componentWhen}
          testId={`${props.testIdPrefix}-component-when-input`}
          placeholder="$status = 'active'"
          fieldOptions={props.felFieldOptions}
          onInput={props.onComponentWhenChange}
        />
      ) : null}

      {/* Accessibility — advanced */}
      {showAccessibility ? (
        <>
          <div class="inspector-subsection-header">Accessibility</div>
          <TextInput
            label="ARIA role"
            value={a11y.role}
            testId={`${props.testIdPrefix}-a11y-role-input`}
            placeholder="e.g. alert, status, region"
            onInput={(value) => {
              const next = { ...a11y, role: value || undefined };
              props.onAccessibilityChange(toAccessibilityOrUndefined(next));
            }}
          />
          <TextInput
            label="ARIA description"
            value={a11y.description}
            testId={`${props.testIdPrefix}-a11y-description-input`}
            placeholder="Screen-reader description"
            onInput={(value) => {
              const next = { ...a11y, description: value || undefined };
              props.onAccessibilityChange(toAccessibilityOrUndefined(next));
            }}
          />
          <Dropdown
            label="Live region"
            value={a11y.liveRegion ?? ''}
            options={LIVE_REGION_OPTIONS}
            testId={`${props.testIdPrefix}-a11y-live-region-input`}
            onChange={(value) => {
              const next = { ...a11y, liveRegion: (value || undefined) as AccessibilityOverride['liveRegion'] };
              props.onAccessibilityChange(toAccessibilityOrUndefined(next));
            }}
          />
        </>
      ) : null}
    </Collapsible>
  );
}

function toAccessibilityOrUndefined(
  a11y: AccessibilityOverride
): AccessibilityOverride | undefined {
  const hasAny = a11y.role || a11y.description || a11y.liveRegion;
  return hasAny ? a11y : undefined;
}
