/** @filedesc Editor-tab properties panel showing only Tier 1 (definition) properties — no appearance, widget, or layout. */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { bindsFor, shapesFor, buildDefLookup, isLayoutId, dataTypeInfo, propertyHelp, getPresentationCascade, getStudioIntelligence } from '@formspec-org/studio-core';
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
import { recordManualPatchAndProvenance } from '../../shared/studio-intelligence-writer';

export function EditorPropertiesPanel({ showActions = true }: { showActions?: boolean }) {
  const {
    selectedKeys,
    selectionCount,
    primaryKeyForTab,
    primaryTypeForTab,
    select,
    deselect,
    shouldFocusInspector,
    consumeFocusInspector,
  } = useSelection();
  const selectedKey = primaryKeyForTab('editor');
  const selectedType = primaryTypeForTab('editor');
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
  const intelligence = useMemo(() => getStudioIntelligence({ definition }), [definition]);

  const handleRename = useCallback((originalPath: string, inputEl: HTMLInputElement) => {
    const nextKey = inputEl.value;
    const currentKey = originalPath.split('.').pop();
    if (nextKey && nextKey !== currentKey) {
      project.renameItem(originalPath, nextKey);
      const parentPath = originalPath.split('.').slice(0, -1).join('.');
      const nextPath = parentPath ? `${parentPath}.${nextKey}` : nextKey;
      recordManualPatchAndProvenance(project, {
        summary: `Renamed ${currentKey ?? originalPath} to ${nextKey}.`,
        affectedRefs: [originalPath, nextPath],
        capability: 'field_group_crud',
      });
      select(nextPath, selectedType ?? 'field', { tab: 'editor' });
    }
  }, [project, select, selectedType]);

  const handleDelete = useCallback((path: string) => {
    project.removeItem(path);
    recordManualPatchAndProvenance(project, {
      summary: `Deleted ${path}.`,
      affectedRefs: [path],
      reviewStatus: 'confirmed',
      capability: 'field_group_crud',
    });
  }, [project]);

  const handleDuplicate = useCallback((path: string) => {
    project.copyItem(path);
    recordManualPatchAndProvenance(project, {
      summary: `Duplicated ${path}.`,
      affectedRefs: [path],
      capability: 'field_group_crud',
    });
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
  const isChoice = dataType === 'choice' || dataType === 'multiChoice';
  const isDecimalLike = dataType === 'decimal' || dataType === 'money';
  const isMoney = dataType === 'money';

  const existingBehaviorTypes = [
    ...Object.keys(binds).filter(k => binds[k] !== null && binds[k] !== undefined),
    ...(item.prePopulate ? ['pre-populate'] : []),
  ];
  const provenance = intelligence.provenance.find((entry) => entry.objectRef === path);
  const openPatchCount = intelligence.patches.filter(
    (patch) => patch.status === 'open' && patch.affectedRefs.includes(path),
  ).length;

  return (
    <div className="h-full flex flex-col glass overflow-hidden shadow-premium">
      <div className="border-b border-border/40 bg-surface/40 px-6 py-6 shrink-0 backdrop-blur-md">
        <div className="flex items-center gap-3 mb-2">
          {info && (
            <div className={`flex h-10 w-10 items-center justify-center rounded-[14px] bg-bg-default shadow-sm font-mono font-bold text-[12px] ${info.color}`}>
              {info.icon}
            </div>
          )}
          <h2 className="text-[20px] font-bold text-ink tracking-tight font-display">Properties</h2>
        </div>
        <div className="text-[14px] font-medium text-ink/80 truncate">
          {(item.label as string) || currentKey}
        </div>
        <div data-testid="properties-selection-path" className="mt-2 font-mono text-[10px] font-semibold tracking-[0.12em] uppercase text-accent/80">
          {selectionPath}
        </div>
        <p className="mt-3 max-w-[28rem] text-[12px] leading-relaxed text-muted italic">
          Deep configuration and advanced behavioral logic for this {isGroup ? 'group' : 'field'}.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8 md:px-7">
        <Section title="Identity">
          <div className="mb-4 space-y-2">
            <label className="block text-[11px] font-bold uppercase tracking-[0.1em] text-muted">
              <HelpTip text={propertyHelp.key}>Key</HelpTip>
            </label>
            <input
              key={path}
              ref={keyInputRef}
              type="text"
              aria-label="Key"
              className="w-full h-10 px-3 text-[14px] font-mono border border-border/60 rounded-[10px] bg-surface/50 outline-none transition-all focus:border-accent focus:ring-4 focus:ring-accent/15 shadow-sm"
              defaultValue={currentKey}
            />
          </div>
          <div className="mb-4 space-y-2">
            <label className="block text-[11px] font-bold uppercase tracking-[0.1em] text-muted">
              <HelpTip text={propertyHelp.label}>Label</HelpTip>
            </label>
            <input
              key={`${path}-label`}
              type="text"
              aria-label="Label"
              className="w-full h-10 px-3 text-[14px] border border-border/60 rounded-[10px] bg-surface/50 outline-none transition-all focus:border-accent focus:ring-4 focus:ring-accent/15 shadow-sm"
              defaultValue={(item.label as string) || ''}

              onBlur={(event) => {
                project.updateItem(path, { label: event.currentTarget.value || null });
                recordManualPatchAndProvenance(project, {
                  summary: `Updated label for ${path}.`,
                  affectedRefs: [path],
                  capability: 'field_group_crud',
                });
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

        <Section title="Provenance">
          <PropertyRow label="Origin">{provenance?.origin ?? 'manual'}</PropertyRow>
          <PropertyRow label="Confidence">{provenance?.confidence ?? 'medium'}</PropertyRow>
          <PropertyRow label="Review">{provenance?.reviewStatus ?? 'unreviewed'}</PropertyRow>
          <PropertyRow label="Sources">{String(provenance?.sourceRefs.length ?? 0)}</PropertyRow>
          <PropertyRow label="Open patches">{String(openPatchCount)}</PropertyRow>
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
        <div className="shrink-0 border-t border-border/40 bg-surface/60 p-6 pb-8 backdrop-blur-md">
          <div className="flex gap-3">
          <button
            type="button"
            className="flex-1 rounded-[14px] border border-border/80 bg-surface px-4 py-3 text-[12px] font-bold uppercase tracking-[0.15em] text-ink transition-all cursor-pointer hover:bg-subtle/80 hover:border-muted/30 hover:scale-[1.02] active:scale-[0.98] focus-ring shadow-sm"
            onClick={() => handleDuplicate(path)}
          >
            Duplicate
          </button>
          <button
            type="button"
            className="rounded-[14px] border border-border/80 bg-surface px-4 py-3 text-[12px] font-bold uppercase tracking-[0.15em] text-muted transition-all cursor-pointer hover:border-error/40 hover:bg-error/[0.03] hover:text-error hover:scale-[1.02] active:scale-[0.98] focus-ring shadow-sm"
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
