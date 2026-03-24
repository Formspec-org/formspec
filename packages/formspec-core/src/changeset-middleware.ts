/** @filedesc Recording middleware for changeset-based proposal tracking. */
import type { AnyCommand, CommandResult, Middleware, ProjectState } from './types.js';

/**
 * Control interface for the changeset recording middleware.
 *
 * The ProposalManager in studio-core holds this handle and toggles
 * `recording` and `currentActor` as the changeset lifecycle progresses.
 * The MCP layer sets `currentActor = 'ai'` inside beginEntry/endEntry
 * brackets; outside those brackets the actor defaults to `'user'`.
 */
export interface ChangesetRecorderControl {
  /** Whether the middleware should record commands passing through. */
  recording: boolean;
  /** Current actor — determines which recording track captures the commands. */
  currentActor: 'ai' | 'user';
  /**
   * Called after each successful dispatch when recording is on.
   *
   * @param actor - Which actor's track should receive these commands.
   * @param commands - The command phases that were dispatched.
   * @param results - The per-command results from execution.
   * @param priorState - The project state before the dispatch.
   */
  onCommandsRecorded(
    actor: 'ai' | 'user',
    commands: Readonly<AnyCommand[][]>,
    results: Readonly<CommandResult[]>,
    priorState: Readonly<ProjectState>,
  ): void;
}

/**
 * Creates a recording middleware controlled by the given handle.
 *
 * The middleware is a pure side-effect observer: it passes commands through
 * unchanged and records them after successful execution. It never blocks
 * or transforms commands — the user is never locked out.
 */
export function createChangesetMiddleware(control: ChangesetRecorderControl): Middleware {
  return (state, commands, next) => {
    const result = next(commands as AnyCommand[][]);
    if (control.recording) {
      control.onCommandsRecorded(control.currentActor, commands, result.results, state);
    }
    return result;
  };
}
