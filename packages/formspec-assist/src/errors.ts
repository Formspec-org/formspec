/** @filedesc Internal error helpers for stable assist tool error envelopes. */

export class AssistError extends Error {
  public readonly code: string;
  public readonly path?: string;

  public constructor(code: string, message: string, path?: string) {
    super(message);
    this.name = 'AssistError';
    this.code = code;
    this.path = path;
  }
}

export function isAssistError(value: unknown): value is AssistError {
  return value instanceof AssistError;
}
