/** @filedesc Bootstraps a Studio project and wires context providers around the Shell. */
import { useState, useEffect, useCallback, type ReactElement } from 'react';
import { createProject, type CreateProjectOptions, type Project, type FormDefinition, type ProjectBundle } from '@formspec-org/studio-core';
import commonRegistry from '../../../../registries/formspec-common.registry.json';

const COMMON_REGISTRY_URL = 'https://formspec.org/registries/formspec-common.registry.json';
import { ProjectProvider } from '../state/ProjectContext';
import { SelectionProvider } from '../state/useSelection';
import { ActiveGroupProvider } from '../state/useActiveGroup';
import { Shell } from '../components/Shell';
import { blankDefinition } from '../fixtures/blank-definition';
import { useColorScheme } from '../hooks/useColorScheme';
import { AssistantWorkspace } from '../onboarding/AssistantWorkspace';
import {
  getInitialStudioWorkspaceView,
  markOnboardingCompleted,
  resetOnboardingPreferences,
  setPersistedStudioView,
} from '../onboarding/onboarding-storage';
import { emitOnboardingTelemetry } from '../onboarding/onboarding-telemetry';
import {
  OPEN_ASSISTANT_WORKSPACE_EVENT,
  type OpenAssistantWorkspaceEventDetail,
  StudioWorkspaceViewProvider,
} from './StudioWorkspaceViewContext';

/**
 * Check for a handoff bundle in localStorage (from Chat or Inquest).
 */
export function getHandoffBundle(): ProjectBundle | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const handoffId = params.get('h');
  if (!handoffId) return null;

  const storageKey = `formspec-handoff:${handoffId}`;
  const raw = localStorage.getItem(storageKey);
  if (!raw) return null;

  try {
    const bundle = JSON.parse(raw);
    localStorage.removeItem(storageKey);

    // Clean up URL without reload
    const url = new URL(window.location.href);
    url.searchParams.delete('h');
    window.history.replaceState({}, '', url.toString());

    return bundle;
  } catch (err) {
    console.error('Failed to parse handoff bundle', err);
    return null;
  }
}

export function createStudioProject(seed?: CreateProjectOptions): Project {
  const handoffBundle = !seed ? getHandoffBundle() : null;
  const options: CreateProjectOptions = seed ?? (handoffBundle ? { seed: handoffBundle } : { seed: { definition: blankDefinition as FormDefinition } });
  const bundledRegistry = { ...(commonRegistry as Record<string, unknown>), url: COMMON_REGISTRY_URL };
  return createProject({
    ...options,
    registries: [...(options.registries ?? []), bundledRegistry],
  });
}

interface StudioAppProps {
  project?: Project;
}

export function StudioApp({ project }: StudioAppProps = {}): ReactElement {
  const [activeProject] = useState<Project>(() => project ?? createStudioProject());
  const [studioView, setStudioView] = useState<'assistant' | 'workspace'>(() => {
    if (project) return 'workspace';
    if (typeof window === 'undefined') return 'workspace';
    return getInitialStudioWorkspaceView(false);
  });
  const colorScheme = useColorScheme();

  const openAssistantWorkspace = useCallback(() => {
    setPersistedStudioView('assistant');
    setStudioView('assistant');
  }, []);

  useEffect(() => {
    if (project) return;
    const onRestartOnboarding = () => {
      resetOnboardingPreferences();
      activeProject.loadBundle(createStudioProject().export());
      setStudioView('assistant');
    };
    window.addEventListener('formspec:restart-onboarding', onRestartOnboarding);
    return () => window.removeEventListener('formspec:restart-onboarding', onRestartOnboarding);
  }, [activeProject, project]);

  useEffect(() => {
    const onOpenAssistant = (event: Event) => {
      const detail = (event as CustomEvent<OpenAssistantWorkspaceEventDetail>).detail;
      if (detail?.resetFirstRun) {
        resetOnboardingPreferences();
      }
      openAssistantWorkspace();
    };
    window.addEventListener(OPEN_ASSISTANT_WORKSPACE_EVENT, onOpenAssistant);
    return () => window.removeEventListener(OPEN_ASSISTANT_WORKSPACE_EVENT, onOpenAssistant);
  }, [openAssistantWorkspace]);

  const enterWorkspaceFromAssistant = () => {
    const diagnostics = activeProject.diagnose();
    const entries = [
      ...(diagnostics.structural ?? []),
      ...(diagnostics.expressions ?? []),
      ...(diagnostics.extensions ?? []),
      ...(diagnostics.consistency ?? []),
    ];
    const diagnosticWarnings = entries.filter((entry) => entry.severity === 'warning').length;
    const diagnosticErrors = entries.length - diagnosticWarnings;
    markOnboardingCompleted();
    setPersistedStudioView('workspace');
    emitOnboardingTelemetry('onboarding_completed');
    emitOnboardingTelemetry('onboarding_diagnostics_snapshot', {
      diagnosticTotal: entries.length,
      diagnosticErrors,
      diagnosticWarnings,
    });
    setStudioView('workspace');
  };

  return (
    <ProjectProvider project={activeProject}>
      <SelectionProvider>
        <ActiveGroupProvider>
          {studioView === 'assistant' ? (
            <AssistantWorkspace
              project={activeProject}
              onEnterStudio={enterWorkspaceFromAssistant}
              colorScheme={colorScheme}
            />
          ) : (
            <StudioWorkspaceViewProvider openAssistantWorkspace={openAssistantWorkspace}>
              <Shell colorScheme={colorScheme} />
            </StudioWorkspaceViewProvider>
          )}
        </ActiveGroupProvider>
      </SelectionProvider>
    </ProjectProvider>
  );
}
