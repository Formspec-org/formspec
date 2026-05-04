/** @filedesc Design mode section — brand colors editing. */
import { useState, useRef } from 'react';
import { useProject } from '../../state/useProject';
import { useProjectState } from '../../state/useProjectState';
import { getTokensByGroup, validateTokenName } from '@formspec-org/studio-core';

export function BrandColorsSection() {
  const project = useProject();
  useProjectState();
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');

  const colorTokens = getTokensByGroup(project, 'color');

  const setToken = (key: string, value: string | null) => {
    project.setToken(key, value);
  };

  const handleAdd = () => {
    const name = newName.trim();
    if (!validateTokenName(name)) return;
    setToken(`color.${name}`, '#3B82F6');
    setNewName('');
    setIsAdding(false);
  };

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[19px] font-semibold text-ink tracking-tight">Brand Colors</h3>
          <p className="text-[13px] text-muted mt-1">Define your core color palette for use across the form.</p>
        </div>
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="rounded-full bg-accent px-4 py-2 text-[13px] font-semibold text-white hover:bg-accent/90 transition-colors focus-ring"
        >
          Add Color
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {colorTokens.map(({ key, name, value }) => (
          <ColorCard
            key={key}
            tokenKey={key}
            name={name}
            value={value}
            onChange={(v) => setToken(key, v)}
            onDelete={() => setToken(key, null)}
          />
        ))}

        {isAdding && (
          <div className="rounded-xl border-2 border-dashed border-accent/30 p-4 bg-accent/5">
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
              className="w-full bg-transparent border-none outline-none text-[15px] font-medium text-ink placeholder:text-muted mb-3"
            />
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                className="rounded-lg bg-accent px-3 py-1.5 text-[12px] font-bold text-white"
              >
                Create
              </button>
              <button
                onClick={() => setIsAdding(false)}
                className="rounded-lg border border-border px-3 py-1.5 text-[12px] font-medium text-ink"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function ColorCard({
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
    <div className="group relative rounded-xl border border-border bg-surface p-4 shadow-sm transition-all hover:border-accent/40 hover:shadow-md">
      <div className="flex items-center gap-4">
        <button
          type="button"
          className="w-12 h-12 rounded-full border border-border/60 shrink-0 shadow-inner"
          style={{ backgroundColor: value }}
          onClick={() => colorInputRef.current?.click()}
        >
          <input
            ref={colorInputRef}
            type="color"
            value={value}
            onInput={(e) => onChange((e.target as HTMLInputElement).value)}
            className="sr-only"
          />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-semibold text-ink truncate capitalize">{name.replace(/-/g, ' ')}</div>
          <div className="flex items-center gap-2 mt-0.5">
            <code className="text-[11px] font-mono text-muted uppercase tracking-wider">{value}</code>
          </div>
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="p-2 text-muted hover:text-error opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label={`Delete ${name}`}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
