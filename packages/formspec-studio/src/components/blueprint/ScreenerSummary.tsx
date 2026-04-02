/** @filedesc Read-only screener summary for the Blueprint sidebar. */
import { useScreener } from '../../state/useScreener';
import { Pill } from '../ui/Pill';

export function ScreenerSummary() {
  const screener = useScreener();

  if (!screener) {
    return (
      <div className="px-2 py-1 text-[12px] text-muted italic">
        Not configured
      </div>
    );
  }

  const qCount = screener.items?.length ?? 0;
  const phaseCount = screener.evaluation?.length ?? 0;
  const rCount = screener.evaluation?.reduce((sum, phase) => sum + (phase.routes?.length ?? 0), 0) ?? 0;

  return (
    <div className="flex flex-col gap-1 px-2 py-1">
      <div className="flex items-center gap-2">
        <Pill text="Active" color="green" size="sm" />
        <span className="text-[12px] text-muted">
          {qCount} question{qCount !== 1 ? 's' : ''}, {phaseCount} phase{phaseCount !== 1 ? 's' : ''}, {rCount} route{rCount !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}
