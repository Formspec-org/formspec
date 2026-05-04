/** @filedesc Rich FEL expression editor with syntax highlighting, field/function autocomplete, and validation. */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  size,
} from '@floating-ui/react';
import {
  buildFELHighlightTokens,
  validateFEL,
  type FELAutocompleteTrigger,
} from '@formspec-org/studio-core';
import { useOptionalDefinition } from '../../state/useDefinition';
import { useFELAutocomplete, type AutocompleteOption } from '../../hooks/useFELAutocomplete';
import { dispatchStudioEvent, STUDIO_EVENTS } from '../../studio-events';
import { FELHighlightOverlay } from './FELHighlightOverlay';
import { FELAutocompleteMenu } from './FELAutocompleteMenu';

interface FELEditorProps {
  value: string;
  onSave: (newValue: string) => void;
  onCancel?: () => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  /** Type of expression being edited — determines if rendering-only callout should appear. */
  expressionType?: 'when' | 'calculate' | 'default';
  /** For 'when' expressions: the item key being configured, to enable Editor navigation. */
  itemKey?: string;
}

export function FELEditor({ value, onSave, onCancel, placeholder, className, autoFocus, expressionType, itemKey }: FELEditorProps) {
  const definition = useOptionalDefinition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState(value);
  const draftRef = useRef(value);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  draftRef.current = draft;

  const {
    autocomplete,
    autocompleteOptions,
    activeOptionIndex,
    setActiveOptionIndex,
    openAutocomplete,
    closeAutocomplete,
    functionSignatures,
  } = useFELAutocomplete(definition);

  function navigateToEditor() {
    if (itemKey) {
      dispatchStudioEvent(STUDIO_EVENTS.NAVIGATE_WORKSPACE, {
        tab: 'Editor', view: 'bindings', section: itemKey,
      });
    }
  }

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    };
  }, []);

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = 'auto';
    el.style.height = Math.max(36, el.scrollHeight) + 'px';
  }

  useLayoutEffect(() => {
    if (autoFocus && textareaRef.current) {
      autoResize(textareaRef.current);
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  const { refs, floatingStyles, isPositioned } = useFloating({
    open: !!autocomplete,
    onOpenChange: (open) => { if (!open) closeAutocomplete(); },
    placement: 'bottom-start',
    middleware: [
      offset(4), flip(), shift(),
      size({
        apply({ availableHeight, elements }) {
          Object.assign(elements.floating.style, {
            maxHeight: `${Math.min(availableHeight, 300)}px`,
          });
        },
      }),
    ],
    whileElementsMounted: autoUpdate,
  });

  const makeCaretReference = useCallback((trigger: FELAutocompleteTrigger) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const fontSize = 14;
    const lineHeight = 1.6;
    const padding = 8;
    const lines = textarea.value.slice(0, trigger.start).split('\n');
    const lineIndex = lines.length - 1;
    const charIndex = lines[lineIndex].length;
    const top = lineIndex * fontSize * lineHeight + padding;
    const left = charIndex * (fontSize * 0.6) + padding;
    refs.setReference({
      getBoundingClientRect: () => {
        const rect = textarea.getBoundingClientRect();
        return {
          x: rect.left + left, y: rect.top + top, top: rect.top + top,
          left: rect.left + left, right: rect.left + left,
          bottom: rect.top + top + fontSize * lineHeight,
          width: 0, height: fontSize * lineHeight,
        };
      },
    });
  }, [refs]);

  useLayoutEffect(() => {
    if (autocomplete) makeCaretReference(autocomplete);
  }, [autocomplete, makeCaretReference]);

  const applyAutocomplete = (option: AutocompleteOption) => {
    if (!autocomplete) return;
    let nextValue = draft;
    let cursor = autocomplete.start;

    if (option.kind === 'path') {
      const insertionPrefix = autocomplete.insertionPrefix ?? '$';
      nextValue = `${draft.slice(0, autocomplete.start)}${insertionPrefix}${option.path}${draft.slice(autocomplete.end)}`;
      cursor = autocomplete.start + insertionPrefix.length + option.path.length;
    } else if (option.kind === 'instanceName') {
      const insertionSuffix = autocomplete.insertionSuffix ?? '';
      nextValue = `${draft.slice(0, autocomplete.start)}${option.name}${insertionSuffix}${draft.slice(autocomplete.end)}`;
      cursor = autocomplete.start + option.name.length + insertionSuffix.length;
    } else {
      const suffix = draft.slice(autocomplete.end);
      const hasRoundOpen = suffix.startsWith('(');
      nextValue = hasRoundOpen
        ? `${draft.slice(0, autocomplete.start)}${option.name}${suffix}`
        : `${draft.slice(0, autocomplete.start)}${option.name}()${suffix}`;
      cursor = autocomplete.start + option.name.length + (hasRoundOpen ? 1 : 1);
    }

    setDraft(nextValue);
    closeAutocomplete();

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(cursor, cursor);
        autoResize(textareaRef.current);
      }
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (autocomplete && autocompleteOptions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveOptionIndex(curr => Math.min(curr + 1, autocompleteOptions.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveOptionIndex(curr => Math.max(curr - 1, 0));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        applyAutocomplete(autocompleteOptions[activeOptionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        closeAutocomplete();
        return;
      }
    }

    if (e.key === 'Escape') {
      onCancel?.();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      onSave(draft);
    }
  };

  const highlightTokens = useMemo(() => buildFELHighlightTokens(draft, functionSignatures), [draft, functionSignatures]);
  const syntaxError = useMemo(() => validateFEL(draft), [draft]);

  return (
    <div className={`relative flex gap-2 ${className ?? ''}`}>
      <div className="w-4 shrink-0 pt-2 flex flex-col items-center gap-1">
        {syntaxError ? (
          <div className="w-2 h-2 rounded-full bg-error animate-pulse" title={syntaxError} />
        ) : (
          <div className="w-1.5 h-1.5 rounded-full bg-accent/20" />
        )}
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        {expressionType === 'when' && (
          <div data-testid="when-rendering-callout" className="mb-2 px-2 py-1.5 bg-info/10 border border-info/20 rounded-[4px] text-[11px] text-info flex items-start justify-between gap-2">
            <div>
              <strong>Rendering visibility only.</strong> This condition controls whether the field is shown. Use the <strong>"relevant"</strong> binding in the Editor workspace to include/exclude data.
            </div>
            {itemKey && (
              <button type="button" data-testid="when-configure-in-editor" onClick={navigateToEditor} className="shrink-0 ml-2 font-semibold text-info hover:text-info/80 transition-colors focus-ring whitespace-nowrap">
                Configure in Editor →
              </button>
            )}
          </div>
        )}
        <div className="relative" data-fel-editor-root>
          <FELHighlightOverlay tokens={highlightTokens} placeholder={placeholder} />
          <textarea
            ref={textareaRef}
            value={draft}
            placeholder={placeholder}
            spellCheck={false}
            onChange={(e) => {
              const val = e.target.value;
              setDraft(val);
              autoResize(e.target);
              openAutocomplete(val, e.target.selectionStart);
            }}
            onKeyDown={handleKeyDown}
            onBlur={(e) => {
              const container = e.currentTarget.closest('[data-fel-editor-root]');
              const next = e.relatedTarget as Node | null;
              if (container && next && container.contains(next)) return;
              if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
              blurTimeoutRef.current = setTimeout(() => {
                closeAutocomplete();
                onSave(draftRef.current);
              }, 150);
            }}
            style={{ caretColor: 'var(--studio-color-ink)' }}
            className={`w-full font-mono text-[14px] text-transparent border rounded-[4px] px-2 py-1.5 resize-none overflow-hidden outline-none transition-all leading-relaxed relative z-10 block min-h-[36px] ${
              syntaxError ? 'border-error bg-error/5' : 'bg-transparent border-border/80 focus:border-accent/40 focus:bg-surface/50'
            }`}
            rows={1}
          />
        </div>

        {syntaxError && (
          <div className="text-[10px] text-error leading-tight mt-0.5 px-1 truncate" title={syntaxError}>
            {syntaxError}
          </div>
        )}

        {!syntaxError && (
          <div className="text-[10px] text-muted mt-0.5 px-1 select-none">
            <kbd className="font-mono">&#8984;&#9166;</kbd> save &middot; <kbd className="font-mono">Esc</kbd> cancel
          </div>
        )}

        <FELAutocompleteMenu
          options={autocompleteOptions}
          activeIndex={activeOptionIndex}
          onSelect={applyAutocomplete}
          onHover={setActiveOptionIndex}
          refs={refs}
          floatingStyles={floatingStyles}
          isPositioned={isPositioned}
        />
      </div>
    </div>
  );
}
