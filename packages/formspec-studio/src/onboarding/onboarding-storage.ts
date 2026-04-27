/** @filedesc Versioned localStorage policy for Studio first-run onboarding completion. */
export const ONBOARDING_COMPLETED_KEY = 'formspec-studio:onboarding-completed:v1';
/** Dismissed setup tip card in first-run onboarding (re-shown after `resetOnboardingPreferences`). */
export const ONBOARDING_ORIENTATION_KEY = 'formspec-studio:onboarding-orientation:v1';
/** Last explicit assistant vs workspace shell choice (after first-run defaults). */
export const STUDIO_VIEW_PREFERENCE_KEY = 'formspec-studio:studio-view:v1';

export type StudioViewPreference = 'assistant' | 'workspace';

export function getPersistedStudioView(storage: Storage = localStorage): StudioViewPreference | null {
  const raw = storage.getItem(STUDIO_VIEW_PREFERENCE_KEY);
  if (raw === 'assistant' || raw === 'workspace') return raw;
  return null;
}

export function setPersistedStudioView(view: StudioViewPreference, storage: Storage = localStorage): void {
  storage.setItem(STUDIO_VIEW_PREFERENCE_KEY, view);
}

export function clearStudioViewPreference(storage: Storage = localStorage): void {
  storage.removeItem(STUDIO_VIEW_PREFERENCE_KEY);
}

export function isOnboardingCompleted(storage: Storage = localStorage): boolean {
  return storage.getItem(ONBOARDING_COMPLETED_KEY) === '1';
}

export function markOnboardingCompleted(storage: Storage = localStorage): void {
  storage.setItem(ONBOARDING_COMPLETED_KEY, '1');
}

export function clearOnboardingCompleted(storage: Storage = localStorage): void {
  storage.removeItem(ONBOARDING_COMPLETED_KEY);
}

/** Clears completion and orientation so the next onboarding mount matches a true first-run. */
export function resetOnboardingPreferences(storage: Storage = localStorage): void {
  clearOnboardingCompleted(storage);
  storage.removeItem(ONBOARDING_ORIENTATION_KEY);
  clearStudioViewPreference(storage);
}

export function shouldShowOnboarding(location: Location = window.location, storage: Storage = localStorage): boolean {
  const params = new URLSearchParams(location.search);
  if (params.get('skipOnboarding') === '1') return false;
  if (params.has('h')) return false;
  if (params.get('onboarding') === '1') return true;
  return !isOnboardingCompleted(storage);
}

/** Which full-app surface to show on cold load (assistant workspace vs Studio shell). */
export function getInitialStudioWorkspaceView(
  hasExternalProject: boolean,
  location: Location = window.location,
  storage: Storage = localStorage,
): StudioViewPreference {
  if (hasExternalProject || typeof window === 'undefined') return 'workspace';
  if (shouldShowOnboarding(location, storage)) return 'assistant';
  const persisted = getPersistedStudioView(storage);
  if (persisted === 'assistant' || persisted === 'workspace') return persisted;
  return 'workspace';
}
