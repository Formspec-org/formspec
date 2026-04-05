/** @filedesc Theme tab section for viewing and editing color.* design tokens as a color palette. */
import { useState, useRef } from 'react';
import { useTheme } from '../../state/useTheme';
import { useProject } from '../../state/useProject';
import { getTokensByGroup, validateTokenName } from '@formspec-org/studio-core';

export function ColorPalette() {
  useTheme();
  const project = useProject();
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');

  const colorTokens = getTokensByGroup(project, 'color');

  const setToken = (key: string, value: string | null) => {
    project.setToken(key, value);
  };

  const handleAdd = () => {
    const name = newName.trim();
    if (!validateTokenName(name)) return;
    setToken(`color.${name}`, '#808080');
    setNewName('');
    setIsAdding(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center mb-1">
        <h4 className="text-[12px] font-bold text-muted uppercase tracking-wider">Colors</h4>
        {!isAdding && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="text-[11px] text-accent hover:text-accent-hover font-bold uppercase tracking-wider transition-colors"
          >
            + New Color
          </button>
        )}
      </div>

      {isAdding && (
        <div className="border border-accent/30 rounded-lg bg-accent/5 p-3 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
          <input
            autoFocus
            type="text"
            placeholder="color name (e.g. brand)"
            value={newName}
            onChange={(e) => setNewName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
              if (e.key === 'Escape') setIsAdding(false);
            }}
            className="w-full bg-transparent border-none outline-none text-sm font-mono text-ink placeholder:text-muted/40"
          />
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

      {colorTokens.length === 0 && !isAdding && (
        <div className="py-2 text-xs text-muted italic">No color tokens defined. Click &quot;+ New Color&quot; to start.</div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {colorTokens.map(({ key, name, value }) => (
          <ColorSwatch
            key={key}
            tokenKey={key}
            name={name}
            value={value}
            onChange={(v) => setToken(key, v)}
            onDelete={() => setToken(key, null)}
          />
        ))}
      </div>
    </div>
  );
}

function ColorSwatch({
  tokenKey,
  name,
  value,
  onChange,
  onDelete,
}: {
  tokenKey: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  onDelete: () => void;
}) {
  const colorInputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      data-testid={`color-token-${tokenKey}`}
      className="border border-border rounded-lg bg-surface p-3 transition-all hover:border-accent/50 group"
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="w-8 h-8 rounded-full border border-border/60 shrink-0 cursor-pointer"
          style={{ backgroundColor: value }}
          onClick={() => colorInputRef.current?.click()}
        >
          <input
            ref={colorInputRef}
            type="color"
            value={value}
            aria-label={`Pick color for ${name}`}
            onInput={(e) => onChange((e.target as HTMLInputElement).value)}
            className="sr-only"
          />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold text-ink truncate">{name}</div>
          <input
            data-testid={`color-value-${tokenKey}`}
            type="text"
            defaultValue={value}
            key={value}
            aria-label={`Value for ${name}`}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== value) onChange(v);
            }}
            className="text-[11px] font-mono text-muted bg-transparent border-none outline-none w-full"
          />
        </div>
        <button
          type="button"
          aria-label={`Delete color ${name}`}
          onClick={onDelete}
          className="text-[10px] text-muted hover:text-error font-mono uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-all"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
