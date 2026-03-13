import { useComponent } from '../../state/useComponent';

interface CompNode {
  component: string;
  bind?: string;
  nodeId?: string;
  children?: CompNode[];
  [key: string]: unknown;
}

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
        className="flex items-center gap-1.5 px-2 py-1 text-sm"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        <span className={`font-mono text-xs ${color}`}>{node.component}</span>
        {bind && (
          <span className="text-xs text-muted">{bind}</span>
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
    return <p className="text-sm text-muted py-2">No component tree</p>;
  }

  return (
    <div className="flex flex-col">
      <CompNodeRow node={tree} depth={0} />
    </div>
  );
}
