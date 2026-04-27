/** @filedesc Code-defined starter catalog for Studio onboarding seed selection. */
import type { FormDefinition, ProjectBundle } from '@formspec-org/studio-core';
import { exampleDefinition } from '../fixtures/example-definition.js';

export interface StarterCatalogEntry {
  id: string;
  title: string;
  description: string;
  tags: string[];
  localeAssumptions: string[];
  stats: {
    fieldCount: number;
    pageCount: number;
    sectionCount: number;
  };
  integrationIndicators: string[];
  diagnosticStatus: 'ready' | 'warning';
  bundle: ProjectBundle;
}

export const starterCatalog: StarterCatalogEntry[] = [
  {
    id: 'section-8-hcv-intake',
    title: 'Section 8 HCV intake',
    description: 'Housing voucher intake with applicant, household, income, assets, and review sections.',
    tags: ['benefits', 'housing', 'wizard'],
    localeAssumptions: ['en-US'],
    stats: {
      fieldCount: 28,
      pageCount: 5,
      sectionCount: 5,
    },
    integrationIndicators: ['Definition only'],
    diagnosticStatus: 'ready',
    bundle: { definition: exampleDefinition as FormDefinition },
  },
];
