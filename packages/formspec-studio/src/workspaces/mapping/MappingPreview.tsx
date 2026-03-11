import { useMapping } from '../../state/useMapping';
import { Pill } from '../../components/ui/Pill';

export function MappingPreview() {
  const mapping = useMapping();
  const direction = mapping?.direction ?? 'outbound';

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <span className="text-sm text-muted">Direction:</span>
        <Pill text={direction} color="accent" />
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
