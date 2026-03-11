import { ShapeCard } from '../../components/ui/ShapeCard';

interface Shape {
  name: string;
  severity: string;
  constraint: string;
  targets?: string[];
  message?: string;
}

interface ShapesSectionProps {
  shapes: Shape[];
}

export function ShapesSection({ shapes }: ShapesSectionProps) {
  if (shapes.length === 0) return null;

  return (
    <div className="space-y-2">
      {shapes.map((shape) => (
        <ShapeCard
          key={shape.name}
          name={shape.name}
          severity={shape.severity}
          constraint={shape.constraint}
        />
      ))}
    </div>
  );
}
