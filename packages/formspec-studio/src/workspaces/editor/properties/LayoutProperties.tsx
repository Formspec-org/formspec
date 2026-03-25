/** @filedesc Properties panel for selected layout/component-tree nodes showing component type and slot. */
import { Section } from '../../../components/ui/Section';
import { PropertyRow } from '../../../components/ui/PropertyRow';
import { nodeIdFromLayoutId } from '../../../lib/field-helpers';
import { useComponent } from '../../../state/useComponent';
import type { Project } from 'formspec-studio-core';

function findNode(root: any, nodeId: string): any {
  if (root?.nodeId === nodeId) return root;
  for (const child of root?.children ?? []) {
    const match = findNode(child, nodeId);
    if (match) return match;
  }
  return null;
}

export function LayoutProperties({
  layoutId,
  project,
  deselect,
}: {
  layoutId: string;
  project: Project;
  deselect: () => void;
}) {
  const component = useComponent();
  const nodeId = nodeIdFromLayoutId(layoutId);
  const node = component?.tree ? findNode(component.tree, nodeId) : null;
  const componentType = node?.component ?? 'Unknown';

  return (
    <div className="h-full flex flex-col bg-surface overflow-hidden">
      <div className="px-3.5 py-2.5 border-b border-border bg-surface shrink-0">
        <h2 className="text-[15px] font-bold text-ink tracking-tight font-ui">Layout</h2>
      </div>
      <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-4">
        <Section title="Identity">
          <PropertyRow label="Type">
            <span className="font-mono text-[12px] text-accent font-semibold">{componentType}</span>
          </PropertyRow>
          <PropertyRow label="Node ID">
            <span className="font-mono text-[11px] text-muted">{nodeId}</span>
          </PropertyRow>
        </Section>
        <Section title="Actions">
          <div className="flex gap-2">
            <button
              type="button"
              className="flex-1 py-1.5 px-3 rounded text-[11.5px] font-mono border border-border text-muted hover:text-ink hover:border-ink/30 transition-colors cursor-pointer"
              onClick={() => {
                project.unwrapLayoutNode(nodeId);
                deselect();
              }}
            >
              Unwrap
            </button>
            <button
              type="button"
              className="flex-1 py-1.5 px-3 rounded text-[11.5px] font-mono border border-red-300 text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
              onClick={() => {
                project.deleteLayoutNode(nodeId);
                deselect();
              }}
            >
              Delete
            </button>
          </div>
        </Section>
      </div>
    </div>
  );
}
