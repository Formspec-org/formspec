/** @filedesc Single-field prePopulate editor: leading @ or $ then instance[.path] (stored as plain instance/path in the definition). */

export interface ParsedPrePopulateBody {
  instance: string;
  path: string;
}

/**
 * Build the editor string from definition fields (always leads with @ for display when non-empty).
 */
export function formatPrePopulateCombined(instance: string | undefined, path: string | undefined): string {
  const i = typeof instance === 'string' ? instance : '';
  const p = typeof path === 'string' ? path : '';
  if (!i.trim() && !p.trim()) {
    return '';
  }
  return `@${i.trim()}${p.trim() ? `.${p.trim()}` : ''}`;
}

/**
 * Normalize user input: non-empty values must start with `$` or `@`. If missing, prepend `@`.
 * After the sigil, the rest splits on the first `.` into instance and path.
 */
export function parsePrePopulateCombined(raw: string): ParsedPrePopulateBody {
  let t = raw.trim();
  if (!t) {
    return { instance: '', path: '' };
  }
  if (t[0] !== '$' && t[0] !== '@') {
    t = `@${t}`;
  }
  const body = t.slice(1);
  const dot = body.indexOf('.');
  if (dot === -1) {
    return { instance: body, path: '' };
  }
  return {
    instance: body.slice(0, dot),
    path: body.slice(dot + 1),
  };
}
