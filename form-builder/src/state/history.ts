/**
 * @module Undo/redo history for studio project state.
 * Maintains two stacks: undoStack (past states) and redoStack (future states).
 * Integrated with commitProject via pushHistory().
 */
import type { Signal } from '@preact/signals';
import type { ProjectState } from './project';

const MAX_HISTORY = 50;
const undoStack: ProjectState[] = [];
const redoStack: ProjectState[] = [];

/** Push a snapshot onto the undo stack and clear the redo stack. */
export function pushHistory(state: ProjectState): void {
  undoStack.push(state);
  if (undoStack.length > MAX_HISTORY) {
    undoStack.shift();
  }
  redoStack.length = 0;
}

/** Restore the previous snapshot. Returns true if a state was restored. */
export function undoProject(project: Signal<ProjectState>): boolean {
  const previous = undoStack.pop();
  if (!previous) {
    return false;
  }
  redoStack.push(project.value);
  project.value = previous;
  return true;
}

/** Reapply the next snapshot. Returns true if a state was restored. */
export function redoProject(project: Signal<ProjectState>): boolean {
  const next = redoStack.pop();
  if (!next) {
    return false;
  }
  undoStack.push(project.value);
  project.value = next;
  return true;
}

function canUndo(): boolean {
  return undoStack.length > 0;
}

function canRedo(): boolean {
  return redoStack.length > 0;
}

/** Clears both stacks (used on full project reset/import). */
export function clearHistory(): void {
  undoStack.length = 0;
  redoStack.length = 0;
}
