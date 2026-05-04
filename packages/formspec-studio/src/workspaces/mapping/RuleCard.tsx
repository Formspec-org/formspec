/** @filedesc Interactive editor card for a single mapping rule with source/target paths, transform selection, and collapsible Advanced section. */
import { useEffect, useId, useState } from 'react';
import { Pill } from '../../components/ui/Pill';
import { IconArrowRight, IconTrash } from '../../components/icons';
import { useProject } from '../../state/useProject';
import type { MappingRule } from './types';

const TRANSFORMS = [
  'preserve', 'drop', 'expression', 'coerce', 'valueMap',
  'flatten', 'nest', 'constant', 'concat', 'split'
] as const;

const TRANSFORM_DESCRIPTIONS: Record<string, string> = {
  preserve: 'Copies the source value exactly as it is without any changes.',
  drop: 'Removes this path from the output entirely. Useful for filtering sensitive data.',
  expression: 'Evaluates a FEL expression to compute the target value dynamically.',
  coerce: 'Casts the source value to a specific type (string, number, boolean).',
  valueMap: 'Maps specific source values to specific target values using a lookup table.',
  flatten: 'Unwraps complex source objects into a flat structure.',
  nest: 'Wraps the source value into a nested object structure.',
  constant: 'Always returns a fixed value regardless of the source data.',
  concat: 'Joins multiple string values together into a single string.',
  split: 'Breaks a string into an array based on a character delimiter.'
};

interface RuleCardProps {
  index: number;
  source: string;
  target: string;
  transform?: string;
  rule: MappingRule;
}

export function RuleCard({ index, source, target, transform = 'preserve', rule }: RuleCardProps) {
  const project = useProject();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [hoveredTransform, setHoveredTransform] = useState<string | null>(null);
  const [showDescription, setShowDescription] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const listboxId = useId();

  const updateRule = (property: string, value: unknown) => {
    project.updateMappingRule(index, property, value);
  };

  const deleteRule = () => {
    project.removeMappingRule(index);
  };

  const setTransform = (value: string) => {
    updateRule('transform', value);
    setPickerOpen(false);
    setShowDescription(false);
  };

  // Delayed hover description logic
  useEffect(() => {
    if (!hoveredTransform) {
      setShowDescription(false);
      return;
    }

    const timer = setTimeout(() => {
      setShowDescription(true);
    }, 800); // Wait 0.8s before showing description

    return () => clearTimeout(timer);
  }, [hoveredTransform]);

  return (
    <div className="group border border-border rounded bg-surface p-3 shadow-sm hover:border-accent/30 transition-all duration-200">
      <div className="flex items-center gap-3">
        {/* Source Path */}
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={source}
            data-testid={`rule-source-${index}`}
            onChange={(e) => updateRule('sourcePath', e.target.value)}
            placeholder="source.path"
            className="w-full font-mono text-[11px] font-bold bg-subtle border-none px-2 py-1.5 rounded text-ink placeholder:text-muted focus:ring-1 focus:ring-accent transition-all"
          />
        </div>

        <div className="text-muted shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </div>

        {/* Target Path */}
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={target}
            data-testid={`rule-target-${index}`}
            onChange={(e) => updateRule('targetPath', e.target.value)}
            placeholder="target.path"
            className="w-full font-mono text-[11px] font-bold bg-subtle border-none px-2 py-1.5 rounded text-ink placeholder:text-muted focus:ring-1 focus:ring-accent transition-all"
          />
        </div>

        {/* Transform Picker */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setPickerOpen(!pickerOpen)}
            className="px-2 py-1 rounded bg-accent/[0.04] text-accent border border-accent/20 text-[9px] font-bold uppercase tracking-normal hover:bg-accent hover:text-surface transition-all"
          >
            {transform}
          </button>

          {pickerOpen && (
            <>
              <div
                id={listboxId}
                className="right-0 top-full z-30 mt-1 min-w-[130px] p-0.5 shadow-md dropdown-panel"
              >
                <div className="px-2 py-1 mb-0.5 border-b border-border text-[8px] font-bold text-muted uppercase tracking-normal">
                  Transform
                </div>
                {TRANSFORMS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onMouseEnter={() => setHoveredTransform(t)}
                    onMouseLeave={() => setHoveredTransform(null)}
                    className={`flex w-full rounded px-2 py-1.5 text-left text-[11px] font-bold transition-all ${t === transform ? 'bg-accent text-surface shadow-sm' : 'text-ink hover:bg-subtle hover:text-accent'
                      }`}
                    onClick={() => setTransform(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {/* Hover Peek Description */}
              {showDescription && hoveredTransform && (
                <div className="absolute right-[calc(100%+8px)] top-full z-30 mt-1 w-52 p-3 rounded border border-border bg-surface shadow-lg">
                  <div className="text-[9px] font-bold text-accent uppercase tracking-normal mb-1.5">
                    {hoveredTransform}
                  </div>
                  <div className="text-[12px] text-ink font-bold leading-relaxed opacity-70">
                    {TRANSFORM_DESCRIPTIONS[hoveredTransform]}
                  </div>
                  <div className="mt-3 text-[10px] text-muted font-bold italic opacity-50">
                    {['expression', 'constant', 'concat', 'split', 'flatten', 'nest'].includes(hoveredTransform) ? 'Requires additional configuration.' : 'Applied immediately.'}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Delete button */}
        <button
          type="button"
          onClick={deleteRule}
          className="w-7 h-7 flex items-center justify-center text-muted hover:text-error hover:bg-error/5 transition-all rounded opacity-0 group-hover:opacity-100"
          title="Delete Rule"
        >
          <IconTrash size={14} />
        </button>

        {/* Advanced toggle */}
        <button
          type="button"
          className={`font-mono text-[9px] font-bold uppercase tracking-normal text-muted hover:text-ink cursor-pointer select-none ${
            advancedOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          } transition-opacity`}
          onClick={() => setAdvancedOpen(!advancedOpen)}
          data-testid={`rule-advanced-toggle-${index}`}
        >
          {advancedOpen ? '\u25BE' : '\u25B8'} Advanced
        </button>
      </div>

      {/* Sub-config for complex transforms (expression, coerce, etc.) */}
      {['expression', 'constant', 'concat', 'split', 'flatten', 'nest'].includes(transform) && (
        <div className="mt-3 pt-3 border-t border-border flex items-center gap-3">
          <span className="text-[9px] font-bold text-muted uppercase tracking-normal w-12 shrink-0">Formula</span>
          <input
            type="text"
            value={rule.expression ?? ''}
            onChange={(e) => updateRule('expression', e.target.value)}
            placeholder="FEL expression..."
            className="flex-1 font-mono text-[11px] font-bold bg-subtle border-none px-2 py-1.5 rounded text-ink placeholder:text-muted focus:ring-1 focus:ring-accent transition-all"
          />
        </div>
      )}

      {/* Advanced section */}
      {advancedOpen && (
        <AdvancedSection index={index} rule={rule ?? {}} transform={transform} updateRule={updateRule} />
      )}
    </div>
  );
}

// ── Advanced Section ──────────────────────────────────────────────────────────

interface AdvancedSectionProps {
  index: number;
  rule: MappingRule;
  transform: string;
  updateRule: (property: string, value: unknown) => void;
}

function AdvancedSection({ index, rule, transform, updateRule }: AdvancedSectionProps) {
  const [defaultError, setDefaultError] = useState(false);

  const commitText = (property: string, raw: string) => {
    updateRule(property, raw.trim() === '' ? null : raw.trim());
  };

  const commitNumber = (property: string, raw: string) => {
    const n = Number(raw);
    updateRule(property, isNaN(n) ? 0 : n);
  };

  const commitDefault = (raw: string) => {
    if (raw.trim() === '') {
      setDefaultError(false);
      updateRule('default', undefined);
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      setDefaultError(false);
      updateRule('default', parsed);
    } catch {
      setDefaultError(true);
    }
  };

  const commitReverseExpression = (raw: string) => {
    const existing = rule.reverse ?? {};
    if (raw.trim() === '') {
      const { expression: _, ...rest } = existing;
      updateRule('reverse', Object.keys(rest).length > 0 ? rest : null);
    } else {
      updateRule('reverse', { ...existing, expression: raw.trim() });
    }
  };

  const inputClass = 'w-full rounded-md border border-border bg-surface px-2 py-1.5 text-[11px] font-medium text-ink placeholder:text-muted outline-none focus:ring-2 focus:ring-accent/10 transition-all';

  return (
    <div
      className="border-t border-border/10 mt-4 pt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-xs"
      data-testid={`rule-advanced-${index}`}
    >
      <label className="text-muted font-mono text-[9px] font-bold uppercase tracking-normal leading-8">Description</label>
      <input
        type="text"
        className={inputClass}
        defaultValue={(rule.description as string) ?? ''}
        placeholder="Optional description"
        onBlur={(e) => commitText('description', e.target.value)}
        data-testid={`rule-description-${index}`}
      />

      <label className="text-muted font-mono text-[9px] font-bold uppercase tracking-normal leading-8">Priority</label>
      <input
        type="number"
        className={inputClass}
        defaultValue={(rule.priority as number) ?? 0}
        onBlur={(e) => commitNumber('priority', e.target.value)}
        data-testid={`rule-priority-${index}`}
      />

      <label className="text-muted font-mono text-[9px] font-bold uppercase tracking-normal leading-8">Bidirectional</label>
      <div className="flex items-center h-8">
        <input
          type="checkbox"
          checked={(rule.bidirectional as boolean) ?? true}
          onChange={(e) => updateRule('bidirectional', e.target.checked)}
          className="w-5 h-5 rounded-md border-border/40 text-accent focus:ring-accent/20 focus:ring-offset-0"
          data-testid={`rule-bidirectional-${index}`}
        />
      </div>

      <label className="text-muted font-mono text-[9px] font-bold uppercase tracking-normal leading-8">Condition</label>
      <input
        type="text"
        className={inputClass}
        defaultValue={(rule.condition as string) ?? ''}
        placeholder="FEL condition (e.g. @source.flag = true)"
        onBlur={(e) => commitText('condition', e.target.value)}
        data-testid={`rule-condition-${index}`}
      />

      <label className="text-muted font-mono text-[9px] font-bold uppercase tracking-normal leading-8">Default</label>
      <input
        type="text"
        className={`${inputClass} ${defaultError ? 'border-red-400' : ''}`}
        defaultValue={rule.default !== undefined ? JSON.stringify(rule.default) : ''}
        placeholder="JSON value"
        onBlur={(e) => commitDefault(e.target.value)}
        data-testid={`rule-default-${index}`}
      />

      {transform !== 'drop' && (
        <>
          <label className="text-muted font-mono text-[9px] font-bold uppercase tracking-normal leading-8">Reverse expr</label>
          <input
            type="text"
            className={inputClass}
            defaultValue={((rule.reverse as Record<string, unknown>)?.expression as string) ?? ''}
            placeholder="Reverse expression"
            onBlur={(e) => commitReverseExpression(e.target.value)}
            data-testid={`rule-reverse-expression-${index}`}
          />
        </>
      )}
    </div>
  );
}
