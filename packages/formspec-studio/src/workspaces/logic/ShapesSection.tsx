import { ShapeCard } from '../../components/ui/ShapeCard';

interface Shape {
  name: string;
  severity: string;
  constraint?: string;
  and?: string[];
  or?: string[];
  targets?: string[];
  message?: string;
  code?: string;
}

interface ShapesSectionProps {
  shapes: Shape[];
}

export function ShapesSection({ shapes }: ShapesSectionProps) {
  if (shapes.length === 0) return null;

  return (
    <div className="space-y-2">
      {shapes.map((shape) => {
        const constraint = shape.constraint
          ?? (Array.isArray(shape.or) ? shape.or.join(' or ') : undefined)
          ?? (Array.isArray(shape.and) ? shape.and.join(' and ') : '');

        return (
          <ShapeCard
            key={shape.name}
            name={shape.name}
            severity={shape.severity}
            constraint={constraint}
            message={shape.message}
            code={shape.code}
          />
        );
      })}
    </div>
  );
}
