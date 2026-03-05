import type { Signal } from '@preact/signals';
import type { FormspecItem } from 'formspec-engine';
import { collectLogicCatalog } from '../logic/catalog';
import {
  setActiveBreakpoint,
  renameItem,
  setBind,
  setFieldWidgetComponent,
  setComponentResponsiveOverride,
  setInspectorSectionOpen,
  setItemText,
  setPresentation
} from '../../state/mutations';
import type { ProjectState } from '../../state/project';
import { getFieldWidgetOptions, resolveDefaultFieldWidget } from '../../state/field-widgets';
import { buildExtensionCatalog } from '../../state/extensions';
import { AdvancedSection } from './sections/AdvancedSection';
import { AppearanceSection } from './sections/AppearanceSection';
import { BasicsSection } from './sections/BasicsSection';
import { LogicSection } from './sections/LogicSection';
import { ValidationSection } from './sections/ValidationSection';
import {
  findBindByPath,
  getComponentNodeByPath,
  getComponentResponsiveOverride,
  getThemeItemPresentation
} from './utils';

export interface FieldInspectorProps {
  project: Signal<ProjectState>;
  path: string;
  item: FormspecItem;
}

export function FieldInspector(props: FieldInspectorProps) {
  const bind = findBindByPath(props.project.value.definition.binds, props.path);
  const logicCatalog = collectLogicCatalog(props.project.value.definition.items);
  const itemPresentation = (props.item.presentation as Record<string, unknown> | undefined) ?? {};
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
  const defaultWidget = resolveDefaultFieldWidget(props.item.dataType);
  const selectedWidgetComponent = componentNode?.component ?? defaultWidget;
  const selectedWidgetValue = selectedWidgetComponent === defaultWidget ? '' : selectedWidgetComponent;
  const widgetOptions = getFieldWidgetOptions(props.item.dataType, selectedWidgetComponent);
  const extensionCatalog = buildExtensionCatalog(props.project.value.extensions.registries);

  const requiredIsBoolean = typeof bind?.required === 'boolean' ? bind.required : false;
  const requiredExpression = typeof bind?.required === 'string' ? bind.required : undefined;

  const setSectionOpen = (sectionId: string, open: boolean) => {
    setInspectorSectionOpen(props.project, `field:${sectionId}`, open);
  };
  const FIELD_SECTION_DEFAULTS: Record<string, boolean> = { basics: true };
  const isSectionOpen = (sectionId: string) =>
    props.project.value.uiState.inspectorSections[`field:${sectionId}`] ?? FIELD_SECTION_DEFAULTS[sectionId] ?? false;

  const updateDefinitionPresentation = (key: string, value: unknown) => {
    const next = { ...itemPresentation };
    if (typeof value === 'string' && value.trim().length === 0) {
      delete next[key];
    } else if (value === undefined || value === null) {
      delete next[key];
    } else {
      next[key] = value;
    }
    setPresentation(props.project, props.path, Object.keys(next).length ? next : null, 'definition');
  };

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
    <div class="inspector-content" data-testid="field-inspector">
      <p class="inspector-content__title">Field Inspector</p>
      <BasicsSection
        testIdPrefix="field"
        open={isSectionOpen('basics')}
        keyValue={props.item.key}
        label={props.item.label}
        description={props.item.description}
        hint={props.item.hint}
        placeholder={typeof itemPresentation.placeholder === 'string' ? itemPresentation.placeholder : undefined}
        required={requiredIsBoolean}
        showDescription
        showHint
        showPlaceholder
        showRequired
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
        onHintInput={(value) => {
          setItemText(props.project, props.path, 'hint', value);
        }}
        onPlaceholderInput={(value) => {
          updateDefinitionPresentation('placeholder', value);
        }}
        onRequiredToggle={(value) => {
          setBind(props.project, props.path, 'required', value ? true : undefined);
        }}
      />

      <LogicSection
        testIdPrefix="field"
        open={isSectionOpen('logic')}
        fields={logicCatalog.fields}
        groups={logicCatalog.groups}
        relevant={bind?.relevant}
        required={requiredExpression}
        calculate={bind?.calculate}
        readonly={typeof bind?.readonly === 'string' ? bind.readonly : undefined}
        onToggle={(open) => {
          setSectionOpen('logic', open);
        }}
        onRelevantInput={(value) => {
          setBind(props.project, props.path, 'relevant', value);
        }}
        onRequiredInput={(value) => {
          setBind(props.project, props.path, 'required', value);
        }}
        onCalculateInput={(value) => {
          setBind(props.project, props.path, 'calculate', value);
        }}
        onReadonlyInput={(value) => {
          setBind(props.project, props.path, 'readonly', value);
        }}
      />

      <ValidationSection
        testIdPrefix="field"
        open={isSectionOpen('validation')}
        dataType={props.item.dataType}
        fields={logicCatalog.fields}
        constraint={bind?.constraint}
        message={bind?.constraintMessage}
        customConstraints={extensionCatalog.constraints}
        onToggle={(open) => {
          setSectionOpen('validation', open);
        }}
        onConstraintInput={(value) => {
          setBind(props.project, props.path, 'constraint', value);
        }}
        onMessageInput={(value) => {
          setBind(props.project, props.path, 'constraintMessage', value);
        }}
      />

      <AppearanceSection
        testIdPrefix="field"
        open={isSectionOpen('appearance')}
        widget={selectedWidgetValue}
        widgetOptions={widgetOptions}
        cssClass={typeof themePresentation.cssClass === 'string' ? themePresentation.cssClass : undefined}
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
          setFieldWidgetComponent(props.project, props.path, value);
        }}
        onCssClassInput={(value) => {
          updateThemePresentation('cssClass', value);
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

      <AdvancedSection
        testIdPrefix="field"
        open={isSectionOpen('advanced')}
        defaultValue={typeof bind?.default === 'string' ? bind.default : undefined}
        whitespace={bind?.whitespace}
        excludedValue={bind?.excludedValue}
        nonRelevantBehavior={bind?.nonRelevantBehavior}
        disabledDisplay={bind?.disabledDisplay}
        precision={bind?.precision}
        remoteOptions={bind?.remoteOptions}
        onToggle={(open) => {
          setSectionOpen('advanced', open);
        }}
        onDefaultValueInput={(value) => {
          setBind(props.project, props.path, 'default', value);
        }}
        onWhitespaceChange={(value) => {
          setBind(props.project, props.path, 'whitespace', value || undefined);
        }}
        onExcludedValueChange={(value) => {
          setBind(props.project, props.path, 'excludedValue', value || undefined);
        }}
        onNonRelevantBehaviorChange={(value) => {
          setBind(props.project, props.path, 'nonRelevantBehavior', value || undefined);
        }}
        onDisabledDisplayChange={(value) => {
          setBind(props.project, props.path, 'disabledDisplay', value || undefined);
        }}
        onPrecisionInput={(value) => {
          setBind(props.project, props.path, 'precision', value);
        }}
        onRemoteOptionsInput={(value) => {
          setBind(props.project, props.path, 'remoteOptions', value);
        }}
      />
    </div>
  );
}
