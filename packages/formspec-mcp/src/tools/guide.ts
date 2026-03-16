/**
 * Guide tool: interactive questionnaire for conversational form intake.
 *
 * mode='new': Returns structured questionnaire for requirements gathering.
 * mode='modify': Returns current form summary + targeted modification questions.
 */

import type { ProjectRegistry } from '../registry.js';
import { successResponse, errorResponse, formatToolError } from '../errors.js';

const NEW_FORM_QUESTIONNAIRE = {
  sections: [
    {
      title: 'Purpose & Audience',
      questions: [
        { id: 'purpose', text: 'What is this form for?', type: 'open' },
        { id: 'audience', text: 'Who fills it out?', type: 'open' },
      ],
    },
    {
      title: 'Fields & Structure',
      questions: [
        { id: 'fields', text: 'What information do you need to collect? List the fields.', type: 'open' },
        {
          id: 'multi_page', text: 'Single page or multi-page?', type: 'choice',
          options: ['Single page', 'Multi-page wizard', 'Tabbed sections'],
        },
        { id: 'repeating', text: 'Any repeating sections (e.g., "add another item")?', type: 'boolean' },
        { id: 'groups', text: 'Should fields be grouped into sections?', type: 'boolean' },
      ],
    },
    {
      title: 'Logic & Validation',
      questions: [
        { id: 'conditional', text: 'Fields that show/hide based on answers?', type: 'boolean' },
        { id: 'calculated', text: 'Computed values (totals, scores, derived fields)?', type: 'boolean' },
        { id: 'validation', text: 'Special validation rules beyond required fields?', type: 'open' },
      ],
    },
    {
      title: 'Advanced',
      questions: [
        { id: 'screener', text: 'Pre-screening step before the main form?', type: 'boolean' },
        { id: 'external_data', text: 'Load data from external sources?', type: 'boolean' },
        { id: 'branding', text: 'Any styling or branding requirements?', type: 'open' },
      ],
    },
  ],
};

const WORKFLOW_INSTRUCTIONS = {
  first_question: {
    text: 'Do you have existing materials (PDFs, Excel files, images, wireframes) that describe this form?',
    if_yes: 'Ask the user to share the materials. Review them thoroughly, then produce all three JSON artifacts (definition, component, theme) in one shot via formspec_draft.',
    if_no: 'Proceed with the questionnaire below.',
  },
};

const OUTPUT_INSTRUCTIONS = {
  artifacts: ['definition', 'component', 'theme'],
  workflow: [
    '1. Build all three JSON artifacts from gathered requirements',
    '2. Submit each via formspec_draft(type, json)',
    '3. Call formspec_load to transition to authoring',
    '4. Use authoring tools for incremental refinements',
  ],
};

const MODIFY_QUESTIONS = [
  { id: 'change_type', text: 'What do you want to change?', type: 'choice', options: ['Add fields', 'Modify logic', 'Restyle/retheme', 'Restructure pages', 'Other'] },
  { id: 'affected_area', text: 'Which section or fields are affected?', type: 'open' },
];

export function handleGuide(
  registry: ProjectRegistry,
  mode: 'new' | 'modify',
  projectId?: string,
  context?: string,
) {
  if (mode === 'new') {
    return successResponse({
      workflow: WORKFLOW_INSTRUCTIONS,
      questionnaire: NEW_FORM_QUESTIONNAIRE,
      output_instructions: OUTPUT_INSTRUCTIONS,
      ...(context ? { context } : {}),
    });
  }

  // mode === 'modify'
  if (!projectId) {
    return errorResponse(formatToolError(
      'MISSING_PROJECT_ID',
      'project_id is required for modify mode',
    ));
  }

  try {
    const project = registry.getProject(projectId);
    const stats = project.statistics();
    const fields = project.fieldPaths();

    return successResponse({
      current_form: {
        fields,
        statistics: stats,
      },
      questions: MODIFY_QUESTIONS,
      ...(context ? { context } : {}),
    });
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err) {
      const e = err as { code: string; message: string };
      return errorResponse(formatToolError(e.code, e.message));
    }
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(formatToolError('COMMAND_FAILED', message));
  }
}
