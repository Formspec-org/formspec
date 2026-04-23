/** @filedesc Manages active workspace tab, section, editor view, mapping tab, and preview state with navigation event listeners. */
import { useState, useEffect } from 'react';
import { type EditorView } from '../workspaces/editor/BuildManageToggle';
import { type MappingTabId } from '../workspaces/mapping/MappingTab';
import { type Viewport } from '../workspaces/preview/ViewportSwitcher';
import { type PreviewMode } from '../workspaces/preview/PreviewTab';

export interface WorkspaceRouterState {
  activeTab: string;
  setActiveTab: (tab: string) => void;
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
}

const VALID_TABS = new Set(['Editor', 'Layout', 'Theme', 'Mapping', 'Preview']);
const VALID_MAPPING_TAB_IDS = new Set<string>(['all', 'config', 'rules', 'adapter', 'preview']);
const VALID_EDITOR_VIEWS = new Set<string>(['build', 'manage', 'screener', 'health']);

function isCustomEventWithDetail(
  event: Event,
): event is CustomEvent<Record<string, unknown>> {
  return 'detail' in event && typeof (event as CustomEvent).detail === 'object' && (event as CustomEvent).detail !== null;
}

export function useWorkspaceRouter(): WorkspaceRouterState {
  const [activeTab, setActiveTab] = useState<string>('Editor');
  const [activeSection, setActiveSection] = useState<string>('Structure');
  const [activeEditorView, setActiveEditorView] = useState<EditorView>('build');
  const [activeMappingTab, setActiveMappingTab] = useState<MappingTabId>('all');
  const [mappingConfigOpen, setMappingConfigOpen] = useState(true);
  const [previewViewport, setPreviewViewport] = useState<Viewport>('desktop');
  const [previewMode, setPreviewMode] = useState<PreviewMode>('form');

  useEffect(() => {
    const onNavigateWorkspace = (event: Event) => {
      if (!isCustomEventWithDetail(event)) return;
      const detail = event.detail as Record<string, unknown>;
      let tab = typeof detail.tab === 'string' ? detail.tab : undefined;
      const subTab = typeof detail.subTab === 'string' ? detail.subTab : undefined;
      const view = typeof detail.view === 'string' ? detail.view : undefined;
      const section = typeof detail.section === 'string' ? detail.section : undefined;
      if (tab && VALID_TABS.has(tab)) {
        setActiveTab(tab);
        if (tab === 'Editor' && view && VALID_EDITOR_VIEWS.has(view)) {
          setActiveEditorView(view as EditorView);
        }
        if (subTab && tab === 'Mapping' && VALID_MAPPING_TAB_IDS.has(subTab)) {
          setActiveMappingTab(subTab as MappingTabId);
        }
        if (section) {
          setActiveSection(section);
          window.dispatchEvent(new CustomEvent('formspec:scroll-to-section', {
            detail: { section },
          }));
        }
      }
    };
    window.addEventListener('formspec:navigate-workspace', onNavigateWorkspace);
    return () => window.removeEventListener('formspec:navigate-workspace', onNavigateWorkspace);
  }, []);

  return {
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
  };
}
