import type { Signal } from '@preact/signals';
import type { FormspecItem } from 'formspec-engine';
import { collectLogicCatalog } from '../logic/catalog';
import {
  type GroupDataTableColumn,
  type GroupDataTablePatch,
  setActiveBreakpoint,
  setComponentNodeProperty,
  setDefinitionPresentationKey,
  setGroupDataTableConfig,
  setGroupDisplayMode,
  setGroupRepeatable,
  renameItem,
  setBind,
  setComponentResponsiveOverride,
  setInspectorSectionOpen,
  setItemProperty,
  setItemText,
  setPresentation
} from '../../state/mutations';
import type { ProjectState } from '../../state/project';
import { AppearanceSection, type AccessibilityOverride } from './sections/AppearanceSection';
import { BasicsSection } from './sections/BasicsSection';
import { Collapsible } from '../controls/Collapsible';
import { Dropdown } from '../controls/Dropdown';
import { NumberInput } from '../controls/NumberInput';
import { TextInput } from '../controls/TextInput';
import { Toggle } from '../controls/Toggle';
import { LogicSection } from './sections/LogicSection';
import { type PresentationHints, PresentationSection } from './sections/PresentationSection';
import { RepeatSection } from './sections/RepeatSection';
import { type GeneratedComponentNode } from '../../state/wiring';
import {
  findBindByPath,
  getComponentNodeByPath,
  getComponentResponsiveOverride,
  getThemeItemPresentation
} from './utils';

import type { InspectorTier } from './Inspector';

interface GroupInspectorProps {
  project: Signal<ProjectState>;
  path: string;
  item: FormspecItem;
  tier?: InspectorTier;
}

export function GroupInspector(props: GroupInspectorProps) {
  const bind = findBindByPath(props.project.value.definition.binds, props.path);
  const logicCatalog = collectLogicCatalog(props.project.value.definition.items);
  const themePresentation = getThemeItemPresentation(props.project.value.theme, props.path);
  const componentNode = getComponentNodeByPath(
    props.project.value.definition.items,
    props.project.value.component,
    props.path
  );
  const activeBreakpoint = props.project.value.uiState.activeBreakpoint;
  const responsiveOverride = getComponentResponsiveOverride(
    props.project.value.definition.items,
    props.project.value.component,
    props.path,
    activeBreakpoint
  );
  const childFields = (props.item.children ?? [])
    .filter((child) => child.type === 'field')
    .map((child) => ({
      key: child.key,
      label: child.label ?? child.key
    }));
  const displayMode = componentNode?.component === 'DataTable' ? 'table' : 'stack';
  const tableColumns = resolveTableColumns(componentNode?.columns, childFields);
  const sortBy = typeof componentNode?.sortBy === 'string' ? componentNode.sortBy : undefined;
  const sortDirection = componentNode?.sortDirection === 'desc' ? 'desc' : 'asc';
  const onTableConfigChange = (patch: GroupDataTablePatch) => {
    setGroupDataTableConfig(props.project, props.path, patch);
  };

  const setSectionOpen = (sectionId: string, open: boolean) => {
    setInspectorSectionOpen(props.project, `group:${props.path}:${sectionId}`, open);
  };
  const GROUP_SECTION_DEFAULTS: Record<string, boolean> = { basics: true };
  const isSectionOpen = (sectionId: string) =>
    props.project.value.uiState.inspectorSections[`group:${props.path}:${sectionId}`] ?? GROUP_SECTION_DEFAULTS[sectionId] ?? false;

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
    <div class="inspector-content" data-testid="group-inspector">
      <BasicsSection
        testIdPrefix="group"
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

      <RepeatSection
        testIdPrefix="group"
        open={isSectionOpen('repeat')}
        repeatable={Boolean(props.item.repeatable)}
        minRepeat={typeof props.item.minRepeat === 'number' ? props.item.minRepeat : undefined}
        maxRepeat={typeof props.item.maxRepeat === 'number' ? props.item.maxRepeat : undefined}
        onToggle={(open) => {
          setSectionOpen('repeat', open);
        }}
        onRepeatableToggle={(value) => {
          setGroupRepeatable(props.project, props.path, value);
          if (!value) {
            setGroupDisplayMode(props.project, props.path, 'stack');
          }
        }}
        onMinRepeatInput={(value) => {
          setItemProperty(props.project, props.path, 'minRepeat', value);
        }}
        onMaxRepeatInput={(value) => {
          setItemProperty(props.project, props.path, 'maxRepeat', value);
        }}
        displayMode={displayMode}
        childFields={childFields}
        tableColumns={tableColumns}
        showRowNumbers={componentNode?.showRowNumbers === true}
        allowAddRows={componentNode?.allowAdd === true}
        allowRemoveRows={componentNode?.allowRemove === true}
        sortable={componentNode?.sortable === true}
        filterable={componentNode?.filterable === true}
        sortBy={sortBy}
        sortDirection={sortDirection}
        onDisplayModeChange={(mode) => {
          setGroupDisplayMode(props.project, props.path, mode);
        }}
        onTableColumnsChange={(columns) => {
          onTableConfigChange({ columns });
        }}
        onShowRowNumbersToggle={(value) => {
          onTableConfigChange({ showRowNumbers: value });
        }}
        onAllowAddRowsToggle={(value) => {
          onTableConfigChange({ allowAdd: value });
        }}
        onAllowRemoveRowsToggle={(value) => {
          onTableConfigChange({ allowRemove: value });
        }}
        onSortableToggle={(value) => {
          onTableConfigChange({ sortable: value });
        }}
        onFilterableToggle={(value) => {
          onTableConfigChange({ filterable: value });
        }}
        onSortByChange={(value) => {
          onTableConfigChange({ sortBy: value });
        }}
        onSortDirectionChange={(value) => {
          onTableConfigChange({ sortDirection: value });
        }}
      />

      <LogicSection
        testIdPrefix="group"
        open={isSectionOpen('logic')}
        fields={logicCatalog.fields}
        groups={logicCatalog.groups}
        relevant={bind?.relevant}
        readonly={typeof bind?.readonly === 'string' ? bind.readonly : undefined}
        showRequired={false}
        showCalculate={false}
        onToggle={(open) => {
          setSectionOpen('logic', open);
        }}
        onRelevantInput={(value) => {
          setBind(props.project, props.path, 'relevant', value);
        }}
        onReadonlyInput={(value) => {
          setBind(props.project, props.path, 'readonly', value);
        }}
      />

      <PresentationSection
        testIdPrefix="group"
        open={isSectionOpen('presentation')}
        isGroup
        hints={(props.item.presentation as PresentationHints | undefined) ?? {}}
        onToggle={(open) => { setSectionOpen('presentation', open); }}
        onChange={(key, value) => {
          setDefinitionPresentationKey(props.project, props.path, key, value);
        }}
      />

      {renderLayoutSection(
        componentNode?.component,
        componentNode,
        isSectionOpen('layout-props'),
        (open) => setSectionOpen('layout-props', open),
        (prop, value) => setComponentNodeProperty(props.project, props.path, prop, value)
      )}

      <AppearanceSection
        testIdPrefix="group"
        open={isSectionOpen('appearance')}
        widget={typeof themePresentation.widget === 'string' ? themePresentation.widget : undefined}
        cssClass={typeof themePresentation.cssClass === 'string' ? themePresentation.cssClass : undefined}
        componentWhen={componentNode?.when}
        accessibility={isGroupRecord(themePresentation.accessibility) ? themePresentation.accessibility as AccessibilityOverride : undefined}
        style={isGroupRecord(themePresentation.style) ? themePresentation.style as Record<string, string | number> : undefined}
        widgetConfig={isGroupRecord(themePresentation.widgetConfig) ? themePresentation.widgetConfig as Record<string, string | number> : undefined}
        fallback={Array.isArray(themePresentation.fallback) ? themePresentation.fallback as string[] : undefined}
        felFieldOptions={logicCatalog.fields.map((f) => ({ path: f.path, label: f.label }))}
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

const LAYOUT_COMPONENT_TYPES = new Set(['Page', 'Grid', 'Columns', 'Tabs', 'Accordion']);

function renderLayoutSection(
  component: string | undefined,
  node: GeneratedComponentNode | null,
  open: boolean,
  onToggle: (open: boolean) => void,
  onChange: (prop: string, value: unknown) => void
) {
  if (!component || !LAYOUT_COMPONENT_TYPES.has(component)) {
    return null;
  }

  return (
    <Collapsible id="layout-props" title={`${component} Properties`} open={open} onToggle={onToggle}>
      {component === 'Grid' ? (
        <>
          <NumberInput
            label="Columns"
            value={typeof node?.gridColumns === 'number' ? node.gridColumns : undefined}
            testId="layout-grid-columns"
            onInput={(value) => { onChange('gridColumns', value ?? undefined); }}
          />
          <TextInput
            label="Gap"
            value={node?.gap}
            testId="layout-grid-gap"
            placeholder="e.g. 1rem, 16px"
            onInput={(value) => { onChange('gap', value || undefined); }}
          />
          <TextInput
            label="Row gap"
            value={node?.rowGap}
            testId="layout-grid-rowgap"
            placeholder="e.g. 0.5rem"
            onInput={(value) => { onChange('rowGap', value || undefined); }}
          />
        </>
      ) : null}

      {component === 'Columns' ? (
        <>
          <TextInput
            label="Column widths"
            value={node?.widths}
            testId="layout-columns-widths"
            placeholder="e.g. 1fr 2fr 1fr"
            onInput={(value) => { onChange('widths', value || undefined); }}
          />
          <TextInput
            label="Gap"
            value={node?.gap}
            testId="layout-columns-gap"
            placeholder="e.g. 1rem, 16px"
            onInput={(value) => { onChange('gap', value || undefined); }}
          />
        </>
      ) : null}

      {component === 'Tabs' ? (
        <>
          <Dropdown
            label="Tab bar position"
            value={node?.position ?? ''}
            testId="layout-tabs-position"
            options={[
              { value: '', label: 'Default (top)' },
              { value: 'top', label: 'Top' },
              { value: 'bottom', label: 'Bottom' },
              { value: 'left', label: 'Left' },
              { value: 'right', label: 'Right' }
            ]}
            onChange={(value) => { onChange('position', value || undefined); }}
          />
          <TextInput
            label="Tab labels (comma-separated)"
            value={node?.tabLabels}
            testId="layout-tabs-labels"
            placeholder="e.g. Step 1, Step 2, Step 3"
            onInput={(value) => { onChange('tabLabels', value || undefined); }}
          />
          <TextInput
            label="Default tab key"
            value={node?.defaultTab}
            testId="layout-tabs-default"
            placeholder="e.g. step1"
            onInput={(value) => { onChange('defaultTab', value || undefined); }}
          />
        </>
      ) : null}

      {component === 'Accordion' ? (
        <>
          <Toggle
            label="Allow multiple open"
            checked={node?.allowMultiple === true}
            testId="layout-accordion-multiple"
            onToggle={(value) => { onChange('allowMultiple', value || undefined); }}
          />
          <TextInput
            label="Panel labels (comma-separated)"
            value={node?.labels}
            testId="layout-accordion-labels"
            placeholder="e.g. Section A, Section B"
            onInput={(value) => { onChange('labels', value || undefined); }}
          />
        </>
      ) : null}
    </Collapsible>
  );
}

function isGroupRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function resolveTableColumns(
  rawColumns: unknown,
  childFields: Array<{ key: string; label: string }>
): GroupDataTableColumn[] {
  const fieldIndex = new Map(childFields.map((field) => [field.key, field]));
  if (!Array.isArray(rawColumns)) {
    return childFields.map((field) => ({
      bind: field.key,
      header: field.label
    }));
  }

  const seen = new Set<string>();
  const columns: GroupDataTableColumn[] = [];
  for (const entry of rawColumns) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }

    const column = entry as Partial<GroupDataTableColumn>;
    if (typeof column.bind !== 'string') {
      continue;
    }

    const field = fieldIndex.get(column.bind);
    if (!field || seen.has(field.key)) {
      continue;
    }
    seen.add(field.key);
    columns.push({
      bind: field.key,
      header: typeof column.header === 'string' && column.header.trim().length > 0 ? column.header : field.label
    });
  }

  return columns;
}
