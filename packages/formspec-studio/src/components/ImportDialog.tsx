/** @filedesc Modal dialog for pasting and importing JSON artifacts (definition, component, theme, mapping). */
import { useEffect, useId, useMemo, useState } from 'react';
import { useProject } from '../state/useProject';
import { useEscapeKey } from '../hooks/useEscapeKey';

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
}

const ARTIFACT_TYPES = ['Definition', 'Component', 'Theme', 'Mapping'] as const;

export function ImportDialog({ open, onClose }: ImportDialogProps) {
  const project = useProject();
  const titleId = useId();
  const descriptionId = useId();
  const textareaId = useId();
  const [selectedType, setSelectedType] = useState<string>(ARTIFACT_TYPES[0]);
  const [jsonText, setJsonText] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelectedType(ARTIFACT_TYPES[0]);
    setJsonText('');
    setParseError(null);
  }, [open]);

  useEscapeKey(onClose, open);

  const canLoad = useMemo(() => {
    if (!jsonText.trim()) return false;
    try {
      JSON.parse(jsonText);
      return true;
    } catch {
      return false;
    }
  }, [jsonText]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        data-testid="import-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="w-full max-w-lg bg-surface border border-border rounded-lg shadow-xl"
      >
        <div className="p-4 border-b border-border">
          <h2 id={titleId} className="text-sm font-semibold">Import</h2>
          <p id={descriptionId} className="text-xs text-muted mt-1">
            Paste JSON to load a formspec artifact into your project.
          </p>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted mb-2">Artifact Type</label>
            <div className="flex gap-2">
              {ARTIFACT_TYPES.map((type) => (
                <button
                  type="button"
                  key={type}
                  className={`px-3 py-1 text-sm rounded-[4px] border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                    selectedType === type
                      ? 'border-accent bg-accent text-on-accent'
                      : 'border-border text-muted hover:text-ink hover:bg-subtle/70'
                  }`}
                  onClick={() => setSelectedType(type)}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor={textareaId} className="block text-xs font-medium text-muted mb-2">JSON Content</label>
            <textarea
              id={textareaId}
              className={`w-full h-40 px-3 py-2 text-sm font-mono bg-bg-default border rounded-[4px] resize-none outline-none focus:ring-2 transition-shadow ${
                parseError ? 'border-error focus:border-error focus:ring-error/30' : 'border-border focus:border-accent focus:ring-accent/30'
              }`}
              placeholder={`Paste ${selectedType.toLowerCase()} JSON here...`}
              value={jsonText}
              onChange={(e) => {
                const next = e.target.value;
                setJsonText(next);
                if (!next.trim()) {
                  setParseError(null);
                  return;
                }
                try {
                  JSON.parse(next);
                  setParseError(null);
                } catch (error) {
                  setParseError((error as SyntaxError).message);
                }
              }}
            />
            {parseError && (
              <p className="text-xs text-error mt-1">{parseError}</p>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-border flex justify-end gap-2">
          <button
            type="button"
            className="px-3 py-1.5 text-sm rounded-[4px] border border-border text-muted hover:bg-subtle/70 hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="px-3 py-1.5 text-[13px] font-medium rounded-[4px] bg-accent text-white hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-50 transition-colors"
            disabled={!canLoad}
            onClick={() => {
              try {
                const parsed = JSON.parse(jsonText);
                const artifactKey = selectedType.toLowerCase();
                project.loadBundle({ [artifactKey]: parsed });
                onClose();
              } catch (e) {
                setParseError((e as SyntaxError).message);
              }
            }}
          >
            Load
          </button>
        </div>
      </div>
    </div>
  );
}
