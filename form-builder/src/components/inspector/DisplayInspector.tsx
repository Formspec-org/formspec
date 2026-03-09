import type { Signal } from '@preact/signals';
import type { FormspecItem } from 'formspec-engine';
import {
  setActiveBreakpoint,
  setComponentNodeProperty,
  setComponentResponsiveOverride,
  setDefinitionPresentationKey,
  renameItem,
  setInspectorSectionOpen,
  setItemText,
  setPresentation
} from '../../state/mutations';
import type { ProjectState } from '../../state/project';
import { LayoutStyleSection, type AccessibilityOverride } from './sections/LayoutStyleSection';
import { QuestionSection } from './sections/QuestionSection';
import { Collapsible } from '../controls/Collapsible';
import { TextInput } from '../controls/TextInput';
import { getComponentNodeByPath, getComponentResponsiveOverride, getThemeItemPresentation } from './utils';
import type { InspectorTier } from './Inspector';

interface DisplayInspectorProps {
  project: Signal<ProjectState>;
  path: string;
  item: FormspecItem;
  tier: InspectorTier;
}

export function DisplayInspector(props: DisplayInspectorProps) {
  const themePresentation = getThemeItemPresentation(props.project.value.theme, props.path);
  const activeBreakpoint = props.project.value.uiState.activeBreakpoint;
  const componentNode = getComponentNodeByPath(
    props.project.value.definition.items,
    props.project.value.component,
    props.path
  );
  const responsiveOverride = getComponentResponsiveOverride(
    props.project.value.definition.items,
    props.project.value.component,
    props.path,
    activeBreakpoint
  );

  const setSectionOpen = (sectionId: string, open: boolean) => {
    setInspectorSectionOpen(props.project, `display:${props.path}:${sectionId}`, open);
  };
  const DISPLAY_SECTION_DEFAULTS: Record<string, boolean> = { question: true };
  const isSectionOpen = (sectionId: string) =>
    props.project.value.uiState.inspectorSections[`display:${props.path}:${sectionId}`] ?? DISPLAY_SECTION_DEFAULTS[sectionId] ?? false;

  const updateThemePresentation = (key: string, value: unknown) => {
    const next = { ...themePresentation };
    if (typeof value === 'string' && value.trim().length === 0) {
      delete next[key];
    } else if (value === undefined || value === null) {
      delete next[key];
    } else {
      next[key] = value;
    }
    setPresentation(props.project, props.path, Object.keys(next).length ? next : null, 'theme');
  };

  // Layout & style presentation hints from definition
  const layoutPresentation = (props.item.presentation as Record<string, unknown> | undefined) ?? {};
  const layoutObj = (layoutPresentation.layout as Record<string, unknown> | undefined) ?? {};
  const styleHintsObj = (layoutPresentation.styleHints as Record<string, unknown> | undefined) ?? {};

  return (
    <div class="inspector-content" data-testid="display-inspector">
      <QuestionSection
        testIdPrefix="display"
        open={isSectionOpen('question')}
        tier={props.tier}
        keyValue={props.item.key}
        label={props.item.label}
        description={props.item.description}
        hint={props.item.hint}
        showPlaceholder={false}
        showPrefixSuffix={false}
        showOptionSet={false}
        onToggle={(open) => {
          setSectionOpen('question', open);
        }}
        onKeyCommit={(value) => {
          if (!value.trim().length || value === props.item.key) {
            return;
          }
          renameItem(props.project, props.path, value);
        }}
        onLabelInput={(value) => {
          setItemText(props.project, props.path, 'label', value);
        }}
        onDescriptionInput={(value) => {
          setItemText(props.project, props.path, 'description', value);
        }}
        onHintInput={(value) => {
          setItemText(props.project, props.path, 'hint', value);
        }}
      />

      {componentNode?.component === 'Spacer' ? (
        <Collapsible
          id="spacer-props"
          title="Spacer"
          open={isSectionOpen('spacer-props')}
          onToggle={(open) => setSectionOpen('spacer-props', open)}
        >
          <TextInput
            label="Size"
            value={componentNode?.size}
            testId="spacer-size-input"
            placeholder="e.g. 2rem, 24px, md"
            onInput={(value) => {
              setComponentNodeProperty(props.project, props.path, 'size', value || undefined);
            }}
          />
        </Collapsible>
      ) : null}

      <LayoutStyleSection
        testIdPrefix="display"
        open={isSectionOpen('layout-style')}
        tier={props.tier}
        cssClass={typeof themePresentation.cssClass === 'string' ? themePresentation.cssClass : undefined}
        style={isRecord(themePresentation.style) ? themePresentation.style as Record<string, string | number> : undefined}
        accessibility={isRecord(themePresentation.accessibility) ? themePresentation.accessibility as AccessibilityOverride : undefined}
        widgetConfig={isRecord(themePresentation.widgetConfig) ? themePresentation.widgetConfig as Record<string, string | number> : undefined}
        fallback={Array.isArray(themePresentation.fallback) ? themePresentation.fallback as string[] : undefined}
        componentWhen={componentNode?.when}
        presentationHints={{
          colSpan: typeof layoutObj.colSpan === 'number' ? layoutObj.colSpan : undefined,
          newRow: typeof layoutObj.newRow === 'boolean' ? layoutObj.newRow : undefined,
          emphasis: typeof styleHintsObj.emphasis === 'string' ? styleHintsObj.emphasis : undefined,
          size: typeof styleHintsObj.size === 'string' ? styleHintsObj.size : undefined
        }}
        breakpoints={props.project.value.theme.breakpoints ?? {}}
        activeBreakpoint={activeBreakpoint}
        responsiveOverride={{
          span: typeof responsiveOverride.span === 'number' ? responsiveOverride.span : undefined,
          start: typeof responsiveOverride.start === 'number' ? responsiveOverride.start : undefined,
          hidden: typeof responsiveOverride.hidden === 'boolean' ? responsiveOverride.hidden : undefined
        }}
        felFieldOptions={[]}
        onToggle={(open) => {
          setSectionOpen('layout-style', open);
        }}
        onLabelPositionChange={(value) => {
          updateThemePresentation('labelPosition', value);
        }}
        onCssClassInput={(value) => {
          updateThemePresentation('cssClass', value);
        }}
        onStyleChange={(value) => {
          updateThemePresentation('style', value);
        }}
        onAccessibilityChange={(value) => {
          updateThemePresentation('accessibility', value);
        }}
        onWidgetConfigChange={(value) => {
          updateThemePresentation('widgetConfig', value);
        }}
        onFallbackChange={(value) => {
          updateThemePresentation('fallback', value);
        }}
        onComponentWhenChange={(value) => {
          setComponentNodeProperty(props.project, props.path, 'when', value || undefined);
        }}
        onPresentationChange={(key, value) => {
          setDefinitionPresentationKey(props.project, props.path, key, value);
        }}
        onBreakpointChange={(value) => {
          setActiveBreakpoint(props.project, value);
        }}
        onResponsiveOverrideChange={(value) => {
          setComponentResponsiveOverride(
            props.project,
            props.path,
            props.project.value.uiState.activeBreakpoint,
            value
          );
        }}
      />
    </div>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
