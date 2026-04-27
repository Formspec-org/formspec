/** @filedesc Minimal valid Studio seed used for first-run blank onboarding projects. */
import type { FormDefinition } from '@formspec-org/studio-core';

export const blankDefinition: FormDefinition = {
  $formspec: '1.0',
  name: 'untitled-form',
  title: 'Untitled form',
  status: 'draft',
  formPresentation: {
    pageMode: 'single',
    labelPosition: 'top',
    density: 'comfortable',
  },
  items: [],
};
