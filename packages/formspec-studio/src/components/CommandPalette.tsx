import { useState } from 'react';
import { useDefinition } from '../state/useDefinition';
import { useSelection } from '../state/useSelection';
import { flatItems } from '../lib/field-helpers';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const definition = useDefinition();
  const { select } = useSelection();
  const [search, setSearch] = useState('');

  if (!open) return null;

  const items = definition.items ? flatItems(definition.items as any[]) : [];
  const variables = (definition as any).variables ?? [];

  const query = search.toLowerCase();

  const filteredItems = query
    ? items.filter((fi) => fi.path.toLowerCase().includes(query) || (fi.item as any).label?.toLowerCase().includes(query))
    : items;

  const filteredVariables = query
    ? variables.filter((v: any) => v.name?.toLowerCase().includes(query))
    : variables;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div data-testid="command-palette" className="w-full max-w-lg bg-surface border border-border rounded-lg shadow-xl">
        <div className="p-3 border-b border-border">
          <input
            type="text"
            placeholder="Search items, variables..."
            className="w-full px-3 py-2 text-sm bg-bg border border-border rounded outline-none focus:border-accent"
            value={search}
            onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
            autoFocus
          />
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {filteredItems.length > 0 && (
            <div>
              <div className="px-2 py-1 text-xs text-muted font-medium uppercase">Items</div>
              {filteredItems.map((fi) => (
                <div
                  key={fi.path}
                  data-testid="palette-result"
                  className="px-3 py-2 text-sm rounded hover:bg-surface-hover cursor-pointer"
                  onClick={() => { select(fi.path, (fi.item as any).type); onClose(); }}
                >
                  <span className="font-medium">{fi.path}</span>
                  {(fi.item as any).label && (
                    <span className="ml-2 text-muted">{(fi.item as any).label}</span>
                  )}
                </div>
              ))}
            </div>
          )}
          {filteredVariables.length > 0 && (
            <div>
              <div className="px-2 py-1 text-xs text-muted font-medium uppercase">Variables</div>
              {filteredVariables.map((v: any) => (
                <div key={v.name} className="px-3 py-2 text-sm rounded hover:bg-surface-hover cursor-pointer" title={v.expression || undefined}>
                  <span className="font-medium">{v.name}</span>
                </div>
              ))}
            </div>
          )}
          {filteredItems.length === 0 && filteredVariables.length === 0 && (
            <div className="px-3 py-4 text-sm text-muted text-center">No results found</div>
          )}
        </div>
      </div>
    </div>
  );
}
