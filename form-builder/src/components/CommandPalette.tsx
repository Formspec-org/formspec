import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { searchCommands, type StudioCommand } from './commands';

export interface CommandPaletteProps {
  open: boolean;
  commands: StudioCommand[];
  onClose: () => void;
}

export function CommandPalette(props: CommandPaletteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const results = useMemo(() => searchCommands(props.commands, query), [props.commands, query]);

  useEffect(() => {
    if (!props.open) {
      return;
    }
    setQuery('');
    setActiveIndex(0);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, [props.open]);

  useEffect(() => {
    setActiveIndex((current) => clamp(current, 0, Math.max(0, results.length - 1)));
  }, [results.length]);

  if (!props.open) {
    return null;
  }

  const executeCommand = (command: StudioCommand | undefined) => {
    if (!command) {
      return;
    }
    command.run();
    props.onClose();
  };

  return (
    <div
      class="command-palette-overlay"
      data-testid="command-palette"
      onMouseDown={() => {
        props.onClose();
      }}
    >
      <div
        class="command-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onMouseDown={(event) => {
          event.stopPropagation();
        }}
      >
        <input
          ref={inputRef}
          type="text"
          class="command-palette__input"
          data-testid="command-palette-input"
          placeholder="Type a command..."
          value={query}
          onInput={(event) => {
            setQuery((event.currentTarget as HTMLInputElement).value);
            setActiveIndex(0);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActiveIndex((current) => clamp(current + 1, 0, Math.max(0, results.length - 1)));
              return;
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActiveIndex((current) => clamp(current - 1, 0, Math.max(0, results.length - 1)));
              return;
            }
            if (event.key === 'Enter') {
              event.preventDefault();
              executeCommand(results[activeIndex]?.command ?? results[0]?.command);
              return;
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              props.onClose();
            }
          }}
        />

        <ul class="command-palette__results" data-testid="command-palette-results">
          {results.length > 0 ? (
            results.map((result, index) => (
              <li key={result.command.id}>
                <button
                  type="button"
                  class={`command-palette__result${index === activeIndex ? ' is-active' : ''}`}
                  data-testid={`command-result-${result.command.id}`}
                  onMouseEnter={() => {
                    setActiveIndex(index);
                  }}
                  onClick={() => {
                    executeCommand(result.command);
                  }}
                >
                  <span class="command-palette__result-main">
                    <span class="command-palette__result-title">{result.command.title}</span>
                    {result.command.subtitle ? (
                      <span class="command-palette__result-subtitle">{result.command.subtitle}</span>
                    ) : null}
                  </span>
                  <span class="command-palette__result-category">{result.command.category}</span>
                </button>
              </li>
            ))
          ) : (
            <li class="command-palette__empty" data-testid="command-palette-empty">
              No commands found.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
