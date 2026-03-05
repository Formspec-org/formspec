import { Dropdown } from '../controls/Dropdown';
import { NumberInput } from '../controls/NumberInput';
import { Toggle } from '../controls/Toggle';

export interface ResponsiveOverrideValue {
  span?: number;
  start?: number;
  hidden?: boolean;
}

export interface ResponsiveOverridePatch {
  span?: number | null;
  start?: number | null;
  hidden?: boolean | null;
}

export interface ResponsiveOverridesProps {
  testIdPrefix: string;
  breakpoints: Record<string, number>;
  activeBreakpoint: string;
  value: ResponsiveOverrideValue;
  onBreakpointChange: (breakpointName: string) => void;
  onOverrideChange: (patch: ResponsiveOverridePatch) => void;
}

export function ResponsiveOverrides(props: ResponsiveOverridesProps) {
  const breakpointEntries = Object.entries(props.breakpoints).sort((left, right) => left[1] - right[1]);
  if (!breakpointEntries.length) {
    return (
      <p class="inspector-hint" data-testid={`${props.testIdPrefix}-responsive-empty`}>
        No breakpoints available.
      </p>
    );
  }

  const hasValue = props.value.span !== undefined || props.value.start !== undefined || props.value.hidden !== undefined;

  return (
    <div class="responsive-overrides">
      <p class="responsive-overrides__title">Responsive overrides</p>
      <Dropdown
        label="Breakpoint"
        value={props.activeBreakpoint}
        testId={`${props.testIdPrefix}-responsive-breakpoint-input`}
        options={breakpointEntries.map(([name, width]) => ({
          value: name,
          label: `${name} (${width}px)`
        }))}
        onChange={props.onBreakpointChange}
      />
      <NumberInput
        label="Span (1-12)"
        value={props.value.span}
        min={1}
        max={12}
        testId={`${props.testIdPrefix}-responsive-span-input`}
        onInput={(span) => {
          props.onOverrideChange({ span: span ?? null });
        }}
      />
      <NumberInput
        label="Start (1-12)"
        value={props.value.start}
        min={1}
        max={12}
        testId={`${props.testIdPrefix}-responsive-start-input`}
        onInput={(start) => {
          props.onOverrideChange({ start: start ?? null });
        }}
      />
      <Toggle
        label="Hidden at breakpoint"
        checked={props.value.hidden ?? false}
        testId={`${props.testIdPrefix}-responsive-hidden-toggle`}
        onToggle={(hidden) => {
          props.onOverrideChange({ hidden });
        }}
      />
      <button
        type="button"
        class="responsive-overrides__clear"
        data-testid={`${props.testIdPrefix}-responsive-clear`}
        disabled={!hasValue}
        onClick={() => {
          props.onOverrideChange({ span: null, start: null, hidden: null });
        }}
      >
        Clear overrides
      </button>
    </div>
  );
}
