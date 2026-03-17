/** @filedesc Properties panel section showing resolved theme cascade and per-item style overrides. */
import { useState } from 'react';
import { Section } from '../../../components/ui/Section';
import { useTheme } from '../../../state/useTheme';
import { useProject } from '../../../state/useProject';
import { resolveThemeCascade, type ResolvedProperty } from 'formspec-studio-core';

const PROVENANCE_LABELS: Record<string, string> = {
  'default': 'from: Default',
  'selector': 'from: Field Type Rule',
  'item-override': 'from: This Field',
};

export function AppearanceSection({
  itemKey,
  itemType,
  itemDataType,
}: {
  itemKey: string;
  itemType: string;
  itemDataType?: string;
}) {
  const theme = useTheme();
  const project = useProject();
  const [addingStyle, setAddingStyle] = useState(false);
  const [styleKey, setStyleKey] = useState('');
  const [styleValue, setStyleValue] = useState('');

  if (!theme) return null;

  const cascade = resolveThemeCascade(theme, itemKey, itemType, itemDataType);
  const labelPos = cascade.labelPosition;
  const hasOverride = Object.values(cascade).some((p: ResolvedProperty) => p.source === 'item-override');

  const setItemOverride = (property: string, value: unknown) => {
    project.setItemOverride(itemKey, property, value);
  };

  const clearOverride = () => {
    project.clearItemOverrides(itemKey);
  };

  const addStyle = () => {
    const k = styleKey.trim();
    const v = styleValue.trim();
    if (!k) return;
    project.applyStyle(itemKey, { [k]: v });
    setStyleKey('');
    setStyleValue('');
    setAddingStyle(false);
  };

  return (
    <Section title="Appearance">
      {/* Label Position */}
      <div className="space-y-1 mb-3">
        <div className="flex items-center justify-between">
          <label
            htmlFor={`appearance-labelPos-${itemKey}`}
            className="font-mono text-[10px] text-muted uppercase tracking-wider"
          >
            Label Position
          </label>
          {labelPos && (
            <span className="text-[9px] text-muted italic">
              {PROVENANCE_LABELS[labelPos.source] || labelPos.source}
            </span>
          )}
        </div>
        <select
          id={`appearance-labelPos-${itemKey}`}
          aria-label="Label Position"
          value={(labelPos?.value as string) ?? ''}
          onChange={(e) => setItemOverride('labelPosition', e.target.value || null)}
          className="w-full px-2 py-1 text-[13px] font-mono border border-border rounded-[4px] bg-surface outline-none focus:border-accent"
        >
          <option value="">—</option>
          <option value="top">top</option>
          <option value="start">start</option>
          <option value="hidden">hidden</option>
        </select>
      </div>

      {/* CSS Class */}
      {cascade.cssClass && (
        <div className="space-y-1 mb-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-muted uppercase tracking-wider">CSS Class</span>
            <span className="text-[9px] text-muted italic">
              {PROVENANCE_LABELS[cascade.cssClass.source]}
            </span>
          </div>
          <div className="text-[12px] font-mono text-ink">{cascade.cssClass.value as string}</div>
        </div>
      )}

      {/* Clear override button */}
      {hasOverride && (
        <button
          type="button"
          aria-label="Clear override"
          onClick={clearOverride}
          className="text-[10px] text-muted hover:text-error font-mono uppercase tracking-wider transition-colors mb-3"
        >
          Clear Override
        </button>
      )}

      {/* Add style override */}
      {!addingStyle && (
        <button
          type="button"
          onClick={() => setAddingStyle(true)}
          className="text-[11px] text-muted hover:text-accent font-mono cursor-pointer transition-colors"
        >
          + Add Style
        </button>
      )}
      {addingStyle && (
        <div className="border border-accent/30 rounded-lg bg-accent/5 p-2 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex gap-2">
            <input
              autoFocus
              type="text"
              placeholder="property (e.g. fontWeight)"
              value={styleKey}
              onChange={(e) => setStyleKey(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addStyle();
                if (e.key === 'Escape') setAddingStyle(false);
              }}
              className="flex-1 bg-transparent border-b border-border outline-none text-[11px] font-mono placeholder:text-muted/40"
            />
            <input
              type="text"
              placeholder="value"
              value={styleValue}
              onChange={(e) => setStyleValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addStyle();
                if (e.key === 'Escape') setAddingStyle(false);
              }}
              className="flex-1 bg-transparent border-b border-border outline-none text-[11px] font-mono placeholder:text-muted/40"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setAddingStyle(false)}
              className="text-[10px] uppercase font-bold text-muted hover:text-ink transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={addStyle}
              className="text-[10px] uppercase font-bold text-accent hover:text-accent-hover transition-colors"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </Section>
  );
}
