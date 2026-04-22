/** @filedesc Theme tab section for editing responsive breakpoint definitions (name and min-width). */
import { useState } from 'react';
import { useTheme } from '../../state/useTheme';
import { useProject } from '../../state/useProject';
import { applyBreakpointPresets, getSortedBreakpoints } from '@formspec-org/studio-core';
import { InlineCreateForm } from '../../components/shared/InlineCreateForm';

export function ScreenSizes() {
  useTheme();
  const project = useProject();
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newWidth, setNewWidth] = useState('');

  const sorted = getSortedBreakpoints(project);

  const setBreakpoint = (name: string, minWidth: number | null) => {
    project.setBreakpoint(name, minWidth);
  };

  const handleAdd = () => {
    const name = newName.trim();
    const width = parseInt(newWidth, 10);
    if (!name || isNaN(width)) return;
    setBreakpoint(name, width);
    setNewName('');
    setNewWidth('');
    setIsAdding(false);
  };

  const applyPresets = () => {
    applyBreakpointPresets(project);
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center mb-1">
        <h4 className="text-[12px] font-bold text-muted uppercase tracking-wider">
          {sorted.length} breakpoints
        </h4>
        {!isAdding && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="text-[11px] text-accent hover:text-accent-hover font-bold uppercase tracking-wider transition-colors"
          >
            + New Breakpoint
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
              placeholder="name (e.g. tablet)"
              value={newName}
              onChange={(e) => setNewName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
                if (e.key === 'Escape') setIsAdding(false);
              }}
              className="flex-1 bg-transparent border-b border-border outline-none text-sm font-mono text-ink placeholder:text-muted/40"
            />
            <input
              type="number"
              placeholder="min width (px)"
              value={newWidth}
              onChange={(e) => setNewWidth(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
                if (e.key === 'Escape') setIsAdding(false);
              }}
              className="w-28 bg-transparent border-b border-border outline-none text-sm font-mono text-ink placeholder:text-muted/40"
            />
          </div>
        </InlineCreateForm>
      )}

      {sorted.length === 0 && !isAdding && (
        <div className="py-3 text-xs text-muted italic space-y-2">
          <div>No breakpoints defined.</div>
          <div>
            Common presets: mobile (0px), tablet (768px), desktop (1024px)
          </div>
          <button
            type="button"
            onClick={applyPresets}
            className="text-[11px] text-accent hover:text-accent-hover font-bold transition-colors"
          >
            Apply Presets
          </button>
        </div>
      )}

      <div className="space-y-1">
        {sorted.map(({ name, width }) => (
          <div
            key={name}
            className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-subtle/50 group"
          >
            <span
              data-testid={`breakpoint-name-${name}`}
              className="text-[13px] font-bold text-ink w-24"
            >
              {name}
            </span>
            <span className="text-[12px] font-mono text-muted">{width}px</span>
            <div className="flex-1 h-2 bg-subtle rounded-full overflow-hidden">
              <div
                className="h-full bg-accent/30 rounded-full"
                style={{ width: `${Math.min((width / 1920) * 100, 100)}%` }}
              />
            </div>
            <button
              type="button"
              aria-label={`Delete ${name}`}
              onClick={() => setBreakpoint(name, null)}
              className="text-[10px] text-muted hover:text-error font-mono uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-all"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
