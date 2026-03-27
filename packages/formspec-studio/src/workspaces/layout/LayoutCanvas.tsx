/** @filedesc Main Layout workspace canvas — renders the component tree with page sections, layout containers, and field/display blocks. */
import { useMemo } from 'react';
import { useDefinition } from '../../state/useDefinition';
import { useComponent } from '../../state/useComponent';
import { useProject } from '../../state/useProject';
import { usePageStructure } from '../pages/usePageStructure';
import { buildDefLookup, buildBindKeyMap } from '../../lib/field-helpers';
import { WorkspacePage, WorkspacePageSection } from '../../components/ui/WorkspacePage';
import { ModeSelector } from './ModeSelector';
import { PageNav } from './PageNav';
import { renderLayoutTree } from './render-tree';

interface CompNode {
  component: string;
  bind?: string;
  nodeId?: string;
  title?: string;
  _layout?: boolean;
  children?: CompNode[];
  [key: string]: unknown;
}

export function LayoutCanvas() {
  const definition = useDefinition();
  const component = useComponent();
  const project = useProject();
  const structure = usePageStructure();

  const items = definition?.items ?? [];
  const tree = component?.tree as CompNode | undefined;

  const defLookup = useMemo(() => buildDefLookup(items), [items]);
  const bindKeyMap = useMemo(() => buildBindKeyMap(defLookup), [defLookup]);

  const treeChildren = tree?.children ?? [];

  const hasPages = structure.pages.length > 0;
  const isMultiPage = structure.mode !== 'single' && hasPages;

  const pageNavItems = useMemo(
    () => structure.pages.map((p) => ({ id: p.id, title: p.title || p.id })),
    [structure.pages],
  );

  return (
    <WorkspacePage maxWidth="max-w-[980px]" className="overflow-y-auto">
      <WorkspacePageSection
        padding="px-7"
        className="sticky top-0 z-20 border-b border-border/40 bg-bg-default/85 py-4 backdrop-blur-md"
      >
        <div className="space-y-3">
          <ModeSelector mode={structure.mode} onSetMode={(mode) => project.setFlow(mode)} />
          {isMultiPage && (
            <PageNav
              pages={pageNavItems}
              activePageId={pageNavItems[0]?.id ?? null}
              onSelectPage={() => {}}
            />
          )}
        </div>
      </WorkspacePageSection>

      <WorkspacePageSection className="space-y-3 py-4">
        {renderLayoutTree(treeChildren, { defLookup, bindKeyMap }, '')}

        {treeChildren.length === 0 && (
          <p className="text-center text-[13px] text-muted py-8">
            No items yet. Add fields in the Editor tab.
          </p>
        )}
      </WorkspacePageSection>
    </WorkspacePage>
  );
}
