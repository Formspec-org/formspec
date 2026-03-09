import type { Signal } from '@preact/signals';
import { projectSignal, type ProjectState } from '../../state/project';
import { setInspectorMode } from '../../state/mutations';
import { DisplayInspector } from './DisplayInspector';
import { FieldInspector } from './FieldInspector';
import { FormInspector } from './FormInspector';
import { GroupInspector } from './GroupInspector';
import { findItemByPath } from './utils';

export type InspectorTier = 'simple' | 'standard' | 'advanced';

/** Returns a numeric tier level for comparison: simple=1, standard=2, advanced=3. */
export function tierLevel(tier: InspectorTier): number {
  if (tier === 'simple') return 1;
  if (tier === 'standard') return 2;
  return 3;
}

/** Returns true when the active tier meets or exceeds the required tier. */
export function meetsMinTier(active: InspectorTier, minTier: InspectorTier): boolean {
  return tierLevel(active) >= tierLevel(minTier);
}

const TIERS: { value: InspectorTier; label: string }[] = [
  { value: 'simple', label: 'Simple' },
  { value: 'standard', label: 'Standard' },
  { value: 'advanced', label: 'Advanced' }
];

interface InspectorProps {
  project?: Signal<ProjectState>;
}

export function Inspector(props: InspectorProps) {
  const project = props.project ?? projectSignal;
  const state = project.value;
  const tier = state.uiState.inspectorMode;

  const modeToggle = (
    <div class="inspector-mode-toggle" data-testid="inspector-mode-toggle">
      {TIERS.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          class={`inspector-mode-toggle__btn${tier === value ? ' is-active' : ''}`}
          data-testid={`inspector-mode-${value}`}
          onClick={() => { if (tier !== value) setInspectorMode(project, value); }}
        >
          {label}
        </button>
      ))}
    </div>
  );

  if (!state.selection) {
    return (
      <>
        {modeToggle}
        <FormInspector project={project} tier={tier} />
      </>
    );
  }

  const item = findItemByPath(state.definition.items, state.selection);
  if (!item) {
    return (
      <div class="inspector-content" data-testid="inspector-missing-selection">
        <p class="inspector-hint">Selected item no longer exists.</p>
      </div>
    );
  }

  if (item.type === 'field') {
    return (
      <>
        {modeToggle}
        <FieldInspector project={project} path={state.selection} item={item} tier={tier} />
      </>
    );
  }
  if (item.type === 'group') {
    return (
      <>
        {modeToggle}
        <GroupInspector project={project} path={state.selection} item={item} tier={tier} />
      </>
    );
  }

  return (
    <>
      {modeToggle}
      <DisplayInspector project={project} path={state.selection} item={item} tier={tier} />
    </>
  );
}
