/** @filedesc Layout workspace tab — dispatches to mode-specific page renderers. */
import { useCallback, useContext, useState } from 'react';
import { WorkspacePage, WorkspacePageSection } from '../../components/ui/WorkspacePage';
import { usePageStructure } from './usePageStructure';
import { useProject } from '../../state/useProject';
import { ActiveGroupContext } from '../../state/useActiveGroup';
import { PagesFocusView } from './PagesFocusView';
import { SingleModeCanvas } from './SingleModeCanvas';
import { WizardModeFlow } from './WizardModeFlow';
import { TabsModeEditor } from './TabsModeEditor';
import type { ModeRendererProps } from './mode-renderer-props';

type FlowMode = 'single' | 'wizard' | 'tabs';

function ModeSelector({
  mode,
  onSetMode,
}: {
  mode: FlowMode;
  onSetMode: (mode: FlowMode) => void;
}) {
  const modes: Array<{ id: FlowMode; label: string }> = [
    { id: 'single', label: 'Single' },
    { id: 'wizard', label: 'Wizard' },
    { id: 'tabs', label: 'Tabs' },
  ];
  const modeHelpText: Record<FlowMode, string> = {
    single: 'One continuous form — all content on a single scrollable surface.',
    wizard: 'Step through pages in order and control how the form advances.',
    tabs: 'Keep pages directly reachable from a top-level tab strip.',
  };

  return (
    <div className="space-y-3">
      <div className="inline-flex items-center gap-1 rounded-[14px] border border-border bg-surface p-1 shadow-sm">
        {modes.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => onSetMode(entry.id)}
            className={`rounded-[10px] px-3.5 py-1.5 text-[12px] font-semibold tracking-wide transition-colors ${
              mode === entry.id
                ? 'bg-accent text-white'
                : 'text-muted hover:bg-subtle hover:text-ink'
            }`}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <p className="max-w-[560px] text-[12px] leading-5 text-muted">{modeHelpText[mode]}</p>
    </div>
  );
}

export function PagesTab() {
  const project = useProject();
  const structure = usePageStructure();
  const activeGroupCtx = useContext(ActiveGroupContext);

  const isSingle = structure.mode === 'single';
  const hasPages = structure.pages.length > 0;

  const [deleteToast, setDeleteToast] = useState<{ title: string } | null>(null);
  const [focusPageId, setFocusPageId] = useState<string | null>(null);

  const handleAddPage = useCallback(() => {
    const result = project.addPage(`Page ${structure.pages.length + 1}`);
    if (result.createdId && result.groupKey && activeGroupCtx) {
      activeGroupCtx.setActiveGroupKey(result.groupKey);
    }
  }, [activeGroupCtx, project, structure.pages.length]);

  if (focusPageId) {
    return (
      <PagesFocusView
        pageId={focusPageId}
        onBack={() => setFocusPageId(null)}
        onNavigate={setFocusPageId}
      />
    );
  }

  const rendererProps: ModeRendererProps = {
    structure,
    project,
    activeGroupCtx,
    setDeleteToast,
    setFocusPageId,
    handleAddPage,
  };

  return (
    <WorkspacePage maxWidth="max-w-[980px]" className="overflow-y-auto">
      <WorkspacePageSection
        padding="px-7"
        className="sticky top-0 z-20 border-b border-border/40 bg-bg-default/85 py-6 backdrop-blur-md"
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="max-w-[560px] text-[20px] font-semibold leading-tight text-ink">
                Layout
              </p>
              <p className="max-w-[620px] text-[13px] leading-5 text-muted">
                Organize the user journey — reorder pages, assign fields, and edit grid layouts.
              </p>
            </div>
            <ModeSelector mode={structure.mode} onSetMode={(mode) => project.setFlow(mode)} />
          </div>

          {!isSingle && (
            <div className="flex items-center gap-2">
              {hasPages && (
                <div className="rounded-full border border-border bg-surface px-3 py-1.5 text-[12px] text-muted">
                  {structure.pages.length} {structure.pages.length === 1 ? 'page' : 'pages'}
                </div>
              )}
              <button
                type="button"
                aria-label="Add page"
                onClick={handleAddPage}
                className="rounded-full bg-accent px-4 py-2 text-[12px] font-semibold tracking-wide text-white transition-colors hover:bg-accent/90"
              >
                Add page
              </button>
            </div>
          )}
        </div>
      </WorkspacePageSection>

      <WorkspacePageSection className="space-y-6 py-6">
        {/* Empty states for wizard/tabs with no pages */}
        {!isSingle && !hasPages && (
          <div className="space-y-4 rounded-[28px] border border-dashed border-border bg-surface px-6 py-10 text-center">
            <div className="space-y-2">
              <p className="text-[18px] font-semibold text-ink">No pages yet</p>
              <p className="mx-auto max-w-[460px] text-[13px] leading-5 text-muted">
                Start with a manual page, or generate pages from your current group structure
                and adjust them after.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => project.autoGeneratePages()}
                className="rounded-full border border-border px-4 py-2 text-[12px] font-semibold text-muted transition-colors hover:text-ink"
              >
                Auto-generate from groups
              </button>
              <button
                type="button"
                onClick={handleAddPage}
                className="rounded-full bg-accent px-4 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-accent/90"
              >
                Add page
              </button>
            </div>
          </div>
        )}

        {/* Mode-specific renderers */}
        {structure.mode === 'single' && <SingleModeCanvas {...rendererProps} />}
        {structure.mode === 'wizard' && hasPages && <WizardModeFlow {...rendererProps} />}
        {structure.mode === 'tabs' && hasPages && <TabsModeEditor {...rendererProps} />}
      </WorkspacePageSection>

      {deleteToast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 50,
          }}
          className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-lg"
        >
          <p className="text-[13px] text-ink">{deleteToast.title} deleted</p>
          <button
            type="button"
            aria-label="Undo"
            onClick={() => {
              project.undo();
              setDeleteToast(null);
            }}
            className="rounded-full bg-accent px-3 py-1 text-[12px] font-semibold text-white transition-colors hover:bg-accent/90"
          >
            Undo
          </button>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setDeleteToast(null)}
            className="text-[12px] text-muted transition-colors hover:text-ink"
          >
            Dismiss
          </button>
        </div>
      )}
    </WorkspacePage>
  );
}
