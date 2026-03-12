import { useState } from 'react';
import { useDispatch } from '../state/useDispatch';

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
}

const ARTIFACT_TYPES = ['Definition', 'Component', 'Theme', 'Mapping'] as const;

export function ImportDialog({ open, onClose }: ImportDialogProps) {
  const dispatch = useDispatch();
  const [selectedType, setSelectedType] = useState<string>(ARTIFACT_TYPES[0]);
  const [jsonText, setJsonText] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div data-testid="import-dialog" className="w-full max-w-lg bg-surface border border-border rounded-lg shadow-xl">
        <div className="p-4 border-b border-border">
          <h2 className="text-sm font-semibold">Import</h2>
          <p className="text-xs text-muted mt-1">
            Paste JSON to load a formspec artifact into your project.
          </p>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted mb-2">Artifact Type</label>
            <div className="flex gap-2">
              {ARTIFACT_TYPES.map((type) => (
                <button
                  key={type}
                  className={`px-3 py-1 text-sm rounded border ${
                    selectedType === type
                      ? 'border-accent bg-accent text-on-accent'
                      : 'border-border text-muted hover:bg-surface-hover'
                  }`}
                  onClick={() => setSelectedType(type)}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-2">JSON Content</label>
            <textarea
              className={`w-full h-40 px-3 py-2 text-sm font-mono bg-bg border rounded resize-none outline-none focus:border-accent ${
                parseError ? 'border-red-500' : 'border-border'
              }`}
              placeholder={`Paste ${selectedType.toLowerCase()} JSON here...`}
              value={jsonText}
              onChange={(e) => { setJsonText(e.target.value); setParseError(null); }}
            />
            {parseError && (
              <p className="text-xs text-red-500 mt-1">{parseError}</p>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-border flex justify-end gap-2">
          <button
            className="px-3 py-1.5 text-sm rounded border border-border text-muted hover:bg-surface-hover"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-3 py-1.5 text-sm rounded bg-accent text-on-accent hover:opacity-90"
            disabled={!jsonText.trim()}
            onClick={() => {
              try {
                const parsed = JSON.parse(jsonText);
                const artifactKey = selectedType.toLowerCase();
                dispatch({
                  type: 'project.import',
                  payload: { [artifactKey]: parsed },
                });
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
