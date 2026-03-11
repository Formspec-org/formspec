/** Convert a FEL field reference to a human-readable label. */
function humanizeRef(ref: string): string {
  // $camelCase -> Title Case with spaces
  const name = ref.replace(/^\$/, '');
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, c => c.toUpperCase())
    .trim();
}

/** Convert a value literal to human-readable form. */
function humanizeValue(val: string): string {
  if (val === 'true') return 'Yes';
  if (val === 'false') return 'No';
  return val;
}

const OP_MAP: Record<string, string> = {
  '=': 'is',
  '!=': 'is not',
  '>': 'is greater than',
  '>=': 'is at least',
  '<': 'is less than',
  '<=': 'is at most',
};

/**
 * Attempt to convert a FEL expression to a human-readable string.
 * Only handles simple `$ref op value` patterns. Returns the raw expression
 * for anything more complex (function calls, nested expressions, etc.).
 */
export function humanizeFEL(expression: string): string {
  const trimmed = expression.trim();

  // Match: $ref op value
  const match = trimmed.match(/^(\$\w+)\s*(!=|>=|<=|=|>|<)\s*(.+)$/);
  if (!match) return trimmed;

  const [, ref, op, value] = match;
  const humanOp = OP_MAP[op];
  if (!humanOp) return trimmed;

  return `${humanizeRef(ref)} ${humanOp} ${humanizeValue(value.trim())}`;
}
