/** @filedesc Read-only screener summary for the Blueprint sidebar. */
import { useDefinition } from '../../state/useDefinition';
import { Pill } from '../ui/Pill';

interface Screener {
  items?: unknown[];
  routes?: unknown[];
}

export function ScreenerSummary() {
  const definition = useDefinition();
  const screener = definition?.screener as Screener | undefined;

  if (!screener) {
    return (
      <div className="px-2 py-1 text-[12px] text-muted italic">
        Not configured
      </div>
    );
  }

  const qCount = screener.items?.length ?? 0;
  const rCount = screener.routes?.length ?? 0;

  return (
    <div className="flex flex-col gap-1 px-2 py-1">
      <div className="flex items-center gap-2">
        <Pill text="Active" color="green" size="sm" />
        <span className="text-[12px] text-muted">
          {qCount} question{qCount !== 1 ? 's' : ''}, {rCount} route{rCount !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}
