/**
 * Unit tests for the deterministic adapter — the built-in, regex-based
 * provider that builds analysis/proposal/edit-patch without any LLM calls.
 *
 * Tests cover: buildAnalysis, buildProposal, buildEditPatch, createDeterministicAdapter.
 */

import { describe, expect, it } from 'vitest';
import {
  buildAnalysis,
  buildProposal,
  buildEditPatch,
  createDeterministicAdapter,
} from '../../src/shared/providers/deterministic';
import type {
  AnalysisV1,
  InquestModelInput,
  InquestSessionV1,
  InquestTemplate,
  ProposalV1,
} from '../../src/shared/contracts/inquest';

/* ── Factories ──────────────────────────────────── */

function makeSession(overrides: Partial<InquestSessionV1> = {}): InquestSessionV1 {
  return {
    version: 1,
    sessionId: 'test-session',
    title: 'Test',
    phase: 'inputs',
    mode: 'new-project',
    workflowMode: 'draft-fast',
    providerId: 'deterministic',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    input: { description: '', templateId: undefined, uploads: [], messages: [] },
    issues: [],
    ...overrides,
  };
}

function makeInput(overrides: Partial<InquestModelInput> = {}): InquestModelInput {
  return {
    session: makeSession(),
    ...overrides,
  };
}

function makeTemplate(overrides: Partial<InquestTemplate> = {}): InquestTemplate {
  return {
    id: 'test-template',
    version: '1.0.0',
    name: 'Test Template',
    category: 'Test',
    description: 'A test template.',
    tags: [],
    starterPrompts: [],
    seedAnalysis: {
      sections: [{ id: 'main', title: 'Main' }],
      fields: [
        { key: 'firstName', label: 'First Name', dataType: 'string', required: true, sectionId: 'main' },
        { key: 'lastName', label: 'Last Name', dataType: 'string', sectionId: 'main' },
      ],
      rules: [],
    },
    ...overrides,
  };
}

/* ── buildAnalysis ──────────────────────────────── */

describe('buildAnalysis', () => {
  describe('field detection from description text', () => {
    it('detects email, phone, and address keywords', () => {
      const result = buildAnalysis(makeInput({
        session: makeSession({
          input: { description: 'Collect the applicant email, phone, and mailing address', templateId: undefined, uploads: [], messages: [] },
        }),
      }));

      const keys = result.requirements.fields.map((f) => f.key);
      expect(keys).toContain('email');
      expect(keys).toContain('phone');
      expect(keys).toContain('address');
    });

    it('detects amount/income/budget as money data type', () => {
      const result = buildAnalysis(makeInput({
        session: makeSession({
          input: { description: 'Ask for the household income and monthly budget amounts', templateId: undefined, uploads: [], messages: [] },
        }),
      }));

      const amountField = result.requirements.fields.find((f) => f.key === 'amount');
      expect(amountField).toBeDefined();
      expect(amountField!.dataType).toBe('money');
    });

    it('detects date keyword as date data type', () => {
      const result = buildAnalysis(makeInput({
        session: makeSession({
          input: { description: 'Capture the application date for review', templateId: undefined, uploads: [], messages: [] },
        }),
      }));

      const dateField = result.requirements.fields.find((f) => f.key === 'date');
      expect(dateField).toBeDefined();
      expect(dateField!.dataType).toBe('date');
    });

    it('detects name keyword as string type', () => {
      const result = buildAnalysis(makeInput({
        session: makeSession({
          input: { description: 'We need the applicant name for the records', templateId: undefined, uploads: [], messages: [] },
        }),
      }));

      const nameField = result.requirements.fields.find((f) => f.key === 'name');
      expect(nameField).toBeDefined();
      expect(nameField!.dataType).toBe('string');
    });

    it('detects household as integer type', () => {
      const result = buildAnalysis(makeInput({
        session: makeSession({
          input: { description: 'Record the household size of each applicant', templateId: undefined, uploads: [], messages: [] },
        }),
      }));

      const field = result.requirements.fields.find((f) => f.key === 'householdSize');
      expect(field).toBeDefined();
      expect(field!.dataType).toBe('integer');
    });

    it('detects certification as boolean type', () => {
      const result = buildAnalysis(makeInput({
        session: makeSession({
          input: { description: 'Include a certification checkbox at the end', templateId: undefined, uploads: [], messages: [] },
        }),
      }));

      const field = result.requirements.fields.find((f) => f.key === 'certify');
      expect(field).toBeDefined();
      expect(field!.dataType).toBe('boolean');
    });

    it('marks fields as required when description contains "required"', () => {
      const result = buildAnalysis(makeInput({
        session: makeSession({
          input: { description: 'Collect the required email from the applicant', templateId: undefined, uploads: [], messages: [] },
        }),
      }));

      const emailField = result.requirements.fields.find((f) => f.key === 'email');
      expect(emailField!.required).toBe(true);
    });

    it('marks fields as not required when no required keyword is present', () => {
      const result = buildAnalysis(makeInput({
        session: makeSession({
          input: { description: 'Collect the email from the applicant', templateId: undefined, uploads: [], messages: [] },
        }),
      }));

      const emailField = result.requirements.fields.find((f) => f.key === 'email');
      expect(emailField!.required).toBe(false);
    });

    it('assigns medium confidence to description-detected fields', () => {
      const result = buildAnalysis(makeInput({
        session: makeSession({
          input: { description: 'Collect the email and phone for contact', templateId: undefined, uploads: [], messages: [] },
        }),
      }));

      for (const field of result.requirements.fields) {
        if (field.sourceIds.includes('description')) {
          expect(field.confidence).toMatch(/medium|low/);
        }
      }
    });

    it('parses custom phrases with "field/collect/capture" keywords at low confidence', () => {
      const result = buildAnalysis(makeInput({
        session: makeSession({
          input: { description: 'collect the organization type, capture the project scope', templateId: undefined, uploads: [], messages: [] },
        }),
      }));

      const orgField = result.requirements.fields.find((f) => f.key === 'organizationType');
      expect(orgField).toBeDefined();
      expect(orgField!.confidence).toBe('low');

      const scopeField = result.requirements.fields.find((f) => f.key === 'projectScope');
      expect(scopeField).toBeDefined();
      expect(scopeField!.confidence).toBe('low');
    });
  });

  describe('template field merging', () => {
    it('returns template fields at high confidence', () => {
      const template = makeTemplate();
      const result = buildAnalysis(makeInput({ template }));

      const firstName = result.requirements.fields.find((f) => f.key === 'firstName');
      expect(firstName).toBeDefined();
      expect(firstName!.confidence).toBe('high');
      expect(firstName!.id).toBe('template:firstName');
    });

    it('deduplicates by key, keeping highest confidence when template and description overlap', () => {
      const template = makeTemplate({
        seedAnalysis: {
          sections: [],
          fields: [{ key: 'email', label: 'Email', dataType: 'string', sectionId: 'main' }],
          rules: [],
        },
      });

      const result = buildAnalysis(makeInput({
        template,
        session: makeSession({
          input: { description: 'Collect the email address for notifications', templateId: undefined, uploads: [], messages: [] },
        }),
      }));

      const emailFields = result.requirements.fields.filter((f) => f.key === 'email');
      expect(emailFields).toHaveLength(1);
      expect(emailFields[0].confidence).toBe('high');
      expect(emailFields[0].sourceIds).toContain('test-template');
      expect(emailFields[0].sourceIds).toContain('description');
    });

    it('merges required: template=false + description=true results in required=true', () => {
      const template = makeTemplate({
        seedAnalysis: {
          sections: [],
          fields: [{ key: 'email', label: 'Email', dataType: 'string' }],
          rules: [],
        },
      });

      const result = buildAnalysis(makeInput({
        template,
        session: makeSession({
          input: { description: 'Collect the required email for contact', templateId: undefined, uploads: [], messages: [] },
        }),
      }));

      const emailField = result.requirements.fields.find((f) => f.key === 'email');
      expect(emailField!.required).toBe(true);
    });
  });

  describe('sections', () => {
    it('creates sections from template sections with fieldIds populated', () => {
      const template = makeTemplate();
      const result = buildAnalysis(makeInput({ template }));

      expect(result.requirements.sections).toHaveLength(1);
      expect(result.requirements.sections[0].title).toBe('Main');
      expect(result.requirements.sections[0].fieldIds.length).toBeGreaterThan(0);
    });

    it('creates a single General section when no template is provided', () => {
      const result = buildAnalysis(makeInput({
        session: makeSession({
          input: { description: 'Collect email and phone', templateId: undefined, uploads: [], messages: [] },
        }),
      }));

      expect(result.requirements.sections).toHaveLength(1);
      expect(result.requirements.sections[0].id).toBe('general');
      expect(result.requirements.sections[0].title).toBe('General');
      expect(result.requirements.sections[0].fieldIds.length).toBeGreaterThan(0);
    });
  });

  describe('issues', () => {
    it('emits no-fields issue when nothing is detected', () => {
      const result = buildAnalysis(makeInput({
        session: makeSession({
          input: { description: '', templateId: undefined, uploads: [], messages: [] },
        }),
      }));

      const noFields = result.issues.find((i) => i.id === 'no-fields');
      expect(noFields).toBeDefined();
      expect(noFields!.severity).toBe('warning');
      expect(noFields!.blocking).toBe(true);
    });

    it('emits limited-description when description is under 24 characters', () => {
      const result = buildAnalysis(makeInput({
        session: makeSession({
          input: { description: 'collect email', templateId: undefined, uploads: [], messages: [] },
        }),
      }));

      const limited = result.issues.find((i) => i.id === 'limited-description');
      expect(limited).toBeDefined();
      expect(limited!.severity).toBe('warning');
    });

    it('marks limited-description as blocking when workflowMode is verify-carefully', () => {
      const result = buildAnalysis(makeInput({
        session: makeSession({
          workflowMode: 'verify-carefully',
          input: { description: 'collect email', templateId: undefined, uploads: [], messages: [] },
        }),
      }));

      const limited = result.issues.find((i) => i.id === 'limited-description');
      expect(limited!.blocking).toBe(true);
    });

    it('marks limited-description as non-blocking when workflowMode is draft-fast', () => {
      const result = buildAnalysis(makeInput({
        session: makeSession({
          workflowMode: 'draft-fast',
          input: { description: 'collect email', templateId: undefined, uploads: [], messages: [] },
        }),
      }));

      const limited = result.issues.find((i) => i.id === 'limited-description');
      expect(limited!.blocking).toBe(false);
    });

    it('does not emit limited-description when description is 24+ characters', () => {
      const result = buildAnalysis(makeInput({
        session: makeSession({
          input: { description: 'Collect the email and phone number for all applicants', templateId: undefined, uploads: [], messages: [] },
        }),
      }));

      const limited = result.issues.find((i) => i.id === 'limited-description');
      expect(limited).toBeUndefined();
    });
  });

  describe('trace map', () => {
    it('creates trace entries linking fields to description source', () => {
      const result = buildAnalysis(makeInput({
        session: makeSession({
          input: { description: 'Collect the applicant email for notifications', templateId: undefined, uploads: [], messages: [] },
        }),
      }));

      const emailTraces = result.trace['desc:email'];
      expect(emailTraces).toBeDefined();
      expect(emailTraces.some((t) => t.type === 'description')).toBe(true);
    });

    it('creates trace entries linking fields to template source', () => {
      const template = makeTemplate();
      const result = buildAnalysis(makeInput({ template }));

      const trace = result.trace['template:firstName'];
      expect(trace).toBeDefined();
      expect(trace.some((t) => t.type === 'template' && t.sourceId === 'test-template')).toBe(true);
    });
  });

  describe('summary', () => {
    it('mentions template name when template is provided', () => {
      const template = makeTemplate();
      const result = buildAnalysis(makeInput({ template }));

      expect(result.summary).toContain('Test Template');
    });

    it('mentions description source when no template is provided', () => {
      const result = buildAnalysis(makeInput({
        session: makeSession({
          input: { description: 'Collect email and phone for the intake form', templateId: undefined, uploads: [], messages: [] },
        }),
      }));

      expect(result.summary).toContain('description');
    });

    it('includes the field count in the summary', () => {
      const result = buildAnalysis(makeInput({
        session: makeSession({
          input: { description: 'Collect email and phone for the applicant', templateId: undefined, uploads: [], messages: [] },
        }),
      }));

      const fieldCount = result.requirements.fields.length;
      expect(result.summary).toContain(`${fieldCount}`);
    });
  });

  describe('rules, repeats, and routes from template', () => {
    it('carries template rules through with high confidence', () => {
      const template = makeTemplate({
        seedAnalysis: {
          sections: [],
          fields: [{ key: 'income', label: 'Income', dataType: 'money' }],
          rules: [{
            id: 'income-check',
            label: 'Income is required',
            kind: 'required',
            expression: 'true',
            explanation: 'Always required.',
            fieldPaths: ['income'],
          }],
        },
      });

      const result = buildAnalysis(makeInput({ template }));
      expect(result.requirements.rules).toHaveLength(1);
      expect(result.requirements.rules[0].confidence).toBe('high');
      expect(result.requirements.rules[0].id).toBe('income-check');
    });
  });
});

/* ── buildProposal ──────────────────────────────── */

describe('buildProposal', () => {
  describe('definition generation', () => {
    it('creates a definition with fields as flat items when there is one section', () => {
      const analysis = buildAnalysis(makeInput({
        session: makeSession({
          input: { description: 'Collect the email and phone for the intake form', templateId: undefined, uploads: [], messages: [] },
        }),
      }));

      const result = buildProposal(makeInput({
        session: makeSession({
          input: { description: 'Collect the email and phone for the intake form', templateId: undefined, uploads: [], messages: [] },
        }),
        analysis,
      }));

      const def = result.definition as Record<string, any>;
      expect(def.$formspec).toBe('1.0');
      expect(def.title).toBe('Test');
      expect(def.url).toContain('test-session');
      expect(Array.isArray(def.items)).toBe(true);
      // Flat items (no groups) when single section
      for (const item of def.items) {
        expect(item.type).toBe('field');
      }
    });

    it('creates grouped items when there are multiple sections', () => {
      const template = makeTemplate({
        seedAnalysis: {
          sections: [
            { id: 'personal', title: 'Personal' },
            { id: 'contact', title: 'Contact' },
          ],
          fields: [
            { key: 'fullName', label: 'Full Name', dataType: 'string', sectionId: 'personal' },
            { key: 'email', label: 'Email', dataType: 'string', sectionId: 'contact' },
          ],
          rules: [],
        },
      });

      const analysis = buildAnalysis(makeInput({ template }));
      const result = buildProposal(makeInput({ template, analysis }));

      const def = result.definition as Record<string, any>;
      expect(Array.isArray(def.items)).toBe(true);
      // With multiple sections, items should be groups
      expect(def.items.some((item: any) => item.type === 'group')).toBe(true);
    });

    it('inherits template scaffold definition when available', () => {
      const template = makeTemplate({
        seedScaffold: {
          definition: {
            $formspec: '1.0',
            url: 'urn:formspec:template:test',
            version: '0.1.0',
            title: 'Scaffold Title',
            items: [{ type: 'field', key: 'firstName', label: 'First Name', dataType: 'string' }],
          },
        },
      });

      const analysis = buildAnalysis(makeInput({ template }));
      const result = buildProposal(makeInput({ template, analysis }));

      const def = result.definition as Record<string, any>;
      // Should have scaffold items, not regenerated ones
      expect(def.items).toEqual([{ type: 'field', key: 'firstName', label: 'First Name', dataType: 'string' }]);
      // Title should come from session title, overriding scaffold
      expect(def.title).toBe('Test');
    });

    it('uses session title for the definition', () => {
      const result = buildProposal(makeInput({
        session: makeSession({
          title: 'My Custom Title',
          input: { description: 'Collect email for the application form here', templateId: undefined, uploads: [], messages: [] },
        }),
      }));

      const def = result.definition as Record<string, any>;
      expect(def.title).toBe('My Custom Title');
    });

    it('falls back to "Inquest Draft" when session title is empty', () => {
      const result = buildProposal(makeInput({
        session: makeSession({
          title: '',
          input: { description: 'Collect email for the application form here', templateId: undefined, uploads: [], messages: [] },
        }),
      }));

      const def = result.definition as Record<string, any>;
      expect(def.title).toBe('Inquest Draft');
    });
  });

  describe('bind entries', () => {
    it('creates bind entries for required fields', () => {
      const template = makeTemplate({
        seedAnalysis: {
          sections: [],
          fields: [
            { key: 'firstName', label: 'First Name', dataType: 'string', required: true },
            { key: 'lastName', label: 'Last Name', dataType: 'string' },
          ],
          rules: [],
        },
      });

      const analysis = buildAnalysis(makeInput({ template }));
      const result = buildProposal(makeInput({ template, analysis }));

      const def = result.definition as Record<string, any>;
      expect(def.binds.firstName).toEqual({ required: 'true' });
      expect(def.binds.lastName).toBeUndefined();
    });

    it('creates bind entries from analysis rules', () => {
      const template = makeTemplate({
        seedAnalysis: {
          sections: [],
          fields: [
            { key: 'hasIncome', label: 'Has Income', dataType: 'boolean' },
            { key: 'monthlyIncome', label: 'Monthly Income', dataType: 'money' },
          ],
          rules: [{
            id: 'income-relevant',
            label: 'Income visibility',
            kind: 'relevant',
            expression: '$hasIncome = true',
            explanation: 'Only show income when applicable.',
            fieldPaths: ['monthlyIncome'],
          }],
        },
      });

      const analysis = buildAnalysis(makeInput({ template }));
      const result = buildProposal(makeInput({ template, analysis }));

      const def = result.definition as Record<string, any>;
      expect(def.binds.monthlyIncome).toHaveProperty('relevant', '$hasIncome = true');
    });

    it('uses section-qualified paths for binds when multiple sections exist', () => {
      const template = makeTemplate({
        seedAnalysis: {
          sections: [
            { id: 'personal', title: 'Personal' },
            { id: 'contact', title: 'Contact' },
          ],
          fields: [
            { key: 'fullName', label: 'Full Name', dataType: 'string', required: true, sectionId: 'personal' },
            { key: 'email', label: 'Email', dataType: 'string', required: true, sectionId: 'contact' },
          ],
          rules: [],
        },
      });

      const analysis = buildAnalysis(makeInput({ template }));
      const result = buildProposal(makeInput({ template, analysis }));

      const def = result.definition as Record<string, any>;
      expect(def.binds['personal.fullName']).toEqual({ required: 'true' });
      expect(def.binds['contact.email']).toEqual({ required: 'true' });
    });
  });

  describe('issues', () => {
    it('adds low-confidence-fields issue when any field has low confidence', () => {
      const result = buildProposal(makeInput({
        session: makeSession({
          input: { description: 'collect the organization type, capture the project scope', templateId: undefined, uploads: [], messages: [] },
        }),
      }));

      const issue = result.issues.find((i) => i.id === 'low-confidence-fields');
      expect(issue).toBeDefined();
      expect(issue!.severity).toBe('warning');
      expect(issue!.source).toBe('proposal');
    });

    it('does not add low-confidence-fields issue when all fields are high/medium', () => {
      const template = makeTemplate();
      const result = buildProposal(makeInput({ template }));

      const issue = result.issues.find((i) => i.id === 'low-confidence-fields');
      expect(issue).toBeUndefined();
    });

    it('marks low-confidence-fields as blocking in verify-carefully mode', () => {
      const result = buildProposal(makeInput({
        session: makeSession({
          workflowMode: 'verify-carefully',
          input: { description: 'collect the organization type, capture the project scope', templateId: undefined, uploads: [], messages: [] },
        }),
      }));

      const issue = result.issues.find((i) => i.id === 'low-confidence-fields');
      expect(issue!.blocking).toBe(true);
    });
  });

  describe('summary', () => {
    it('returns correct field, section, and bind counts', () => {
      const template = makeTemplate({
        seedAnalysis: {
          sections: [{ id: 'main', title: 'Main' }],
          fields: [
            { key: 'a', label: 'A', dataType: 'string', required: true, sectionId: 'main' },
            { key: 'b', label: 'B', dataType: 'string', sectionId: 'main' },
            { key: 'c', label: 'C', dataType: 'string', required: true, sectionId: 'main' },
          ],
          rules: [],
        },
      });

      const analysis = buildAnalysis(makeInput({ template }));
      const result = buildProposal(makeInput({ template, analysis }));

      expect(result.summary.fieldCount).toBe(3);
      expect(result.summary.sectionCount).toBe(1);
      expect(result.summary.bindCount).toBe(2); // a and c are required
    });

    it('calculates coverage as percentage of included fields over total', () => {
      const template = makeTemplate();
      const analysis = buildAnalysis(makeInput({ template }));

      // Exclude one field
      analysis.requirements.fields[1].included = false;

      const result = buildProposal(makeInput({ template, analysis }));

      // 1 included out of 2 total
      expect(result.summary.coverage).toBe(50);
    });

    it('handles zero total fields without dividing by zero', () => {
      const analysis: AnalysisV1 = {
        summary: 'No fields',
        requirements: { fields: [], sections: [], rules: [], repeats: [], routes: [] },
        issues: [],
        trace: {},
      };

      const result = buildProposal(makeInput({ analysis }));

      expect(result.summary.coverage).toBe(0);
      expect(result.summary.fieldCount).toBe(0);
    });
  });

  describe('template component passthrough', () => {
    it('passes through component from template scaffold', () => {
      const component = { pages: [{ sections: ['main'] }] };
      const template = makeTemplate({
        seedScaffold: {
          definition: { $formspec: '1.0', items: [] },
          component,
        },
      });

      const result = buildProposal(makeInput({ template }));
      expect(result.component).toEqual(component);
    });

    it('returns undefined component when template has no scaffold', () => {
      const template = makeTemplate({ seedScaffold: undefined });
      const result = buildProposal(makeInput({ template }));
      expect(result.component).toBeUndefined();
    });
  });
});

/* ── buildEditPatch ──────────────────────────────── */

describe('buildEditPatch', () => {
  function makeProposalWithItems(items: any[]): ProposalV1 {
    return {
      definition: { items },
      issues: [],
      trace: {},
      summary: { fieldCount: 0, sectionCount: 0, bindCount: 0, shapeCount: 0, variableCount: 0, coverage: 0 },
    };
  }

  describe('make X required', () => {
    it('generates a setBind command when field exists', () => {
      const proposal = makeProposalWithItems([
        { type: 'field', key: 'email', label: 'Email', dataType: 'string' },
      ]);

      const result = buildEditPatch(makeInput({ proposal, prompt: 'make email required' }));

      expect(result.commands).toHaveLength(1);
      expect(result.commands[0].type).toBe('definition.setBind');
      expect(result.commands[0].payload).toEqual({ path: 'email', properties: { required: 'true' } });
      expect(result.issues).toHaveLength(0);
    });

    it('resolves by label (case insensitive)', () => {
      const proposal = makeProposalWithItems([
        { type: 'field', key: 'fullName', label: 'Full Name', dataType: 'string' },
      ]);

      const result = buildEditPatch(makeInput({ proposal, prompt: 'make full name required' }));

      expect(result.commands).toHaveLength(1);
      expect(result.commands[0].payload).toEqual({ path: 'fullName', properties: { required: 'true' } });
    });

    it('resolves nested field paths', () => {
      const proposal = makeProposalWithItems([
        {
          type: 'group',
          key: 'personal',
          label: 'Personal',
          children: [
            { type: 'field', key: 'email', label: 'Email', dataType: 'string' },
          ],
        },
      ]);

      const result = buildEditPatch(makeInput({ proposal, prompt: 'make email required' }));

      expect(result.commands).toHaveLength(1);
      expect(result.commands[0].payload).toEqual({ path: 'personal.email', properties: { required: 'true' } });
    });

    it('emits edit-required-miss issue when field is not found', () => {
      const proposal = makeProposalWithItems([
        { type: 'field', key: 'email', label: 'Email', dataType: 'string' },
      ]);

      const result = buildEditPatch(makeInput({ proposal, prompt: 'make salary required' }));

      expect(result.commands).toHaveLength(0);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].id).toBe('edit-required-miss');
      expect(result.issues[0].message).toContain('salary');
    });
  });

  describe('add X field', () => {
    it('generates an addItem command with inferred string type', () => {
      const result = buildEditPatch(makeInput({ prompt: 'add middle name field' }));

      expect(result.commands).toHaveLength(1);
      expect(result.commands[0].type).toBe('definition.addItem');
      expect(result.commands[0].payload).toMatchObject({
        type: 'field',
        key: 'middleName',
        label: 'Middle Name',
        dataType: 'string',
      });
    });

    it('infers money type for amount-related field names', () => {
      const result = buildEditPatch(makeInput({ prompt: 'add budget amount field' }));

      expect(result.commands[0].payload.dataType).toBe('money');
    });

    it('infers date type for date-related field names', () => {
      const result = buildEditPatch(makeInput({ prompt: 'add start date field' }));

      expect(result.commands[0].payload.dataType).toBe('date');
    });
  });

  describe('show X only when Y (conditional)', () => {
    it('generates a setBind with relevant expression when both fields exist', () => {
      const proposal = makeProposalWithItems([
        { type: 'field', key: 'hasIncome', label: 'Has Income', dataType: 'boolean' },
        { type: 'field', key: 'monthlyIncome', label: 'Monthly Income', dataType: 'money' },
      ]);

      const result = buildEditPatch(makeInput({
        proposal,
        prompt: 'show monthlyIncome only when hasIncome',
      }));

      expect(result.commands).toHaveLength(1);
      expect(result.commands[0].type).toBe('definition.setBind');
      expect(result.commands[0].payload).toEqual({
        path: 'monthlyIncome',
        properties: { relevant: '$hasIncome = true' },
      });
    });

    it('emits edit-relevant-miss when target field is not found', () => {
      const proposal = makeProposalWithItems([
        { type: 'field', key: 'hasIncome', label: 'Has Income', dataType: 'boolean' },
      ]);

      const result = buildEditPatch(makeInput({
        proposal,
        prompt: 'show salary only when hasIncome',
      }));

      expect(result.commands).toHaveLength(0);
      expect(result.issues.find((i) => i.id === 'edit-relevant-miss')).toBeDefined();
    });

    it('emits edit-relevant-miss when source field is not found', () => {
      const proposal = makeProposalWithItems([
        { type: 'field', key: 'monthlyIncome', label: 'Monthly Income', dataType: 'money' },
      ]);

      const result = buildEditPatch(makeInput({
        proposal,
        prompt: 'show monthlyIncome only when hasIncome',
      }));

      expect(result.commands).toHaveLength(0);
      expect(result.issues.find((i) => i.id === 'edit-relevant-miss')).toBeDefined();
    });
  });

  describe('unrecognized prompts', () => {
    it('emits edit-unsupported when no pattern matches', () => {
      const result = buildEditPatch(makeInput({ prompt: 'change the color to blue' }));

      expect(result.commands).toHaveLength(0);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].id).toBe('edit-unsupported');
      expect(result.issues[0].severity).toBe('info');
    });

    it('emits edit-unsupported when prompt is empty', () => {
      const result = buildEditPatch(makeInput({ prompt: '' }));

      expect(result.commands).toHaveLength(0);
      expect(result.issues[0].id).toBe('edit-unsupported');
    });

    it('emits edit-unsupported when prompt is undefined', () => {
      const result = buildEditPatch(makeInput({}));

      expect(result.commands).toHaveLength(0);
      expect(result.issues[0].id).toBe('edit-unsupported');
    });
  });

  describe('explanation passthrough', () => {
    it('returns the original prompt as explanation', () => {
      const result = buildEditPatch(makeInput({ prompt: 'make email required' }));
      expect(result.explanation).toBe('make email required');
    });
  });
});

/* ── createDeterministicAdapter ─────────────────── */

describe('createDeterministicAdapter', () => {
  const adapter = createDeterministicAdapter('test-det', 'Test Deterministic');

  it('exposes the provided id and label', () => {
    expect(adapter.id).toBe('test-det');
    expect(adapter.label).toBe('Test Deterministic');
  });

  it('declares correct capabilities', () => {
    expect(adapter.capabilities).toEqual({
      chat: true,
      images: false,
      pdf: false,
      structuredOutput: true,
      streaming: false,
    });
  });

  describe('testConnection', () => {
    it('returns ok:true for a non-empty API key', async () => {
      const result = await adapter.testConnection({ apiKey: 'some-key' });
      expect(result.ok).toBe(true);
      expect(result.message).toContain('Test Deterministic');
    });

    it('returns ok:false for an empty API key', async () => {
      const result = await adapter.testConnection({ apiKey: '' });
      expect(result.ok).toBe(false);
    });

    it('returns ok:false for a whitespace-only API key', async () => {
      const result = await adapter.testConnection({ apiKey: '   ' });
      expect(result.ok).toBe(false);
    });
  });

  describe('runAnalysis', () => {
    it('delegates to buildAnalysis and returns the result', async () => {
      const input = makeInput({
        session: makeSession({
          input: { description: 'Collect email and phone for the intake form', templateId: undefined, uploads: [], messages: [] },
        }),
      });

      const result = await adapter.runAnalysis(input);
      const direct = buildAnalysis(input);

      expect(result.requirements.fields.length).toBe(direct.requirements.fields.length);
      expect(result.requirements.fields.map((f) => f.key)).toEqual(direct.requirements.fields.map((f) => f.key));
    });
  });

  describe('runProposal', () => {
    it('delegates to buildProposal and returns the result', async () => {
      const input = makeInput({
        session: makeSession({
          input: { description: 'Collect email and phone for the intake form', templateId: undefined, uploads: [], messages: [] },
        }),
      });

      const result = await adapter.runProposal(input);
      expect(result.definition).toBeDefined();
      expect(result.summary.fieldCount).toBeGreaterThan(0);
    });
  });

  describe('runEdit', () => {
    it('delegates to buildEditPatch and returns the result', async () => {
      const input = makeInput({ prompt: 'add salary field' });

      const result = await adapter.runEdit(input);
      expect(result.commands).toHaveLength(1);
      expect(result.commands[0].type).toBe('definition.addItem');
    });
  });
});
