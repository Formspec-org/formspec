/** Normalize BCP 47: lowercase language, title-case script, uppercase region. */
export function normalizeBcp47(code: string): string {
  const parts = code.split('-');
  parts[0] = parts[0].toLowerCase();
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    if (part.length === 2) {
      parts[i] = part.toUpperCase();
    } else if (part.length === 4 && /^[a-zA-Z]+$/.test(part)) {
      parts[i] = part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    } else {
      parts[i] = part.toLowerCase();
    }
  }
  return parts.join('-');
}
