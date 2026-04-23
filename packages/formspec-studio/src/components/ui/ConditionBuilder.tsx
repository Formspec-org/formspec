/** @filedesc Visual condition builder for FEL boolean expressions with guided/advanced toggle. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  type Condition,
  type ConditionGroup,
  type Operator,
  type OperatorInfo,
  conditionToFEL,
  emptyCondition,
  emptyGroup,
  getOperatorLabel,
  getOperatorsForDataType,
  groupToFEL,
  operatorRequiresValue,
  parseFELToGroup,
  quoteFELValue,
  unquoteFELValue,
} from '@formspec-org/studio-core';
import {
  IconChevronRight,
  IconTrash,
  IconPlus,
} from '../icons';
import type { FELEditorFieldOption } from '@formspec-org/studio-core';
import { HighlightedExpression } from './InlineExpression';
import { FELEditor } from './FELEditor';
import { FELReferencePopup } from './FELReferencePopup';

export interface ConditionBuilderProps {
  value: string;
  onSave: (fel: string) => void;
  onCancel?: () => void;
  fields: FELEditorFieldOption[];
  selfReference?: boolean;
  autoEdit?: boolean;
  className?: string;
}

type Mode = 'guided' | 'advanced';

const SELECT_CLASSES =
  'font-ui text-[11px] bg-subtle border border-border rounded px-1.5 py-0.5 text-ink appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent/40';

function ConditionRow({
  condition,
  fields,
  operators,
  selfReference,
  onChange,
  onRemove,
}: {
  condition: Condition;
  fields: FELEditorFieldOption[];
  operators: OperatorInfo[];
  selfReference: boolean;
  onChange: (c: Condition) => void;
  onRemove: () => void;
}) {
  const selectedField = useMemo(
    () => fields.find((f) => f.path === condition.field),
    [fields, condition.field],
  );

  const currentOperators = useMemo(() => {
    if (selectedField?.dataType) return getOperatorsForDataType(selectedField.dataType);
    if (condition.field === '$') return getOperatorsForDataType('number');
    return operators;
  }, [selectedField, condition.field, operators]);

  const handleFieldChange = useCallback(
    (path: string) => {
      const field = fields.find((f) => f.path === path);
      const newOps = field?.dataType
        ? getOperatorsForDataType(field.dataType)
        : operators;
      const needsValue = newOps.length > 0 ? operatorRequiresValue(newOps[0].operator) : true;
      onChange({
        field: path,
        operator: newOps[0]?.operator ?? 'eq',
        value: needsValue ? condition.value : '',
      });
    },
    [fields, operators, condition.value, onChange],
  );

  const handleOperatorChange = useCallback(
    (op: Operator) => {
      const needsValue = operatorRequiresValue(op);
      onChange({ ...condition, operator: op, value: needsValue ? condition.value : '' });
    },
    [condition, onChange],
  );

  const handleValueChange = useCallback(
    (value: string) => {
      onChange({ ...condition, value });
    },
    [condition, onChange],
  );

  const showValue = operatorRequiresValue(condition.operator);

  return (
    <div className="flex items-center gap-1.5" role="group">
      {!selfReference ? (
        <select
          value={condition.field}
          onChange={(e) => handleFieldChange(e.target.value)}
          className={SELECT_CLASSES}
          aria-label="Field"
          style={{ maxWidth: 140 }}
        >
          <option value="" disabled>
            Select field...
          </option>
          {fields.map((f) => (
            <option key={f.path} value={f.path}>
              {f.label || f.path}
            </option>
          ))}
        </select>
      ) : (
        <span className="font-mono text-[11px] text-ink/60 px-1">this value</span>
      )}

      <select
        value={condition.operator}
        onChange={(e) => handleOperatorChange(e.target.value as Operator)}
        className={SELECT_CLASSES}
        aria-label="Operator"
      >
        {currentOperators.map((op) => (
          <option key={op.operator} value={op.operator}>
            {op.label}
          </option>
        ))}
      </select>

      {showValue && (
        <input
          type="text"
          value={unquoteFELValue(condition.value)}
          onChange={(e) => {
            handleValueChange(quoteFELValue(e.target.value));
          }}
          placeholder="Value"
          className="font-mono text-[11px] bg-subtle border border-border rounded px-1.5 py-0.5 text-ink flex-1 min-w-[60px] focus:outline-none focus:ring-1 focus:ring-accent/40"
          aria-label="Value"
        />
      )}

      <button
        type="button"
        onClick={onRemove}
        className="w-5 h-5 flex items-center justify-center rounded text-muted/40 hover:text-error hover:bg-error/10 transition-colors shrink-0"
        aria-label="Remove condition"
      >
        <IconTrash size={12} />
      </button>
    </div>
  );
}

export function ConditionBuilder({
  value,
  onSave,
  onCancel,
  fields,
  selfReference = false,
  autoEdit = false,
  className,
}: ConditionBuilderProps) {
  const parsed = useMemo(() => parseFELToGroup(value), [value]);

  const initialMode: Mode = parsed ? 'guided' : 'advanced';
  const [mode, setMode] = useState<Mode>(initialMode);
  const [group, setGroup] = useState<ConditionGroup>(() => parsed ?? emptyGroup());
  const [advancedDraft, setAdvancedDraft] = useState(value);

  useEffect(() => {
    const nextParsed = parseFELToGroup(value);
    const nextMode: Mode = nextParsed ? 'guided' : 'advanced';
    setMode(nextMode);
    setGroup(nextParsed ?? emptyGroup());
    setAdvancedDraft(value);
  }, [value]);

  const defaultOperators = useMemo(() => getOperatorsForDataType('string'), []);

  const felPreview = useMemo(() => groupToFEL(group), [group]);

  const handleSave = useCallback(() => {
    if (mode === 'guided') {
      onSave(groupToFEL(group));
    } else {
      onSave(advancedDraft);
    }
  }, [mode, group, advancedDraft, onSave]);

  const handleCancel = useCallback(() => {
    onCancel?.();
  }, [onCancel]);

  const updateCondition = useCallback(
    (index: number, updated: Condition) => {
      setGroup((prev) => ({
        ...prev,
        conditions: prev.conditions.map((c, i) => (i === index ? updated : c)),
      }));
    },
    [],
  );

  const removeCondition = useCallback((index: number) => {
    setGroup((prev) => ({
      ...prev,
      conditions: prev.conditions.filter((_, i) => i !== index),
    }));
  }, []);

  const addCondition = useCallback(() => {
    setGroup((prev) => ({
      ...prev,
      conditions: [...prev.conditions, emptyCondition()],
    }));
  }, []);

  const toggleLogic = useCallback(() => {
    setGroup((prev) => ({
      ...prev,
      logic: prev.logic === 'and' ? 'or' : 'and',
    }));
  }, []);

  const switchToAdvanced = useCallback(() => {
    setAdvancedDraft(felPreview || value);
    setMode('advanced');
  }, [felPreview, value]);

  const switchToGuided = useCallback(() => {
    const reParsed = parseFELToGroup(advancedDraft);
    if (reParsed) {
      setGroup(reParsed);
      setMode('guided');
    }
  }, [advancedDraft]);

  const hasConditions =
    group.conditions.length > 0 &&
    group.conditions.some((c) => c.field || c.value);

  return (
    <div className={"space-y-2 " + (className ?? '')} data-testid="condition-builder">
      {mode === 'guided' ? (
        <>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-ui text-[10px] text-muted uppercase tracking-wider">When</span>
            <button
              type="button"
              onClick={toggleLogic}
              className="font-ui text-[10px] font-semibold text-accent hover:text-accent/80 transition-colors px-1.5 py-0.5 rounded bg-accent/5"
              aria-label={"Switch to " + (group.logic === 'and' ? 'any' : 'all') + " match"}
            >
              {group.logic === 'and' ? 'all' : 'any'}
            </button>
            <span className="font-ui text-[10px] text-muted">of these are true:</span>
          </div>

          <div className="space-y-1.5">
            {group.conditions.map((cond, i) => (
              <ConditionRow
                key={cond.field + '-' + cond.operator + '-' + i}
                condition={cond}
                fields={fields}
                operators={defaultOperators}
                selfReference={selfReference}
                onChange={(c) => updateCondition(i, c)}
                onRemove={() => removeCondition(i)}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={addCondition}
            className="flex items-center gap-1 font-ui text-[10px] text-accent hover:text-accent/80 transition-colors"
          >
            <IconPlus size={12} />
            Add condition
          </button>

          {felPreview && (
            <div
              className="font-mono text-[10px] text-muted/60 bg-subtle/50 px-1.5 py-0.5 rounded truncate"
              title={felPreview}
            >
              FEL: <HighlightedExpression expression={felPreview} />
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleSave}
              disabled={!hasConditions}
              className="font-ui text-[10px] font-semibold text-surface bg-accent hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed rounded px-2 py-0.5 transition-colors"
            >
              Save
            </button>
            {onCancel && (
              <button
                type="button"
                onClick={handleCancel}
                className="font-ui text-[10px] text-muted hover:text-ink transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={switchToAdvanced}
              className="font-ui text-[10px] text-muted hover:text-ink transition-colors ml-auto"
            >
              Advanced
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-start gap-1">
            <FELEditor
              value={advancedDraft}
              onSave={(val) => onSave(val)}
              onCancel={handleCancel}
              placeholder="FEL expression"
              className="flex-1"
              autoFocus
            />
            <FELReferencePopup />
          </div>
          <button
            type="button"
            onClick={switchToGuided}
            className="font-ui text-[10px] text-muted hover:text-ink transition-colors"
          >
            Guided
          </button>
        </>
      )}
    </div>
  );
}

export function ConditionBuilderPreview({
  value,
  onClick,
  selfReference = false,
}: {
  value: string;
  onClick: () => void;
  selfReference?: boolean;
}) {
  const parsed = useMemo(() => parseFELToGroup(value), [value]);

  const className = "inline-flex items-center gap-1 font-mono text-[11px] bg-subtle border border-border/60 px-1.5 py-0.5 rounded-[2px] cursor-pointer hover:bg-subtle/80 transition-colors text-left";

  if (!parsed || parsed.conditions.length === 0) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={className}
        title={value}
      >
        <span className="max-w-[120px] overflow-hidden text-ellipsis">
          <HighlightedExpression expression={value} />
        </span>
      </button>
    );
  }

  const parts = parsed.conditions.map((c) => {
    const fieldLabel = selfReference ? 'value' : (c.field || 'this');
    const opLabel = getOperatorLabel(c.operator);
    const valDisplay = unquoteFELValue(c.value);
    if (!operatorRequiresValue(c.operator)) return `${fieldLabel} ${opLabel}`;
    return `${fieldLabel} ${opLabel} ${valDisplay}`;
  });

  const connector = parsed.logic === 'and' ? 'and' : 'or';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${className} text-ink`}
      title={value}
      data-testid="condition-builder-preview"
    >
      {parts.join(` ${connector} `)}
    </button>
  );
}
