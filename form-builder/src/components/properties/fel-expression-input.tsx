import type { FormspecItem } from 'formspec-engine';
import { useMemo, useRef, useState } from 'preact/hooks';
import { definition, definitionVersion } from '../../state/definition';
import felFunctionsSchema from '../../../../schemas/fel-functions.schema.json';

type TriggerKind = '$' | '@';

type Suggestion = {
  key: string;
  text: string;
  detail?: string;
  insertText: string;
  caretOffset?: number;
};

type TriggerMatch = {
  trigger: TriggerKind;
  start: number;
  end: number;
  query: string;
};

const MAX_SUGGESTIONS = 10;
const tokenCharPattern = /[A-Za-z0-9_$@.[\]]/;

function collectItemKeys(items: FormspecItem[], keys = new Set<string>()): Set<string> {
  for (const item of items) {
    keys.add(item.key);
    if (item.children?.length) {
      collectItemKeys(item.children, keys);
    }
  }
  return keys;
}

function readTriggerToken(text: string, caret: number): TriggerMatch | null {
  let start = caret;
  while (start > 0 && tokenCharPattern.test(text[start - 1])) {
    start -= 1;
  }

  let end = caret;
  while (end < text.length && tokenCharPattern.test(text[end])) {
    end += 1;
  }

  const token = text.slice(start, caret);
  if (!token) return null;
  const trigger = token[0];
  if (trigger !== '$' && trigger !== '@') return null;

  return {
    trigger,
    start,
    end,
    query: token.slice(1).toLowerCase(),
  };
}

export function FelExpressionInput({
  value,
  placeholder,
  onValueChange,
  className = 'studio-input studio-input-mono',
}: {
  value: string;
  placeholder?: string;
  onValueChange: (value: string) => void;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [match, setMatch] = useState<TriggerMatch | null>(null);
  const version = definitionVersion.value;

  const itemKeys = useMemo(
    () => Array.from(collectItemKeys(definition.value.items)).sort((a, b) => a.localeCompare(b)),
    [version],
  );

  const variableSuggestions = useMemo(() => {
    const base = ['$', '$index', '$parent'];
    return Array.from(new Set([...base, ...itemKeys.map((key) => `$${key}`)]));
  }, [itemKeys]);

  const functionSuggestions = useMemo(() => {
    const funcs = felFunctionsSchema.functions
      .map((fn) => ({
        key: `fn-${fn.name}`,
        text: `@${fn.name}`,
        detail: fn.description,
        insertText: `${fn.name}()`,
        caretOffset: -1,
      }))
      .sort((a, b) => a.text.localeCompare(b.text));
    return [
      { key: 'symbol-current', text: '@current', detail: 'Current repeat instance', insertText: '@current' },
      ...funcs,
    ];
  }, []);

  function closeSuggestions() {
    setSuggestions([]);
    setActiveIndex(0);
    setMatch(null);
  }

  function updateSuggestionsForInput(text: string, inputEl: HTMLInputElement) {
    const selectionStart = inputEl.selectionStart ?? text.length;
    const selectionEnd = inputEl.selectionEnd ?? selectionStart;
    if (selectionStart !== selectionEnd) {
      closeSuggestions();
      return;
    }

    const trigger = readTriggerToken(text, selectionStart);
    if (!trigger) {
      closeSuggestions();
      return;
    }

    if (trigger.trigger === '$') {
      const filtered = variableSuggestions
        .filter((token) => token.slice(1).toLowerCase().includes(trigger.query))
        .map((token) => ({
          key: `var-${token}`,
          text: token,
          insertText: token,
        }))
        .slice(0, MAX_SUGGESTIONS);

      setSuggestions(filtered);
      setActiveIndex(0);
      setMatch(trigger);
      return;
    }

    const filtered = functionSuggestions
      .filter((item) => item.text.slice(1).toLowerCase().includes(trigger.query))
      .slice(0, MAX_SUGGESTIONS);

    setSuggestions(filtered);
    setActiveIndex(0);
    setMatch(trigger);
  }

  function applySuggestion(suggestion: Suggestion) {
    if (!match) return;
    const nextValue = `${value.slice(0, match.start)}${suggestion.insertText}${value.slice(match.end)}`;
    const nextCaret = match.start + suggestion.insertText.length + (suggestion.caretOffset ?? 0);
    onValueChange(nextValue);
    closeSuggestions();

    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(nextCaret, nextCaret);
    });
  }

  function handleInput(event: Event) {
    const inputEl = event.currentTarget as HTMLInputElement;
    const nextValue = inputEl.value;
    onValueChange(nextValue);
    updateSuggestionsForInput(nextValue, inputEl);
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (suggestions.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % suggestions.length);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
      return;
    }

    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      applySuggestion(suggestions[activeIndex]);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      closeSuggestions();
    }
  }

  return (
    <div class="fel-input-wrap">
      <input
        ref={inputRef}
        class={className}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        spellcheck={false}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onBlur={closeSuggestions}
      />
      {suggestions.length > 0 && (
        <div class="fel-autocomplete" role="listbox">
          {suggestions.map((suggestion, index) => (
            <div
              key={suggestion.key}
              role="option"
              aria-selected={index === activeIndex}
              class={`fel-autocomplete-option ${index === activeIndex ? 'active' : ''}`}
              onMouseDown={(event) => {
                event.preventDefault();
                applySuggestion(suggestion);
              }}
            >
              <div class="fel-autocomplete-text">{suggestion.text}</div>
              {suggestion.detail && <div class="fel-autocomplete-detail">{suggestion.detail}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
