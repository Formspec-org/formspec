/** @filedesc Mapping tab section for setting the top-level mapping direction and URL properties. */
import { useEffect, useId, useState } from 'react';
import { useProject } from '../../state/useProject';
import { useMapping } from '../../state/useMapping';
import { useProjectState } from '../../state/useProjectState';
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
  const projectSnapshot = useProjectState();
  const activeMappingId =
    projectSnapshot.selectedMappingId ?? Object.keys(projectSnapshot.mappings)[0] ?? 'default';
  const mappingHydrationKey = `${activeMappingId}:${mapping?.version ?? ''}:${(mapping?.rules ?? []).length}:${mapping?.direction ?? ''}`;
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
    <div className="mb-8">
      <button
        type="button"
        className="w-full flex items-center justify-between py-1.5 cursor-pointer group"
        onClick={toggleOpen}
      >
        <span className="text-[10px] font-bold tracking-normal uppercase text-muted group-hover:text-ink transition-colors">
          Configuration
        </span>
        <span className={`text-[12px] text-muted transition-transform duration-300 ${open ? 'rotate-90' : ''}`}>
          ▸
        </span>
      </button>
      {open && (
        <div className="space-y-1.5 mt-1">
          {/* Mapping Direction Row */}
          <div className="flex items-center justify-between py-1 px-2 rounded hover:bg-subtle transition-all">
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-bold text-muted">Direction</span>
              <HelpTip text="The flow of transformation. 'Forward' for exports (Form -> External), 'Reverse' for imports (External -> Form).">
                <span className="text-[11px] text-muted cursor-help hover:text-accent transition-colors">ⓘ</span>
              </HelpTip>
            </div>
            <div className="relative z-30 isolate">
              <button
                type="button"
                data-testid="direction-picker"
                className={`inline-flex items-center rounded border font-bold text-[9px] uppercase tracking-normal px-2 py-1 transition-all ${direction === 'unset'
                  ? 'bg-surface text-muted border-border shadow-sm'
                  : 'bg-accent/[0.04] text-accent border-accent/20'
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
                  className="right-0 top-full mt-1 min-w-[130px] p-0.5 shadow-md dropdown-panel"
                >
                  {directions.map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-selected={value === direction}
                      className={`flex w-full rounded px-2 py-1.5 text-left text-[11px] font-bold uppercase tracking-normal transition-all ${value === direction ? 'bg-accent text-surface shadow-sm' : 'text-ink hover:bg-subtle hover:text-accent'
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
          <div className="flex items-center justify-between py-1 px-2 rounded hover:bg-subtle transition-all">
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-bold text-muted">Version</span>
              <HelpTip text="Author-defined SemVer for this mapping document. Bump when making breaking changes.">
                <span className="text-[11px] text-muted cursor-help hover:text-accent transition-colors">ⓘ</span>
              </HelpTip>
            </div>
            <div className="shrink-0">
              <input
                key={mappingHydrationKey}
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
                className="font-mono text-[11px] font-bold text-ink text-right bg-subtle border border-border rounded px-2 py-1 w-20 outline-none focus:ring-1 focus:ring-accent transition-all placeholder:text-muted"
              />
            </div>
          </div>

          {/* Definition Ref Row */}
          {mapping?.definitionRef && (
            <div className="flex items-center justify-between py-1 px-2 rounded hover:bg-subtle transition-all">
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-bold text-muted">Definition</span>
                <HelpTip text="The Formspec definition this mapping transforms.">
                  <span className="text-[11px] text-muted cursor-help hover:text-accent transition-colors">ⓘ</span>
                </HelpTip>
              </div>
              <span className="font-mono text-[11px] font-bold text-ink/70 truncate max-w-[160px]" title={mapping.definitionRef}>
                {mapping.definitionRef}
              </span>
            </div>
          )}

          {/* Target Schema & Format Section */}
          <div className="mt-4 pt-4 border-t border-border">
            <div className="px-2 mb-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] font-bold text-muted">Target Schema</span>
                <HelpTip text="The external JSON Schema URL used to validate the output and provide structural hints.">
                  <span className="text-[11px] text-muted cursor-help hover:text-accent transition-colors">ⓘ</span>
                </HelpTip>
              </div>
              <input
                key={`${mappingHydrationKey}-schema-url`}
                type="text"
                placeholder="https://example.com/schema.json"
                defaultValue={mapping?.targetSchema?.url ?? ''}
                onBlur={(e) => project.setMappingTargetSchema('url', e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                className="w-full font-mono text-[11px] font-bold bg-subtle border border-border rounded px-2 py-1.5 text-ink placeholder:text-muted outline-none focus:ring-1 focus:ring-accent transition-all"
              />
            </div>
            {mapping?.targetSchema?.format && (
              <div className="flex items-center justify-between px-2 mt-3">
                <span className="text-muted text-[10px] font-bold uppercase tracking-normal">Output Format</span>
                <span className="text-[10px] font-bold text-teal uppercase tracking-normal bg-teal/[0.04] px-2 py-0.5 rounded border border-teal/20 shadow-sm">
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
