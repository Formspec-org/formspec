import type { Signal } from '@preact/signals';
import { projectSignal, type ProjectState } from '../../state/project';
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

  if (!state.selection) {
    return <FormInspector project={project} />;
  }

  const item = findItemByPath(state.definition.items, state.selection);
  if (!item) {
    return (
      <div class="inspector-content" data-testid="inspector-missing-selection">
        <p class="inspector-content__title">Inspector</p>
        <p class="inspector-hint">Selected item no longer exists.</p>
      </div>
    );
  }

  if (item.type === 'field') {
    return <FieldInspector project={project} path={state.selection} item={item} />;
  }
  if (item.type === 'group') {
    return <GroupInspector project={project} path={state.selection} item={item} />;
  }

  return <DisplayInspector project={project} path={state.selection} item={item} />;
}
