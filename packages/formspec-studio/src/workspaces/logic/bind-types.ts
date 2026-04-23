/** @filedesc Shared bind entry types and bind type constants for the logic workspace. */
import type { FormItem } from '@formspec-org/types';

export interface BindEntry {
  required?: string;
  relevant?: string;
  calculate?: string;
  constraint?: string;
  readonly?: string;
  'pre-populate'?: FormItem['prePopulate'];
  [key: string]: unknown;
}

export const bindTypes = ['required', 'relevant', 'calculate', 'constraint', 'readonly', 'pre-populate'] as const;

export type BindType = (typeof bindTypes)[number];
