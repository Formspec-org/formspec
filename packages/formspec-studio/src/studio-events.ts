/** @filedesc Typed event bus for studio-internal DOM custom events. */
export type StudioModeLiteral = 'chat' | 'edit' | 'design' | 'preview';

export const STUDIO_EVENTS = {
  NAVIGATE_WORKSPACE: 'formspec:navigate-workspace',
  SET_MODE: 'formspec:set-mode',
  MODE_CHANGED: 'formspec:mode-changed',
  OPEN_SETTINGS: 'formspec:open-settings',
  OPEN_APP_SETTINGS: 'formspec:open-app-settings',
  TOGGLE_PREVIEW_COMPANION: 'formspec:toggle-preview-companion',
  RESTART_ONBOARDING: 'formspec:restart-onboarding',
  PUBLISH_PROJECT: 'formspec:publish-project',
  OPEN_ASSISTANT_WORKSPACE: 'formspec:open-assistant-workspace',
  ASSISTANT_PROMPT: 'formspec:assistant-prompt',
  AUTHORING_TELEMETRY: 'formspec:authoring-telemetry',
  ONBOARDING_TELEMETRY: 'formspec:onboarding-telemetry',
  MODEL_ROUTING: 'formspec:model-routing',
  SCROLL_TO_SECTION: 'formspec:scroll-to-section',
} as const;

export type StudioEventName = (typeof STUDIO_EVENTS)[keyof typeof STUDIO_EVENTS];

export interface NavigateWorkspaceDetail {
  tab?: string;
  view?: string;
  section?: string;
  subTab?: string;
}

export interface ScrollToSectionDetail {
  section: string;
}

/** Detail payload per event name (string literals match {@link STUDIO_EVENTS} values). */
export type StudioEventDetailMap = {
  'formspec:navigate-workspace': NavigateWorkspaceDetail;
  'formspec:set-mode': { mode: StudioModeLiteral };
  'formspec:mode-changed': { from: StudioModeLiteral; to: StudioModeLiteral };
  'formspec:open-settings': undefined;
  'formspec:open-app-settings': undefined;
  'formspec:toggle-preview-companion': { open?: boolean };
  'formspec:restart-onboarding': undefined;
  'formspec:publish-project': undefined;
  'formspec:open-assistant-workspace': { resetFirstRun?: boolean };
  'formspec:assistant-prompt': { prompt: string };
  'formspec:authoring-telemetry': object;
  'formspec:onboarding-telemetry': object;
  'formspec:model-routing': object;
  'formspec:scroll-to-section': ScrollToSectionDetail;
};

type DetailFor<N extends StudioEventName> = StudioEventDetailMap[N];

export function dispatchStudioEvent<N extends StudioEventName>(
  name: N,
  detail?: DetailFor<N>,
): void {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

export function addStudioEventListener<N extends StudioEventName>(
  name: N,
  handler: (e: CustomEvent<DetailFor<N>>) => void,
): () => void {
  const wrapped: EventListener = (e: Event) => {
    if (!(e instanceof CustomEvent)) return;
    handler(e as CustomEvent<DetailFor<N>>);
  };
  window.addEventListener(name, wrapped);
  return () => window.removeEventListener(name, wrapped);
}
