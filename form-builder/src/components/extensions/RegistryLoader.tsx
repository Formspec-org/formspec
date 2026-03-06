import { useState } from 'preact/hooks';

interface RegistryLoaderProps {
  onLoad: (payload: unknown, sourceType: 'url' | 'file', sourceLabel: string) => Promise<void> | void;
}

export function RegistryLoader(props: RegistryLoaderProps) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      const payload = await response.json();
      await props.onLoad(payload, 'url', normalizedUrl);
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
      const content = await file.text();
      const payload = JSON.parse(content) as unknown;
      await props.onLoad(payload, 'file', file.name);
      target.value = '';
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="registry-loader" data-testid="registry-loader">
      <label class="inspector-control">
        <span class="inspector-control__label">Registry URL</span>
        <div class="registry-loader__row">
          <input
            class="inspector-input"
            data-testid="extension-registry-url-input"
            type="url"
            placeholder="https://example.org/formspec/registry.json"
            value={url}
            onInput={(event) => {
              setUrl((event.currentTarget as HTMLInputElement).value);
            }}
          />
          <button
            type="button"
            class="registry-loader__button"
            data-testid="extension-registry-url-load"
            disabled={loading || !url.trim().length}
            onClick={() => {
              void loadFromUrl();
            }}
          >
            {loading ? 'Loading...' : 'Load URL'}
          </button>
        </div>
      </label>

      <label class="registry-loader__file" data-testid="extension-registry-file-load">
        <span>Load registry file</span>
        <input
          class="registry-loader__file-input"
          data-testid="extension-registry-file-input"
          type="file"
          accept="application/json,.json"
          onChange={(event) => {
            void onFileChange(event);
          }}
        />
      </label>

      {error ? (
        <p class="registry-loader__error" data-testid="extension-registry-loader-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
