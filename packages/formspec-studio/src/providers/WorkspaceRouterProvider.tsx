/** @filedesc Context provider for workspace routing: active tab, section, editor view, mapping tab, preview state, and mode-aware navigation. */
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useMode, type StudioMode } from '../studio-app/ModeProvider';
import {
  addStudioEventListener,
  dispatchStudioEvent,
  STUDIO_EVENTS,
  type NavigateWorkspaceDetail,
} from '../studio-events';
import { type EditorView } from '../workspaces/editor/BuildManageToggle';
import { type MappingTabId } from '../workspaces/mapping/MappingTab';
import { type Viewport } from '../workspaces/preview/ViewportSwitcher';
import { type PreviewMode } from '../workspaces/preview/PreviewTab';
import { BLUEPRINT_SECTIONS_BY_TAB } from '../components/shell/ShellConstants';
import { WORKSPACE_SHELL_TAB_ORDER, type WorkspaceShellTab } from '../studio/workspace-shell-tabs';

export type { WorkspaceShellTab } from '../studio/workspace-shell-tabs';
export const WORKSPACE_SHELL_TABS = WORKSPACE_SHELL_TAB_ORDER;

const ADVANCED_WORKSPACE_TABS = new Set(['Evidence', 'Mapping']);
const VALID_MAPPING_TAB_IDS = new Set<string>(['all', 'config', 'rules', 'adapter', 'preview']);
const VALID_EDITOR_VIEWS = new Set<string>(['build', 'manage', 'screener', 'health']);

function modeToWorkspaceTab(mode: StudioMode): WorkspaceShellTab {
  switch (mode) {
    case 'chat': return 'Editor';
    case 'edit': return 'Editor';
    case 'design': return 'Design';
    case 'preview': return 'Preview';
  }
}

export interface WorkspaceRouterState {
  activeTab: WorkspaceShellTab;
  /** Switches workspace tab (syncs {@link ModeProvider} + advanced tabs). */
  setActiveTab: (tab: WorkspaceShellTab) => void;
  activeSection: string;
  setActiveSection: (section: string) => void;
  activeEditorView: EditorView;
  setActiveEditorView: (view: EditorView) => void;
  activeMappingTab: MappingTabId;
  setActiveMappingTab: (tab: MappingTabId) => void;
  mappingConfigOpen: boolean;
  setMappingConfigOpen: (open: boolean) => void;
  previewViewport: Viewport;
  setPreviewViewport: (viewport: Viewport) => void;
  previewMode: PreviewMode;
  setPreviewMode: (mode: PreviewMode) => void;
  advancedTab: 'Evidence' | 'Mapping' | null;
  setAdvancedTab: (tab: 'Evidence' | 'Mapping' | null) => void;
  leftTab: 'blueprint' | 'chat' | 'history';
  setLeftTab: (tab: 'blueprint' | 'chat' | 'history') => void;
  leftCollapsed: boolean;
  setLeftCollapsed: (collapsed: boolean) => void;
  setStudioMode: (mode: StudioMode) => void;
}

export const WorkspaceRouterContext = createContext<WorkspaceRouterState | null>(null);

export function useWorkspaceRouter(): WorkspaceRouterState {
  const ctx = useContext(WorkspaceRouterContext);
  if (!ctx) throw new Error('useWorkspaceRouter must be used within WorkspaceRouterProvider');
  return ctx;
}

export function WorkspaceRouterProvider({ children }: { children: ReactNode }) {
  const { mode, setMode } = useMode();
  const [advancedTab, setAdvancedTab] = useState<'Evidence' | 'Mapping' | null>(null);
  const [activeSection, setActiveSection] = useState<string>('Structure');
  const [activeMappingTab, setActiveMappingTab] = useState<MappingTabId>('all');
  const [mappingConfigOpen, setMappingConfigOpen] = useState(true);
  const [previewViewport, setPreviewViewport] = useState<Viewport>('desktop');
  const [previewMode, setPreviewMode] = useState<PreviewMode>('form');
  const [activeEditorView, setActiveEditorView] = useState<EditorView>('build');
  const [leftTab, setLeftTab] = useState<'blueprint' | 'chat' | 'history'>('blueprint');
  const [leftCollapsed, setLeftCollapsed] = useState(false);

  const activeTab = advancedTab ?? modeToWorkspaceTab(mode);

  const setStudioMode = useCallback((nextMode: StudioMode) => {
    setAdvancedTab(null);
    setMode(nextMode);
  }, [setMode]);

  const setActiveTab = useCallback((tab: WorkspaceShellTab) => {
    if (tab === 'Editor') {
      setAdvancedTab(null);
      setMode('edit');
      setActiveSection('Structure');
      return;
    }
    if (tab === 'Design' || tab === 'Layout') {
      setAdvancedTab(null);
      setMode('design');
      setActiveSection('Colors');
      return;
    }
    if (tab === 'Preview') {
      setAdvancedTab(null);
      setMode('preview');
      return;
    }
    if (ADVANCED_WORKSPACE_TABS.has(tab)) {
      setMode('edit');
      setAdvancedTab(tab);
      setActiveSection(tab === 'Mapping' ? 'Mappings' : 'Structure');
    }
  }, [setMode]);

  useEffect(() => {
    const onNavigateWorkspace = (event: CustomEvent<NavigateWorkspaceDetail>) => {
      const detail = event.detail;
      if (!detail || typeof detail !== 'object') return;

      const tab = typeof detail.tab === 'string' ? detail.tab : undefined;
      const view = typeof detail.view === 'string' ? detail.view : undefined;
      const subTab = typeof detail.subTab === 'string' ? detail.subTab : undefined;
      const section = typeof detail.section === 'string' ? detail.section : undefined;

      if (tab === 'Theme' || tab === 'Design' || tab === 'Layout') {
        setAdvancedTab(null);
        setMode('design');
        setActiveSection(section ?? 'Colors');
        return;
      }

      if (tab === 'Preview' || tab === 'Playthrough') {
        setAdvancedTab(null);
        setMode('preview');
        return;
      }

      if (tab === 'Editor') {
        setAdvancedTab(null);
        setMode('edit');
        if (view && VALID_EDITOR_VIEWS.has(view)) {
          setActiveEditorView(view as EditorView);
        }
        const editorSections = BLUEPRINT_SECTIONS_BY_TAB.Editor;
        const resolvedSection =
          section && editorSections.includes(section)
            ? section
            : view === 'build'
              ? 'Structure'
              : null;
        if (resolvedSection !== null) {
          setActiveSection(resolvedSection);
          if (!view || view === 'manage' || view === 'build') {
            dispatchStudioEvent(STUDIO_EVENTS.SCROLL_TO_SECTION, { section: resolvedSection });
          }
        }
        return;
      }

      if (tab && ADVANCED_WORKSPACE_TABS.has(tab)) {
        setMode('edit');
        setAdvancedTab(tab as 'Evidence' | 'Mapping');
        setActiveSection(tab === 'Mapping' ? 'Mappings' : 'Structure');
        if (subTab && tab === 'Mapping' && VALID_MAPPING_TAB_IDS.has(subTab)) {
          setActiveMappingTab(subTab as MappingTabId);
        }
      }
    };

    const cleanup = addStudioEventListener(STUDIO_EVENTS.NAVIGATE_WORKSPACE, onNavigateWorkspace);
    return cleanup;
    // setState identities are stable; include them so exhaustive-deps matches intentional subscription scope.
  }, [
    setMode,
    setAdvancedTab,
    setActiveSection,
    setActiveEditorView,
    setActiveMappingTab,
    setMappingConfigOpen,
  ]);

  const value: WorkspaceRouterState = {
    activeTab,
    setActiveTab,
    activeSection,
    setActiveSection,
    activeEditorView,
    setActiveEditorView,
    activeMappingTab,
    setActiveMappingTab,
    mappingConfigOpen,
    setMappingConfigOpen,
    previewViewport,
    setPreviewViewport,
    previewMode,
    setPreviewMode,
    advancedTab,
    setAdvancedTab,
    leftTab,
    setLeftTab,
    leftCollapsed,
    setLeftCollapsed,
    setStudioMode,
  };

  return (
    <WorkspaceRouterContext.Provider value={value}>
      {children}
    </WorkspaceRouterContext.Provider>
  );
}
