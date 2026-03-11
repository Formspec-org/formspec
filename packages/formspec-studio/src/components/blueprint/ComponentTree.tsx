import { useComponent } from '../../state/useComponent';
import { Section } from '../ui/Section';

interface CompNode {
  type: string;
  props?: Record<string, unknown>;
  children?: CompNode[];
}

const CATEGORY_COLORS: Record<string, string> = {
  layout: 'text-accent',
  input: 'text-green',
  display: 'text-amber',
};

const TYPE_CATEGORIES: Record<string, string> = {
  page: 'layout',
  section: 'layout',
  columns: 'layout',
  row: 'layout',
  'text-input': 'input',
  'email-input': 'input',
  'number-input': 'input',
  select: 'input',
  checkbox: 'input',
  radio: 'input',
  textarea: 'input',
  'date-input': 'input',
  heading: 'display',
  paragraph: 'display',
  image: 'display',
  button: 'input',
};

function categoryColor(type: string): string {
  const cat = TYPE_CATEGORIES[type] ?? 'other';
  return CATEGORY_COLORS[cat] ?? 'text-muted';
}

function CompNodeRow({ node, depth }: { node: CompNode; depth: number }) {
  const bind = node.props?.bind as string | undefined;
  const color = categoryColor(node.type);

  return (
    <>
      <div
        className="flex items-center gap-1.5 px-2 py-1 text-sm"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        <span className={`font-mono text-xs ${color}`}>{node.type}</span>
        {bind && (
          <span className="text-xs text-muted">{bind}</span>
        )}
      </div>
      {node.children?.map((child, i) => (
        <CompNodeRow key={`${child.type}-${i}`} node={child} depth={depth + 1} />
      ))}
    </>
  );
}

export function ComponentTree() {
  const component = useComponent();
  const tree = component.tree as CompNode | undefined;

  return (
    <Section title="Component Tree">
      {!tree ? (
        <p className="text-sm text-muted py-2">No component tree</p>
      ) : (
        <div className="flex flex-col">
          <CompNodeRow node={tree} depth={0} />
        </div>
      )}
    </Section>
  );
}
