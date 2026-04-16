/** @filedesc Shared `unknown` narrowers for workspace modules — Pragmatic `data` blobs and JSON-like definition fragments. */

/** Non-null object value (includes arrays). Matches Pragmatic `source.data` / drop target payloads. */
export function isRecord(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object';
}

/** Plain object: not null and not an array — typical for definition `formPresentation` and tree nodes. */
export function isPlainObject(x: unknown): x is Record<string, unknown> {
  return isRecord(x) && !Array.isArray(x);
}
