import type {
  FormspecComponentDocument,
  FormspecGeneratedLayoutDocument,
  ProjectState,
} from './types.js';

export function isAuthoredComponentDocument(doc: unknown): doc is FormspecComponentDocument {
  return !!doc && typeof doc === 'object' && typeof (doc as Record<string, unknown>).$formspecComponent === 'string';
}

export function hasAuthoredComponentTree(doc: unknown): doc is FormspecComponentDocument {
  return isAuthoredComponentDocument(doc) && !!(doc as FormspecComponentDocument).tree;
}

export function createComponentArtifact(url?: string): FormspecComponentDocument {
  return {
    targetDefinition: url ? { url } : undefined,
  };
}

export function createGeneratedLayoutDocument(
  url?: string,
  seed?: Partial<FormspecComponentDocument> | null,
): FormspecGeneratedLayoutDocument {
  return {
    ...(seed ?? {}),
    ...(url ? { targetDefinition: { url } } : {}),
    'x-studio-generated': true,
  };
}

export function splitComponentState(
  component: FormspecComponentDocument | undefined,
  url?: string,
): { component: FormspecComponentDocument; generatedComponent: FormspecGeneratedLayoutDocument } {
  if (hasAuthoredComponentTree(component) || (isAuthoredComponentDocument(component) && !('x-studio-generated' in (component as Record<string, unknown>)))) {
    return {
      component: {
        ...component,
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
): FormspecComponentDocument | FormspecGeneratedLayoutDocument {
  return hasAuthoredComponentTree(state.component) ? state.component : state.generatedComponent;
}

export function getCurrentComponentDocument(
  state: Pick<ProjectState, 'component' | 'generatedComponent'>,
): FormspecComponentDocument | FormspecGeneratedLayoutDocument {
  if (hasAuthoredComponentTree(state.component)) {
    return state.component;
  }

  return {
    ...state.component,
    ...state.generatedComponent,
    tree: state.generatedComponent.tree,
    'x-studio-generated': true,
  };
}
