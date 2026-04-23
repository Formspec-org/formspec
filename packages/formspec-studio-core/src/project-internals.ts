/** @filedesc Narrow interface exposing only the internal Project surface needed by delegate modules. */
import type { IProjectCore } from '@formspec-org/core';
import type { FormDefinition } from './types.js';

export interface ProjectInternals {
  readonly core: IProjectCore;
  readonly definition: Readonly<FormDefinition>;
}
