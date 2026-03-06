import { Collapsible } from '../../controls/Collapsible';
import { Dropdown } from '../../controls/Dropdown';
import { NumberInput } from '../../controls/NumberInput';
import { TextInput } from '../../controls/TextInput';
import { Toggle } from '../../controls/Toggle';

export interface PresentationLayout {
  flow?: string;
  columns?: number;
  colSpan?: number;
  newRow?: boolean;
  collapsible?: boolean;
  collapsedByDefault?: boolean;
  page?: string;
  direction?: string;
  gap?: string;
  align?: string;
  wrap?: boolean;
}

export interface PresentationHints {
  widgetHint?: string;
  layout?: PresentationLayout;
  styleHints?: {
    emphasis?: string;
    size?: string;
  };
  accessibility?: {
    role?: string;
    description?: string;
    liveRegion?: string;
  };
}

export interface PresentationSectionProps {
  testIdPrefix: string;
  open: boolean;
  isGroup?: boolean;
  hints: PresentationHints;
  onToggle: (open: boolean) => void;
  onChange: (key: string, value: unknown) => void;
}

export function PresentationSection(props: PresentationSectionProps) {
  const { hints } = props;
  const layout = hints.layout ?? {};
  const styleHints = hints.styleHints ?? {};
  const accessibility = hints.accessibility ?? {};

  const hasSomething = Boolean(hints.widgetHint || hints.layout || hints.styleHints || hints.accessibility);

  return (
    <Collapsible
      id="presentation"
      title="Presentation Hints"
      open={props.open}
      summary={hasSomething ? 'Configured' : null}
      onToggle={props.onToggle}
    >
      <TextInput
        label="Widget hint"
        value={hints.widgetHint}
        testId={`${props.testIdPrefix}-widget-hint-input`}
        onInput={(value) => { props.onChange('widgetHint', value || undefined); }}
      />

      {props.isGroup ? (
        <>
          <Dropdown
            label="Layout flow"
            value={layout.flow ?? ''}
            testId={`${props.testIdPrefix}-layout-flow-input`}
            options={[
              { value: '', label: 'Default (stack)' },
              { value: 'stack', label: 'Stack (vertical)' },
              { value: 'grid', label: 'Grid' },
              { value: 'inline', label: 'Inline (horizontal)' }
            ]}
            onChange={(value) => { props.onChange('layout.flow', value || undefined); }}
          />
          {layout.flow === 'grid' ? (
            <NumberInput
              label="Grid columns"
              value={layout.columns}
              testId={`${props.testIdPrefix}-layout-columns-input`}
              onInput={(value) => { props.onChange('layout.columns', value); }}
            />
          ) : null}
          <Toggle
            label="Collapsible"
            checked={Boolean(layout.collapsible)}
            testId={`${props.testIdPrefix}-layout-collapsible-input`}
            onToggle={(value) => { props.onChange('layout.collapsible', value || undefined); }}
          />
          {layout.collapsible ? (
            <Toggle
              label="Collapsed by default"
              checked={Boolean(layout.collapsedByDefault)}
              testId={`${props.testIdPrefix}-layout-collapsed-default-input`}
              onToggle={(value) => { props.onChange('layout.collapsedByDefault', value || undefined); }}
            />
          ) : null}
          <TextInput
            label="Page / wizard step"
            value={layout.page}
            testId={`${props.testIdPrefix}-layout-page-input`}
            onInput={(value) => { props.onChange('layout.page', value || undefined); }}
          />
          <Dropdown
            label="Stack direction"
            value={layout.direction ?? ''}
            testId={`${props.testIdPrefix}-layout-direction-input`}
            options={[
              { value: '', label: 'Default (vertical)' },
              { value: 'vertical', label: 'Vertical' },
              { value: 'horizontal', label: 'Horizontal' }
            ]}
            onChange={(value) => { props.onChange('layout.direction', value || undefined); }}
          />
          <TextInput
            label="Gap"
            value={layout.gap}
            testId={`${props.testIdPrefix}-layout-gap-input`}
            onInput={(value) => { props.onChange('layout.gap', value || undefined); }}
          />
          <Dropdown
            label="Align items"
            value={layout.align ?? ''}
            testId={`${props.testIdPrefix}-layout-align-input`}
            options={[
              { value: '', label: 'Default' },
              { value: 'start', label: 'Start' },
              { value: 'center', label: 'Center' },
              { value: 'end', label: 'End' },
              { value: 'stretch', label: 'Stretch' }
            ]}
            onChange={(value) => { props.onChange('layout.align', value || undefined); }}
          />
          <Toggle
            label="Wrap"
            checked={Boolean(layout.wrap)}
            testId={`${props.testIdPrefix}-layout-wrap-input`}
            onToggle={(value) => { props.onChange('layout.wrap', value || undefined); }}
          />
        </>
      ) : (
        <>
          <NumberInput
            label="Column span (in grid parent)"
            value={layout.colSpan}
            testId={`${props.testIdPrefix}-layout-col-span-input`}
            onInput={(value) => { props.onChange('layout.colSpan', value); }}
          />
          <Toggle
            label="Force new row"
            checked={Boolean(layout.newRow)}
            testId={`${props.testIdPrefix}-layout-new-row-input`}
            onToggle={(value) => { props.onChange('layout.newRow', value || undefined); }}
          />
        </>
      )}

      <Dropdown
        label="Emphasis"
        value={styleHints.emphasis ?? ''}
        testId={`${props.testIdPrefix}-style-emphasis-input`}
        options={[
          { value: '', label: 'Default' },
          { value: 'primary', label: 'Primary' },
          { value: 'success', label: 'Success' },
          { value: 'warning', label: 'Warning' },
          { value: 'danger', label: 'Danger' },
          { value: 'muted', label: 'Muted' }
        ]}
        onChange={(value) => { props.onChange('styleHints.emphasis', value || undefined); }}
      />
      <Dropdown
        label="Size"
        value={styleHints.size ?? ''}
        testId={`${props.testIdPrefix}-style-size-input`}
        options={[
          { value: '', label: 'Default' },
          { value: 'compact', label: 'Compact' },
          { value: 'large', label: 'Large' }
        ]}
        onChange={(value) => { props.onChange('styleHints.size', value || undefined); }}
      />

      <TextInput
        label="Accessibility role"
        value={accessibility.role}
        testId={`${props.testIdPrefix}-a11y-role-input`}
        onInput={(value) => { props.onChange('accessibility.role', value || undefined); }}
      />
      <TextInput
        label="Accessibility description"
        value={accessibility.description}
        testId={`${props.testIdPrefix}-a11y-description-input`}
        onInput={(value) => { props.onChange('accessibility.description', value || undefined); }}
      />
      <Dropdown
        label="Live region"
        value={accessibility.liveRegion ?? ''}
        testId={`${props.testIdPrefix}-a11y-live-region-input`}
        options={[
          { value: '', label: 'Off' },
          { value: 'polite', label: 'Polite' },
          { value: 'assertive', label: 'Assertive' }
        ]}
        onChange={(value) => { props.onChange('accessibility.liveRegion', value || undefined); }}
      />
    </Collapsible>
  );
}
