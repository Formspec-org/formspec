/** @filedesc Rich FEL expression editor with syntax highlighting, field/function autocomplete, and validation. */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  size,
  FloatingPortal,
} from '@floating-ui/react';
import {
  buildFELHighlightTokens,
  filterFELFieldOptions,
  filterFELFunctionOptions,
  getFELAutocompleteTrigger,
  getFELFunctionAutocompleteTrigger,
  getFELInstanceNameAutocompleteTrigger,
  getInstanceFieldOptions,
  getInstanceNameOptions,
  validateFEL,
  flatItems,
  dataTypeInfo,
  type FELAutocompleteTrigger,
  type FELEditorFieldOption,
  type FELEditorFunctionOption,
} from '@formspec-org/studio-core';
import { useOptionalDefinition } from '../../state/useDefinition';
import { getBuiltinFELFunctionCatalog } from '@formspec-org/engine';
import { formatCategoryName } from './FELReferencePopup';

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

type AutocompleteOption =
  | { kind: 'instanceName'; name: string }
  | { kind: 'path'; path: string; label: string; dataType?: string }
  | { kind: 'function'; name: string; label: string; signature?: string; description?: string; category?: string };

export function FELEditor({ value, onSave, onCancel, placeholder, className, autoFocus, expressionType, itemKey }: FELEditorProps) {
  const definition = useOptionalDefinition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState(value);
  const [activeOptionIndex, setActiveOptionIndex] = useState(0);
  const [autocomplete, setAutocomplete] = useState<FELAutocompleteTrigger | null>(null);
  const [autocompleteKind, setAutocompleteKind] = useState<'path' | 'function' | 'instanceName' | null>(null);

  function navigateToEditor() {
    if (itemKey) {
      window.dispatchEvent(new CustomEvent('formspec:navigate-workspace', {
        detail: {
          tab: 'Editor',
          view: 'bindings',
          section: itemKey,
        },
      }));
    }
  }

  // Sync draft with value when not editing
  useEffect(() => {
    setDraft(value);
  }, [value]);

  useLayoutEffect(() => {
    if (autoFocus && textareaRef.current) {
      autoResize(textareaRef.current);
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = 'auto';
    el.style.height = Math.max(36, el.scrollHeight) + 'px';
  }

  // Floating UI for autocomplete menu
  const { refs, floatingStyles, isPositioned } = useFloating({
    open: !!autocomplete,
    onOpenChange: (open) => {
      if (!open) {
        setAutocomplete(null);
        setAutocompleteKind(null);
      }
    },
    placement: 'bottom-start',
    middleware: [
      offset(4),
      flip(),
      shift(),
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

  // Build a virtual reference element anchored to the caret position.
  const makeCaretReference = (trigger: FELAutocompleteTrigger) => {
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
          x: rect.left + left,
          y: rect.top + top,
          top: rect.top + top,
          left: rect.left + left,
          right: rect.left + left,
          bottom: rect.top + top + fontSize * lineHeight,
          width: 0,
          height: fontSize * lineHeight,
        };
      },
    });
  };

  // Sync reference position before paint so the portal never appears at (0,0).
  useLayoutEffect(() => {
    if (autocomplete) makeCaretReference(autocomplete);
  }, [autocomplete]);

  // Options memoization
  const fieldOptions = useMemo(() => {
    if (!definition) return [];
    return flatItems(definition.items || []).map(fi => ({
      path: fi.path,
      label: fi.item.label || fi.path,
      dataType: fi.item.dataType
    }));
  }, [definition]);

  const functionOptions = useMemo(() => {
    return getBuiltinFELFunctionCatalog().map(entry => ({
      name: entry.name,
      label: entry.name,
      signature: entry.signature ?? '',
      description: entry.description ?? '',
      category: formatCategoryName(entry.category),
    }));
  }, []);

  const functionSignatures = useMemo(() => {
    return Object.fromEntries(functionOptions.map(opt => [opt.name, opt.signature || '']));
  }, [functionOptions]);

  const autocompleteOptions = useMemo(() => {
    if (!autocomplete || !autocompleteKind) return [];

    if (autocompleteKind === 'path') {
      const options = autocomplete.instanceName
        ? getInstanceFieldOptions(definition?.instances, autocomplete.instanceName)
        : fieldOptions;

      return filterFELFieldOptions(options, autocomplete.query).map(opt => ({
        kind: 'path' as const,
        path: opt.path,
        label: opt.label,
        dataType: opt.dataType
      }));
    }

    if (autocompleteKind === 'instanceName') {
      return getInstanceNameOptions(definition?.instances, autocomplete.query).map(name => ({
        kind: 'instanceName' as const,
        name
      }));
    }

    return filterFELFunctionOptions(functionOptions, autocomplete.query).map(opt => ({
      kind: 'function' as const,
      name: opt.name,
      label: opt.label,
      signature: opt.signature,
      description: opt.description,
      category: opt.category
    }));
  }, [autocomplete, autocompleteKind, fieldOptions, functionOptions, definition]);

  const openAutocomplete = (nextValue: string, caret: number) => {
    const pathTrigger = getFELAutocompleteTrigger(nextValue, caret);
    if (pathTrigger) {
      makeCaretReference(pathTrigger);
      setAutocomplete(pathTrigger);
      setAutocompleteKind('path');
      setActiveOptionIndex(0);
      return;
    }

    const instanceNameTrigger = getFELInstanceNameAutocompleteTrigger(nextValue, caret);
    if (instanceNameTrigger) {
      makeCaretReference(instanceNameTrigger);
      setAutocomplete(instanceNameTrigger);
      setAutocompleteKind('instanceName');
      setActiveOptionIndex(0);
      return;
    }

    const functionTrigger = getFELFunctionAutocompleteTrigger(nextValue, caret);
    if (functionTrigger) {
      makeCaretReference(functionTrigger);
      setAutocomplete(functionTrigger);
      setAutocompleteKind('function');
      setActiveOptionIndex(0);
      return;
    }

    setAutocomplete(null);
    setAutocompleteKind(null);
  };

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
    setAutocomplete(null);
    setAutocompleteKind(null);

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
        setAutocomplete(null);
        setAutocompleteKind(null);
        return;
      }
    }

    if (e.key === 'Escape') {
      onCancel?.();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      onSave(draft);
    }
  };

  const highlightTokens = useMemo(() => {
    return buildFELHighlightTokens(draft, functionSignatures);
  }, [draft, functionSignatures]);

  const syntaxError = useMemo(() => validateFEL(draft), [draft]);
  const activeOption = autocompleteOptions[activeOptionIndex];

  return (
    <div className={`relative flex gap-2 ${className ?? ''}`}>
      {/* Gutter / Error Indicator */}
      <div className="w-4 shrink-0 pt-2 flex flex-col items-center gap-1">
        {syntaxError ? (
          <div className="w-2 h-2 rounded-full bg-error animate-pulse" title={syntaxError} />
        ) : (
          <div className="w-1.5 h-1.5 rounded-full bg-accent/20" />
        )}
      </div>

      <div className={`flex-1 flex flex-col min-w-0`}>
        {expressionType === 'when' && (
          <div
            data-testid="when-rendering-callout"
            className="mb-2 px-2 py-1.5 bg-info/10 border border-info/20 rounded-[4px] text-[11px] text-info flex items-start justify-between gap-2"
          >
            <div>
              <strong>Rendering visibility only.</strong> This condition controls whether the field is shown. Use the <strong>"relevant"</strong> binding in the Editor workspace to include/exclude data.
            </div>
            {itemKey && (
              <button
                type="button"
                data-testid="when-configure-in-editor"
                onClick={navigateToEditor}
                className="shrink-0 ml-2 font-semibold text-info hover:text-info/80 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-info/50 whitespace-nowrap"
              >
                Configure in Editor →
              </button>
            )}
          </div>
        )}
        <div className="relative">
          {/* Highlighting Overlay */}
          <div 
            className="absolute inset-0 z-20 pointer-events-none font-mono text-[14px] px-2 py-1.5 whitespace-pre-wrap break-all select-none overflow-hidden leading-relaxed"
            aria-hidden="true"
          >
            {highlightTokens.length === 0 && placeholder && (
              <span className="text-muted/40">{placeholder}</span>
            )}
            {highlightTokens.map((token, i) => (
              <span 
                key={`${token.key}-${i}`} 
                className={`
                  ${token.kind === 'keyword' ? 'text-accent font-bold' : ''}
                  ${token.kind === 'path' ? 'text-green' : ''}
                  ${token.kind === 'function' ? 'text-logic font-semibold underline decoration-logic/20 underline-offset-2' : ''}
                  ${token.kind === 'literal' ? 'text-amber' : ''}
                  ${token.kind === 'operator' ? 'text-muted/60' : ''}
                  ${token.kind === 'plain' ? 'text-ink/80' : ''}
                `}
              >
                {token.text}
              </span>
            ))}
          </div>

          {/* Textarea */}
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
              // Don't save if focus moved to a sibling (e.g. the FEL reference popup).
              const container = e.currentTarget.closest('[data-fel-editor-root]');
              const next = e.relatedTarget as Node | null;
              if (container && next && container.contains(next)) return;
              setTimeout(() => {
                setAutocomplete(null);
                setAutocompleteKind(null);
                onSave(draft);
              }, 150);
            }}
            style={{ caretColor: 'var(--studio-color-ink)' }}
            className={`w-full font-mono text-[14px] text-transparent border rounded-[4px] px-2 py-1.5 resize-none overflow-hidden outline-none transition-all leading-relaxed relative z-10 block min-h-[36px] ${
              syntaxError
                ? 'border-error bg-error/5'
                : 'bg-transparent border-border/80 focus:border-accent/40 focus:bg-surface/50'
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
          <div className="text-[10px] text-muted/40 mt-0.5 px-1 select-none">
            <kbd className="font-mono">&#8984;&#9166;</kbd> save &middot; <kbd className="font-mono">Esc</kbd> cancel
          </div>
        )}

        {/* Floating Autocomplete Menu */}
        {autocomplete && autocompleteOptions.length > 0 && (
          <FloatingPortal>
            <div
              ref={refs.setFloating}
              style={{ ...floatingStyles, opacity: isPositioned ? 1 : 0, transition: 'opacity 100ms ease-out' }}
              className="z-[100] flex bg-surface border border-border rounded-lg shadow-2xl overflow-hidden"
            >
              {/* Menu List */}
              <div className="w-64 border-r border-border/50">
                <ul className="max-h-64 overflow-y-auto py-1">
                  {autocompleteOptions.map((opt, i) => {
                    const isSelected = activeOptionIndex === i;
                    let icon = 'ƒ';
                    let iconColor = 'text-logic';
                    
                    if (opt.kind === 'path') {
                      const type = dataTypeInfo(opt.dataType || 'string');
                      icon = type.icon;
                      iconColor = type.color;
                    } else if (opt.kind === 'instanceName') {
                      icon = '@';
                      iconColor = 'text-accent';
                    }

                    return (
                      <li 
                        key={i}
                        className={`px-3 py-1.5 text-[11px] font-mono cursor-pointer flex items-center gap-2.5
                          ${isSelected ? 'bg-accent text-white' : 'hover:bg-subtle text-ink'}
                        `}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          applyAutocomplete(opt);
                        }}
                        onMouseEnter={() => setActiveOptionIndex(i)}
                      >
                        <span className={`w-4 text-center ${isSelected ? 'text-white' : iconColor} opacity-80 shrink-0 font-bold`}>
                          {icon}
                        </span>
                        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                          <span className="font-bold truncate">
                            {opt.kind === 'path' ? `$${opt.path}` : opt.kind === 'function' ? opt.name : opt.name}
                          </span>
                          {opt.kind === 'path' && opt.label !== opt.path && (
                            <span className={`text-[10px] truncate ${isSelected ? 'text-white/70' : 'text-muted/80'}`}>
                              {opt.label}
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* Peek Pane - Function Details */}
              {activeOption?.kind === 'function' && (
                <div className="w-48 bg-subtle/20 p-3 flex flex-col gap-2 animate-in slide-in-from-left-2 duration-200">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] uppercase tracking-wider text-muted font-bold">Signature</span>
                    <span className="text-[11px] font-mono text-logic font-semibold">
                      {activeOption.signature?.split('->')[0]?.trim()}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] uppercase tracking-wider text-muted font-bold">Returns</span>
                    <span className="text-[11px] font-mono text-ink/70">
                      {activeOption.signature?.split('->')[1]?.trim() || 'any'}
                    </span>
                  </div>
                  {activeOption.description && (
                    <div className="text-[10px] text-ink/60 leading-normal mt-1 border-t border-border/40 pt-2">
                      {activeOption.description}
                    </div>
                  )}
                </div>
              )}
            </div>
          </FloatingPortal>
        )}
      </div>
    </div>
  );
}
