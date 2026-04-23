import React from 'react';
import { BuildManageToggle, type EditorView } from '../../workspaces/editor/BuildManageToggle';
import { DefinitionTreeEditor } from '../../workspaces/editor/DefinitionTreeEditor';
import { ScreenerWorkspace } from '../../workspaces/editor/ScreenerWorkspace';
import { ManageView } from '../../workspaces/editor/ManageView';
import { MappingTab, type MappingTabId } from '../../workspaces/mapping/MappingTab';
import { PreviewTab } from '../../workspaces/preview/PreviewTab';
import { WORKSPACES } from './ShellConstants';
import type { Viewport } from '../../workspaces/preview/ViewportSwitcher';
import type { PreviewMode } from '../../workspaces/preview/PreviewTab';

interface WorkspaceContentProps {
  activeTab: string;
  activeEditorView: EditorView | undefined;
  setActiveEditorView: (view: EditorView) => void;
  manageCount: number;
  hasScreener: boolean;
  activeMappingTab: MappingTabId;
  setActiveMappingTab: (tab: MappingTabId) => void;
  mappingConfigOpen: boolean;
  setMappingConfigOpen: (open: boolean) => void;
  previewViewport: Viewport;
  setPreviewViewport: (viewport: Viewport) => void;
  previewMode: PreviewMode;
  setPreviewMode: (mode: PreviewMode) => void;
  appearance: 'light' | 'dark';
}

export function WorkspaceContent({
  activeTab,
  activeEditorView,
  setActiveEditorView,
  manageCount,
  hasScreener,
  activeMappingTab,
  setActiveMappingTab,
  mappingConfigOpen,
  setMappingConfigOpen,
  previewViewport,
  setPreviewViewport,
  previewMode,
  setPreviewMode,
  appearance,
}: WorkspaceContentProps) {
  if (activeTab === 'Editor') {
    return (
      <div className="flex-1 overflow-y-auto flex flex-col">
        <div className="px-3 pt-3 md:px-6 md:pt-4 xl:px-8">
          <BuildManageToggle activeView={activeEditorView || 'build'} onViewChange={setActiveEditorView} manageCount={manageCount} showScreener={hasScreener} />
        </div>
        <div key={activeEditorView} className="flex-1 animate-in fade-in duration-150">
          {activeEditorView === 'build'
            ? <DefinitionTreeEditor />
            : activeEditorView === 'screener'
              ? <ScreenerWorkspace />
              : <ManageView />}
        </div>
      </div>
    );
  }

  switch (activeTab) {
    case 'Mapping':
      return (
        <MappingTab
          activeTab={activeMappingTab}
          onActiveTabChange={setActiveMappingTab}
          configOpen={mappingConfigOpen}
          onConfigOpenChange={setMappingConfigOpen}
        />
      );
    case 'Preview':
      return (
        <PreviewTab
          viewport={previewViewport}
          onViewportChange={setPreviewViewport}
          mode={previewMode}
          onModeChange={setPreviewMode}
          appearance={appearance}
        />
      );
    default: {
      const WorkspaceComponent = WORKSPACES[activeTab];
      return WorkspaceComponent ? <WorkspaceComponent /> : <>{activeTab}</>;
    }
  }
}
