/** @filedesc Editor-tab properties panel showing only Tier 1 (definition) properties — no appearance, widget, or layout. */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { bindsFor, shapesFor, buildDefLookup, isLayoutId } from '../../../lib/field-helpers';
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
import { Section } from '../../../components/ui/Section';
import { PropertyRow } from '../../../components/ui/PropertyRow';
import { HelpTip } from '../../../components/ui/HelpTip';
import { dataTypeInfo, propertyHelp } from '../../../lib/field-helpers';
import type { FormItem } from '@formspec-org/types';

export function EditorPropertiesPanel({ showActions = true }: { showActions?: boolean }) {
  const {
    selectedKey,
    selectedType,
    selectedKeys,
    selectionCount,
    select,
    deselect,
    shouldFocusInspector,
    consumeFocusInspector,
  } = useSelection();
  const definition = useDefinition();
  const project = useProject();
  const keyInputRef = useRef<HTMLInputElement>(null);

  const items = definition.items || [];
  const lookup = useMemo(() => buildDefLookup(items), [items]);
  const found = selectedKey ? lookup.get(selectedKey) : null;
  const itemPath = found?.path ?? '';

  const handleRename = useCallback((originalPath: string, inputEl: HTMLInputElement) => {
    const nextKey = inputEl.value;
    const currentKey = originalPath.split('.').pop();
    if (nextKey && nextKey !== currentKey) {
      project.renameItem(originalPath, nextKey);
      const parentPath = originalPath.split('.').slice(0, -1).join('.');
      const nextPath = parentPath ? `${parentPath}.${nextKey}` : nextKey;
      select(nextPath, selectedType ?? 'field');
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
        <div className="px-3.5 py-2.5 border-b border-border bg-surface shrink-0">
          <h2 className="text-[15px] font-bold text-ink tracking-tight font-ui">Layout Node</h2>
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
      <div className="px-3.5 py-2.5 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          {info && (
            <div className={`w-5.5 h-5.5 rounded-[3px] bg-subtle flex items-center justify-center font-mono font-bold text-[10px] ${info.color}`}>
              {info.icon}
            </div>
          )}
          <h2 className="text-[15px] font-bold text-ink tracking-tight font-ui">Properties</h2>
        </div>
        <div className="font-mono text-[12px] text-muted truncate">
          {(item.label as string) || currentKey}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3.5 py-2 space-y-1">
        <Section title="Identity">
          <div className="space-y-1.5 mb-2">
            <label className="font-mono text-[10px] text-muted uppercase tracking-wider block">
              <HelpTip text={propertyHelp.key}>Key</HelpTip>
            </label>
            <input
              key={path}
              ref={keyInputRef}
              type="text"
              aria-label="Key"
              className="w-full px-2 py-1 text-[13px] font-mono border border-border rounded-[4px] bg-surface outline-none focus:border-accent transition-colors"
              defaultValue={currentKey}
            />
          </div>
          <div className="space-y-1.5 mb-2">
            <label className="font-mono text-[10px] text-muted uppercase tracking-wider block">
              <HelpTip text={propertyHelp.label}>Label</HelpTip>
            </label>
            <input
              key={`${path}-label`}
              type="text"
              aria-label="Label"
              className="w-full px-2 py-1 text-[13px] border border-border rounded-[4px] bg-surface outline-none focus:border-accent transition-colors"
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

        <BindsInlineSection
          path={path}
          binds={binds}
          existingBehaviorTypes={existingBehaviorTypes}
          project={project}
        />
      </div>

      {showActions && (
        <div className="p-3 pb-6 sm:p-3.5 border-t-2 border-border bg-subtle/30 shrink-0 flex gap-2">
          <button
            type="button"
            className="flex-1 py-1.5 bg-surface border border-border rounded-[4px] font-mono text-[11px] font-bold uppercase tracking-widest hover:bg-surface-hover hover:border-muted/30 transition-all cursor-pointer shadow-sm active:translate-y-px"
            onClick={() => handleDuplicate(path)}
          >
            Duplicate
          </button>
          <button
            type="button"
            className="flex-1 py-1.5 bg-surface border border-error/20 rounded-[4px] font-mono text-[11px] font-bold uppercase tracking-widest text-error hover:bg-error/5 hover:border-error/40 transition-all cursor-pointer shadow-sm active:translate-y-px"
            onClick={() => handleDelete(path)}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
