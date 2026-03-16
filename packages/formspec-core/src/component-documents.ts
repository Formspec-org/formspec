import type {
  ComponentState,
  GeneratedLayoutState,
  ProjectState,
} from './types.js';

export function isAuthoredComponentDocument(doc: unknown): doc is ComponentState {
  return !!doc && typeof doc === 'object' && typeof (doc as Record<string, unknown>).$formspecComponent === 'string';
}

export function hasAuthoredComponentTree(doc: unknown): doc is ComponentState {
  return isAuthoredComponentDocument(doc) && !!(doc as ComponentState).tree;
}

export function createComponentArtifact(url?: string): ComponentState {
  return url ? { targetDefinition: { url } } : {};
}

export function createGeneratedLayoutDocument(
  url?: string,
  seed?: Partial<ComponentState> | null,
): GeneratedLayoutState {
  return {
    ...(seed ?? {}),
    ...(url ? { targetDefinition: { url } } : {}),
    'x-studio-generated': true,
  };
}

export function splitComponentState(
  component: ComponentState | undefined,
  url?: string,
): { component: ComponentState; generatedComponent: GeneratedLayoutState } {
  if (hasAuthoredComponentTree(component) || (isAuthoredComponentDocument(component) && !('x-studio-generated' in (component as Record<string, unknown>)))) {
    return {
      component: {
        ...component!,
        ...(url ? { targetDefinition: { ...(component?.targetDefinition ?? {}), url } } : {}),
      },
      generatedComponent: createGeneratedLayoutDocument(url),
    };
  }

  return {
    component: createComponentArtifact(url),
    generatedComponent: createGeneratedLayoutDocument(url, component ?? undefined),
  };
}

export function getEditableComponentDocument(
  state: Pick<ProjectState, 'component' | 'generatedComponent'>,
): ComponentState | GeneratedLayoutState {
  return hasAuthoredComponentTree(state.component) ? state.component : state.generatedComponent;
}

export function getCurrentComponentDocument(
  state: Pick<ProjectState, 'component' | 'generatedComponent'>,
): ComponentState | GeneratedLayoutState {
  if (hasAuthoredComponentTree(state.component)) {
    return state.component;
  }

  return Object.assign({}, state.component, state.generatedComponent, {
    tree: state.generatedComponent.tree,
    'x-studio-generated': true as const,
  }) as GeneratedLayoutState;
}
