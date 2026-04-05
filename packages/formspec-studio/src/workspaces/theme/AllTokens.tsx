/** @filedesc Theme tab section showing all tokens grouped by dot-prefix with inline edit and delete. */
import { useState } from 'react';
import { getGroupedTokens } from '@formspec-org/studio-core';
import { useTheme } from '../../state/useTheme';
import { useProject } from '../../state/useProject';

function isHexColor(v: string): boolean {
  return /^#([0-9a-fA-F]{3}){1,2}$/.test(v);
}

export function AllTokens() {
  useTheme();
  const project = useProject();
  const [isAdding, setIsAdding] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  const groups = getGroupedTokens(project);
  const totalTokens = Array.from(groups.values()).reduce((count, items) => count + items.length, 0);

  const setToken = (key: string, value: string | null) => {
    project.setToken(key, value);
  };

  const handleAdd = () => {
    const key = newKey.trim();
    const value = newValue.trim();
    if (!key) return;
    setToken(key, value || '');
    setNewKey('');
    setNewValue('');
    setIsAdding(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center mb-1">
        <h4 className="text-[12px] font-bold text-muted uppercase tracking-wider">
          {totalTokens} tokens
        </h4>
        {!isAdding && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="text-[11px] text-accent hover:text-accent-hover font-bold uppercase tracking-wider transition-colors"
          >
            + New Token
          </button>
        )}
      </div>

      {isAdding && (
        <div className="border border-accent/30 rounded-lg bg-accent/5 p-3 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex gap-2">
            <input
              autoFocus
              type="text"
              placeholder="token key (e.g. custom.foo)"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
                if (e.key === 'Escape') setIsAdding(false);
              }}
              className="flex-1 bg-transparent border-b border-border outline-none text-sm font-mono text-ink placeholder:text-muted/40"
            />
            <input
              type="text"
              placeholder="value"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
                if (e.key === 'Escape') setIsAdding(false);
              }}
              className="flex-1 bg-transparent border-b border-border outline-none text-sm font-mono text-ink placeholder:text-muted/40"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setIsAdding(false)}
              className="text-[10px] uppercase font-bold text-muted hover:text-ink transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              className="text-[10px] uppercase font-bold text-accent hover:text-accent-hover transition-colors"
            >
              Create
            </button>
          </div>
        </div>
      )}

      {Array.from(groups.entries()).map(([prefix, items]) => (
        <div key={prefix} className="space-y-1">
          <div className="text-[11px] font-bold text-muted uppercase tracking-wider">{prefix}</div>
          {items.map(({ key, name, value }) => (
            <div
              key={key}
              className="flex items-center gap-2 py-1 px-2 rounded hover:bg-subtle/50 group"
            >
              {isHexColor(value) && (
                <div
                  data-testid={`swatch-${key}`}
                  className="w-4 h-4 rounded-full border border-border/60 shrink-0"
                  style={{ backgroundColor: value }}
                />
              )}
              <span className="text-[12px] font-mono font-bold text-ink flex-shrink-0">{name}</span>
              <input
                type="text"
                defaultValue={value}
                key={`${key}-${value}`}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v !== value) setToken(key, v);
                }}
                className="flex-1 text-[12px] font-mono text-muted bg-transparent border-none outline-none"
              />
              <button
                type="button"
                aria-label={`Delete ${key}`}
                onClick={() => setToken(key, null)}
                className="text-[10px] text-muted hover:text-error font-mono uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-all"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
