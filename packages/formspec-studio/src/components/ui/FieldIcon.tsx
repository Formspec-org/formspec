/** @filedesc Monospace icon glyph and color mapped from a formspec data type string. */
const typeIcons: Record<string, { icon: string; color: string }> = {
  string: { icon: 'Aa', color: 'text-accent' },
  integer: { icon: '#', color: 'text-green' },
  decimal: { icon: '#.#', color: 'text-green' },
  boolean: { icon: '\u2298', color: 'text-logic' },
  date: { icon: '\uD83D\uDCC5', color: 'text-amber' },
  time: { icon: '\uD83D\uDD50', color: 'text-amber' },
  dateTime: { icon: '\uD83D\uDCC5\uD83D\uDD50', color: 'text-amber' },
  select1: { icon: '\u25C9', color: 'text-accent' },
  select: { icon: '\u2611', color: 'text-accent' },
  binary: { icon: '\uD83D\uDCCE', color: 'text-muted' },
  geopoint: { icon: '\uD83D\uDCCD', color: 'text-green' },
  barcode: { icon: '|||', color: 'text-muted' },
  money: { icon: '$', color: 'text-amber' },
};

interface FieldIconProps {
  dataType: string;
  className?: string;
}

export function FieldIcon({ dataType, className = '' }: FieldIconProps) {
  const info = typeIcons[dataType] || { icon: '?', color: 'text-muted' };
  return <span className={`font-mono text-xs ${info.color} ${className}`}>{info.icon}</span>;
}
