/** @filedesc Full screener authoring surface — shared editor for items, plus phases/routes and toggle. */
import { useScreener } from '../../state/useScreener';
import { ScreenerToggle } from './screener/ScreenerToggle';
import { ScreenerItemEditor } from './ScreenerItemEditor';
import { PhaseList } from './screener/PhaseList';

export function ScreenerAuthoring() {
  const screener = useScreener();
  const isActive = screener !== null;
  const questionCount = screener?.items?.length ?? 0;
  const phaseCount = screener?.evaluation?.length ?? 0;
  const routeCount = screener
    ? screener.evaluation.reduce((sum, phase) => sum + (phase.routes?.length ?? 0), 0)
    : 0;

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-muted italic">
        Answers are used for routing only and are not saved in the form response.
      </p>

      <ScreenerToggle
        isActive={isActive}
        questionCount={questionCount}
        routeCount={routeCount}
        phaseCount={phaseCount}
      />

      {isActive && (
        <div className="space-y-6 mt-2">
          <ScreenerItemEditor />
          <PhaseList />
        </div>
      )}
    </div>
  );
}
