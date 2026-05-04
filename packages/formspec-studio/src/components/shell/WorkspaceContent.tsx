import { DefinitionTreeEditor } from '../../workspaces/editor/DefinitionTreeEditor';
import { ScreenerWorkspace } from '../../workspaces/editor/ScreenerWorkspace';
import { ManageView } from '../../workspaces/editor/ManageView';
import { BuildManageToggle } from '../../workspaces/editor/BuildManageToggle';
import { MappingTab } from '../../workspaces/mapping/MappingTab';
import { PreviewTab } from '../../workspaces/preview/PreviewTab';
import { WORKSPACES } from './ShellConstants';
import { useWorkspaceRouter } from '../../providers/WorkspaceRouterProvider';
import { useEditorState } from '../../hooks/useEditorState';
import { useProjectState } from '../../state/useProjectState';
import { useColorScheme } from '../../hooks/useColorScheme';

export function WorkspaceContent() {
  const {
    activeTab,
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
  } = useWorkspaceRouter();

  const { manageCount } = useEditorState();
  const hasScreener = useProjectState().screener !== null;
  const appearance = useColorScheme().resolvedTheme;

  if (activeTab === 'Editor') {
    return (
      <div className="flex-1 overflow-y-auto flex flex-col">
        <div className="mb-4">
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
        <div className="flex-1 min-h-0">
          <MappingTab
            activeTab={activeMappingTab}
            onActiveTabChange={setActiveMappingTab}
            configOpen={mappingConfigOpen}
            onConfigOpenChange={setMappingConfigOpen}
          />
        </div>
      );
    case 'Preview':
      return (
        <div className="flex-1 min-h-0">
          <PreviewTab
            viewport={previewViewport}
            onViewportChange={setPreviewViewport}
            mode={previewMode}
            onModeChange={setPreviewMode}
            appearance={appearance}
          />
        </div>
      );
    default: {
      const WorkspaceComponent = WORKSPACES[activeTab];
      return WorkspaceComponent ? (
        <div className="flex-1 min-h-0">
          <WorkspaceComponent />
        </div>
      ) : <>{activeTab}</>;
    }
  }
}
