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
      const detail = (event as CustomEvent<{ tab?: string; subTab?: string; view?: EditorView; section?: string }>).detail ?? {};
      let { tab, subTab, view, section } = detail;
      if (tab === 'Theme') {
        tab = 'Layout';
      }
      if (tab && (tab === 'Editor' || ['Layout', 'Mapping', 'Preview'].includes(tab))) {
        setActiveTab(tab);
        if (tab === 'Editor' && view) {
          setActiveEditorView(view);
        }
        if (subTab) {
          if (tab === 'Mapping') setActiveMappingTab(subTab as MappingTabId);
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
