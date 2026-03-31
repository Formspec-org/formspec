/** @filedesc Full screener authoring surface for ManageView — questions, routes, and toggle. */
import { useDefinition } from '../../state/useDefinition';
import { ScreenerToggle } from './screener/ScreenerToggle';
import { ScreenerQuestions } from './screener/ScreenerQuestions';
import { ScreenerRoutes } from './screener/ScreenerRoutes';

interface ScreenerItem {
  key: string;
  type: string;
  [k: string]: unknown;
}

interface Route {
  condition: string;
  target: string;
}

interface Screener {
  items?: ScreenerItem[];
  routes?: Route[];
}

export function ScreenerAuthoring() {
  const definition = useDefinition();
  const screener = definition?.screener as Screener | undefined;
  const isActive = Boolean(screener);
  const questionCount = screener?.items?.length ?? 0;
  const routeCount = screener?.routes?.length ?? 0;

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-muted/70 italic">
        Answers are used for routing only and are not saved in the form response.
      </p>

      <ScreenerToggle
        isActive={isActive}
        questionCount={questionCount}
        routeCount={routeCount}
      />

      {isActive && (
        <div className="space-y-6 mt-2">
          <ScreenerQuestions />

          <ScreenerRoutes />
        </div>
      )}
    </div>
  );
}
