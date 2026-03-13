import { useProjectState } from './useProjectState';

export function useComponent() {
  const state = useProjectState();
  const authored = state.component as Record<string, unknown>;
  if (typeof authored.$formspecComponent === 'string' && authored.tree) {
    return state.component;
  }

  return {
    ...state.component,
    ...state.generatedComponent,
    tree: state.generatedComponent?.tree,
    'x-studio-generated': true,
  };
}
