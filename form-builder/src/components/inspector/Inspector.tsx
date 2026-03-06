import type { Signal } from '@preact/signals';
import { projectSignal, type ProjectState } from '../../state/project';
import { toggleInspectorMode } from '../../state/mutations';
import { DisplayInspector } from './DisplayInspector';
import { FieldInspector } from './FieldInspector';
import { FormInspector } from './FormInspector';
import { GroupInspector } from './GroupInspector';
import { findItemByPath } from './utils';

export interface InspectorProps {
  project?: Signal<ProjectState>;
}

export function Inspector(props: InspectorProps) {
  const project = props.project ?? projectSignal;
  const state = project.value;
  const isAdvanced = state.uiState.inspectorMode === 'advanced';

  const modeToggle = (
    <div class="inspector-mode-toggle" data-testid="inspector-mode-toggle">
      <button
        type="button"
        class={`inspector-mode-toggle__btn${!isAdvanced ? ' is-active' : ''}`}
        data-testid="inspector-mode-simple"
        onClick={() => { if (isAdvanced) toggleInspectorMode(project); }}
      >
        Simple
      </button>
      <button
        type="button"
        class={`inspector-mode-toggle__btn${isAdvanced ? ' is-active' : ''}`}
        data-testid="inspector-mode-advanced"
        onClick={() => { if (!isAdvanced) toggleInspectorMode(project); }}
      >
        Advanced
      </button>
    </div>
  );

  if (!state.selection) {
    return (
      <>
        {modeToggle}
        <FormInspector project={project} />
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
        <FieldInspector project={project} path={state.selection} item={item} advancedMode={isAdvanced} />
      </>
    );
  }
  if (item.type === 'group') {
    return (
      <>
        {modeToggle}
        <GroupInspector project={project} path={state.selection} item={item} />
      </>
    );
  }

  return (
    <>
      {modeToggle}
      <DisplayInspector project={project} path={state.selection} item={item} />
    </>
  );
}
