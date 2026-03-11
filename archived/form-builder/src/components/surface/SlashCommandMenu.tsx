import type { JSX } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { filterTemplates, type FieldTemplate } from './field-templates';

interface SlashCommandMenuProps {
  open: boolean;
  query: string;
  templates: FieldTemplate[];
  top: number;
  left: number;
  onQueryChange: (value: string) => void;
  onSelect: (template: FieldTemplate) => void;
  onClose: () => void;
}

export function SlashCommandMenu(props: SlashCommandMenuProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const activeIndexRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const results = useMemo(() => filterTemplates(props.query, props.templates), [props.query, props.templates]);

  useEffect(() => {
    if (!props.open) {
      return;
    }
    inputRef.current?.focus();
  }, [props.open]);

  useEffect(() => {
    setActiveIndex(0);
    activeIndexRef.current = 0;
  }, [props.query, props.open]);

  useEffect(() => {
    if (activeIndex < results.length) {
      return;
    }
    const nextIndex = results.length === 0 ? 0 : results.length - 1;
    setActiveIndex(nextIndex);
    activeIndexRef.current = nextIndex;
  }, [activeIndex, results.length]);

  if (!props.open) {
    return null;
  }

  const onKeyDown = (event: JSX.TargetedKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      props.onClose();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!results.length) {
        return;
      }
      setActiveIndex((current) => {
        const next = (current + 1) % results.length;
        activeIndexRef.current = next;
        return next;
      });
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!results.length) {
        return;
      }
      setActiveIndex((current) => {
        const next = (current - 1 + results.length) % results.length;
        activeIndexRef.current = next;
        return next;
      });
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      if (!results.length) {
        return;
      }
      props.onSelect(results[activeIndexRef.current] ?? results[0]);
    }
  };

  return (
    <div
      class="slash-menu"
      data-testid="slash-command-menu"
      style={{
        top: `${props.top}px`,
        left: `${props.left}px`
      }}
      onClick={(event) => {
        event.stopPropagation();
      }}
    >
      <input
        ref={inputRef}
        type="text"
        class="slash-menu__search"
        data-testid="slash-command-search"
        value={props.query}
        placeholder="Search fields, groups, and display blocks"
        onClick={(event) => {
          event.stopPropagation();
        }}
        onInput={(event) => {
          props.onQueryChange((event.currentTarget as HTMLInputElement).value);
        }}
        onKeyDown={onKeyDown}
      />

      <ul class="slash-menu__results" role="listbox" aria-label="Insertion templates">
        {results.length ? (
          results.map((template, index) => (
            <li key={template.id}>
              <button
                type="button"
                class={`slash-menu__option${index === activeIndex ? ' is-active' : ''}`}
                data-testid={`slash-template-${template.id}`}
                onMouseEnter={() => {
                  setActiveIndex(index);
                  activeIndexRef.current = index;
                }}
                onClick={() => {
                  props.onSelect(template);
                }}
              >
                <span class="slash-menu__option-name">{template.name}</span>
                <span class="slash-menu__option-meta">{template.category}</span>
              </button>
            </li>
          ))
        ) : (
          <li class="slash-menu__empty" data-testid="slash-command-empty">
            No matches found.
          </li>
        )}
      </ul>
    </div>
  );
}
