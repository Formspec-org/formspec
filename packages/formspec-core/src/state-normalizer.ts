/** @filedesc Enforces cross-artifact invariants after every state mutation. */
import type { ProjectState } from './types.js';

/**
 * Enforce cross-artifact invariants on a mutable state object.
 * Runs after every dispatch and batch cycle.
 * Undo/redo bypass this — snapshots were already normalized.
 */
export function normalizeState(state: ProjectState): void {
  const url = state.definition.url;

  // Sync targetDefinition.url on component and theme
  if (state.component.targetDefinition) {
    state.component.targetDefinition.url = url;
  }
  if (state.theme.targetDefinition) {
    state.theme.targetDefinition.url = url;
  }

  // Sync locale targetDefinition.url with definition URL
  state.locales ??= {};
  for (const locale of Object.values(state.locales)) {
    if (locale.targetDefinition) {
      locale.targetDefinition.url = url;
    }
  }

  // Sort theme breakpoints by minWidth ascending
  const themeBp = state.theme.breakpoints;
  if (themeBp) {
    const sorted = Object.entries(themeBp).sort((a, b) => a[1] - b[1]);
    const fresh: Record<string, number> = {};
    for (const [name, minWidth] of sorted) fresh[name] = minWidth;
    state.theme.breakpoints = fresh;
  }

  // Sync component breakpoints from theme when not independently set
  if (!state.component.breakpoints && themeBp) {
    state.component.breakpoints = { ...state.theme.breakpoints };
  }
}
