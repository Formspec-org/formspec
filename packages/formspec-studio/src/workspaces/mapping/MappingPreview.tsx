/** @filedesc Mapping tab panel showing a live preview of the mapping direction picker and URL. */
import { useEffect, useId, useState } from 'react';
import { useProject } from '../../state/useProject';
import { useMapping } from '../../state/useMapping';

const directions = ['unset', 'inbound', 'outbound', 'bidirectional'] as const;

export function MappingPreview() {
  const mapping = useMapping();
  const project = useProject();
  const [pickerOpen, setPickerOpen] = useState(false);
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

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <span className="text-sm text-muted">Direction:</span>
        <div className="relative">
          <button
            type="button"
            className="inline-flex items-center rounded-sm border font-ui bg-accent/10 text-accent border-accent/20 text-sm px-2 py-0.5"
            aria-haspopup="listbox"
            aria-expanded={pickerOpen}
            aria-controls={pickerOpen ? listboxId : undefined}
            aria-label={`Direction ${direction}`}
            onClick={() => setPickerOpen((open) => !open)}
          >
            {direction}
          </button>
          {pickerOpen && (
            <div
              id={listboxId}
              role="listbox"
              aria-label="Direction"
              className="absolute left-0 top-full z-10 mt-1 min-w-32 rounded-md border border-border bg-panel p-1 shadow-lg"
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
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 border-r border-border p-3">
          <div className="text-xs font-medium text-muted uppercase tracking-wide mb-2">Input</div>
          <div className="font-mono text-xs text-muted bg-subtle rounded p-2 min-h-[4rem]">
            {'{}'}
          </div>
        </div>
        <div className="flex-1 p-3">
          <div className="text-xs font-medium text-muted uppercase tracking-wide mb-2">Output</div>
          <div className="font-mono text-xs text-muted bg-subtle rounded p-2 min-h-[4rem]">
            {'{}'}
          </div>
        </div>
      </div>
    </div>
  );
}
