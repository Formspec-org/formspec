import type { JSX } from 'preact';
import type { FormspecBind, FormspecItem } from 'formspec-engine';

interface TreeNodeProps {
  item: FormspecItem;
  path: string;
  depth: number;
  selected: boolean;
  bind?: FormspecBind;
  collapsed?: boolean;
  hasChildren?: boolean;
  dragging?: boolean;
  onSelect: (path: string) => void;
  onToggleCollapse?: (path: string) => void;
  onReorder?: (path: string, direction: 'up' | 'down') => void;
  onDragStart: (path: string, event: DragEvent) => void;
  onDragEnd: () => void;
}

export function TreeNode(props: TreeNodeProps) {
  const itemType = resolveItemTypeLabel(props.item);
  const icon = resolveItemIcon(props.item);
  const logicBadges = collectLogicBadges(props.bind);
  const className = [
    'structure-node',
    props.selected ? 'is-selected' : '',
    props.dragging ? 'is-dragging' : ''
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      class={className}
      style={{ paddingInlineStart: `${0.35 + props.depth * 0.7}rem` } as JSX.CSSProperties}
      data-item-path={props.path}
      data-testid={`structure-node-${props.path}`}
      draggable
      onDragStart={(event) => {
        props.onDragStart(props.path, event);
      }}
      onDragEnd={() => {
        props.onDragEnd();
      }}
      onClick={(event) => {
        event.stopPropagation();
        props.onSelect(props.path);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          props.onSelect(props.path);
        }
        if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
          event.preventDefault();
          props.onReorder?.(props.path, event.key === 'ArrowUp' ? 'up' : 'down');
        }
      }}
      role="button"
      tabIndex={0}
      aria-current={props.selected ? 'true' : 'false'}
      aria-label={`${itemType}: ${props.item.label ?? props.item.key}`}
    >
      {props.item.type === 'group' ? (
        <button
          type="button"
          class="structure-node__expander"
          aria-label={props.collapsed ? 'Expand group' : 'Collapse group'}
          onClick={(event) => {
            event.stopPropagation();
            props.onToggleCollapse?.(props.path);
          }}
        >
          {props.hasChildren ? (props.collapsed ? '▸' : '▾') : '•'}
        </button>
      ) : (
        <span class="structure-node__spacer" aria-hidden>
          •
        </span>
      )}

      <span class="structure-node__icon" aria-hidden>
        {icon}
      </span>

      <span class="structure-node__label">{props.item.label ?? props.item.key}</span>
      <span class="structure-node__meta">{itemType}</span>

      {logicBadges.length ? (
        <span class="structure-node__badges" aria-label="Logic badges">
          {logicBadges.map((badge) => (
            <span
              class="structure-node__badge"
              title={badge.title}
              data-testid={`structure-logic-badge-${props.path}-${badge.key}`}
              key={badge.key}
            >
              {badge.symbol}
            </span>
          ))}
        </span>
      ) : null}
    </div>
  );
}

function resolveItemTypeLabel(item: FormspecItem): string {
  if (item.type === 'group') {
    return 'Group';
  }
  if (item.type === 'display') {
    return 'Display';
  }
  return item.dataType ?? 'string';
}

function resolveItemIcon(item: FormspecItem): string {
  if (item.type === 'group') {
    return '[]';
  }
  if (item.type === 'display') {
    return 'T';
  }
  const dataType = item.dataType ?? 'string';
  if (dataType === 'boolean') {
    return '?';
  }
  if (dataType === 'choice' || dataType === 'multiChoice') {
    return 'O';
  }
  if (dataType === 'date' || dataType === 'dateTime' || dataType === 'time') {
    return '@';
  }
  if (dataType === 'integer' || dataType === 'decimal' || dataType === 'number' || dataType === 'money') {
    return '#';
  }
  return 'A';
}

function collectLogicBadges(bind: FormspecBind | undefined): Array<{ key: string; symbol: string; title: string }> {
  const badges: Array<{ key: string; symbol: string; title: string }> = [];
  if (hasLogicValue(bind?.required)) {
    badges.push({ key: 'required', symbol: '●', title: 'Required' });
  }
  if (hasLogicValue(bind?.relevant)) {
    badges.push({ key: 'relevant', symbol: '?', title: 'Conditional visibility' });
  }
  if (hasLogicValue(bind?.calculate)) {
    badges.push({ key: 'calculate', symbol: '=', title: 'Calculated value' });
  }
  if (hasLogicValue(bind?.constraint)) {
    badges.push({ key: 'constraint', symbol: '!', title: 'Constraint' });
  }
  if (hasLogicValue(bind?.readonly)) {
    badges.push({ key: 'readonly', symbol: 'L', title: 'Readonly' });
  }
  return badges;
}

function hasLogicValue(value: unknown): boolean {
  if (value === undefined || value === null) {
    return false;
  }
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  return true;
}
