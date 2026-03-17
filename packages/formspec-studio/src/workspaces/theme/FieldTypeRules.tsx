/** @filedesc Theme tab section for managing selector rules that apply styles by item type or dataType. */
import { useState } from 'react';
import { useTheme } from '../../state/useTheme';
import { useProject } from '../../state/useProject';

interface SelectorRule {
  match?: { type?: string; dataType?: string };
  apply?: Record<string, unknown>;
}

function ruleSummary(rule: SelectorRule): string {
  const parts: string[] = [];
  if (rule.match?.type) parts.push(rule.match.type);
  if (rule.match?.dataType) parts.push(rule.match.dataType);
  if (parts.length === 0) return 'Any item';
  return parts.join(' + ');
}

export function FieldTypeRules() {
  const theme = useTheme();
  const project = useProject();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const selectors = (theme?.selectors ?? []) as SelectorRule[];

  const addRule = () => {
    project.addThemeSelector({}, {});
  };

  const setSelector = (index: number, match?: Record<string, unknown>, apply?: Record<string, unknown>) => {
    const update: { match?: Record<string, unknown>; apply?: Record<string, unknown> } = {};
    if (match !== undefined) update.match = match;
    if (apply !== undefined) update.apply = apply;
    project.updateThemeSelector(index, update);
  };

  const deleteSelector = (index: number) => {
    project.deleteThemeSelector(index);
    if (expandedIndex === index) setExpandedIndex(null);
  };

  const reorder = (index: number, direction: 'up' | 'down') => {
    project.reorderThemeSelector(index, direction);
    setExpandedIndex(direction === 'up' ? index - 1 : index + 1);
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center mb-1">
        <h4 className="text-[12px] font-bold text-muted uppercase tracking-wider">Selector Rules</h4>
        <button
          type="button"
          onClick={addRule}
          className="text-[11px] text-accent hover:text-accent-hover font-bold uppercase tracking-wider transition-colors"
        >
          + New Rule
        </button>
      </div>

      {selectors.length === 0 && (
        <div className="py-2 text-xs text-muted italic">
          No styling rules defined. Rules automatically apply widgets and styles based on field type.
        </div>
      )}

      <div className="text-[10px] text-muted italic mb-2">
        Rules apply in order — later rules override earlier ones
      </div>

      {selectors.map((rule, index) => {
        const isExpanded = expandedIndex === index;
        const summary = ruleSummary(rule);
        const widgetName = rule.apply?.widget as string | undefined;

        return (
          <div key={index} className="border border-border rounded-lg bg-surface overflow-hidden">
            {/* Collapsed header */}
            <div
              className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-subtle/50 transition-colors"
              onClick={() => setExpandedIndex(isExpanded ? null : index)}
            >
              <span className="text-[10px] font-mono text-muted w-6">#{index + 1}</span>
              <span className="text-[13px] font-bold text-ink flex-1">{summary}</span>
              {widgetName && (
                <span className="text-[11px] text-muted font-mono">{widgetName}</span>
              )}
            </div>

            {/* Expanded detail */}
            {isExpanded && (
              <div className="border-t border-border p-3 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                {/* Match section */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor={`rule-type-${index}`} className="font-mono text-[10px] text-muted uppercase tracking-wider block">
                      Item Type
                    </label>
                    <select
                      id={`rule-type-${index}`}
                      aria-label="Item Type"
                      value={rule.match?.type ?? ''}
                      onChange={(e) => {
                        const newMatch = { ...rule.match, type: e.target.value || undefined };
                        if (!newMatch.type) delete newMatch.type;
                        setSelector(index, newMatch);
                      }}
                      className="w-full px-2 py-1 text-[13px] font-mono border border-border rounded-[4px] bg-surface outline-none focus:border-accent"
                    >
                      <option value="">Any</option>
                      <option value="field">field</option>
                      <option value="group">group</option>
                      <option value="display">display</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label htmlFor={`rule-dataType-${index}`} className="font-mono text-[10px] text-muted uppercase tracking-wider block">
                      Data Type
                    </label>
                    <select
                      id={`rule-dataType-${index}`}
                      value={rule.match?.dataType ?? ''}
                      onChange={(e) => {
                        const newMatch = { ...rule.match, dataType: e.target.value || undefined };
                        if (!newMatch.dataType) delete newMatch.dataType;
                        setSelector(index, newMatch);
                      }}
                      className="w-full px-2 py-1 text-[13px] font-mono border border-border rounded-[4px] bg-surface outline-none focus:border-accent"
                    >
                      <option value="">Any</option>
                      {['string', 'integer', 'decimal', 'boolean', 'date', 'time', 'dateTime', 'money', 'email', 'url', 'phone', 'binary', 'text'].map((dt) => (
                        <option key={dt} value={dt}>{dt}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Apply section */}
                <div className="space-y-1">
                  <label htmlFor={`rule-widget-${index}`} className="font-mono text-[10px] text-muted uppercase tracking-wider block">
                    Widget
                  </label>
                  <input
                    id={`rule-widget-${index}`}
                    type="text"
                    aria-label="Widget"
                    defaultValue={(rule.apply?.widget as string) ?? ''}
                    key={`widget-${index}-${rule.apply?.widget}`}
                    placeholder="e.g. moneyInput"
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      setSelector(index, undefined, { ...rule.apply, widget: v || undefined });
                    }}
                    className="w-full px-2 py-1 text-[13px] font-mono border border-border rounded-[4px] bg-surface outline-none focus:border-accent transition-colors"
                  />
                </div>

                {/* Actions */}
                <div className="flex justify-between items-center pt-1">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      aria-label="Move up"
                      disabled={index === 0}
                      onClick={() => reorder(index, 'up')}
                      className="text-[10px] font-mono uppercase tracking-wider transition-colors disabled:opacity-30 text-muted hover:text-ink"
                    >
                      Move Up
                    </button>
                    <button
                      type="button"
                      aria-label="Move down"
                      disabled={index === selectors.length - 1}
                      onClick={() => reorder(index, 'down')}
                      className="text-[10px] font-mono uppercase tracking-wider transition-colors disabled:opacity-30 text-muted hover:text-ink"
                    >
                      Move Down
                    </button>
                  </div>
                  <button
                    type="button"
                    aria-label="Delete"
                    onClick={() => deleteSelector(index)}
                    className="text-[10px] text-muted hover:text-error font-bold uppercase tracking-wider transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
