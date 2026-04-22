/** @filedesc Shared bind entry types and bind type constants for the logic workspace. */

export interface BindEntry {
  required?: string;
  relevant?: string;
  calculate?: string;
  constraint?: string;
  readonly?: string;
  'pre-populate'?: any;
  [key: string]: any;
}

export const bindTypes = ['required', 'relevant', 'calculate', 'constraint', 'readonly', 'pre-populate'] as const;

export type BindType = (typeof bindTypes)[number];
