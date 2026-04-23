/** @filedesc Presence toggle for the screener — empty state or active summary with remove action. */
import { useState } from 'react';
import { useProject } from '../../../state/useProject';
import { Pill } from '../../../components/ui/Pill';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { EmptyWorkspaceState } from '../../../components/shared/EmptyWorkspaceState';

interface ScreenerToggleProps {
  isActive: boolean;
  questionCount: number;
  routeCount: number;
  phaseCount: number;
}

export function ScreenerToggle({ isActive, questionCount, routeCount, phaseCount }: ScreenerToggleProps) {
  const project = useProject();
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  const handleSetup = () => {
    project.createScreenerDocument();
  };

  const handleRemove = () => {
    setShowRemoveConfirm(true);
  };

  const confirmRemove = () => {
    project.deleteScreenerDocument();
    setShowRemoveConfirm(false);
  };

  if (!isActive) {
    return (
      <EmptyWorkspaceState
        message="No screening configured."
        description={
          <>
            <p className="mb-4">
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
          </>
        }
      />
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
      <ConfirmDialog
        open={showRemoveConfirm}
        title="Remove screener"
        description="This will remove the screener document and all screening questions, phases, and routing rules."
        confirmLabel="Remove"
        onConfirm={confirmRemove}
        onCancel={() => setShowRemoveConfirm(false)}
      />
    </div>
  );
}
