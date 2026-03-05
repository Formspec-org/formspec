import type { Signal } from '@preact/signals';
import type { FormspecItem } from 'formspec-engine';
import { collectLogicCatalog } from '../logic/catalog';
import {
  type GroupDataTableColumn,
  type GroupDataTablePatch,
  setActiveBreakpoint,
  setGroupDataTableConfig,
  setGroupDisplayMode,
  renameItem,
  setBind,
  setComponentResponsiveOverride,
  setInspectorSectionOpen,
  setItemProperty,
  setItemText,
  setPresentation
} from '../../state/mutations';
import type { ProjectState } from '../../state/project';
import { AppearanceSection } from './sections/AppearanceSection';
import { BasicsSection } from './sections/BasicsSection';
import { LogicSection } from './sections/LogicSection';
import { RepeatSection } from './sections/RepeatSection';
import {
  findBindByPath,
  getComponentNodeByPath,
  getComponentResponsiveOverride,
  getThemeItemPresentation
} from './utils';

export interface GroupInspectorProps {
  project: Signal<ProjectState>;
  path: string;
  item: FormspecItem;
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
    setInspectorSectionOpen(props.project, `group:${sectionId}`, open);
  };
  const GROUP_SECTION_DEFAULTS: Record<string, boolean> = { basics: true };
  const isSectionOpen = (sectionId: string) =>
    props.project.value.uiState.inspectorSections[`group:${sectionId}`] ?? GROUP_SECTION_DEFAULTS[sectionId] ?? false;

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
      <p class="inspector-content__title">Group Inspector</p>
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
          setItemProperty(props.project, props.path, 'repeatable', value);
          if (!value) {
            setItemProperty(props.project, props.path, 'minRepeat', undefined);
            setItemProperty(props.project, props.path, 'maxRepeat', undefined);
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

      <AppearanceSection
        testIdPrefix="group"
        open={isSectionOpen('appearance')}
        widget={typeof themePresentation.widget === 'string' ? themePresentation.widget : undefined}
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
          updateThemePresentation('widget', value);
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
    </div>
  );
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
