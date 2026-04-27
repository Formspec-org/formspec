import { beforeEach, describe, expect, it } from 'vitest';
import {
  ONBOARDING_COMPLETED_KEY,
  ONBOARDING_ORIENTATION_KEY,
  STUDIO_VIEW_PREFERENCE_KEY,
  clearOnboardingCompleted,
  getInitialStudioWorkspaceView,
  isOnboardingCompleted,
  markOnboardingCompleted,
  resetOnboardingPreferences,
  setPersistedStudioView,
  shouldShowOnboarding,
} from '../../src/onboarding/onboarding-storage';

describe('onboarding storage policy', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('persists completion behind a versioned key', () => {
    expect(isOnboardingCompleted()).toBe(false);

    markOnboardingCompleted();

    expect(localStorage.getItem(ONBOARDING_COMPLETED_KEY)).toBe('1');
    expect(isOnboardingCompleted()).toBe(true);

    clearOnboardingCompleted();
    expect(isOnboardingCompleted()).toBe(false);
  });

  it('shows onboarding only when not completed', () => {
    expect(shouldShowOnboarding()).toBe(true);

    markOnboardingCompleted();

    expect(shouldShowOnboarding()).toBe(false);
  });

  it('honors QA query overrides and handoff bypass', () => {
    window.history.replaceState({}, '', '/?skipOnboarding=1');
    expect(shouldShowOnboarding()).toBe(false);

    window.history.replaceState({}, '', '/?onboarding=1');
    expect(shouldShowOnboarding()).toBe(true);

    window.history.replaceState({}, '', '/?h=bundle-1');
    expect(shouldShowOnboarding()).toBe(false);

    window.history.replaceState({}, '', '/?onboarding=1&h=bundle-2');
    expect(shouldShowOnboarding()).toBe(false);
  });

  it('resetOnboardingPreferences clears completion and orientation', () => {
    markOnboardingCompleted();
    localStorage.setItem(ONBOARDING_ORIENTATION_KEY, 'dismissed');
    resetOnboardingPreferences();
    expect(localStorage.getItem(ONBOARDING_COMPLETED_KEY)).toBeNull();
    expect(localStorage.getItem(ONBOARDING_ORIENTATION_KEY)).toBeNull();
  });

  it('resetOnboardingPreferences clears studio view preference', () => {
    localStorage.setItem(STUDIO_VIEW_PREFERENCE_KEY, 'workspace');
    resetOnboardingPreferences();
    expect(localStorage.getItem(STUDIO_VIEW_PREFERENCE_KEY)).toBeNull();
  });

  it('initial studio view follows onboarding policy and persistence', () => {
    expect(getInitialStudioWorkspaceView(false)).toBe('assistant');
    markOnboardingCompleted();
    expect(getInitialStudioWorkspaceView(false)).toBe('workspace');
    setPersistedStudioView('assistant');
    expect(getInitialStudioWorkspaceView(false)).toBe('assistant');
    setPersistedStudioView('workspace');
    expect(getInitialStudioWorkspaceView(false)).toBe('workspace');
  });
});
