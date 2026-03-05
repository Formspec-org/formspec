import type { Signal } from '@preact/signals';
import { Collapsible } from '../controls/Collapsible';
import { Dropdown } from '../controls/Dropdown';
import { TextInput } from '../controls/TextInput';
import {
  setFormPresentationProperty,
  setInspectorSectionOpen,
  setThemeToken
} from '../../state/mutations';
import type { ProjectState } from '../../state/project';
import { ColorPicker } from './ColorPicker';
import { SelectorRuleEditor } from './SelectorRuleEditor';
import { TokenEditor } from './TokenEditor';

export interface BrandPanelProps {
  project: Signal<ProjectState>;
}

export function BrandPanel(props: BrandPanelProps) {
  const definition = props.project.value.definition;
  const formPresentation = (definition.formPresentation as Record<string, unknown> | undefined) ?? {};
  const tokenCount = Object.keys(props.project.value.theme.tokens ?? {}).length;
  const selectorRuleCount = props.project.value.theme.selectors?.length ?? 0;

  const setSectionOpen = (sectionId: string, open: boolean) => {
    setInspectorSectionOpen(props.project, `form:${sectionId}`, open);
  };
  const isSectionOpen = (sectionId: string, defaultOpen: boolean) =>
    props.project.value.uiState.inspectorSections[`form:${sectionId}`] ?? defaultOpen;

  return (
    <>
      <Collapsible
        id="brand-style"
        title="Brand"
        open={isSectionOpen('brand-style', true)}
        onToggle={(open) => {
          setSectionOpen('brand-style', open);
        }}
      >
        <ColorPicker
          label="Primary color"
          value={toTokenValue(props.project.value.theme.tokens?.['color.primary'])}
          testId="brand-primary-color-input"
          onInput={(value) => {
            setThemeToken(props.project, 'color.primary', value);
          }}
        />
        <ColorPicker
          label="Secondary color"
          value={toTokenValue(props.project.value.theme.tokens?.['color.secondary'])}
          testId="brand-secondary-color-input"
          onInput={(value) => {
            setThemeToken(props.project, 'color.secondary', value);
          }}
        />
        <ColorPicker
          label="Error color"
          value={toTokenValue(props.project.value.theme.tokens?.['color.error'])}
          testId="brand-error-color-input"
          onInput={(value) => {
            setThemeToken(props.project, 'color.error', value);
          }}
        />
        <TextInput
          label="Font family"
          value={toTokenValue(props.project.value.theme.tokens?.['typography.body.family'])}
          testId="brand-font-family-input"
          onInput={(value) => {
            setThemeToken(props.project, 'typography.body.family', value);
          }}
        />
      </Collapsible>

      <Collapsible
        id="brand-layout"
        title="Layout"
        open={isSectionOpen('brand-layout', true)}
        onToggle={(open) => {
          setSectionOpen('brand-layout', open);
        }}
      >
        <Dropdown
          label="Page mode"
          value={typeof formPresentation.pageMode === 'string' ? formPresentation.pageMode : 'single'}
          testId="form-page-mode-input"
          options={[
            { value: 'single', label: 'Single page' },
            { value: 'wizard', label: 'Wizard' },
            { value: 'tabs', label: 'Tabs' }
          ]}
          onChange={(value) => {
            setFormPresentationProperty(props.project, 'pageMode', value);
          }}
        />
        <Dropdown
          label="Label position"
          value={typeof formPresentation.labelPosition === 'string' ? formPresentation.labelPosition : 'top'}
          testId="form-label-position-input"
          options={[
            { value: 'top', label: 'Top' },
            { value: 'start', label: 'Start' },
            { value: 'hidden', label: 'Hidden' }
          ]}
          onChange={(value) => {
            setFormPresentationProperty(props.project, 'labelPosition', value);
          }}
        />
        <Dropdown
          label="Density"
          value={typeof formPresentation.density === 'string' ? formPresentation.density : 'comfortable'}
          testId="form-density-input"
          options={[
            { value: 'compact', label: 'Compact' },
            { value: 'comfortable', label: 'Comfortable' },
            { value: 'spacious', label: 'Spacious' }
          ]}
          onChange={(value) => {
            setFormPresentationProperty(props.project, 'density', value);
          }}
        />
        <TextInput
          label="Default currency"
          value={typeof formPresentation.defaultCurrency === 'string' ? formPresentation.defaultCurrency : undefined}
          testId="form-default-currency-input"
          onInput={(value) => {
            setFormPresentationProperty(props.project, 'defaultCurrency', value);
          }}
        />
      </Collapsible>

      <Collapsible
        id="brand-style-rules"
        title="Style Rules"
        open={isSectionOpen('brand-style-rules', true)}
        summary={selectorRuleCount > 0 ? `${selectorRuleCount} rules` : null}
        onToggle={(open) => {
          setSectionOpen('brand-style-rules', open);
        }}
      >
        <SelectorRuleEditor project={props.project} />
      </Collapsible>

      <Collapsible
        id="brand-tokens"
        title="Design Tokens"
        open={isSectionOpen('brand-tokens', false)}
        summary={tokenCount > 0 ? `${tokenCount} tokens` : null}
        onToggle={(open) => {
          setSectionOpen('brand-tokens', open);
        }}
      >
        <TokenEditor project={props.project} />
      </Collapsible>
    </>
  );
}

function toTokenValue(token: string | number | undefined): string | undefined {
  if (token === undefined) {
    return undefined;
  }
  return String(token);
}
