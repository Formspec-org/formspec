import type { Signal } from '@preact/signals';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { collectLogicCatalog } from '../logic/catalog';
import { addShape, deleteShape } from '../../state/mutations';
import type { ProjectState } from '../../state/project';
import { ShapeEditor } from './ShapeEditor';
import { ShapeList } from './ShapeList';

export interface FormRulesBuilderProps {
  project: Signal<ProjectState>;
}

export function FormRulesBuilder(props: FormRulesBuilderProps) {
  const definition = props.project.value.definition;
  const shapes = definition.shapes ?? [];
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(shapes[0]?.id ?? null);

  useEffect(() => {
    if (shapes.length === 0) {
      setSelectedShapeId(null);
      return;
    }

    if (selectedShapeId && shapes.some((shape) => shape.id === selectedShapeId)) {
      return;
    }

    setSelectedShapeId(shapes[0].id);
  }, [selectedShapeId, shapes]);

  const selectedShape = useMemo(
    () => shapes.find((shape) => shape.id === selectedShapeId) ?? null,
    [selectedShapeId, shapes]
  );

  const logicCatalog = useMemo(() => collectLogicCatalog(definition.items), [definition.items]);
  const fieldOptions = logicCatalog.fields.map((field) => ({
    path: field.path,
    label: field.label
  }));

  return (
    <div class="form-rules-builder" data-testid="form-rules-builder">
      <ShapeList
        shapes={shapes}
        selectedShapeId={selectedShapeId}
        onAdd={() => {
          const nextShapeId = addShape(props.project, { name: 'New rule' });
          setSelectedShapeId(nextShapeId);
        }}
        onSelect={setSelectedShapeId}
        onDelete={(shapeId) => {
          deleteShape(props.project, shapeId);
          if (selectedShapeId === shapeId) {
            setSelectedShapeId(null);
          }
        }}
      />

      {selectedShape ? (
        <ShapeEditor
          project={props.project}
          shape={selectedShape}
          allShapes={shapes}
          fieldOptions={fieldOptions}
        />
      ) : (
        <p class="inspector-hint" data-testid="shape-editor-empty">
          Select a rule to edit its condition and composition.
        </p>
      )}
    </div>
  );
}
