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
    <div className="group border border-border/60 rounded-xl bg-surface p-3 shadow-sm hover:border-accent/40 transition-all">
      <div className="flex items-center gap-3">
        {/* Source Path */}
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={source}
            data-testid={`rule-source-${index}`}
            onChange={(e) => updateRule('sourcePath', e.target.value)}
            placeholder="source.path"
            className="w-full font-mono text-[12px] bg-subtle/40 border-none p-1.5 rounded-md text-ink placeholder:text-muted/40 focus:ring-1 focus:ring-accent/30"
          />
        </div>

        <div className="text-muted/30">
          <IconArrowRight />
        </div>

        {/* Target Path */}
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={target}
            data-testid={`rule-target-${index}`}
            onChange={(e) => updateRule('targetPath', e.target.value)}
            placeholder="target.path"
            className="w-full font-mono text-[12px] bg-subtle/40 border-none p-1.5 rounded-md text-ink placeholder:text-muted/40 focus:ring-1 focus:ring-accent/30"
          />
        </div>

        {/* Transform Picker */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setPickerOpen(!pickerOpen)}
            className="px-2 py-1 rounded bg-accent/5 text-accent border border-accent/10 text-[10px] font-bold uppercase tracking-wider hover:bg-accent/10 transition-colors"
          >
            {transform}
          </button>

          {pickerOpen && (
            <>
              <div
                id={listboxId}
                className="absolute right-0 top-full z-30 mt-1 min-w-[120px] rounded-lg border border-border bg-panel p-1 shadow-xl animate-in fade-in zoom-in-95 duration-150"
              >
                <div className="p-1.5 mb-1 pb-1 border-b border-border/40 text-[9px] font-bold text-muted uppercase tracking-widest">
                  Transform
                </div>
                {TRANSFORMS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onMouseEnter={() => setHoveredTransform(t)}
                    onMouseLeave={() => setHoveredTransform(null)}
                    className={`flex w-full rounded-md px-2 py-1.5 text-left text-[11px] font-medium transition-colors ${t === transform ? 'bg-accent/10 text-accent font-bold' : 'text-ink hover:bg-subtle'
                      }`}
                    onClick={() => setTransform(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {/* Hover Peek Description */}
              {showDescription && hoveredTransform && (
                <div className="absolute right-[calc(100%+8px)] top-full z-30 mt-1 w-48 p-3 rounded-lg border border-accent/20 bg-panel shadow-2xl animate-in fade-in slide-in-from-right-2 duration-200">
                  <div className="text-[10px] font-bold text-accent uppercase tracking-widest mb-1">
                    {hoveredTransform}
                  </div>
                  <div className="text-[11px] text-ink leading-relaxed">
                    {TRANSFORM_DESCRIPTIONS[hoveredTransform]}
                  </div>
                  <div className="mt-2 text-[9px] text-muted italic">
                    {['expression', 'constant', 'concat', 'split', 'flatten', 'nest'].includes(hoveredTransform) ? 'Requires additional configuration below.' : 'Applied immediately.'}
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
          className="p-1.5 text-muted/40 hover:text-red-500 hover:bg-red-50 transition-all rounded-md opacity-0 group-hover:opacity-100"
          title="Delete Rule"
        >
          <IconTrash size={14} />
        </button>

        {/* Advanced toggle */}
        <button
          type="button"
          className={`text-[10px] text-muted hover:text-ink cursor-pointer select-none ${
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
        <div className="mt-2 pt-2 border-t border-border/30 flex items-center gap-2">
          <span className="text-[10px] font-bold text-muted uppercase tracking-wider w-16">Formula</span>
          <input
            type="text"
            value={rule.expression ?? ''}
            onChange={(e) => updateRule('expression', e.target.value)}
            placeholder="FEL expression..."
            className="flex-1 font-mono text-[11px] bg-subtle/20 border-none p-1 rounded text-ink focus:ring-0"
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

  const inputClass = 'w-full rounded border border-border bg-bg-default px-2 py-1 text-xs text-ink placeholder:text-muted focus:outline-none focus:border-accent';

  return (
    <div
      className="border-t border-border/30 mt-2 pt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs"
      data-testid={`rule-advanced-${index}`}
    >
      <label className="text-muted leading-6">Description</label>
      <input
        type="text"
        className={inputClass}
        defaultValue={(rule.description as string) ?? ''}
        placeholder="Optional description"
        onBlur={(e) => commitText('description', e.target.value)}
        data-testid={`rule-description-${index}`}
      />

      <label className="text-muted leading-6">Priority</label>
      <input
        type="number"
        className={inputClass}
        defaultValue={(rule.priority as number) ?? 0}
        onBlur={(e) => commitNumber('priority', e.target.value)}
        data-testid={`rule-priority-${index}`}
      />

      <label className="text-muted leading-6">Bidirectional</label>
      <div className="flex items-center h-6">
        <input
          type="checkbox"
          checked={(rule.bidirectional as boolean) ?? true}
          onChange={(e) => updateRule('bidirectional', e.target.checked)}
          className="accent-accent"
          data-testid={`rule-bidirectional-${index}`}
        />
      </div>

      <label className="text-muted leading-6">Condition</label>
      <input
        type="text"
        className={inputClass}
        defaultValue={(rule.condition as string) ?? ''}
        placeholder="FEL condition (e.g. @source.flag = true)"
        onBlur={(e) => commitText('condition', e.target.value)}
        data-testid={`rule-condition-${index}`}
      />

      <label className="text-muted leading-6">Default</label>
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
          <label className="text-muted leading-6">Reverse expr</label>
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
