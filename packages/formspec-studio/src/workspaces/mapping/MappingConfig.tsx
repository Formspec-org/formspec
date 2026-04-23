/** @filedesc Mapping tab section for setting the top-level mapping direction and URL properties. */
import { useEffect, useId, useState } from 'react';
import { useProject } from '../../state/useProject';
import { useMapping } from '../../state/useMapping';
import { HelpTip } from '../../components/ui/HelpTip';

import { useControllableState } from '../../hooks/useControllableState';

const directions = ['unset', 'forward', 'reverse', 'both'] as const;

interface MappingConfigProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function MappingConfig({ open: controlledOpen, onOpenChange }: MappingConfigProps = {}) {
  const mapping = useMapping();
  const project = useProject();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [open, setOpen] = useControllableState(controlledOpen, onOpenChange, true);
  const listboxId = useId();
  const direction = mapping?.direction ?? 'unset';

  useEffect(() => {
    if (!pickerOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPickerOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pickerOpen]);

  const setDirection = (value: (typeof directions)[number]) => {
    project.setMappingProperty('direction', value === 'unset' ? null : value);
    setPickerOpen(false);
  };

  const toggleOpen = () => {
    setOpen(!open);
  };

  return (
    <div className="mb-4">
      <button
        type="button"
        className="w-full flex items-center justify-between py-1.5 cursor-pointer group"
        onClick={toggleOpen}
      >
        <span className="font-mono text-[10px] font-bold tracking-[0.15em] uppercase text-muted group-hover:text-ink transition-colors">
          Configuration
        </span>
        <span className={`text-[10px] text-muted transition-transform duration-150 ${open ? 'rotate-90' : ''}`}>
          ▶
        </span>
      </button>
      {open && (
        <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
          {/* Mapping Direction Row */}
          <div className="flex items-center justify-between py-1 px-2 rounded-md hover:bg-subtle/30 transition-colors">
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-medium text-muted">Direction</span>
              <HelpTip text="The flow of transformation. 'Forward' for exports (Form -> External), 'Reverse' for imports (External -> Form).">
                <span className="text-[10px] text-muted/50 cursor-help hover:text-accent transition-colors">ⓘ</span>
              </HelpTip>
            </div>
            <div className="relative">
              <button
                type="button"
                data-testid="direction-picker"
                className={`inline-flex items-center rounded-sm border font-ui text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 ${direction === 'unset'
                  ? 'bg-panel text-muted border-border'
                  : 'bg-accent/10 text-accent border-accent/20'
                  }`}
                aria-haspopup="listbox"
                aria-expanded={pickerOpen}
                aria-controls={pickerOpen ? listboxId : undefined}
                onClick={(e) => {
                  e.stopPropagation();
                  setPickerOpen((v) => !v);
                }}
              >
                {direction === 'unset' ? 'Default (Forward)' : direction}
              </button>
              {pickerOpen && (
                <div
                  id={listboxId}
                  role="listbox"
                  className="absolute right-0 top-full z-20 mt-1 min-w-32 rounded-md border border-border bg-panel p-1 shadow-lg"
                >
                  {directions.map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-selected={value === direction}
                      className={`flex w-full rounded px-2 py-1 text-left text-[11px] font-bold uppercase ${value === direction ? 'bg-accent/10 text-accent' : 'text-ink hover:bg-subtle'
                        }`}
                      onClick={() => setDirection(value)}
                    >
                      {value === 'unset' ? 'Default (Forward)' : value}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Mapping Version Row */}
          <div className="flex items-center justify-between py-1 px-2 rounded-md hover:bg-subtle/30 transition-colors">
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-medium text-muted">Version</span>
              <HelpTip text="Author-defined SemVer for this mapping document. Bump when making breaking changes.">
                <span className="text-[10px] text-muted/50 cursor-help hover:text-accent transition-colors">ⓘ</span>
              </HelpTip>
            </div>
            <div className="shrink-0">
              <input
                type="text"
                data-testid="mapping-version"
                defaultValue={mapping?.version ?? ''}
                placeholder="1.0.0"
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  project.setMappingProperty('version', v === '' ? null : v);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                }}
                className="font-mono text-[11px] text-ink text-right bg-subtle/40 border border-border/40 rounded px-1.5 py-0.5 w-20 focus:outline-none focus:border-accent/30 focus:ring-1 focus:ring-accent/10 placeholder:text-muted/30"
              />
            </div>
          </div>

          {/* Definition Ref Row */}
          {mapping?.definitionRef && (
            <div className="flex items-center justify-between py-1 px-2 rounded-md hover:bg-subtle/30 transition-colors">
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-medium text-muted">Definition</span>
                <HelpTip text="The Formspec definition this mapping transforms.">
                  <span className="text-[10px] text-muted/50 cursor-help hover:text-accent transition-colors">ⓘ</span>
                </HelpTip>
              </div>
              <span className="font-mono text-[11px] text-ink truncate max-w-[120px]" title={mapping.definitionRef}>
                {mapping.definitionRef}
              </span>
            </div>
          )}

          {/* Target Schema & Format Section */}
          <div className="mt-4 pt-3 border-t border-border/40">
            <div className="px-2 mb-2">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[12px] font-medium text-muted">Target Schema</span>
                <HelpTip text="The external JSON Schema URL used to validate the output and provide structural hints.">
                  <span className="text-[10px] text-muted/50 cursor-help hover:text-accent transition-colors">ⓘ</span>
                </HelpTip>
              </div>
              <input
                type="text"
                placeholder="https://example.com/schema.json"
                defaultValue={mapping?.targetSchema?.url ?? ''}
                onBlur={(e) => project.setMappingTargetSchema('url', e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                className="w-full font-mono text-[10px] bg-subtle/40 border border-border/40 rounded px-2 py-1.5 text-ink placeholder:text-muted/30 focus:outline-none focus:border-accent/30 focus:ring-1 focus:ring-accent/10 transition-all"
              />
            </div>
            {mapping?.targetSchema?.format && (
              <div className="flex items-center justify-between px-2 mt-2">
                <span className="text-muted/60 italic text-[10px]">Output Format</span>
                <span className="font-bold text-[10px] text-green uppercase tracking-widest bg-green/10 px-1.5 py-0.5 rounded-sm border border-green/20">
                  {mapping?.targetSchema?.format}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
