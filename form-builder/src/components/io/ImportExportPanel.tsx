import type { Signal } from '@preact/signals';
import { useState } from 'preact/hooks';
import { importArtifacts } from '../../state/mutations';
import {
  buildStudioBundleDocument,
  buildStudioTemplateDocument,
  type StudioTemplateDocument
} from '../../state/import-export';
import type { ProjectState } from '../../state/project';

const TEMPLATE_STORAGE_KEY = 'formspec.studio.templates.v1';

interface StoredTemplate {
  id: string;
  name: string;
  description?: string;
  savedAt: string;
  document: StudioTemplateDocument;
}

export interface ImportExportPanelProps {
  project: Signal<ProjectState>;
}

export function ImportExportPanel(props: ImportExportPanelProps) {
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [importText, setImportText] = useState('');
  const [templates, setTemplates] = useState<StoredTemplate[]>(() => readStoredTemplates());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const state = props.project.value;

  const runImport = (payload: unknown) => {
    try {
      const result = importArtifacts(props.project, { payload });
      setError(null);
      setNotice(
        result.kind === 'template' && result.templateName
          ? `Loaded template "${result.templateName}".`
          : `Imported ${result.kind} payload.`
      );
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : String(importError));
      setNotice(null);
    }
  };

  const saveTemplate = () => {
    const normalizedName = templateName.trim();
    if (!normalizedName.length) {
      setError('Template name is required.');
      setNotice(null);
      return;
    }

    const savedAt = new Date().toISOString();
    const document = buildStudioTemplateDocument(state, {
      name: normalizedName,
      description: templateDescription.trim() || undefined,
      createdAt: savedAt
    });

    const normalizedKey = normalizedName.toLowerCase();
    const existing = templates.find((template) => template.name.toLowerCase() === normalizedKey);
    const nextEntry: StoredTemplate = {
      id: existing?.id ?? `${slugify(normalizedName)}-${Date.now()}`,
      name: normalizedName,
      description: templateDescription.trim() || undefined,
      savedAt,
      document
    };

    const withoutExisting = templates.filter((template) => template.id !== existing?.id);
    const nextTemplates = [nextEntry, ...withoutExisting].sort((left, right) =>
      right.savedAt.localeCompare(left.savedAt)
    );
    setTemplates(nextTemplates);
    writeStoredTemplates(nextTemplates);
    setError(null);
    setNotice(`Saved template "${normalizedName}".`);
  };

  const deleteTemplate = (templateId: string) => {
    const nextTemplates = templates.filter((template) => template.id !== templateId);
    setTemplates(nextTemplates);
    writeStoredTemplates(nextTemplates);
    setError(null);
    setNotice('Template deleted.');
  };

  const importFromText = () => {
    if (!importText.trim().length) {
      return;
    }

    try {
      const payload = JSON.parse(importText) as unknown;
      runImport(payload);
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : String(parseError));
      setNotice(null);
    }
  };

  const onFileChange = async (event: Event) => {
    const target = event.currentTarget as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const payload = JSON.parse(await file.text()) as unknown;
      runImport(payload);
      target.value = '';
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : String(parseError));
      setNotice(null);
    }
  };

  return (
    <div class="import-export-panel" data-testid="import-export-panel">
      <p class="inspector-hint">
        Export form artifacts, import JSON bundles or individual artifacts, and save reusable templates.
      </p>

      <div class="import-export-panel__exports" data-testid="import-export-actions">
        <button
          type="button"
          class="import-export-panel__button"
          data-testid="import-export-export-definition"
          onClick={() => {
            downloadJson(state.definition, buildFilename(state.definition.title, 'definition.json'));
          }}
        >
          Export Definition
        </button>
        <button
          type="button"
          class="import-export-panel__button"
          data-testid="import-export-export-component"
          onClick={() => {
            downloadJson(state.component, buildFilename(state.definition.title, 'component.json'));
          }}
        >
          Export Component
        </button>
        <button
          type="button"
          class="import-export-panel__button"
          data-testid="import-export-export-theme"
          onClick={() => {
            downloadJson(state.theme, buildFilename(state.definition.title, 'theme.json'));
          }}
        >
          Export Theme
        </button>
        <button
          type="button"
          class="import-export-panel__button"
          data-testid="import-export-export-mapping"
          onClick={() => {
            downloadJson(state.mapping, buildFilename(state.definition.title, 'mapping.json'));
          }}
        >
          Export Mapping
        </button>
        <button
          type="button"
          class="import-export-panel__button import-export-panel__button--primary"
          data-testid="import-export-export-bundle"
          onClick={() => {
            downloadJson(
              buildStudioBundleDocument(state),
              buildFilename(state.definition.title, 'bundle.json')
            );
          }}
        >
          Export Bundle
        </button>
      </div>

      <label class="inspector-control">
        <span class="inspector-control__label">Import JSON payload</span>
        <textarea
          class="inspector-textarea"
          data-testid="import-export-json-input"
          rows={8}
          value={importText}
          placeholder='{"definition": {...}, "component": {...}, "theme": {...}}'
          onInput={(event) => {
            setImportText((event.currentTarget as HTMLTextAreaElement).value);
          }}
        />
      </label>

      <div class="import-export-panel__row">
        <button
          type="button"
          class="import-export-panel__button import-export-panel__button--primary"
          data-testid="import-export-json-apply"
          onClick={importFromText}
        >
          Import JSON
        </button>
        <label class="import-export-panel__file" data-testid="import-export-file-load">
          <span>Import from file</span>
          <input
            class="import-export-panel__file-input"
            data-testid="import-export-file-input"
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              void onFileChange(event);
            }}
          />
        </label>
      </div>

      <hr class="import-export-panel__divider" />

      <label class="inspector-control">
        <span class="inspector-control__label">Template name</span>
        <input
          class="inspector-input"
          data-testid="template-name-input"
          type="text"
          value={templateName}
          placeholder="Grant intake"
          onInput={(event) => {
            setTemplateName((event.currentTarget as HTMLInputElement).value);
          }}
        />
      </label>

      <label class="inspector-control">
        <span class="inspector-control__label">Template description (optional)</span>
        <input
          class="inspector-input"
          data-testid="template-description-input"
          type="text"
          value={templateDescription}
          placeholder="Reusable starter for grant applications."
          onInput={(event) => {
            setTemplateDescription((event.currentTarget as HTMLInputElement).value);
          }}
        />
      </label>

      <div class="import-export-panel__row">
        <button
          type="button"
          class="import-export-panel__button import-export-panel__button--primary"
          data-testid="template-save-button"
          onClick={saveTemplate}
        >
          Save Template
        </button>
        <button
          type="button"
          class="import-export-panel__button"
          data-testid="template-export-current-button"
          onClick={() => {
            const normalizedName = templateName.trim() || 'template';
            const document = buildStudioTemplateDocument(state, {
              name: normalizedName,
              description: templateDescription.trim() || undefined
            });
            downloadJson(document, buildFilename(normalizedName, 'template.json'));
          }}
        >
          Export Template JSON
        </button>
      </div>

      {templates.length === 0 ? (
        <p class="inspector-hint" data-testid="template-list-empty">No saved templates.</p>
      ) : (
        <ul class="import-export-panel__template-list" data-testid="template-list">
          {templates.map((template, index) => (
            <li class="import-export-panel__template-row" data-testid={`template-row-${index}`} key={template.id}>
              <div class="import-export-panel__template-meta">
                <p class="import-export-panel__template-name">{template.name}</p>
                <p class="import-export-panel__template-date">{template.savedAt}</p>
              </div>
              <div class="import-export-panel__template-actions">
                <button
                  type="button"
                  class="import-export-panel__button"
                  data-testid={`template-load-button-${index}`}
                  onClick={() => {
                    runImport(template.document);
                  }}
                >
                  Load
                </button>
                <button
                  type="button"
                  class="import-export-panel__button"
                  data-testid={`template-export-button-${index}`}
                  onClick={() => {
                    downloadJson(template.document, buildFilename(template.name, 'template.json'));
                  }}
                >
                  Export
                </button>
                <button
                  type="button"
                  class="import-export-panel__button"
                  data-testid={`template-delete-button-${index}`}
                  onClick={() => {
                    deleteTemplate(template.id);
                  }}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {notice ? (
        <p class="import-export-panel__notice" data-testid="import-export-notice">
          {notice}
        </p>
      ) : null}

      {error ? (
        <p class="import-export-panel__error" data-testid="import-export-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function readStoredTemplates(): StoredTemplate[] {
  if (!canUseStorage()) {
    return [];
  }

  const raw = window.localStorage.getItem(TEMPLATE_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isStoredTemplateLike) as StoredTemplate[];
  } catch {
    return [];
  }
}

function writeStoredTemplates(templates: StoredTemplate[]): void {
  if (!canUseStorage()) {
    return;
  }
  window.localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
}

function isStoredTemplateLike(value: unknown): value is StoredTemplate {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.savedAt === 'string' &&
    isRecord(value.document) &&
    value.document.$formspecStudioTemplate === '1.0'
  );
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'template'
  );
}

function buildFilename(base: string | undefined, suffix: string): string {
  const normalizedBase = slugify(base ?? 'form');
  return `${normalizedBase}-${suffix}`;
}

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function downloadJson(payload: unknown, filename: string): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return;
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
}
