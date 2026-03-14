/**
 * Built-in form templates — re-used from formspec-studio/shared/templates/templates.ts
 */

import type { InquestTemplate } from './types.js';

export const inquestTemplates: InquestTemplate[] = [
  {
    id: 'housing-intake',
    version: '1.0.0',
    name: 'Housing Intake',
    category: 'Housing',
    description: 'Applicant, household, and income verification intake for housing and recertification programs.',
    tags: ['housing', 'eligibility', 'income'],
    starterPrompts: [
      'Capture applicant identity, household members, and monthly income.',
      'Add screening for veteran status or disability only if the program requires it.',
    ],
    seedAnalysis: {
      sections: [
        { id: 'applicant', title: 'Applicant' },
        { id: 'household', title: 'Household' },
        { id: 'income', title: 'Income' },
      ],
      fields: [
        { key: 'fullName', label: 'Full Name', dataType: 'string', required: true, sectionId: 'applicant' },
        { key: 'dateOfBirth', label: 'Date of Birth', dataType: 'date', required: true, sectionId: 'applicant' },
        { key: 'email', label: 'Email', dataType: 'string', sectionId: 'applicant' },
        { key: 'householdSize', label: 'Household Size', dataType: 'integer', required: true, sectionId: 'household' },
        { key: 'hasIncome', label: 'Has Income', dataType: 'boolean', required: true, sectionId: 'income' },
        { key: 'monthlyIncome', label: 'Monthly Income', dataType: 'money', sectionId: 'income' },
      ],
      rules: [
        {
          id: 'income-required',
          label: 'Monthly income appears only when applicant reports income',
          kind: 'relevant',
          expression: '$hasIncome = true',
          explanation: 'Only ask for monthly income when the applicant reports income.',
          fieldPaths: ['monthlyIncome'],
        },
      ],
    },
    seedScaffold: {
      definition: {
        $formspec: '1.0',
        url: 'urn:formspec:template:housing-intake',
        version: '0.1.0',
        title: 'Housing Intake',
        nonRelevantBehavior: 'remove',
        items: [
          {
            type: 'group', key: 'applicant', label: 'Applicant',
            children: [
              { type: 'field', key: 'fullName', label: 'Full Name', dataType: 'string' },
              { type: 'field', key: 'dateOfBirth', label: 'Date of Birth', dataType: 'date' },
              { type: 'field', key: 'email', label: 'Email', dataType: 'string' },
            ],
          },
          {
            type: 'group', key: 'household', label: 'Household',
            children: [
              { type: 'field', key: 'householdSize', label: 'Household Size', dataType: 'integer' },
            ],
          },
          {
            type: 'group', key: 'income', label: 'Income',
            children: [
              { type: 'field', key: 'hasIncome', label: 'Has Income', dataType: 'boolean' },
              { type: 'field', key: 'monthlyIncome', label: 'Monthly Income', dataType: 'money' },
            ],
          },
        ],
        binds: {
          'applicant.fullName': { required: 'true' },
          'applicant.dateOfBirth': { required: 'true' },
          'household.householdSize': { required: 'true' },
          'income.hasIncome': { required: 'true' },
          'income.monthlyIncome': { relevant: '$income.hasIncome = true' },
        },
      },
    },
    sourceNotes: ['General starter for eligibility-heavy housing intake flows.'],
  },
  {
    id: 'grant-application',
    version: '1.0.0',
    name: 'Grant Application',
    category: 'Grants',
    description: 'Organization, project, budget, and certification workflow for grant applications.',
    tags: ['grants', 'budget', 'organization'],
    starterPrompts: [
      'Collect applicant organization profile, project narrative, and budget request.',
      'Require certification before submission.',
    ],
    seedAnalysis: {
      sections: [
        { id: 'organization', title: 'Organization' },
        { id: 'project', title: 'Project' },
        { id: 'certify', title: 'Certification' },
      ],
      fields: [
        { key: 'organizationName', label: 'Organization Name', dataType: 'string', required: true, sectionId: 'organization' },
        { key: 'contactEmail', label: 'Contact Email', dataType: 'string', required: true, sectionId: 'organization' },
        { key: 'projectTitle', label: 'Project Title', dataType: 'string', required: true, sectionId: 'project' },
        { key: 'requestedAmount', label: 'Requested Amount', dataType: 'money', required: true, sectionId: 'project' },
        { key: 'certifyTruth', label: 'I certify the information is correct', dataType: 'boolean', required: true, sectionId: 'certify' },
      ],
      rules: [
        {
          id: 'certify-required',
          label: 'Certification is required',
          kind: 'required',
          expression: 'true',
          explanation: 'The final certification must be affirmatively checked.',
          fieldPaths: ['certifyTruth'],
        },
      ],
    },
    seedScaffold: {
      definition: {
        $formspec: '1.0',
        url: 'urn:formspec:template:grant-application',
        version: '0.1.0',
        title: 'Grant Application',
        nonRelevantBehavior: 'remove',
        items: [
          {
            type: 'group', key: 'organization', label: 'Organization',
            children: [
              { type: 'field', key: 'organizationName', label: 'Organization Name', dataType: 'string' },
              { type: 'field', key: 'contactEmail', label: 'Contact Email', dataType: 'string' },
            ],
          },
          {
            type: 'group', key: 'project', label: 'Project',
            children: [
              { type: 'field', key: 'projectTitle', label: 'Project Title', dataType: 'string' },
              { type: 'field', key: 'requestedAmount', label: 'Requested Amount', dataType: 'money' },
            ],
          },
          {
            type: 'group', key: 'certification', label: 'Certification',
            children: [
              { type: 'field', key: 'certifyTruth', label: 'I certify the information is correct', dataType: 'boolean' },
            ],
          },
        ],
        binds: {
          'organization.organizationName': { required: 'true' },
          'organization.contactEmail': { required: 'true' },
          'project.projectTitle': { required: 'true' },
          'project.requestedAmount': { required: 'true' },
          'certification.certifyTruth': { required: 'true' },
        },
      },
    },
    sourceNotes: ['Good default for multi-section application flows.'],
  },
  {
    id: 'compliance-checklist',
    version: '1.0.0',
    name: 'Compliance Checklist',
    category: 'Compliance',
    description: 'Checklist and attestation flow for policy and compliance review.',
    tags: ['compliance', 'checklist', 'attestation'],
    starterPrompts: [
      'List the required checks with pass/fail or yes/no responses.',
      'Collect reviewer name and completion date.',
    ],
    seedAnalysis: {
      sections: [
        { id: 'review', title: 'Review Items' },
        { id: 'signoff', title: 'Sign Off' },
      ],
      fields: [
        { key: 'reviewerName', label: 'Reviewer Name', dataType: 'string', required: true, sectionId: 'signoff' },
        { key: 'reviewDate', label: 'Review Date', dataType: 'date', required: true, sectionId: 'signoff' },
        { key: 'allChecksPass', label: 'All Checks Pass', dataType: 'boolean', required: true, sectionId: 'review' },
      ],
      rules: [],
    },
    seedScaffold: {
      definition: {
        $formspec: '1.0',
        url: 'urn:formspec:template:compliance-checklist',
        version: '0.1.0',
        title: 'Compliance Checklist',
        items: [
          {
            type: 'group', key: 'review', label: 'Review',
            children: [
              { type: 'field', key: 'allChecksPass', label: 'All Checks Pass', dataType: 'boolean' },
            ],
          },
          {
            type: 'group', key: 'signoff', label: 'Sign Off',
            children: [
              { type: 'field', key: 'reviewerName', label: 'Reviewer Name', dataType: 'string' },
              { type: 'field', key: 'reviewDate', label: 'Review Date', dataType: 'date' },
            ],
          },
        ],
        binds: {
          'review.allChecksPass': { required: 'true' },
          'signoff.reviewerName': { required: 'true' },
          'signoff.reviewDate': { required: 'true' },
        },
      },
    },
    sourceNotes: ['Checklist-first starter with minimal logic.'],
  },
];

export function findInquestTemplate(templateId?: string): InquestTemplate | undefined {
  return inquestTemplates.find((t) => t.id === templateId);
}
