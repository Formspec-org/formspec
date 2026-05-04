/** @filedesc Theme tab section for viewing and editing color.* design tokens as a color palette. */
import { useState, useRef } from 'react';
import { useTheme } from '../../state/useTheme';
import { useProject } from '../../state/useProject';
import { getTokensByGroup, validateTokenName } from '@formspec-org/studio-core';
import { InlineCreateForm } from '../../components/shared/InlineCreateForm';

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
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h4 className="text-[12px] font-bold uppercase tracking-normal text-muted">Colors</h4>
        {!isAdding && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 rounded border border-accent bg-accent/[0.04] px-3 py-1 text-[11px] font-bold text-accent hover:bg-accent hover:text-surface transition-all duration-200 shadow-sm"
          >
            <span>+</span>
            <span className="uppercase tracking-normal">New Color</span>
          </button>
        )}
      </div>

      {isAdding && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
          <InlineCreateForm
            onCancel={() => setIsAdding(false)}
            onCreate={handleAdd}
          >
            <input
              autoFocus
              type="text"
              placeholder="Color name (e.g. brand-primary)"
              value={newName}
              onChange={(e) => setNewName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
                if (e.key === 'Escape') setIsAdding(false);
              }}
              className="w-full bg-transparent border-none outline-none text-[14px] font-bold text-ink placeholder:text-muted px-2"
            />
          </InlineCreateForm>
        </div>
      )}

      {colorTokens.length === 0 && !isAdding && (
        <div className="py-12 flex flex-col items-center justify-center border border-dashed border-border bg-subtle rounded">
          <span className="text-[32px] mb-4 opacity-20">🎨</span>
          <p className="text-[12px] text-muted font-bold">No color tokens defined yet.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
      className="group relative overflow-hidden rounded border border-border bg-surface p-4 transition-all duration-200 hover:border-accent/40 hover:shadow-sm"
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div className="flex flex-col min-w-0">
            <span className="text-[9px] font-bold uppercase tracking-normal text-muted">Token Name</span>
            <div className="text-[14px] font-bold text-ink truncate tracking-tight">{name}</div>
          </div>
          <button
            type="button"
            aria-label={`Delete color ${name}`}
            onClick={onDelete}
            className="h-8 w-8 rounded-full flex items-center justify-center text-muted hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all opacity-0 group-hover:opacity-100"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6" />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-4 bg-subtle rounded border border-border p-2 pr-3">
          <button
            type="button"
            className="w-10 h-10 rounded border border-border shrink-0 shadow-sm relative overflow-hidden group/swatch"
            style={{ backgroundColor: value }}
            onClick={() => colorInputRef.current?.click()}
          >
            <div className="absolute inset-0 bg-black/0 group-hover/swatch:bg-black/5 transition-colors" />
            <input
              ref={colorInputRef}
              type="color"
              value={value}
              aria-label={`Pick color for ${name}`}
              onInput={(e) => onChange((e.target as HTMLInputElement).value)}
              className="sr-only"
            />
          </button>
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <span className="text-[8px] font-bold uppercase tracking-normal text-muted">Hex Value</span>
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
              className="text-[13px] font-mono font-bold text-ink/80 bg-transparent border-none outline-none w-full focus:text-accent transition-colors"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
