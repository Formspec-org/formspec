/** @filedesc Blueprint section rendering the UI component tree with color-coded layout/input/display nodes. */
import type { CompNode } from '@formspec-org/studio-core';
import { useComponent } from '../../state/useComponent';
import { EmptyBlueprintState } from '../shared/EmptyBlueprintState';

const CATEGORY_COLORS: Record<string, string> = {
  layout: 'text-accent',
  input: 'text-green',
  display: 'text-amber',
};

const TYPE_CATEGORIES: Record<string, string> = {
  Root: 'layout',
  Stack: 'layout',
  Page: 'layout',
  Section: 'layout',
  Columns: 'layout',
  Row: 'layout',
  Card: 'layout',
  TextInput: 'input',
  EmailInput: 'input',
  NumberInput: 'input',
  Select: 'input',
  Checkbox: 'input',
  Radio: 'input',
  Textarea: 'input',
  DateInput: 'input',
  Text: 'display',
  Heading: 'display',
  Paragraph: 'display',
  Image: 'display',
  Button: 'input',
};

function categoryColor(type: string): string {
  const cat = TYPE_CATEGORIES[type] ?? 'other';
  return CATEGORY_COLORS[cat] ?? 'text-muted';
}

function CompNodeRow({ node, depth }: { node: CompNode; depth: number }) {
  const bind = node.bind;
  const color = categoryColor(node.component);

  return (
    <>
      <div
        className="flex items-center justify-between px-2 py-1.5 rounded-[4px] hover:bg-subtle/50 transition-colors group cursor-default"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        <span className={`font-mono text-[13px] ${color} font-medium tracking-tight`}>{node.component}</span>
        {bind && (
          <span className="text-[10px] text-muted uppercase tracking-wider bg-surface border border-border/50 px-1.5 py-0.5 rounded opacity-80 group-hover:opacity-100 transition-opacity truncate max-w-[120px]">{bind}</span>
        )}
      </div>
      {node.children?.map((child, i) => (
        <CompNodeRow key={`${child.component}-${i}`} node={child} depth={depth + 1} />
      ))}
    </>
  );
}

export function ComponentTree() {
  const component = useComponent();
  const tree = component.tree as CompNode | undefined;

  if (!tree) {
    return <EmptyBlueprintState message="No component tree" />;
  }

  return (
    <div className="flex flex-col">
      <CompNodeRow node={tree} depth={0} />
    </div>
  );
}
