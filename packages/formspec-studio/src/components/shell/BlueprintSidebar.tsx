import React, { useEffect } from 'react';
import { Blueprint } from '../Blueprint';
import { useOptionalLayoutMode } from '../../workspaces/layout/LayoutModeContext';
import { useBlueprintSectionResolution } from './useBlueprintSectionResolution';
import { THEME_MODE_BLUEPRINT_SECTIONS } from './ShellConstants';
import type { EditorView } from '../../workspaces/editor/BuildManageToggle';

interface BlueprintSidebarProps {
  activeTab: string;
  activeSection: string;
  onSectionChange: (section: string) => void;
  activeEditorView: EditorView | undefined;
  compactLayout: boolean;
  leftWidth: number;
  /** Full-width column (e.g. assistant setup drawer) instead of shell clamp width. */
  embedded?: boolean;
}

export function BlueprintSidebar({
  activeTab,
  activeSection,
  onSectionChange,
  activeEditorView,
  compactLayout,
  leftWidth,
  embedded = false,
}: BlueprintSidebarProps) {
  const layoutModeCtx = useOptionalLayoutMode();
  const { visibleSections, resolvedSection, SidebarComponent } = useBlueprintSectionResolution(activeTab, activeSection);

  useEffect(() => {
    if (activeTab !== 'Design' || !layoutModeCtx) return;
    const first = THEME_MODE_BLUEPRINT_SECTIONS[0] ?? 'Colors';
    if (!THEME_MODE_BLUEPRINT_SECTIONS.includes(activeSection)) {
      onSectionChange(first);
      return;
    }
    layoutModeCtx.setThemeModeSection(activeSection);
  }, [activeTab, activeSection, layoutModeCtx, onSectionChange]);

  if (compactLayout) return null;

  return (
    <aside
      data-testid="blueprint-sidebar"
      className={
        embedded
          ? 'flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-y-auto border-0 glass'
          : 'flex shrink-0 flex-col overflow-y-auto border-r border-border/40 glass'
      }
      style={embedded ? undefined : { width: `clamp(200px, ${leftWidth}px, calc(50vw - 300px))` }}
      aria-label="Blueprint sidebar"
    >

      <Blueprint activeSection={resolvedSection} onSectionChange={onSectionChange} sections={visibleSections} activeEditorView={activeEditorView} activeTab={activeTab} />
      <div className="flex-1 overflow-y-auto px-3 py-4">
        {SidebarComponent && <SidebarComponent />}
      </div>
    </aside>
  );
}
