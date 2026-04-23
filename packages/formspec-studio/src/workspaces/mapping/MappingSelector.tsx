/** @filedesc Mapping tab selector strip — switch, create, delete, and rename named mapping documents. */
import { useState, useRef, useEffect } from 'react';
import { IconEdit, IconClose, IconPlus } from '../../components/icons';
import { useProject } from '../../state/useProject';
import { useMappingIds } from '../../state/useMappingIds';

export function MappingSelector() {
  const project = useProject();
  const { ids, selectedId } = useMappingIds();

  // Inline create state
  const [creating, setCreating] = useState(false);
  const [newId, setNewId] = useState('');

  // Inline rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Error display
  const [error, setError] = useState<string | null>(null);

  const createInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Focus the create input when it appears
  useEffect(() => {
    if (creating) createInputRef.current?.focus();
  }, [creating]);

  // Focus the rename input and select all when it appears
  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  // Clear error after 3s
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 3000);
    return () => clearTimeout(t);
  }, [error]);

  function handleSelect(id: string) {
    if (id === selectedId) return;
    try {
      project.selectMapping(id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function handleCreate() {
    const id = newId.trim();
    if (!id) { setCreating(false); return; }
    try {
      project.createMapping(id);
      setCreating(false);
      setNewId('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function handleCreateKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleCreate();
    if (e.key === 'Escape') { setCreating(false); setNewId(''); }
  }

  function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      project.deleteMapping(id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function startRename(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setRenamingId(id);
    setRenameValue(id);
  }

  function handleRenameCommit() {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === renamingId) { setRenamingId(null); return; }
    try {
      project.renameMapping(renamingId!, trimmed);
      setRenamingId(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setRenamingId(null);
    }
  }

  function handleRenameKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleRenameCommit();
    if (e.key === 'Escape') setRenamingId(null);
  }

  const canDelete = ids.length > 1;

  return (
    <div data-testid="mapping-selector" className="flex items-center gap-1.5 flex-wrap">
      {/* Mapping tabs */}
      <div className="flex items-center gap-1 p-0.5 bg-subtle/30 rounded-lg border border-border/40">
        {ids.map((id) => {
          const isActive = id === selectedId;
          const isRenaming = renamingId === id;

          return (
            <div
              key={id}
              data-testid={`mapping-tab-${id}`}
              aria-selected={isActive}
              className={`group relative flex items-center gap-2 px-3 py-1.5 rounded-[6px] cursor-pointer transition-all duration-200 ${
                isActive
                  ? 'bg-surface text-ink shadow-sm ring-1 ring-black/5'
                  : 'text-muted hover:text-ink hover:bg-subtle/50'
              }`}
              onClick={() => !isRenaming && handleSelect(id)}
            >
              {isRenaming ? (
                <input
                  ref={renameInputRef}
                  data-testid={`mapping-rename-input-${id}`}
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={handleRenameCommit}
                  onKeyDown={handleRenameKeyDown}
                  className="font-mono text-[11px] font-bold bg-transparent border-none outline-none w-24 text-accent"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span
                  data-testid={`mapping-tab-label-${id}`}
                  className={`font-mono text-[11px] font-bold leading-none ${isActive ? 'text-accent' : ''}`}
                  onDoubleClick={(e) => startRename(id, e)}
                  title="Double-click to rename"
                >
                  {id}
                </span>
              )}

              {/* Edit icon (only on active tab, not while renaming) */}
              {isActive && !isRenaming && (
                <button
                  type="button"
                  data-testid={`mapping-rename-btn-${id}`}
                  title="Rename mapping"
                  className="opacity-0 group-hover:opacity-40 hover:!opacity-100 text-muted leading-none transition-opacity"
                  onClick={(e) => startRename(id, e)}
                >
                  <IconEdit size={8} />
                </button>
              )}

              {/* Delete button (shown when >1 mapping, non-active tabs always; active tab in group-hover) */}
              {canDelete && !isRenaming && (
                <button
                  type="button"
                  data-testid={`mapping-delete-btn-${id}`}
                  title={`Delete mapping '${id}'`}
                  className={`leading-none transition-opacity opacity-0 group-hover:opacity-40 hover:!opacity-100 text-muted hover:text-error`}
                  onClick={(e) => handleDelete(id, e)}
                >
                  <IconClose size={8} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Create new mapping */}
      <div className="flex items-center">
        {creating ? (
          <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
            <div className="relative">
              <input
                ref={createInputRef}
                data-testid="mapping-create-input"
                value={newId}
                onChange={(e) => setNewId(e.target.value)}
                onBlur={handleCreate}
                onKeyDown={handleCreateKeyDown}
                placeholder="mapping-id"
                className="font-mono text-[11px] font-bold px-3 py-1.5 rounded-lg border border-accent/30 outline-none bg-surface text-ink w-32 focus:w-48 shadow-lg shadow-accent/10 transition-all duration-300 ring-2 ring-accent/5"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 opacity-30 pointer-events-none">
                <span className="text-[7px] font-bold">↵</span>
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            data-testid="mapping-create-btn"
            title="Add new mapping"
            className="flex items-center justify-center w-8 h-8 rounded-lg border border-dashed border-border hover:border-accent hover:bg-accent/5 hover:text-accent transition-all duration-200 text-muted group/add shadow-sm"
            onClick={() => { setCreating(true); setNewId(''); }}
          >
            <IconPlus size={12} className="transition-transform duration-300 group-hover/add:rotate-90" />
          </button>
        )}
      </div>

      {/* Inline error */}
      {error && (
        <span data-testid="mapping-selector-error" className="text-rust text-[10px] ml-1 animate-in fade-in">
          {error}
        </span>
      )}
    </div>
  );
}
