import { useMemo, useRef, useState } from 'preact/hooks';
import {
  buildFELHighlightTokens,
  FELEditorFunctionOption,
  FELEditorFieldOption,
  filterFELFunctionOptions,
  filterFELFieldOptions,
  getFELAutocompleteTrigger,
  getFELFunctionAutocompleteTrigger,
  validateFEL
} from './fel-utils';
import { buildExtensionCatalog } from '../../state/extensions';
import { projectSignal } from '../../state/project';

export interface FELEditorProps {
  label: string;
  value: string | undefined;
  placeholder?: string;
  testId?: string;
  error?: string | null;
  fieldOptions?: FELEditorFieldOption[];
  functionOptions?: FELEditorFunctionOption[];
  onInput: (value: string) => void;
}

interface AutocompleteState {
  kind: 'path' | 'function';
  start: number;
  end: number;
  query: string;
}

type AutocompleteOption =
  | {
      kind: 'path';
      path: string;
      label: string;
    }
  | {
      kind: 'function';
      name: string;
      label: string;
      signature?: string;
    };

export function FELEditor(props: FELEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [activeOptionIndex, setActiveOptionIndex] = useState(0);
  const [autocomplete, setAutocomplete] = useState<AutocompleteState | null>(null);

  const value = props.value ?? '';
  const options = props.fieldOptions ?? [];
  const extensionCatalog = buildExtensionCatalog(projectSignal.value.extensions.registries);
  const extensionFunctionOptions: FELEditorFunctionOption[] = extensionCatalog.functions.map((entry) => ({
    name: entry.felName,
    label: `${entry.label} (${entry.name})`,
    signature: entry.signature
  }));
  const functionOptions = mergeFunctionOptions(props.functionOptions ?? [], extensionFunctionOptions);
  const functionSignatures = useMemo(
    () => Object.fromEntries(functionOptions.map((option) => [option.name, option.signature ?? `${option.name}(...)`])),
    [functionOptions]
  );

  const syntaxError = useMemo(() => validateFEL(value), [value]);
  const displayError = props.error ?? syntaxError;

  const highlightTokens = useMemo(
    () => buildFELHighlightTokens(value, functionSignatures),
    [value, functionSignatures]
  );

  const autocompleteOptions = useMemo(() => {
    if (!autocomplete) {
      return [];
    }

    if (autocomplete.kind === 'path') {
      return filterFELFieldOptions(options, autocomplete.query).map((option) => ({
        kind: 'path' as const,
        path: option.path,
        label: option.label
      }));
    }

    return filterFELFunctionOptions(functionOptions, autocomplete.query).map((option) => ({
      kind: 'function' as const,
      name: option.name,
      label: option.label,
      signature: option.signature
    }));
  }, [autocomplete, options, functionOptions]);

  const openAutocomplete = (nextValue: string, caret: number) => {
    if (options.length) {
      const pathTrigger = getFELAutocompleteTrigger(nextValue, caret);
      if (pathTrigger) {
        setAutocomplete({
          kind: 'path',
          ...pathTrigger
        });
        setActiveOptionIndex(0);
        return;
      }
    }

    if (functionOptions.length) {
      const functionTrigger = getFELFunctionAutocompleteTrigger(nextValue, caret);
      if (functionTrigger) {
        setAutocomplete({
          kind: 'function',
          ...functionTrigger
        });
        setActiveOptionIndex(0);
        return;
      }
    }

    setAutocomplete(null);
  };

  const applyAutocomplete = (option: AutocompleteOption) => {
    if (!autocomplete) {
      return;
    }

    let nextValue = value;
    let cursor = autocomplete.start;

    if (option.kind === 'path') {
      nextValue = `${value.slice(0, autocomplete.start)}$${option.path}${value.slice(autocomplete.end)}`;
      cursor = autocomplete.start + option.path.length + 1;
    } else {
      const suffix = value.slice(autocomplete.end);
      const hasRoundOpen = suffix.startsWith('(');
      nextValue = hasRoundOpen
        ? `${value.slice(0, autocomplete.start)}${option.name}${suffix}`
        : `${value.slice(0, autocomplete.start)}${option.name}()${suffix}`;
      cursor = autocomplete.start + option.name.length + (hasRoundOpen ? 1 : 1);
    }

    props.onInput(nextValue);
    setAutocomplete(null);

    queueMicrotask(() => {
      const textarea = textareaRef.current;
      if (!textarea) {
        return;
      }

      textarea.focus();
      textarea.setSelectionRange(cursor, cursor);
    });
  };

  return (
    <label class="inspector-control">
      <span class="inspector-control__label">{props.label}</span>
      <div class="fel-editor" data-testid={`${props.testId}-container`}>
        <textarea
          ref={textareaRef}
          class={`inspector-input inspector-input--fel ${displayError ? 'is-invalid' : ''}`}
          data-testid={props.testId}
          value={value}
          placeholder={props.placeholder ?? 'Enter FEL expression'}
          spellcheck={false}
          onInput={(event) => {
            const target = event.currentTarget as HTMLTextAreaElement;
            const nextValue = target.value;
            props.onInput(nextValue);
            openAutocomplete(nextValue, target.selectionStart ?? nextValue.length);
          }}
          onKeyDown={(event) => {
            if (!autocomplete || !autocompleteOptions.length) {
              return;
            }

            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActiveOptionIndex((current) => Math.min(current + 1, autocompleteOptions.length - 1));
              return;
            }

            if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActiveOptionIndex((current) => Math.max(current - 1, 0));
              return;
            }

            if (event.key === 'Enter' || event.key === 'Tab') {
              event.preventDefault();
              applyAutocomplete(autocompleteOptions[activeOptionIndex]);
              return;
            }

            if (event.key === 'Escape') {
              event.preventDefault();
              setAutocomplete(null);
            }
          }}
          onClick={(event) => {
            const target = event.currentTarget as HTMLTextAreaElement;
            openAutocomplete(target.value, target.selectionStart ?? target.value.length);
          }}
        />

        {autocompleteOptions.length ? (
          <ul class="fel-editor__autocomplete" data-testid="fel-autocomplete">
            {autocompleteOptions.map((option, index) => (
              <li
                key={
                  option.kind === 'path'
                    ? `path-${option.path}`
                    : `function-${option.name}`
                }
              >
                <button
                  type="button"
                  class={`fel-editor__autocomplete-option ${activeOptionIndex === index ? 'is-active' : ''}`}
                  data-testid={`fel-autocomplete-option-${index}`}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    applyAutocomplete(option);
                  }}
                >
                  {option.kind === 'path' ? (
                    <>
                      <span class="fel-editor__autocomplete-path">${option.path}</span>
                      <span class="fel-editor__autocomplete-label">{option.label}</span>
                    </>
                  ) : (
                    <>
                      <span class="fel-editor__autocomplete-path">{option.name}()</span>
                      <span class="fel-editor__autocomplete-label">
                        {option.label}
                        {option.signature ? ` — ${option.signature}` : ''}
                      </span>
                    </>
                  )}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <pre class="fel-editor__highlight" data-testid="fel-highlight" aria-hidden="true">
        {highlightTokens.length
          ? highlightTokens.map((token) => {
              if (token.kind === 'function') {
                return (
                  <span
                    key={token.key}
                    class={`fel-token fel-token--${token.kind}`}
                    title={token.signature}
                    data-testid={`fel-token-function-${token.functionName}`}
                  >
                    {token.text}
                  </span>
                );
              }

              if (token.kind === 'plain') {
                return <span key={token.key}>{token.text}</span>;
              }

              return (
                <span key={token.key} class={`fel-token fel-token--${token.kind}`}>
                  {token.text}
                </span>
              );
            })
          : null}
      </pre>

      {displayError ? (
        <span class="inspector-control__error" data-testid="fel-validation-error">
          {displayError}
        </span>
      ) : null}
    </label>
  );
}

function mergeFunctionOptions(
  explicitOptions: FELEditorFunctionOption[],
  extensionOptions: FELEditorFunctionOption[]
): FELEditorFunctionOption[] {
  const merged = new Map<string, FELEditorFunctionOption>();

  for (const option of extensionOptions) {
    merged.set(option.name, option);
  }

  for (const option of explicitOptions) {
    merged.set(option.name, option);
  }

  return [...merged.values()].sort((left, right) => left.name.localeCompare(right.name));
}
