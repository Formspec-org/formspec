import type { Signal } from '@preact/signals';
import { useState } from 'preact/hooks';
import { importSubform } from '../../state/mutations';
import type { ProjectState } from '../../state/project';

export interface SubFormImportProps {
  project: Signal<ProjectState>;
}

export function SubFormImport(props: SubFormImportProps) {
  const [url, setUrl] = useState('');
  const [groupKey, setGroupKey] = useState('');
  const [groupLabel, setGroupLabel] = useState('');
  const [keyPrefix, setKeyPrefix] = useState('');
  const [fragment, setFragment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const runImport = (payload: unknown, sourceLabel: string) => {
    importSubform(props.project, {
      payload,
      sourceLabel,
      groupKey: groupKey.trim() || undefined,
      groupLabel: groupLabel.trim() || undefined,
      keyPrefix: keyPrefix.trim() || undefined,
      fragment: fragment.trim() || undefined
    });
  };

  const loadFromUrl = async () => {
    const normalizedUrl = url.trim();
    if (!normalizedUrl.length || loading) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(normalizedUrl, {
        headers: {
          Accept: 'application/json'
        }
      });
      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }

      const payload = (await response.json()) as unknown;
      runImport(payload, normalizedUrl);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoading(false);
    }
  };

  const onFileChange = async (event: Event) => {
    const target = event.currentTarget as HTMLInputElement;
    const file = target.files?.[0];
    if (!file || loading) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload = JSON.parse(await file.text()) as unknown;
      runImport(payload, file.name);
      target.value = '';
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="subform-import" data-testid="subform-import">
      <p class="inspector-hint">
        Import a Definition as a linked group. Formspec Studio resolves <code>$ref</code> using the engine assembler.
      </p>

      <label class="inspector-control">
        <span class="inspector-control__label">Group key</span>
        <input
          class="inspector-input"
          data-testid="subform-group-key-input"
          type="text"
          value={groupKey}
          placeholder="subform"
          onInput={(event) => {
            setGroupKey((event.currentTarget as HTMLInputElement).value);
          }}
        />
      </label>

      <label class="inspector-control">
        <span class="inspector-control__label">Group label</span>
        <input
          class="inspector-input"
          data-testid="subform-group-label-input"
          type="text"
          value={groupLabel}
          placeholder="Imported sub-form"
          onInput={(event) => {
            setGroupLabel((event.currentTarget as HTMLInputElement).value);
          }}
        />
      </label>

      <label class="inspector-control">
        <span class="inspector-control__label">Fragment (optional key)</span>
        <input
          class="inspector-input"
          data-testid="subform-fragment-input"
          type="text"
          value={fragment}
          placeholder="address"
          onInput={(event) => {
            setFragment((event.currentTarget as HTMLInputElement).value);
          }}
        />
      </label>

      <label class="inspector-control">
        <span class="inspector-control__label">Imported key prefix</span>
        <input
          class="inspector-input"
          data-testid="subform-key-prefix-input"
          type="text"
          value={keyPrefix}
          placeholder="subform_"
          onInput={(event) => {
            setKeyPrefix((event.currentTarget as HTMLInputElement).value);
          }}
        />
      </label>

      <label class="inspector-control">
        <span class="inspector-control__label">Definition URL</span>
        <div class="subform-import__row">
          <input
            class="inspector-input"
            data-testid="subform-url-input"
            type="url"
            value={url}
            placeholder="https://example.org/forms/subform.json"
            onInput={(event) => {
              setUrl((event.currentTarget as HTMLInputElement).value);
            }}
          />
          <button
            type="button"
            class="subform-import__button"
            data-testid="subform-url-load"
            disabled={loading || !url.trim().length}
            onClick={() => {
              void loadFromUrl();
            }}
          >
            {loading ? 'Loading...' : 'Import URL'}
          </button>
        </div>
      </label>

      <label class="subform-import__file" data-testid="subform-file-load">
        <span>Import from file</span>
        <input
          class="subform-import__file-input"
          data-testid="subform-file-input"
          type="file"
          accept="application/json,.json"
          onChange={(event) => {
            void onFileChange(event);
          }}
        />
      </label>

      {error ? (
        <p class="subform-import__error" data-testid="subform-import-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
