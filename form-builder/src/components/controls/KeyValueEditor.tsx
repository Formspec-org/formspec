import { useState } from 'preact/hooks';

interface KeyValueEditorProps {
  label: string;
  value: Record<string, string | number> | undefined;
  testId?: string;
  valuePlaceholder?: string;
  onInput: (value: Record<string, string | number> | undefined) => void;
}

export function KeyValueEditor(props: KeyValueEditorProps) {
  const entries = Object.entries(props.value ?? {});
  const [draftKey, setDraftKey] = useState('');
  const [draftValue, setDraftValue] = useState('');
  const canAdd = draftKey.trim().length > 0;

  const update = (newEntries: Array<[string, string | number]>) => {
    const next: Record<string, string | number> = Object.fromEntries(newEntries);
    props.onInput(Object.keys(next).length > 0 ? next : undefined);
  };

  const remove = (key: string) => {
    update(entries.filter(([k]) => k !== key));
  };

  const edit = (key: string, newValue: string) => {
    const coerced = newValue.trim() !== '' && !Number.isNaN(Number(newValue)) ? Number(newValue) : newValue;
    update(entries.map(([k, v]) => (k === key ? [k, coerced] : [k, v])));
  };

  return (
    <div class="kv-editor" data-testid={props.testId}>
      <span class="inspector-control__label">{props.label}</span>

      {entries.length === 0 ? (
        <p class="inspector-hint kv-editor__empty">No entries. Add a key below.</p>
      ) : (
        <ul class="kv-editor__list">
          {entries.map(([key, val]) => (
            <li key={key} class="kv-editor__row">
              <span class="kv-editor__key" title={key}>{key}</span>
              <input
                class="inspector-input kv-editor__value"
                type="text"
                value={String(val)}
                data-testid={props.testId ? `${props.testId}-val-${key}` : undefined}
                onInput={(event) => {
                  edit(key, (event.currentTarget as HTMLInputElement).value);
                }}
              />
              <button
                type="button"
                class="kv-editor__remove"
                data-testid={props.testId ? `${props.testId}-remove-${key}` : undefined}
                title={`Remove ${key}`}
                onClick={() => remove(key)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div class="kv-editor__add-row">
        <input
          class="inspector-input kv-editor__key-input"
          type="text"
          value={draftKey}
          placeholder="key"
          data-testid={props.testId ? `${props.testId}-key-input` : undefined}
          onInput={(event) => {
            setDraftKey((event.currentTarget as HTMLInputElement).value);
          }}
        />
        <input
          class="inspector-input kv-editor__value-input"
          type="text"
          value={draftValue}
          placeholder={props.valuePlaceholder ?? 'value'}
          data-testid={props.testId ? `${props.testId}-value-input` : undefined}
          onInput={(event) => {
            setDraftValue((event.currentTarget as HTMLInputElement).value);
          }}
        />
        <button
          type="button"
          class="kv-editor__add-button"
          data-testid={props.testId ? `${props.testId}-add-button` : undefined}
          disabled={!canAdd}
          onClick={() => {
            if (!canAdd) return;
            const coerced = draftValue.trim() !== '' && !Number.isNaN(Number(draftValue)) ? Number(draftValue) : draftValue;
            update([...entries, [draftKey.trim(), coerced]]);
            setDraftKey('');
            setDraftValue('');
          }}
        >
          +
        </button>
      </div>
    </div>
  );
}