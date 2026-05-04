/** @filedesc Theme tab section showing all tokens grouped by dot-prefix with inline edit and delete. */
import { useState } from 'react';
import { getGroupedTokens } from '@formspec-org/studio-core';
import { useTheme } from '../../state/useTheme';
import { useProject } from '../../state/useProject';
import { InlineCreateForm } from '../../components/shared/InlineCreateForm';

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
        <h4 className="text-[11px] font-bold text-muted uppercase tracking-normal">
          {totalTokens} tokens
        </h4>
        {!isAdding && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="text-[11px] text-accent hover:text-accent-hover font-bold uppercase tracking-normal transition-colors"
          >
            + New Token
          </button>
        )}
      </div>

      {isAdding && (
        <InlineCreateForm
          onCancel={() => setIsAdding(false)}
          onCreate={handleAdd}
        >
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
              className="flex-1 bg-transparent border-b border-border outline-none text-[12px] font-mono text-ink placeholder:text-muted"
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
              className="flex-1 bg-transparent border-b border-border outline-none text-[12px] font-mono text-ink placeholder:text-muted"
            />
          </div>
        </InlineCreateForm>
      )}

      {Array.from(groups.entries()).map(([prefix, items]) => (
        <div key={prefix} className="space-y-0.5">
          <div className="text-[10px] font-bold text-muted uppercase tracking-normal px-2 pt-2">{prefix}</div>
          {items.map(({ key, name, value }) => (
            <div
              key={key}
              className="flex items-center gap-2 py-0.5 px-2 rounded hover:bg-subtle group"
            >
              {isHexColor(value) && (
                <div
                  data-testid={`swatch-${key}`}
                  className="w-3 h-3 rounded border border-border/60 shrink-0"
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
                className="flex-1 text-[12px] font-mono text-muted bg-transparent border-none outline-none focus:text-ink transition-colors"
              />
              <button
                type="button"
                aria-label={`Delete ${key}`}
                onClick={() => setToken(key, null)}
                className="text-[10px] text-muted hover:text-error font-bold uppercase tracking-normal opacity-0 group-hover:opacity-100 transition-all"
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
