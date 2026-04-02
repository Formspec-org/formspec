/** @filedesc Full screener authoring surface for ManageView — questions, phases, routes, and toggle. */
import { useScreener } from '../../state/useScreener';
import { ScreenerToggle } from './screener/ScreenerToggle';
import { ScreenerQuestions } from './screener/ScreenerQuestions';
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
      <p className="text-[11px] text-muted/70 italic">
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
          <ScreenerQuestions />

          <PhaseList />
        </div>
      )}
    </div>
  );
}
