/** @filedesc Modal dialog for pasting and importing JSON artifacts (definition, component, theme, mapping). */
import { useEffect, useId, useMemo, useState } from 'react';
import type { ComponentDocument, FormDefinition, ThemeDocument, MappingDocument } from '@formspec-org/types';
import { useProject } from '../state/useProject';
import { useEscapeKey } from '../hooks/useEscapeKey';

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  /** When false or resolved false, load is aborted. May return a Promise (e.g. in-app confirm). */
  onBeforeLoad?: () => boolean | Promise<boolean>;
  /** Called after a successful load, before `onClose`. */
  onImportSuccess?: () => void;
}

const ARTIFACT_TYPES = ['Definition', 'Component', 'Theme', 'Mapping'] as const;

type ImportArtifactKey = 'definition' | 'component' | 'theme' | 'mapping';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFormDefinitionPayload(value: unknown): value is FormDefinition {
  return isPlainObject(value) && typeof value.$formspec === 'string';
}

function isComponentPayload(value: unknown): value is ComponentDocument {
  return isPlainObject(value) && (value as { $formspecComponent?: unknown }).$formspecComponent === '1.0';
}

function isThemePayload(value: unknown): value is ThemeDocument {
  return isPlainObject(value) && (value as { $formspecTheme?: unknown }).$formspecTheme === '1.0';
}

function isMappingDocumentLike(value: unknown): value is MappingDocument {
  if (!isPlainObject(value)) return false;
  return (
    value.$formspecMapping === '1.0'
    && typeof value.version === 'string'
    && typeof value.definitionRef === 'string'
  );
}

function narrowMappingsRecord(
  raw: Record<string, unknown>,
): { ok: true; mappings: Record<string, MappingDocument> } | { ok: false; error: string } {
  const mappings: Record<string, MappingDocument> = {};
  for (const [key, entry] of Object.entries(raw)) {
    if (!isMappingDocumentLike(entry)) {
      return {
        ok: false,
        error: `Invalid mapping import: entry "${key}" is not a valid Mapping Document (expected $formspecMapping "1.0" with string version and definitionRef).`,
      };
    }
    mappings[key] = entry;
  }
  return { ok: true, mappings };
}

/**
 * Normalize pasted Mapping JSON into the shape expected by `project.import` (`mappings` map).
 * - A single mapping document becomes `{ default: doc }`.
 * - A bundle with a top-level `mappings` object is passed through (must be a plain object, not an array).
 */
export function resolveMappingsImportPayload(
  parsed: unknown,
): { ok: true; mappings: Record<string, unknown> } | { ok: false; error: string } {
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: 'Invalid mapping import: expected a JSON object.' };
  }
  const doc = parsed as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(doc, 'mappings')) {
    return { ok: true, mappings: { default: doc } };
  }
  const raw = doc.mappings;
  if (raw === undefined) {
    return { ok: false, error: 'Invalid mapping import: property "mappings" is present but undefined.' };
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return {
      ok: false,
      error: 'Invalid mapping import: "mappings" must be an object of named mapping documents, not an array.',
    };
  }
  return { ok: true, mappings: raw as Record<string, unknown> };
}

export function ImportDialog({ open, onClose, onBeforeLoad, onImportSuccess }: ImportDialogProps) {
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
                  className={`px-3 py-1 text-sm rounded-[4px] border transition-colors focus-ring ${
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
            className="px-3 py-1.5 text-sm rounded-[4px] border border-border text-muted hover:bg-subtle/70 hover:text-ink transition-colors focus-ring"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="px-3 py-1.5 text-[13px] font-medium rounded-[4px] bg-accent text-white hover:bg-accent/90 focus-ring disabled:opacity-50 transition-colors"
            disabled={!canLoad}
            onClick={async () => {
              if (onBeforeLoad) {
                const result = onBeforeLoad();
                const ok = result instanceof Promise ? await result : result;
                if (!ok) return;
              }
              try {
                const parsed: unknown = JSON.parse(jsonText);
                const rawKey = selectedType.toLowerCase();
                if (rawKey !== 'mapping' && rawKey !== 'definition' && rawKey !== 'component' && rawKey !== 'theme') {
                  setParseError(`Unsupported artifact type: ${selectedType}`);
                  return;
                }
                const artifactKey = rawKey as ImportArtifactKey;
                switch (artifactKey) {
                  case 'mapping': {
                    const result = resolveMappingsImportPayload(parsed);
                    if (!result.ok) {
                      setParseError(result.error);
                      return;
                    }
                    const narrowed = narrowMappingsRecord(result.mappings);
                    if (!narrowed.ok) {
                      setParseError(narrowed.error);
                      return;
                    }
                    project.loadBundle({ mappings: narrowed.mappings });
                    break;
                  }
                  case 'definition': {
                    if (!isFormDefinitionPayload(parsed)) {
                      setParseError('Invalid definition: expected a JSON object with a string $formspec field.');
                      return;
                    }
                    project.loadBundle({ definition: parsed });
                    break;
                  }
                  case 'component': {
                    if (!isComponentPayload(parsed)) {
                      setParseError('Invalid component: expected a JSON object with $formspecComponent "1.0".');
                      return;
                    }
                    project.loadBundle({ component: parsed });
                    break;
                  }
                  case 'theme': {
                    if (!isThemePayload(parsed)) {
                      setParseError('Invalid theme: expected a JSON object with $formspecTheme "1.0".');
                      return;
                    }
                    project.loadBundle({ theme: parsed });
                    break;
                  }
                }
                onImportSuccess?.();
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
