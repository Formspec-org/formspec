import type { Signal } from '@preact/signals';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { FormspecBind, FormspecItem } from 'formspec-engine';
import { collectLogicCatalog } from '../logic/catalog';
import { saveUserFieldTemplate } from '../surface/field-templates';
import {
  addItem,
  setActiveBreakpoint,
  renameItem,
  setBind,
  setComponentNodeProperty,
  setComponentResponsiveOverride,
  setDefinitionPresentationKey,
  setFieldAnswerType,
  setInspectorSectionOpen,
  setItemLabel,
  setItemProperty,
  setItemText,
  setSelection,
  setPresentation,
  promoteOptionsToOptionSet
} from '../../state/mutations';
import type { ProjectState } from '../../state/project';
import { buildExtensionCatalog } from '../../state/extensions';
import type { InspectorTier } from './Inspector';
import { meetsMinTier } from './Inspector';
import { AnswerTypePicker } from './AnswerTypePicker';
import { QuestionSection } from './sections/QuestionSection';
import { RulesSection } from './sections/RulesSection';
import { LayoutStyleSection, type AccessibilityOverride } from './sections/LayoutStyleSection';
import { WidgetPropsSection } from './sections/WidgetPropsSection';
import { DataHandlingSection, type PrePopulateValue } from './sections/DataHandlingSection';
import {
  findBindByPath,
  getComponentNodeByPath,
  getComponentResponsiveOverride,
  getThemeItemPresentation
} from './utils';

interface FieldInspectorProps {
  project: Signal<ProjectState>;
  path: string;
  item: FormspecItem;
  tier: InspectorTier;
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
  const extensionCatalog = buildExtensionCatalog(props.project.value.extensions.registries);

  const requiredIsBoolean = isStaticRequired(bind?.required);
  const requiredExpression = typeof bind?.required === 'string' && !isStaticRequired(bind.required) ? bind.required : undefined;

  const [autoKey, setAutoKey] = useState(true);
  const [saveTemplateMode, setSaveTemplateMode] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState('');
  const [saveTemplateNotice, setSaveTemplateNotice] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentPathRef = useRef(props.path);
  currentPathRef.current = props.path;

  useEffect(() => {
    setAutoKey(true);
    const panel = containerRef.current?.closest<HTMLElement>('.shell-panel');
    if (panel) {
      panel.scrollTop = 0;
    }
    requestAnimationFrame(() => {
      const container = containerRef.current;
      if (!container) return;
      const firstFocusable = container.querySelector<HTMLElement>(
        'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])'
      );
      firstFocusable?.focus({ preventScroll: true });
    });
  }, [props.path]);

  const setSectionOpen = (sectionId: string, open: boolean) => {
    setInspectorSectionOpen(props.project, `field:${props.path}:${sectionId}`, open);
  };
  const FIELD_SECTION_DEFAULTS: Record<string, boolean> = { question: true };
  const isSectionOpen = (sectionId: string) =>
    props.project.value.uiState.inspectorSections[`field:${props.path}:${sectionId}`]
    ?? FIELD_SECTION_DEFAULTS[sectionId] ?? false;

  const updateDefinitionPresentation = (key: string, value: unknown) => {
    const next = { ...itemPresentation };
    if (typeof value === 'string' && value.trim().length === 0) {
      delete next[key];
    } else if (value === undefined || value === null) {
      delete next[key];
    } else {
      next[key] = value;
    }
    setPresentation(props.project, currentPathRef.current, Object.keys(next).length ? next : null, 'definition');
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
    setPresentation(props.project, currentPathRef.current, Object.keys(next).length ? next : null, 'theme');
  };

  const selectedWidget = componentNode?.component ?? '';

  // Layout & style presentation hints from definition
  const layoutPresentation = (props.item.presentation as Record<string, unknown> | undefined) ?? {};
  const layoutObj = (layoutPresentation.layout as Record<string, unknown> | undefined) ?? {};
  const styleHintsObj = (layoutPresentation.styleHints as Record<string, unknown> | undefined) ?? {};

  return (
    <div ref={containerRef} class="inspector-content" data-testid="field-inspector">
      {/* Answer type picker — always at top, never collapsible */}
      <AnswerTypePicker
        currentDataType={props.item.dataType}
        currentComponent={selectedWidget}
        onChange={(dataType, component) => {
          setFieldAnswerType(props.project, currentPathRef.current, dataType, component);
        }}
      />

      {/* Answer type settings — contextual, shown inline based on selected component */}
      {selectedWidget ? (
        <WidgetPropsSection
          testIdPrefix="field"
          open={isSectionOpen('widget-props')}
          component={selectedWidget}
          componentNode={componentNode ? (componentNode as unknown as Record<string, unknown>) : {}}
          onToggle={(open) => { setSectionOpen('widget-props', open); }}
          onChange={(property, value) => {
            setComponentNodeProperty(props.project, currentPathRef.current, property, value);
          }}
        />
      ) : null}

      {/* Question section (was Basics) */}
      <QuestionSection
        testIdPrefix="field"
        open={isSectionOpen('question')}
        tier={props.tier}
        keyValue={props.item.key}
        label={props.item.label}
        description={props.item.description}
        hint={props.item.hint}
        placeholder={typeof itemPresentation.placeholder === 'string' ? itemPresentation.placeholder : undefined}
        prefix={typeof (props.item as Record<string, unknown>).prefix === 'string' ? (props.item as Record<string, unknown>).prefix as string : undefined}
        suffix={typeof (props.item as Record<string, unknown>).suffix === 'string' ? (props.item as Record<string, unknown>).suffix as string : undefined}
        defaultValue={typeof bind?.default === 'string' ? bind.default : undefined}
        optionSet={typeof (props.item as Record<string, unknown>).optionSet === 'string' ? (props.item as Record<string, unknown>).optionSet as string : undefined}
        availableOptionSets={Object.keys((props.project.value.definition.optionSets as Record<string, unknown> | undefined) ?? {})}
        showPlaceholder={props.item.dataType === 'string' || props.item.dataType === 'text' || props.item.dataType === 'decimal' || props.item.dataType === 'integer'}
        showPrefixSuffix
        showOptionSet={props.item.dataType === 'choice' || props.item.dataType === 'multiChoice'}
        canPromoteToOptionSet={Array.isArray(props.item.options) && props.item.options.length > 0}
        onToggle={(open) => setSectionOpen('question', open)}
        onKeyCommit={(value) => {
          if (!value.trim().length || value === props.item.key) return;
          setAutoKey(false);
          const newPath = renameItem(props.project, currentPathRef.current, value);
          currentPathRef.current = newPath;
        }}
        onLabelInput={(value) => {
          setItemText(props.project, currentPathRef.current, 'label', value);
          if (autoKey) {
            const derived = labelToKey(value);
            if (derived && derived !== props.item.key) {
              const newPath = renameItem(props.project, currentPathRef.current, derived);
              currentPathRef.current = newPath;
            }
          }
        }}
        onDescriptionInput={(value) => {
          setItemText(props.project, currentPathRef.current, 'description', value);
        }}
        onHintInput={(value) => {
          setItemText(props.project, currentPathRef.current, 'hint', value);
        }}
        onPlaceholderInput={(value) => {
          updateDefinitionPresentation('placeholder', value);
        }}
        onPrefixInput={(value) => {
          setItemProperty(props.project, currentPathRef.current, 'prefix', value);
        }}
        onSuffixInput={(value) => {
          setItemProperty(props.project, currentPathRef.current, 'suffix', value);
        }}
        onDefaultValueInput={(value) => {
          setBind(props.project, currentPathRef.current, 'default', value);
        }}
        onOptionSetChange={(value) => {
          setItemProperty(props.project, currentPathRef.current, 'optionSet', value || undefined);
        }}
        onPromoteToOptionSet={() => {
          promoteOptionsToOptionSet(props.project, currentPathRef.current, props.item.key);
        }}
      />

      {/* Rules (merged Logic + Validation) */}
      <RulesSection
        testIdPrefix="field"
        open={isSectionOpen('rules')}
        tier={props.tier}
        requiredBoolean={requiredIsBoolean}
        requiredExpression={requiredExpression}
        relevant={bind?.relevant}
        dataType={props.item.dataType}
        constraint={bind?.constraint}
        constraintMessage={bind?.constraintMessage}
        calculate={bind?.calculate}
        readonly={typeof bind?.readonly === 'string' ? bind.readonly : undefined}
        fields={logicCatalog.fields}
        groups={logicCatalog.groups}
        customConstraints={extensionCatalog.constraints}
        onToggle={(open) => setSectionOpen('rules', open)}
        onRequiredToggle={(value) => {
          setBind(props.project, currentPathRef.current, 'required', value ? 'true' : undefined);
        }}
        onRelevantInput={(value) => {
          setBind(props.project, currentPathRef.current, 'relevant', value);
        }}
        onRequiredWhenInput={(value) => {
          setBind(props.project, currentPathRef.current, 'required', value);
        }}
        onConstraintInput={(value) => {
          setBind(props.project, currentPathRef.current, 'constraint', value);
        }}
        onConstraintMessageInput={(value) => {
          setBind(props.project, currentPathRef.current, 'constraintMessage', value);
        }}
        onCalculateInput={(value) => {
          setBind(props.project, currentPathRef.current, 'calculate', value);
        }}
        onReadonlyInput={(value) => {
          setBind(props.project, currentPathRef.current, 'readonly', value);
        }}
      />

      {/* Layout & Style (merged Appearance + Presentation) */}
      <LayoutStyleSection
        testIdPrefix="field"
        open={isSectionOpen('layout-style')}
        tier={props.tier}
        labelPosition={typeof themePresentation.labelPosition === 'string' ? themePresentation.labelPosition : undefined}
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
        felFieldOptions={logicCatalog.fields.map((f) => ({ path: f.path, label: f.label }))}
        disabledDisplay={bind?.disabledDisplay}
        onToggle={(open) => setSectionOpen('layout-style', open)}
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
          setComponentNodeProperty(props.project, currentPathRef.current, 'when', value || undefined);
        }}
        onPresentationChange={(key, value) => {
          setDefinitionPresentationKey(props.project, currentPathRef.current, key, value);
        }}
        onBreakpointChange={(value) => {
          setActiveBreakpoint(props.project, value);
        }}
        onResponsiveOverrideChange={(value) => {
          setComponentResponsiveOverride(
            props.project,
            currentPathRef.current,
            props.project.value.uiState.activeBreakpoint,
            value
          );
        }}
        onDisabledDisplayChange={(value) => {
          setBind(props.project, currentPathRef.current, 'disabledDisplay', value || undefined);
        }}
      />

      {/* Data Handling — advanced only */}
      {meetsMinTier(props.tier, 'advanced') ? (
        <DataHandlingSection
          testIdPrefix="field"
          open={isSectionOpen('data-handling')}
          initialValue={typeof (props.item as Record<string, unknown>).initialValue === 'string' ? (props.item as Record<string, unknown>).initialValue as string : undefined}
          whitespace={bind?.whitespace}
          excludedValue={bind?.excludedValue}
          nonRelevantBehavior={bind?.nonRelevantBehavior}
          precision={typeof (props.item as Record<string, unknown>).precision === 'number' ? (props.item as Record<string, unknown>).precision as number : undefined}
          remoteOptions={bind?.remoteOptions}
          semanticType={typeof (props.item as Record<string, unknown>).semanticType === 'string' ? (props.item as Record<string, unknown>).semanticType as string : undefined}
          currency={typeof (props.item as Record<string, unknown>).currency === 'string' ? (props.item as Record<string, unknown>).currency as string : undefined}
          labels={((props.item as Record<string, unknown>).labels as Record<string, string> | undefined) ? {
            short: ((props.item as Record<string, unknown>).labels as Record<string, string>).short,
            pdf: ((props.item as Record<string, unknown>).labels as Record<string, string>).pdf,
            csv: ((props.item as Record<string, unknown>).labels as Record<string, string>).csv,
            accessibility: ((props.item as Record<string, unknown>).labels as Record<string, string>).accessibility
          } : undefined}
          prePopulate={(props.item as Record<string, unknown>).prePopulate as PrePopulateValue | undefined}
          onToggle={(open) => setSectionOpen('data-handling', open)}
          onInitialValueInput={(value) => {
            setItemProperty(props.project, currentPathRef.current, 'initialValue', value);
          }}
          onWhitespaceChange={(value) => {
            setBind(props.project, currentPathRef.current, 'whitespace', value || undefined);
          }}
          onExcludedValueChange={(value) => {
            setBind(props.project, currentPathRef.current, 'excludedValue', value || undefined);
          }}
          onNonRelevantBehaviorChange={(value) => {
            setBind(props.project, currentPathRef.current, 'nonRelevantBehavior', value || undefined);
          }}
          onPrecisionInput={(value) => {
            setItemProperty(props.project, currentPathRef.current, 'precision', value);
          }}
          onRemoteOptionsInput={(value) => {
            setBind(props.project, currentPathRef.current, 'remoteOptions', value);
          }}
          onSemanticTypeInput={(value) => {
            setItemProperty(props.project, currentPathRef.current, 'semanticType', value);
          }}
          onCurrencyInput={(value) => {
            setItemProperty(props.project, currentPathRef.current, 'currency', value || undefined);
          }}
          onLabelsInput={(key, value) => {
            setItemLabel(props.project, currentPathRef.current, key, value);
          }}
          onPrePopulateChange={(value) => {
            setItemProperty(props.project, currentPathRef.current, 'prePopulate', value ?? undefined);
          }}
        />
      ) : null}

      {/* Follow-up questions (was Sub-questions) */}
      <FollowUpQuestionsSection
        path={currentPathRef.current}
        item={props.item}
        open={isSectionOpen('sub-questions')}
        onToggle={(open) => setSectionOpen('sub-questions', open)}
        onAddSubQuestion={() => {
          const childPath = addItem(props.project, {
            type: 'field',
            dataType: 'string',
            parentPath: currentPathRef.current,
            index: (props.item.children?.length ?? 0),
            label: 'Sub-question'
          });
          setSelection(props.project, childPath);
        }}
        onSelectChild={(childPath) => {
          setSelection(props.project, childPath);
        }}
      />

      {/* Save as template */}
      <div class="inspector-field-template-save" data-testid="save-field-template-section">
        {!saveTemplateMode ? (
          <button
            type="button"
            class="inspector-action-link"
            data-testid="save-field-template-open"
            onClick={() => {
              setSaveTemplateName(props.item.label ?? '');
              setSaveTemplateMode(true);
              setSaveTemplateNotice(null);
            }}
          >
            Save as template...
          </button>
        ) : (
          <div class="inspector-field-template-save__form">
            <label class="inspector-control">
              <span class="inspector-control__label">Template name</span>
              <input
                class="inspector-input"
                type="text"
                data-testid="save-field-template-name"
                value={saveTemplateName}
                placeholder="e.g. US Phone Number"
                onInput={(event) => {
                  setSaveTemplateName((event.currentTarget as HTMLInputElement).value);
                }}
              />
            </label>
            <div class="inspector-field-template-save__actions">
              <button
                type="button"
                class="inspector-btn inspector-btn--primary"
                data-testid="save-field-template-confirm"
                onClick={() => {
                  const name = saveTemplateName.trim();
                  if (!name) return;
                  const { key: _key, ...itemSeed } = props.item as FormspecItem;
                  const bindSeed: Partial<Omit<FormspecBind, 'path'>> | undefined = bind
                    ? (({ path: _path, ...rest }) => rest)(bind)
                    : undefined;
                  saveUserFieldTemplate({
                    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                    name,
                    savedAt: new Date().toISOString(),
                    itemSeed,
                    bindSeed: bindSeed && Object.keys(bindSeed).length > 0 ? bindSeed : undefined
                  });
                  setSaveTemplateMode(false);
                  setSaveTemplateNotice(`Saved "${name}".`);
                  setTimeout(() => setSaveTemplateNotice(null), 3000);
                }}
              >
                Save
              </button>
              <button
                type="button"
                class="inspector-btn"
                data-testid="save-field-template-cancel"
                onClick={() => { setSaveTemplateMode(false); }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {saveTemplateNotice ? (
          <p class="inspector-field-template-save__notice" data-testid="save-field-template-notice">
            {saveTemplateNotice}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function isStaticRequired(value: unknown): boolean {
  if (value === true) {
    return true;
  }
  if (typeof value !== 'string') {
    return false;
  }
  return value.trim().toLowerCase() === 'true';
}

// ── Follow-up questions (renamed from Sub-questions) ──

interface FollowUpQuestionsSectionProps {
  path: string;
  item: FormspecItem;
  open: boolean;
  onToggle: (open: boolean) => void;
  onAddSubQuestion: () => void;
  onSelectChild: (childPath: string) => void;
}

function FollowUpQuestionsSection(props: FollowUpQuestionsSectionProps) {
  const children = Array.isArray(props.item.children) ? props.item.children : [];
  const summary = children.length > 0 ? `${children.length} follow-up${children.length === 1 ? '' : 's'}` : null;

  return (
    <section class="inspector-section" data-testid="sub-questions-section">
      <button
        type="button"
        class="inspector-section__header"
        aria-expanded={props.open}
        onClick={() => props.onToggle(!props.open)}
      >
        <span>{props.open ? '▾' : '▸'} Follow-up questions</span>
        {!props.open && summary ? <span class="inspector-section__summary">{summary}</span> : null}
      </button>
      <div
        class={`inspector-section__content${props.open ? '' : ' inspector-section__content--collapsed'}`}
        aria-hidden={!props.open}
      >
        {children.length > 0 ? (
          <ul class="inspector-sub-questions-list">
            {children.map((child) => {
              const childPath = `${props.path}.${child.key}`;
              return (
                <li key={child.key}>
                  <button
                    type="button"
                    class="inspector-sub-questions-list__item"
                    data-testid={`sub-question-nav-${child.key}`}
                    onClick={() => props.onSelectChild(childPath)}
                  >
                    <span class="inspector-sub-questions-list__label">{child.label || child.key}</span>
                    <span class="inspector-sub-questions-list__type">{child.type}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p class="inspector-hint">No follow-ups yet. Add questions that appear nested under this one.</p>
        )}
        <button
          type="button"
          class="inspector-action-link"
          data-testid="add-sub-question"
          onClick={props.onAddSubQuestion}
        >
          + Add follow-up question
        </button>
      </div>
    </section>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function labelToKey(label: string): string {
  const words = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return '';
  return words[0] + words.slice(1).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('');
}
