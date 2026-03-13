import { useCallback, useRef, useEffect, useState } from 'react';
import { useSelection } from '../../state/useSelection';
import { useDefinition } from '../../state/useDefinition';
import { useDispatch } from '../../state/useDispatch';
import { useProject } from '../../state/useProject';
import { flatItems, bindsFor, arrayBindsFor, dataTypeInfo, shapesFor, compatibleWidgets, propertyHelp } from '../../lib/field-helpers';
import { pruneDescendants, sortForBatchDelete } from '../../lib/selection-helpers';
import { Section } from '../../components/ui/Section';
import { PropertyRow } from '../../components/ui/PropertyRow';
import { BindCard } from '../../components/ui/BindCard';
import { ShapeCard } from '../../components/ui/ShapeCard';
import { HelpTip } from '../../components/ui/HelpTip';
import { humanizeFEL } from '../../lib/humanize';

/** Labeled text input for a property. */
function PropInput({
  path, property, label, value, dispatch, type = 'text', help, min,
}: {
  path: string; property: string; label: string; value: string | number;
  dispatch: (cmd: any) => any; type?: string; help?: string; min?: number;
}) {
  return (
    <div className="space-y-1.5 mb-2">
      <label className="font-mono text-[10px] text-muted uppercase tracking-wider block" htmlFor={`${path}-${property}`}>
        {help ? <HelpTip text={help}>{label}</HelpTip> : label}
      </label>
      <input
        id={`${path}-${property}`}
        key={`${path}-${property}`}
        type={type}
        min={min}
        aria-label={label}
        className="w-full px-2 py-1 text-[13px] font-mono border border-border rounded-[4px] bg-surface outline-none focus:border-accent transition-colors"
        defaultValue={value}
        onBlur={(e) => {
          let val: string | number | null = e.currentTarget.value;
          if (type === 'number') {
            const parsed = Number.parseInt(val, 10);
            val = Number.isNaN(parsed) ? null : parsed;
          }
          dispatch({
            type: 'definition.setItemProperty',
            payload: { path, property, value: val || null },
          });
        }}
      />
    </div>
  );
}

/** "+ Add ___" placeholder that reveals on click. Wraps in HelpTip when help is provided. */
function AddPlaceholder({ label, onAdd, help }: { label: string; onAdd: () => void; help?: string }) {
  const btn = (
    <button
      type="button"
      className="text-[11px] text-muted hover:text-accent font-mono cursor-pointer transition-colors"
      onClick={onAdd}
    >
      + Add {label}
    </button>
  );
  if (help) {
    return <HelpTip text={help}>{btn}</HelpTip>;
  }
  return btn;
}

/**
 * Displays and edits properties for the currently selected item.
 * When nothing is selected, shows definition-level properties.
 */
export function ItemProperties({ showActions = true }: { showActions?: boolean }) {
  const { selectedKey, selectedType, selectedKeys, selectionCount, select, deselect, shouldFocusInspector, consumeFocusInspector } = useSelection();
  const definition = useDefinition();
  const dispatch = useDispatch();
  const project = useProject();
  const keyInputRef = useRef<HTMLInputElement>(null);

  const handleRename = useCallback(
    (originalPath: string, inputEl: HTMLInputElement) => {
      const newKey = inputEl.value;
      const currentKey = originalPath.split('.').pop();
      if (newKey && newKey !== currentKey) {
        dispatch({
          type: 'definition.renameItem',
          payload: { path: originalPath, newKey },
        });
        const parentPath = originalPath.split('.').slice(0, -1).join('.');
        const nextPath = parentPath ? `${parentPath}.${newKey}` : newKey;
        select(nextPath, selectedType ?? 'field');
      }
    },
    [dispatch, select, selectedType],
  );

  const handleDelete = useCallback(
    (path: string) => {
      dispatch({ type: 'definition.deleteItem', payload: { path } });
    },
    [dispatch],
  );

  const handleDuplicate = useCallback(
    (path: string) => {
      dispatch({ type: 'definition.duplicateItem', payload: { path } });
    },
    [dispatch],
  );

  const items = definition.items || [];
  const flat = flatItems(items as any);
  const found = selectedKey ? flat.find((f) => f.path === selectedKey) : null;
  const itemPath = found?.path ?? '';

  useEffect(() => {
    const el = keyInputRef.current;
    if (!el || !itemPath) return;
    const onBlur = () => { handleRename(itemPath, el); };
    el.addEventListener('blur', onBlur);
    return () => el.removeEventListener('blur', onBlur);
  }, [itemPath, handleRename]);

  useEffect(() => {
    if (!shouldFocusInspector) return;
    const el = keyInputRef.current;
    if (!el || !itemPath) return;
    el.focus();
    el.select();
    consumeFocusInspector();
  }, [shouldFocusInspector, itemPath, consumeFocusInspector]);

  // --- Multi-select summary ---
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

  // --- Nothing selected: definition-level properties ---
  if (!selectedKey) {
    return <DefinitionProperties definition={definition} dispatch={dispatch} />;
  }

  if (!found) {
    return (
      <div className="p-4 text-[13px] text-muted font-ui">
        Item not found: {selectedKey}
      </div>
    );
  }

  const { item, path } = found;
  const rawBinds = definition.binds;
  const binds = Array.isArray(rawBinds)
    ? arrayBindsFor(rawBinds as any[], path)
    : bindsFor(rawBinds as any, path);
  const shapes = shapesFor((definition as any).shapes, path);
  const dtInfo = item.dataType ? dataTypeInfo(item.dataType) : null;
  const currentKey = path.split('.').pop() || path;
  const isField = item.type === 'field';
  const isGroup = item.type === 'group';
  const isChoice = item.dataType === 'choice' || item.dataType === 'multiChoice';
  const isDecimalLike = item.dataType === 'decimal' || item.dataType === 'money';
  const isMoney = item.dataType === 'money';

  return (
    <div className="h-full flex flex-col bg-surface overflow-hidden">
      {/* Panel Header */}
      <div className="px-3.5 py-2.5 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          {dtInfo && (
            <div className={`w-5.5 h-5.5 rounded-[3px] bg-subtle flex items-center justify-center font-mono font-bold text-[10px] ${dtInfo.color}`}>
              {dtInfo.icon}
            </div>
          )}
          <h2 className="text-[15px] font-bold text-ink tracking-tight font-ui">Properties</h2>
        </div>
        <div className="font-mono text-[12px] text-muted truncate">
          {(item.label as string) || currentKey}
        </div>
      </div>

      {/* Inspector Scroll Area */}
      <div className="flex-1 overflow-y-auto px-3.5 py-2 space-y-1">
        {/* Identity */}
        <Section title="Identity">
          <div className="space-y-1.5 mb-2">
            <label className="font-mono text-[10px] text-muted uppercase tracking-wider block">
              <HelpTip text={propertyHelp.key}>Key</HelpTip>
            </label>
            <input
              key={itemPath}
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
              key={`${itemPath}-label`}
              type="text"
              aria-label="Label"
              className="w-full px-2 py-1 text-[13px] border border-border rounded-[4px] bg-surface outline-none focus:border-accent transition-colors"
              defaultValue={(item.label as string) || ''}
              onBlur={(event) => {
                dispatch({
                  type: 'definition.setItemProperty',
                  payload: { path, property: 'label', value: event.currentTarget.value || null },
                });
              }}
            />
          </div>
          <PropertyRow label="Type" help={propertyHelp.type}>{selectedType || item.type}</PropertyRow>
          {dtInfo && (
            <PropertyRow label="DataType" color={dtInfo.color} help={propertyHelp.dataType}>
              <span className="mr-1">{dtInfo.icon}</span>
              {dtInfo.label}
            </PropertyRow>
          )}
        </Section>

        {/* Description & Hint (all items) */}
        <DescriptionHintSection path={path} item={item} dispatch={dispatch} />

        {/* Widget Hint (all items) */}
        <WidgetHintSection path={path} item={item} dispatch={dispatch} />

        {/* Field Config */}
        {isField && (
          <FieldConfigSection path={path} item={item} dispatch={dispatch}
            isChoice={isChoice} isDecimalLike={isDecimalLike} isMoney={isMoney} />
        )}

        {/* Group Config */}
        {isGroup && (
          <GroupConfigSection path={path} item={item} dispatch={dispatch} />
        )}

        {/* Options (choice/multiChoice only) */}
        {isField && isChoice && (
          <OptionsSection path={path} item={item} dispatch={dispatch} />
        )}

        {/* Behavior Rules */}
        {Object.keys(binds).length > 0 ? (
          <Section title="Behavior Rules">
            <div className="space-y-1">
              {Object.entries(binds).map(([type, expr]) => (
                <div key={type} className="relative">
                  <BindCard bindType={type} expression={expr} humanized={humanizeFEL(expr)} />
                  <button
                    type="button"
                    aria-label="Edit in Logic"
                    className="absolute top-2 right-8 text-[10px] text-muted hover:text-accent cursor-pointer transition-colors"
                    title="Edit in Logic tab"
                  >
                    →
                  </button>
                </div>
              ))}
            </div>
          </Section>
        ) : (
          <div className="mb-4">
            <HelpTip text="Behavior rules control when fields are visible, required, readonly, or have calculated values. Opens the Logic tab.">
              <button
                type="button"
                className="text-[11px] text-muted hover:text-accent font-mono cursor-pointer transition-colors"
              >
                + Add behavior rule →
              </button>
            </HelpTip>
          </div>
        )}

        {/* Validation Shapes */}
        {shapes.length > 0 && (
          <Section title="Validation Shapes">
            <div className="space-y-1">
              {shapes.map((sh, i) => (
                <ShapeCard key={i} name={sh.name} severity={sh.severity}
                  constraint={sh.constraint} message={sh.message as string} code={sh.code as string} />
              ))}
            </div>
          </Section>
        )}
      </div>

      {/* Action Footer */}
      {showActions && (
        <div className="p-3.5 border-t border-border bg-surface shrink-0 flex gap-2">
          <button
            className="flex-1 py-1.5 border border-border rounded-[4px] font-mono text-[11px] font-bold uppercase tracking-widest hover:bg-subtle transition-colors cursor-pointer"
            onClick={() => handleDuplicate(path)}
          >
            Duplicate
          </button>
          <button
            className="flex-1 py-1.5 border border-error/20 rounded-[4px] font-mono text-[11px] font-bold uppercase tracking-widest text-error hover:bg-error/5 transition-colors cursor-pointer"
            onClick={() => handleDelete(path)}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

// --- Sub-sections ---

function DescriptionHintSection({ path, item, dispatch }: { path: string; item: any; dispatch: any }) {
  const [showDesc, setShowDesc] = useState(!!item.description);
  const [showHint, setShowHint] = useState(!!item.hint);

  const descIsPlaceholder = !showDesc && !item.description;
  const hintIsPlaceholder = !showHint && !item.hint;
  const bothPlaceholders = descIsPlaceholder && hintIsPlaceholder;

  return (
    <Section title="Content">
      {bothPlaceholders ? (
        <div className="flex gap-3 mb-2">
          <AddPlaceholder label="description" onAdd={() => setShowDesc(true)} help={propertyHelp.description} />
          <AddPlaceholder label="hint" onAdd={() => setShowHint(true)} help={propertyHelp.hint} />
        </div>
      ) : (
        <>
          {descIsPlaceholder ? (
            <AddPlaceholder label="description" onAdd={() => setShowDesc(true)} help={propertyHelp.description} />
          ) : (
            <PropInput path={path} property="description" label="Description"
              value={(item.description as string) ?? ''} dispatch={dispatch} help={propertyHelp.description} />
          )}
          {hintIsPlaceholder ? (
            <AddPlaceholder label="hint" onAdd={() => setShowHint(true)} help={propertyHelp.hint} />
          ) : (
            <PropInput path={path} property="hint" label="Hint"
              value={(item.hint as string) ?? ''} dispatch={dispatch} help={propertyHelp.hint} />
          )}
        </>
      )}
    </Section>
  );
}

function WidgetHintSection({ path, item, dispatch }: { path: string; item: any; dispatch: any }) {
  const project = useProject();
  const widgets = compatibleWidgets(item.type, item.dataType);
  // Read current widget from the component tree (Tier 3), not definition presentation (Tier 1)
  const treeNode = project.componentFor(item.key);
  const currentWidget = (treeNode?.component as string) ?? '';

  if (widgets.length === 0) return null;

  return (
    <Section title="Widget">
      <div className="space-y-1.5 mb-2">
        <label className="font-mono text-[10px] text-muted uppercase tracking-wider block" htmlFor={`${path}-widget`}>
          <HelpTip text={propertyHelp.widgetHint}>Widget</HelpTip>
        </label>
        <select
          id={`${path}-widget`}
          aria-label="Widget"
          className="w-full px-2 py-1 text-[13px] font-mono border border-border rounded-[4px] bg-surface outline-none focus:border-accent transition-colors"
          value={currentWidget}
          onChange={(e) => {
            dispatch({
              type: 'component.setFieldWidget',
              payload: {
                fieldKey: item.key,
                widget: e.currentTarget.value || null,
              },
            });
          }}
        >
          <option value="">Default</option>
          {widgets.map((w) => <option key={w} value={w}>{w}</option>)}
        </select>
      </div>
    </Section>
  );
}

function FieldConfigSection({ path, item, dispatch, isChoice, isDecimalLike, isMoney }: {
  path: string; item: any; dispatch: any;
  isChoice: boolean; isDecimalLike: boolean; isMoney: boolean;
}) {
  const [showPrePop, setShowPrePop] = useState(!!(item as any).prePopulate);
  const prePopulate = (item as any).prePopulate as { instance: string; path: string; editable?: boolean } | undefined;

  return (
    <Section title="Field Config">
      {/* initialValue */}
      <PropInput path={path} property="initialValue" label="Initial Value"
        value={item.initialValue != null ? String(item.initialValue) : ''} dispatch={dispatch}
        help={propertyHelp.initialValue} />

      {/* precision — decimal/money only */}
      {isDecimalLike && typeof item.precision === 'number' && (
        <PropInput path={path} property="precision" label="Precision" type="number" min={0}
          value={item.precision} dispatch={dispatch} help={propertyHelp.precision} />
      )}

      {/* currency — money only */}
      {isMoney && typeof item.currency === 'string' && (
        <PropInput path={path} property="currency" label="Currency"
          value={item.currency} dispatch={dispatch} help={propertyHelp.currency} />
      )}

      {/* prefix/suffix — show when set */}
      {typeof item.prefix === 'string' && (
        <PropInput path={path} property="prefix" label="Prefix"
          value={item.prefix} dispatch={dispatch} help={propertyHelp.prefix} />
      )}
      {typeof item.suffix === 'string' && (
        <PropInput path={path} property="suffix" label="Suffix"
          value={item.suffix} dispatch={dispatch} help={propertyHelp.suffix} />
      )}

      {/* semanticType — show when set */}
      {typeof item.semanticType === 'string' && (
        <PropInput path={path} property="semanticType" label="Semantic Type"
          value={item.semanticType} dispatch={dispatch} help={propertyHelp.semanticType} />
      )}

      {/* prePopulate */}
      {showPrePop || prePopulate ? (
        <div className="space-y-1.5 mb-2">
          <label className="font-mono text-[10px] text-muted uppercase tracking-wider block">
            <HelpTip text={propertyHelp.prePopulate}>Pre-Population</HelpTip>
          </label>
          <div className="rounded-[4px] border border-border bg-subtle/40 px-2 py-2 space-y-2">
            <div className="space-y-1">
              <label className="font-mono text-[10px] text-muted uppercase tracking-wider block" htmlFor={`${path}-prepop-instance`}>
                <HelpTip text={propertyHelp.instance}>Instance</HelpTip>
              </label>
              <input
                id={`${path}-prepop-instance`}
                type="text"
                aria-label="Instance"
                className="w-full px-2 py-1 text-[12px] font-mono border border-border rounded-[4px] bg-surface outline-none focus:border-accent transition-colors"
                defaultValue={prePopulate?.instance ?? ''}
                onBlur={(e) => {
                  dispatch({
                    type: 'definition.setItemProperty',
                    payload: {
                      path, property: 'prePopulate',
                      value: { ...(prePopulate || {}), instance: e.currentTarget.value },
                    },
                  });
                }}
              />
            </div>
            <div className="space-y-1">
              <label className="font-mono text-[10px] text-muted uppercase tracking-wider block" htmlFor={`${path}-prepop-path`}>
                <HelpTip text={propertyHelp.path}>Path</HelpTip>
              </label>
              <input
                id={`${path}-prepop-path`}
                type="text"
                aria-label="Path"
                className="w-full px-2 py-1 text-[12px] font-mono border border-border rounded-[4px] bg-surface outline-none focus:border-accent transition-colors"
                defaultValue={prePopulate?.path ?? ''}
                onBlur={(e) => {
                  dispatch({
                    type: 'definition.setItemProperty',
                    payload: {
                      path, property: 'prePopulate',
                      value: { ...(prePopulate || {}), path: e.currentTarget.value },
                    },
                  });
                }}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id={`${path}-prepop-editable`}
                type="checkbox"
                aria-label="Editable"
                className="accent-accent"
                defaultChecked={prePopulate?.editable !== false}
                onChange={(e) => {
                  dispatch({
                    type: 'definition.setItemProperty',
                    payload: {
                      path, property: 'prePopulate',
                      value: { ...(prePopulate || {}), editable: e.currentTarget.checked },
                    },
                  });
                }}
              />
              <label htmlFor={`${path}-prepop-editable`} className="font-mono text-[10px] text-muted uppercase tracking-wider">
                <HelpTip text={propertyHelp.editable}>Editable</HelpTip>
              </label>
            </div>
          </div>
        </div>
      ) : (
        <AddPlaceholder label="pre-population" onAdd={() => setShowPrePop(true)} help={propertyHelp.prePopulate} />
      )}
    </Section>
  );
}

function GroupConfigSection({ path, item, dispatch }: { path: string; item: any; dispatch: any }) {
  const parseRepeatValue = (value: string): number | null => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number.parseInt(trimmed, 10);
    return Number.isNaN(parsed) ? null : parsed;
  };

  return (
    <Section title="Group Config">
      <div className="flex items-center gap-2 mb-2">
        <input
          id={`${path}-repeatable`}
          type="checkbox"
          aria-label="Repeatable"
          className="accent-accent"
          defaultChecked={!!item.repeatable}
          onChange={(e) => {
            dispatch({
              type: 'definition.setItemProperty',
              payload: { path, property: 'repeatable', value: e.currentTarget.checked },
            });
          }}
        />
        <label htmlFor={`${path}-repeatable`} className="font-mono text-[10px] text-muted uppercase tracking-wider">
          <HelpTip text={propertyHelp.repeatable}>Repeatable</HelpTip>
        </label>
      </div>

      {item.repeatable && (
        <div className="space-y-2">
          <div className="space-y-1.5">
            <label className="font-mono text-[10px] text-muted uppercase tracking-wider block" htmlFor={`${path}-min-repeat`}>
              <HelpTip text={propertyHelp.minRepeat}>Min Repeat</HelpTip>
            </label>
            <input
              id={`${path}-min-repeat`}
              type="number"
              min={0}
              aria-label="Min Repeat"
              className="w-full px-2 py-1 text-[13px] font-mono border border-border rounded-[4px] bg-surface outline-none focus:border-accent transition-colors"
              defaultValue={item.minRepeat ?? ''}
              onBlur={(event) => {
                dispatch({
                  type: 'definition.setItemProperty',
                  payload: { path, property: 'minRepeat', value: parseRepeatValue(event.currentTarget.value) },
                });
              }}
            />
          </div>
          <div className="space-y-1.5">
            <label className="font-mono text-[10px] text-muted uppercase tracking-wider block" htmlFor={`${path}-max-repeat`}>
              <HelpTip text={propertyHelp.maxRepeat}>Max Repeat</HelpTip>
            </label>
            <input
              id={`${path}-max-repeat`}
              type="number"
              min={0}
              aria-label="Max Repeat"
              className="w-full px-2 py-1 text-[13px] font-mono border border-border rounded-[4px] bg-surface outline-none focus:border-accent transition-colors"
              defaultValue={item.maxRepeat ?? ''}
              onBlur={(event) => {
                dispatch({
                  type: 'definition.setItemProperty',
                  payload: { path, property: 'maxRepeat', value: parseRepeatValue(event.currentTarget.value) },
                });
              }}
            />
          </div>
        </div>
      )}
    </Section>
  );
}

function OptionsSection({ path, item, dispatch }: { path: string; item: any; dispatch: any }) {
  const rawChoiceOptions = (item as any).options ?? (item as any).choices;
  const choiceOptions = Array.isArray(rawChoiceOptions) ? (rawChoiceOptions as Array<{ value: string; label?: string }>) : [];

  const updateOption = (index: number, property: 'value' | 'label', value: string) => {
    const nextOptions = choiceOptions.map((option, i) =>
      i === index ? { ...option, [property]: value } : option,
    );
    dispatch({ type: 'definition.setItemProperty', payload: { path, property: 'options', value: nextOptions } });
  };

  const addOption = () => {
    const nextOptions = [...choiceOptions, { value: '', label: '' }];
    dispatch({ type: 'definition.setItemProperty', payload: { path, property: 'options', value: nextOptions } });
  };

  const removeOption = (index: number) => {
    const nextOptions = choiceOptions.filter((_, i) => i !== index);
    dispatch({ type: 'definition.setItemProperty', payload: { path, property: 'options', value: nextOptions } });
  };

  return (
    <Section title="Options">
      <div className="space-y-2">
        {choiceOptions.map((option, index) => (
          <div key={`${option.value}-${index}`} className="rounded-[4px] border border-border bg-subtle/40 px-2 py-2 space-y-2 relative">
            <button
              type="button"
              aria-label="Remove option"
              className="absolute top-1 right-1 text-[10px] text-muted hover:text-error cursor-pointer transition-colors"
              onClick={() => removeOption(index)}
            >
              ✕
            </button>
            <div className="space-y-1">
              <label className="font-mono text-[10px] text-muted uppercase tracking-wider block" htmlFor={`${path}-option-${index}-value`}>
                Option {index + 1} Value
              </label>
              <input
                id={`${path}-option-${index}-value`}
                aria-label={`Option ${index + 1} Value`}
                type="text"
                className="w-full px-2 py-1 text-[12px] font-mono border border-border rounded-[4px] bg-surface outline-none focus:border-accent transition-colors"
                defaultValue={option.value}
                onBlur={(event) => updateOption(index, 'value', event.currentTarget.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="font-mono text-[10px] text-muted uppercase tracking-wider block" htmlFor={`${path}-option-${index}-label`}>
                Option {index + 1} Label
              </label>
              <input
                id={`${path}-option-${index}-label`}
                aria-label={`Option ${index + 1} Label`}
                type="text"
                className="w-full px-2 py-1 text-[12px] border border-border rounded-[4px] bg-surface outline-none focus:border-accent transition-colors"
                defaultValue={option.label ?? option.value}
                onBlur={(event) => updateOption(index, 'label', event.currentTarget.value)}
              />
            </div>
          </div>
        ))}
        <button
          type="button"
          aria-label="Add option"
          className="w-full py-1.5 border border-dashed border-border rounded-[4px] font-mono text-[11px] text-muted hover:text-accent hover:border-accent transition-colors cursor-pointer"
          onClick={addOption}
        >
          + Add Option
        </button>
      </div>
    </Section>
  );
}

function MultiSelectSummary({ selectionCount, selectedKeys, project, deselect }: {
  selectionCount: number;
  selectedKeys: Set<string>;
  project: any;
  deselect: () => void;
}) {
  const handleBatchDelete = () => {
    const pruned = pruneDescendants(selectedKeys);
    const sorted = sortForBatchDelete(pruned);
    project.batch(sorted.map((p: string) => ({ type: 'definition.deleteItem', payload: { path: p } })));
    deselect();
  };

  const handleBatchDuplicate = () => {
    const pruned = pruneDescendants(selectedKeys);
    const sorted = sortForBatchDelete(pruned);
    project.batch(sorted.map((p: string) => ({ type: 'definition.duplicateItem', payload: { path: p } })));
  };

  return (
    <div className="h-full flex flex-col bg-surface overflow-hidden">
      <div className="px-3.5 py-2.5 border-b border-border bg-surface shrink-0">
        <h2 className="text-[15px] font-bold text-ink tracking-tight font-ui">
          {selectionCount} items selected
        </h2>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-3.5">
        <button
          aria-label="Duplicate All"
          className="w-full py-2 border border-border rounded-[4px] font-mono text-[11px] font-bold uppercase tracking-widest hover:bg-subtle transition-colors cursor-pointer"
          onClick={handleBatchDuplicate}
        >
          Duplicate All
        </button>
        <button
          aria-label="Delete All"
          className="w-full py-2 border border-error/20 rounded-[4px] font-mono text-[11px] font-bold uppercase tracking-widest text-error hover:bg-error/5 transition-colors cursor-pointer"
          onClick={handleBatchDelete}
        >
          Delete All
        </button>
      </div>
    </div>
  );
}

function DefinitionProperties({ definition, dispatch }: { definition: any; dispatch: any }) {
  return (
    <div className="h-full flex flex-col bg-surface overflow-hidden">
      <div className="px-3.5 py-2.5 border-b border-border bg-surface shrink-0">
        <h2 className="text-[15px] font-bold text-ink tracking-tight font-ui">Form Properties</h2>
        <div className="font-mono text-[12px] text-muted truncate">
          {definition.url || 'Untitled'}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-3.5 py-2 space-y-1">
        <Section title="Identity">
          <div className="space-y-1.5 mb-2">
            <label className="font-mono text-[10px] text-muted uppercase tracking-wider block" htmlFor="def-title">
              Title
            </label>
            <input
              id="def-title"
              type="text"
              aria-label="Title"
              className="w-full px-2 py-1 text-[13px] border border-border rounded-[4px] bg-surface outline-none focus:border-accent transition-colors"
              defaultValue={definition.title ?? ''}
              onBlur={(e) => {
                dispatch({
                  type: 'definition.setProperty',
                  payload: { property: 'title', value: e.currentTarget.value || null },
                });
              }}
            />
          </div>
          <PropertyRow label="Version">{definition.version ?? ''}</PropertyRow>
          <PropertyRow label="Status">{definition.status ?? ''}</PropertyRow>
        </Section>
      </div>
    </div>
  );
}
