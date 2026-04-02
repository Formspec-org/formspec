/** @filedesc Presence toggle for the screener — empty state or active summary with remove action. */
import { useProject } from '../../../state/useProject';
import { Pill } from '../../../components/ui/Pill';

interface ScreenerToggleProps {
  isActive: boolean;
  questionCount: number;
  routeCount: number;
  phaseCount: number;
}

export function ScreenerToggle({ isActive, questionCount, routeCount, phaseCount }: ScreenerToggleProps) {
  const project = useProject();

  const handleSetup = () => {
    project.createScreenerDocument();
  };

  const handleRemove = () => {
    if (window.confirm('This will remove the screener document and all screening questions, phases, and routing rules.')) {
      project.deleteScreenerDocument();
    }
  };

  if (!isActive) {
    return (
      <div className="py-8 border-2 border-dashed border-border/50 rounded-2xl flex flex-col items-center justify-center text-center px-6">
        <p className="text-sm text-muted font-medium mb-2">No screening configured.</p>
        <p className="text-[12px] text-muted/70 leading-relaxed max-w-[400px] mb-4">
          Add screening questions to pre-qualify respondents before they begin the full form.
          Routing rules direct them to different destinations based on their answers.
        </p>
        <button
          type="button"
          aria-label="Set up screening"
          onClick={handleSetup}
          className="text-[11px] text-accent hover:text-accent-hover font-bold uppercase tracking-wider transition-colors"
        >
          Set up screening
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Pill text="Active" color="green" size="sm" />
        <span className="text-[12px] text-muted">
          {questionCount} question{questionCount !== 1 ? 's' : ''}, {phaseCount} phase{phaseCount !== 1 ? 's' : ''}, {routeCount} route{routeCount !== 1 ? 's' : ''}
        </span>
      </div>
      <button
        type="button"
        aria-label="Remove screener"
        onClick={handleRemove}
        className="text-[10px] font-bold text-muted hover:text-error uppercase tracking-widest transition-colors"
      >
        Remove
      </button>
    </div>
  );
}
