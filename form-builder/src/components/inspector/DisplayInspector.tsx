import type { Signal } from '@preact/signals';
import type { FormspecItem } from 'formspec-engine';
import {
  setActiveBreakpoint,
  setComponentNodeProperty,
  setComponentResponsiveOverride,
  renameItem,
  setInspectorSectionOpen,
  setItemText,
  setPresentation
} from '../../state/mutations';
import type { ProjectState } from '../../state/project';
import { AppearanceSection, type AccessibilityOverride } from './sections/AppearanceSection';
import { BasicsSection } from './sections/BasicsSection';
import { Collapsible } from '../controls/Collapsible';
import { TextInput } from '../controls/TextInput';
import { getComponentNodeByPath, getComponentResponsiveOverride, getThemeItemPresentation } from './utils';

export interface DisplayInspectorProps {
  project: Signal<ProjectState>;
  path: string;
  item: FormspecItem;
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
  const DISPLAY_SECTION_DEFAULTS: Record<string, boolean> = { basics: true };
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

  return (
    <div class="inspector-content" data-testid="display-inspector">
      <BasicsSection
        testIdPrefix="display"
        open={isSectionOpen('basics')}
        keyValue={props.item.key}
        label={props.item.label}
        description={props.item.description}
        showDescription
        onToggle={(open) => {
          setSectionOpen('basics', open);
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

      <AppearanceSection
        testIdPrefix="display"
        open={isSectionOpen('appearance')}
        widget={typeof themePresentation.widget === 'string' ? themePresentation.widget : undefined}
        cssClass={typeof themePresentation.cssClass === 'string' ? themePresentation.cssClass : undefined}
        componentWhen={componentNode?.when}
        accessibility={isDisplayRecord(themePresentation.accessibility) ? themePresentation.accessibility as AccessibilityOverride : undefined}
        style={isDisplayRecord(themePresentation.style) ? themePresentation.style as Record<string, string | number> : undefined}
        widgetConfig={isDisplayRecord(themePresentation.widgetConfig) ? themePresentation.widgetConfig as Record<string, string | number> : undefined}
        fallback={Array.isArray(themePresentation.fallback) ? themePresentation.fallback as string[] : undefined}
        breakpoints={props.project.value.theme.breakpoints ?? {}}
        activeBreakpoint={activeBreakpoint}
        responsiveOverride={{
          span: typeof responsiveOverride.span === 'number' ? responsiveOverride.span : undefined,
          start: typeof responsiveOverride.start === 'number' ? responsiveOverride.start : undefined,
          hidden: typeof responsiveOverride.hidden === 'boolean' ? responsiveOverride.hidden : undefined
        }}
        onToggle={(open) => {
          setSectionOpen('appearance', open);
        }}
        onWidgetChange={(value) => {
          updateThemePresentation('widget', value);
        }}
        onCssClassInput={(value) => {
          updateThemePresentation('cssClass', value);
        }}
        onComponentWhenChange={(value) => {
          setComponentNodeProperty(props.project, props.path, 'when', value || undefined);
        }}
        onAccessibilityChange={(value) => {
          updateThemePresentation('accessibility', value);
        }}
        onStyleChange={(value) => {
          updateThemePresentation('style', value);
        }}
        onWidgetConfigChange={(value) => {
          updateThemePresentation('widgetConfig', value);
        }}
        onFallbackChange={(value) => {
          updateThemePresentation('fallback', value);
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

function isDisplayRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
