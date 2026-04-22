/** @filedesc Editor-tab properties panel showing only Tier 1 (definition) properties — no appearance, widget, or layout. */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { bindsFor, shapesFor, buildDefLookup, isLayoutId, dataTypeInfo, propertyHelp, getPresentationCascade } from '@formspec-org/studio-core';
import { useDefinition } from '../../../state/useDefinition';
import { useProject } from '../../../state/useProject';
import { useSelection } from '../../../state/useSelection';
import { DefinitionProperties } from './DefinitionProperties';
import { MultiSelectSummary } from './MultiSelectSummary';
import { BindsInlineSection } from './BindsInlineSection';
import { FieldConfigSection } from './FieldConfigSection';
import { GroupConfigSection } from './GroupConfigSection';
import { OptionsSection } from './OptionsSection';
import { ContentSection } from './ContentSection';
import { WidgetConstraintSection } from './WidgetConstraintSection';
import { PresentationCascadeSection } from './PresentationCascadeSection';
import { Section } from '../../../components/ui/Section';
import { PropertyRow } from '../../../components/ui/PropertyRow';
import { HelpTip } from '../../../components/ui/HelpTip';
import type { FormItem } from '@formspec-org/types';

export function EditorPropertiesPanel({ showActions = true }: { showActions?: boolean }) {
  const {
    selectedKeys,
    selectionCount,
    selectedKeyForTab,
    selectedTypeForTab,
    select,
    deselect,
    shouldFocusInspector,
    consumeFocusInspector,
  } = useSelection();
  const selectedKey = selectedKeyForTab('editor');
  const selectedType = selectedTypeForTab('editor');
  const definition = useDefinition();
  const project = useProject();
  const keyInputRef = useRef<HTMLInputElement>(null);

  const items = definition.items || [];
  const lookup = useMemo(() => buildDefLookup(items), [items]);
  const found = selectedKey ? lookup.get(selectedKey) : null;
  const itemPath = found?.path ?? '';

  const presentationCascade = useMemo(
    () => itemPath ? getPresentationCascade(project, itemPath) : {},
    [project, itemPath],
  );

  const handleRename = useCallback((originalPath: string, inputEl: HTMLInputElement) => {
    const nextKey = inputEl.value;
    const currentKey = originalPath.split('.').pop();
    if (nextKey && nextKey !== currentKey) {
      project.renameItem(originalPath, nextKey);
      const parentPath = originalPath.split('.').slice(0, -1).join('.');
      const nextPath = parentPath ? `${parentPath}.${nextKey}` : nextKey;
      select(nextPath, selectedType ?? 'field', { tab: 'editor' });
    }
  }, [project, select, selectedType]);

  const handleDelete = useCallback((path: string) => {
    project.removeItem(path);
  }, [project]);

  const handleDuplicate = useCallback((path: string) => {
    project.copyItem(path);
  }, [project]);

  useEffect(() => {
    const input = keyInputRef.current;
    if (!input || !itemPath) return;

    const onBlur = () => handleRename(itemPath, input);
    input.addEventListener('blur', onBlur);
    return () => input.removeEventListener('blur', onBlur);
  }, [itemPath, handleRename]);

  useEffect(() => {
    const input = keyInputRef.current;
    if (!shouldFocusInspector || !input || !itemPath) return;
    input.focus();
    input.select();
    consumeFocusInspector();
  }, [shouldFocusInspector, itemPath, consumeFocusInspector]);

  // Multi-select
  if (selectionCount > 1) {
    return (
      <MultiSelectSummary
        selectionCount={selectionCount}
        selectedKeys={selectedKeys}
        project={project}
        deselect={deselect}
      />
    );
  }

  // No selection
  if (!selectedKey) {
    return <DefinitionProperties definition={definition} project={project} />;
  }

  // Layout node — editor tab can't edit these
  if (isLayoutId(selectedKey)) {
    return (
      <div className="h-full flex flex-col bg-surface overflow-hidden">
        <div className="border-b border-border/80 bg-surface px-5 py-4 shrink-0">
          <h2 className="text-[17px] font-semibold text-ink tracking-tight font-ui">Layout Node</h2>
        </div>
        <div className="flex-1 flex items-center justify-center px-4 text-center">
          <p className="text-[13px] text-muted font-ui">
            Edit this node in the Layout tab.
          </p>
        </div>
      </div>
    );
  }

  // Item not found
  if (!found) {
    return (
      <div className="p-4 text-[13px] text-muted font-ui">
        Item not found: {selectedKey}
      </div>
    );
  }

  const item = found.item;
  const path = found.path;
  const binds = bindsFor(definition.binds, path);
  const currentKey = path.split('.').pop() || path;
  const selectionPath = path.split('.').join(' / ');
  const isField = item.type === 'field';
  const isGroup = item.type === 'group';
  const dataType = item.dataType as string | undefined;
  const info = dataType ? dataTypeInfo(dataType) : null;
  const isChoice = dataType === 'choice' || dataType === 'multiChoice' || dataType === 'select1' || dataType === 'select';
  const isDecimalLike = dataType === 'decimal' || dataType === 'money';
  const isMoney = dataType === 'money';

  const existingBehaviorTypes = [
    ...Object.keys(binds).filter(k => binds[k] !== null && binds[k] !== undefined),
    ...(item.prePopulate ? ['pre-populate'] : []),
  ];

  return (
    <div className="h-full flex flex-col bg-surface overflow-hidden">
      <div className="border-b border-border/80 bg-surface px-5 py-4 shrink-0">
        <div className="flex items-center gap-2 mb-1">
          {info && (
            <div className={`flex h-8 w-8 items-center justify-center rounded-[10px] bg-bg-default font-mono font-bold text-[10px] ${info.color}`}>
              {info.icon}
            </div>
          )}
          <h2 className="text-[17px] font-semibold text-ink tracking-tight font-ui">Advanced Details</h2>
        </div>
        <div className="text-[13px] text-muted truncate">
          {(item.label as string) || currentKey}
        </div>
        <div data-testid="properties-selection-path" className="mt-2 font-mono text-[10px] tracking-[0.08em] text-muted/80">
          {selectionPath}
        </div>
        <p className="mt-2 max-w-[28rem] text-[12px] leading-5 text-muted">
          Use the rows for fast edits. This rail is for deeper configuration and advanced behavior.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1.5 md:px-5">
        <Section title="Identity">
          <div className="mb-3 space-y-2">
            <label className="block text-[12px] font-medium text-muted">
              <HelpTip text={propertyHelp.key}>Key</HelpTip>
            </label>
            <input
              key={path}
              ref={keyInputRef}
              type="text"
              aria-label="Key"
              className="w-full h-8 px-2.5 text-[13px] font-mono border border-border/80 rounded-[6px] bg-surface outline-none transition-shadow focus:border-accent focus:ring-2 focus:ring-accent/30 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
              defaultValue={currentKey}
            />
          </div>
          <div className="mb-3 space-y-2">
            <label className="block text-[12px] font-medium text-muted">
              <HelpTip text={propertyHelp.label}>Label</HelpTip>
            </label>
            <input
              key={`${path}-label`}
              type="text"
              aria-label="Label"
              className="w-full h-8 px-2.5 text-[13px] border border-border/80 rounded-[6px] bg-surface outline-none transition-shadow focus:border-accent focus:ring-2 focus:ring-accent/30 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
              defaultValue={(item.label as string) || ''}
              onBlur={(event) => {
                project.updateItem(path, { label: event.currentTarget.value || null });
              }}
            />
          </div>
          <PropertyRow label="Type" help={propertyHelp.type}>{selectedType || item.type}</PropertyRow>
          {info && (
            <PropertyRow label="DataType" color={info.color} help={propertyHelp.dataType}>
              <span className="mr-1">{info.icon}</span>
              {info.label}
            </PropertyRow>
          )}
        </Section>

        <ContentSection path={path} item={item} project={project} />

        {isField && (
          <FieldConfigSection
            path={path}
            item={item}
            project={project}
            binds={binds}
            existingBehaviorTypes={existingBehaviorTypes}
            isDecimalLike={isDecimalLike}
            isMoney={isMoney}
          />
        )}

        {isGroup && (
          <GroupConfigSection path={path} item={item} project={project} />
        )}

        {isField && isChoice && (
          <OptionsSection path={path} item={item} project={project} />
        )}

        {isField && (
          <WidgetConstraintSection
            path={path}
            project={project}
            widgetState={project.getWidgetConstraints(path)}
          />
        )}

        <PresentationCascadeSection cascade={presentationCascade} />

        <BindsInlineSection
          path={path}
          binds={binds}
          existingBehaviorTypes={existingBehaviorTypes}
          project={project}
        />
      </div>

      {showActions && (
        <div className="shrink-0 border-t border-border/80 bg-bg-default/65 p-4 pb-6 sm:p-4">
          <div className="flex gap-2">
          <button
            type="button"
            className="flex-1 rounded-[12px] border border-border/80 bg-surface px-3 py-2 text-[11px] font-mono font-semibold uppercase tracking-[0.18em] text-ink transition-all cursor-pointer hover:bg-surface-hover hover:border-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25"
            onClick={() => handleDuplicate(path)}
          >
            Duplicate
          </button>
          <button
            type="button"
            className="rounded-[12px] border border-border/70 bg-surface px-3 py-2 text-[11px] font-mono font-semibold uppercase tracking-[0.18em] text-muted transition-all cursor-pointer hover:border-error/35 hover:bg-error/5 hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/20"
            onClick={() => handleDelete(path)}
          >
            Delete
          </button>
          </div>
        </div>
      )}
    </div>
  );
}
