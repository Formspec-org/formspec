/** @filedesc Built-in catalog of form template archetypes for chat scaffolding. */
import type { Template } from './types.js';
import type { FormDefinition } from 'formspec-types';

const TEMPLATES: Template[] = [
  {
    id: 'housing-intake',
    name: 'Housing Intake Form',
    description: 'Applicant intake for housing programs with income-based eligibility branching.',
    category: 'social-services',
    definition: makeDefinition({
      url: 'urn:formspec:template:housing-intake',
      title: 'Housing Intake Form',
      items: [
        field('applicant_name', 'Applicant Name', 'string'),
        field('date_of_birth', 'Date of Birth', 'date'),
        field('email', 'Email Address', 'string'),
        field('phone', 'Phone Number', 'string'),
        group('address', 'Current Address', [
          field('street', 'Street Address', 'string'),
          field('city', 'City', 'string'),
          field('state', 'State', 'string'),
          field('zip', 'ZIP Code', 'string'),
        ]),
        field('household_size', 'Household Size', 'integer'),
        field('income', 'Annual Household Income', 'decimal'),
        field('income_source', 'Primary Income Source', 'choice', [
          { value: 'employment', label: 'Employment' },
          { value: 'self-employment', label: 'Self-Employment' },
          { value: 'disability', label: 'Disability Benefits' },
          { value: 'retirement', label: 'Retirement/Pension' },
          { value: 'other', label: 'Other' },
        ]),
        group('low_income_details', 'Additional Low-Income Documentation', [
          field('assistance_programs', 'Current Assistance Programs', 'multiChoice', [
            { value: 'snap', label: 'SNAP' },
            { value: 'medicaid', label: 'Medicaid' },
            { value: 'section8', label: 'Section 8' },
            { value: 'none', label: 'None' },
          ]),
          field('case_worker_name', 'Case Worker Name', 'string'),
        ]),
        field('housing_preference', 'Housing Type Preference', 'choice', [
          { value: 'apartment', label: 'Apartment' },
          { value: 'house', label: 'House' },
          { value: 'shared', label: 'Shared Housing' },
        ]),
        field('additional_notes', 'Additional Notes', 'text'),
      ],
      binds: [
        { path: 'applicant_name', required: 'true()' },
        { path: 'email', required: 'true()' },
        { path: 'income', required: 'true()' },
        { path: 'low_income_details', relevant: '$income < 30000' },
      ],
    }),
  },
  {
    id: 'grant-application',
    name: 'Grant Application',
    description: 'Grant application with budget line items and calculated totals.',
    category: 'funding',
    definition: makeDefinition({
      url: 'urn:formspec:template:grant-application',
      title: 'Grant Application',
      items: [
        field('organization_name', 'Organization Name', 'string'),
        field('contact_name', 'Contact Person', 'string'),
        field('contact_email', 'Contact Email', 'string'),
        field('project_title', 'Project Title', 'string'),
        field('project_description', 'Project Description', 'text'),
        field('requested_amount', 'Total Amount Requested', 'decimal'),
        group('budget', 'Budget Line Items', [
          field('line_description', 'Description', 'string'),
          field('line_amount', 'Amount', 'decimal'),
          field('line_justification', 'Justification', 'text'),
        ]),
        field('budget_total', 'Budget Total', 'decimal'),
        field('project_start_date', 'Project Start Date', 'date'),
        field('project_end_date', 'Project End Date', 'date'),
        field('expected_outcomes', 'Expected Outcomes', 'text'),
      ],
      binds: [
        { path: 'organization_name', required: 'true()' },
        { path: 'project_title', required: 'true()' },
        { path: 'requested_amount', required: 'true()' },
        { path: 'budget_total', calculate: 'sum($line_amount)' },
      ],
      shapes: [
        {
          id: 'date-order',
          target: '#',
          constraint: '$project_end_date > $project_start_date',
          message: 'End date must be after start date.',
          severity: 'error' as const,
        },
      ],
    }),
  },
  {
    id: 'patient-intake',
    name: 'Patient Intake Form',
    description: 'Medical patient intake with medical history, allergies, and medications.',
    category: 'healthcare',
    definition: makeDefinition({
      url: 'urn:formspec:template:patient-intake',
      title: 'Patient Intake Form',
      items: [
        field('patient_name', 'Patient Name', 'string'),
        field('date_of_birth', 'Date of Birth', 'date'),
        field('gender', 'Gender', 'choice', [
          { value: 'male', label: 'Male' },
          { value: 'female', label: 'Female' },
          { value: 'non-binary', label: 'Non-binary' },
          { value: 'prefer-not-to-say', label: 'Prefer not to say' },
        ]),
        field('phone', 'Phone Number', 'string'),
        field('emergency_contact', 'Emergency Contact Name', 'string'),
        field('emergency_phone', 'Emergency Contact Phone', 'string'),
        field('insurance_provider', 'Insurance Provider', 'string'),
        field('insurance_id', 'Insurance ID', 'string'),
        group('medical_history', 'Medical History', [
          field('conditions', 'Existing Conditions', 'multiChoice', [
            { value: 'diabetes', label: 'Diabetes' },
            { value: 'hypertension', label: 'Hypertension' },
            { value: 'heart-disease', label: 'Heart Disease' },
            { value: 'asthma', label: 'Asthma' },
            { value: 'none', label: 'None' },
          ]),
          field('allergies', 'Known Allergies', 'text'),
          field('current_medications', 'Current Medications', 'text'),
          field('previous_surgeries', 'Previous Surgeries', 'text'),
        ]),
        field('reason_for_visit', 'Reason for Visit', 'text'),
        field('consent', 'I consent to treatment', 'boolean'),
      ],
      binds: [
        { path: 'patient_name', required: 'true()' },
        { path: 'date_of_birth', required: 'true()' },
        { path: 'consent', required: 'true()' },
      ],
    }),
  },
  {
    id: 'compliance-checklist',
    name: 'Compliance Checklist',
    description: 'Review checklist where sign-off requirements depend on findings.',
    category: 'compliance',
    definition: makeDefinition({
      url: 'urn:formspec:template:compliance-checklist',
      title: 'Compliance Review Checklist',
      items: [
        field('review_date', 'Review Date', 'date'),
        field('reviewer_name', 'Reviewer Name', 'string'),
        field('department', 'Department', 'string'),
        field('policy_area', 'Policy Area', 'choice', [
          { value: 'data-privacy', label: 'Data Privacy' },
          { value: 'financial', label: 'Financial Controls' },
          { value: 'safety', label: 'Workplace Safety' },
          { value: 'hr', label: 'HR Compliance' },
        ]),
        group('checklist_items', 'Checklist Items', [
          field('item_description', 'Item', 'string'),
          field('item_status', 'Status', 'choice', [
            { value: 'pass', label: 'Pass' },
            { value: 'fail', label: 'Fail' },
            { value: 'na', label: 'N/A' },
          ]),
          field('item_notes', 'Notes', 'text'),
        ]),
        field('overall_finding', 'Overall Finding', 'choice', [
          { value: 'compliant', label: 'Compliant' },
          { value: 'non-compliant', label: 'Non-Compliant' },
          { value: 'partial', label: 'Partially Compliant' },
        ]),
        group('supervisor_approval', 'Supervisor Approval', [
          field('supervisor_name', 'Supervisor Name', 'string'),
          field('supervisor_signature', 'Supervisor Signature', 'string'),
          field('approval_date', 'Approval Date', 'date'),
        ]),
        field('corrective_actions', 'Corrective Actions Required', 'text'),
      ],
      binds: [
        { path: 'reviewer_name', required: 'true()' },
        { path: 'overall_finding', required: 'true()' },
        { path: 'supervisor_approval', relevant: "$overall_finding != 'compliant'" },
        { path: 'corrective_actions', relevant: "$overall_finding = 'non-compliant'" },
      ],
    }),
  },
  {
    id: 'employee-onboarding',
    name: 'Employee Onboarding',
    description: 'Onboarding form that adapts based on employment type (full-time, part-time, contractor).',
    category: 'hr',
    definition: makeDefinition({
      url: 'urn:formspec:template:employee-onboarding',
      title: 'Employee Onboarding Form',
      items: [
        field('employee_name', 'Full Legal Name', 'string'),
        field('email', 'Email Address', 'string'),
        field('start_date', 'Start Date', 'date'),
        field('employment_type', 'Employment Type', 'choice', [
          { value: 'full-time', label: 'Full-Time' },
          { value: 'part-time', label: 'Part-Time' },
          { value: 'contractor', label: 'Contractor' },
        ]),
        field('department', 'Department', 'string'),
        field('manager_name', 'Manager Name', 'string'),
        group('benefits_enrollment', 'Benefits Enrollment', [
          field('health_plan', 'Health Insurance Plan', 'choice', [
            { value: 'basic', label: 'Basic' },
            { value: 'standard', label: 'Standard' },
            { value: 'premium', label: 'Premium' },
            { value: 'decline', label: 'Decline Coverage' },
          ]),
          field('dental', 'Dental Coverage', 'boolean'),
          field('vision', 'Vision Coverage', 'boolean'),
          field('retirement_contribution', '401k Contribution %', 'integer'),
        ]),
        group('contractor_details', 'Contractor Details', [
          field('company_name', 'Company/LLC Name', 'string'),
          field('tax_id', 'Tax ID (EIN)', 'string'),
          field('contract_end_date', 'Contract End Date', 'date'),
          field('hourly_rate', 'Hourly Rate', 'decimal'),
        ]),
        field('equipment_needs', 'Equipment Needs', 'multiChoice', [
          { value: 'laptop', label: 'Laptop' },
          { value: 'monitor', label: 'External Monitor' },
          { value: 'phone', label: 'Company Phone' },
          { value: 'desk', label: 'Standing Desk' },
        ]),
        field('direct_deposit', 'Set Up Direct Deposit', 'boolean'),
        field('acknowledgement', 'I acknowledge receipt of the employee handbook', 'boolean'),
      ],
      binds: [
        { path: 'employee_name', required: 'true()' },
        { path: 'email', required: 'true()' },
        { path: 'employment_type', required: 'true()' },
        { path: 'benefits_enrollment', relevant: "$employment_type = 'full-time'" },
        { path: 'contractor_details', relevant: "$employment_type = 'contractor'" },
        { path: 'acknowledgement', relevant: "$employment_type != 'contractor'" },
      ],
    }),
  },
];

/**
 * Catalog of 5 template archetypes for the Chat entry screen.
 */
export class TemplateLibrary {
  getAll(): Template[] {
    return TEMPLATES;
  }

  getById(id: string): Template | undefined {
    return TEMPLATES.find(t => t.id === id);
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

function makeDefinition(
  partial: Omit<FormDefinition, '$formspec' | 'version' | 'status'> & {
    shapes?: FormDefinition['shapes'];
  },
): FormDefinition {
  return {
    $formspec: '1.0',
    version: '0.1.0',
    status: 'draft',
    ...partial,
  } as FormDefinition;
}

interface OptionDef { value: string; label: string }

function field(
  key: string,
  label: string,
  dataType: string,
  options?: OptionDef[],
): any {
  const item: any = { key, type: 'field', label, dataType };
  if (options) item.options = options;
  return item;
}

function group(key: string, label: string, children: any[]): any {
  return { key, type: 'group', label, children };
}
