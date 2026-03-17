/** @filedesc Mapping tab section for setting the top-level mapping direction and URL properties. */
import { useEffect, useId, useState } from 'react';
import { useProject } from '../../state/useProject';
import { useMapping } from '../../state/useMapping';

const directions = ['unset', 'inbound', 'outbound', 'bidirectional'] as const;

interface MappingConfigProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function MappingConfig({ open: controlledOpen, onOpenChange }: MappingConfigProps = {}) {
  const mapping = useMapping();
  const project = useProject();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [localOpen, setLocalOpen] = useState(true);
  const listboxId = useId();
  const direction = mapping?.direction ?? 'unset';
  const isControlled = controlledOpen !== undefined;
  const open = controlledOpen ?? localOpen;

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
    const nextOpen = !open;
    if (!isControlled) setLocalOpen(nextOpen);
    onOpenChange?.(nextOpen);
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
        <div className="space-y-1">
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted">Direction</span>
              <div className="relative">
                <button
                  type="button"
                  className="inline-flex items-center rounded-sm border font-ui bg-accent/10 text-accent border-accent/20 text-sm px-2 py-0.5"
                  aria-haspopup="listbox"
                  aria-expanded={pickerOpen}
                  aria-controls={pickerOpen ? listboxId : undefined}
                  aria-label={`Direction ${direction}`}
                  onClick={() => setPickerOpen((value) => !value)}
                >
                  {direction}
                </button>
                {pickerOpen && (
                  <div
                    id={listboxId}
                    role="listbox"
                    aria-label="Direction"
                    className="absolute right-0 top-full z-10 mt-1 min-w-32 rounded-md border border-border bg-panel p-1 shadow-lg"
                  >
                    {directions.map((value) => (
                      <button
                        key={value}
                        type="button"
                        role="option"
                        aria-selected={value === direction}
                        className={`flex w-full rounded px-2 py-1 text-left text-sm ${
                          value === direction ? 'bg-accent/10 text-accent' : 'text-ink hover:bg-subtle'
                        }`}
                        onClick={() => setDirection(value)}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {mapping?.definitionRef && (
              <div className="flex items-center justify-between">
                <span className="text-muted">Definition</span>
                <span className="font-mono text-xs text-ink">{mapping.definitionRef}</span>
              </div>
            )}
            {mapping?.targetSchema && (
              <div className="flex items-center justify-between">
                <span className="text-muted">Target Schema</span>
                <span className="text-xs text-ink">
                  {Object.keys(mapping.targetSchema).length} properties
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
