/** @filedesc Monospace icon glyph and color mapped from a formspec data type string. */
const typeIcons: Record<string, { icon: string; color: string }> = {
  string: { icon: 'Aa', color: 'text-accent' },
  integer: { icon: '#', color: 'text-green' },
  decimal: { icon: '#.#', color: 'text-green' },
  boolean: { icon: '✓', color: 'text-logic' },
  date: { icon: 'D', color: 'text-amber' },
  time: { icon: 'T', color: 'text-amber' },
  dateTime: { icon: 'DT', color: 'text-amber' },
  choice: { icon: '◉', color: 'text-logic' },
  multiChoice: { icon: '☑', color: 'text-logic' },
  select1: { icon: '◉', color: 'text-logic' },
  select: { icon: '☑', color: 'text-logic' },
  binary: { icon: '\u2191', color: 'text-muted' },
  geopoint: { icon: '\u2316', color: 'text-green' },
  barcode: { icon: '|||', color: 'text-muted' },
  money: { icon: '$', color: 'text-amber' },
  attachment: { icon: '\u2191', color: 'text-muted' },
};

interface FieldIconProps {
  dataType: string;
  className?: string;
}

export function FieldIcon({ dataType, className = '' }: FieldIconProps) {
  const info = typeIcons[dataType] || { icon: '?', color: 'text-muted' };
  return <span className={`font-mono text-2xl ${info.color} ${className}`}>{info.icon}</span>;
}
