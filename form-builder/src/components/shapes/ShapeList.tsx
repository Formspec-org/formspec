import type { FormspecShape } from 'formspec-engine';

interface ShapeListProps {
  shapes: FormspecShape[];
  selectedShapeId: string | null;
  onAdd: () => void;
  onSelect: (shapeId: string) => void;
  onDelete: (shapeId: string) => void;
}

export function ShapeList(props: ShapeListProps) {
  return (
    <div class="shape-list" data-testid="shape-list">
      <button
        type="button"
        class="shape-list__add"
        data-testid="shape-add-button"
        onClick={props.onAdd}
      >
        + Add rule
      </button>

      {props.shapes.length === 0 ? <p class="inspector-hint">No form rules yet.</p> : null}

      {props.shapes.map((shape) => {
        const selected = props.selectedShapeId === shape.id;
        return (
          <div class={`shape-list__row ${selected ? 'is-selected' : ''}`} key={shape.id}>
            <button
              type="button"
              class="shape-list__item"
              data-testid={`shape-item-${toTestIdSegment(shape.id)}`}
              onClick={() => {
                props.onSelect(shape.id);
              }}
            >
              <span class={`shape-list__severity shape-list__severity--${shape.severity ?? 'error'}`}>
                {shapeSeverityGlyph(shape.severity)}
              </span>
              <span class="shape-list__label">{toDisplayName(shape.id)}</span>
              <span class="shape-list__id">{shape.id}</span>
            </button>

            <button
              type="button"
              class="shape-list__delete"
              data-testid={`shape-delete-${toTestIdSegment(shape.id)}`}
              onClick={() => {
                props.onDelete(shape.id);
              }}
            >
              Delete
            </button>
          </div>
        );
      })}
    </div>
  );
}

function shapeSeverityGlyph(severity: FormspecShape['severity']): string {
  if (severity === 'info') {
    return 'i';
  }
  if (severity === 'warning') {
    return '!';
  }
  return 'x';
}

function toDisplayName(value: string): string {
  if (!value) {
    return 'Rule';
  }

  return value
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

function toTestIdSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, '-');
}
