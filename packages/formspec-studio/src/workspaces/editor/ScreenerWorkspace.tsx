/** @filedesc Screener workspace view — full-width item editor + phases panel, shown when Editor toggle is 'screener'. */
import { useScreener } from '../../state/useScreener';
import { useProject } from '../../state/useProject';
import { ScreenerItemEditor } from './ScreenerItemEditor';
import { ScreenerToggle } from './screener/ScreenerToggle';
import { PhaseList } from './screener/PhaseList';
import { ScreenerTestRouting } from './screener/ScreenerTestRouting';
import { WorkspacePage, WorkspacePageSection } from '../../components/ui/WorkspacePage';

export function ScreenerWorkspace() {
  const screener = useScreener();
  const project = useProject();
  const isActive = screener !== null;
  const questionCount = screener?.items?.length ?? 0;
  const phaseCount = screener?.evaluation?.length ?? 0;
  const routeCount = screener
    ? screener.evaluation.reduce((sum, phase) => sum + (phase.routes?.length ?? 0), 0)
    : 0;

  if (!isActive) {
    return (
      <WorkspacePage maxWidth="max-w-none" className="w-full">
        <WorkspacePageSection className="flex justify-center pt-10">
          <div className="w-full max-w-[600px]">
            <ScreenerToggle
              isActive={false}
              questionCount={0}
              routeCount={0}
              phaseCount={0}
            />
          </div>
        </WorkspacePageSection>
      </WorkspacePage>
    );
  }

  return (
    <div className="flex flex-col gap-6" data-testid="screener-workspace">
      <ScreenerItemEditor />
      <WorkspacePage maxWidth="max-w-none" className="w-full">
        <WorkspacePageSection padding="px-0" className="flex justify-center pb-20">
          <div className="w-full max-w-[980px] rounded-[22px] border border-border/65 bg-surface/96 px-4 py-4 shadow-[0_4px_16px_rgba(30,24,16,0.04)] backdrop-blur sm:px-5 md:px-6 md:py-5">
            <div className="flex flex-col gap-3 border-b border-border/65 pb-4 mb-4">
              <h2 className="text-[18px] font-semibold tracking-tight text-ink">Evaluation Phases</h2>
              <p className="text-[13px] leading-6 text-muted/90">
                Configure how screening answers are evaluated and where respondents are routed.
              </p>
            </div>
            <PhaseList />
            <div className="mt-4">
              <ScreenerTestRouting />
            </div>
          </div>
        </WorkspacePageSection>
      </WorkspacePage>
    </div>
  );
}
