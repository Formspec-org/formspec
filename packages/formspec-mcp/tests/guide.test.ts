import { describe, it, expect } from 'vitest';
import { registryWithProject } from './helpers.js';
import { handleGuide } from '../src/tools/guide.js';
import { ProjectRegistry } from '../src/registry.js';

function parseResult(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0].text);
}

// ── mode: 'new' ─────────────────────────────────────────────────

describe('handleGuide mode=new', () => {
  it('returns a questionnaire with sections', () => {
    const registry = new ProjectRegistry();
    const result = handleGuide(registry, 'new');
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.questionnaire).toBeDefined();
    expect(data.questionnaire.sections).toBeInstanceOf(Array);
    expect(data.questionnaire.sections.length).toBeGreaterThan(0);
  });

  it('includes workflow instructions', () => {
    const registry = new ProjectRegistry();
    const result = handleGuide(registry, 'new');
    const data = parseResult(result);

    expect(data.workflow).toBeDefined();
    expect(data.workflow.first_question).toBeDefined();
    expect(data.workflow.first_question.text).toContain('existing materials');
  });

  it('includes output instructions with artifact list', () => {
    const registry = new ProjectRegistry();
    const result = handleGuide(registry, 'new');
    const data = parseResult(result);

    expect(data.output_instructions).toBeDefined();
    expect(data.output_instructions.artifacts).toEqual(['definition', 'component', 'theme']);
    expect(data.output_instructions.workflow).toBeInstanceOf(Array);
  });

  it('each section has questions with id and text', () => {
    const registry = new ProjectRegistry();
    const result = handleGuide(registry, 'new');
    const data = parseResult(result);

    for (const section of data.questionnaire.sections) {
      expect(section.title).toBeTruthy();
      for (const q of section.questions) {
        expect(q.id).toBeTruthy();
        expect(q.text).toBeTruthy();
        expect(q.type).toBeTruthy();
      }
    }
  });

  it('ignores project_id for new mode', () => {
    const registry = new ProjectRegistry();
    const result = handleGuide(registry, 'new', 'fake-id');
    expect(result.isError).toBeUndefined();
  });

  it('accepts optional context hint', () => {
    const registry = new ProjectRegistry();
    const result = handleGuide(registry, 'new', undefined, 'grant application form');
    const data = parseResult(result);

    // Context is passed through — doesn't change structure but is available
    expect(data.context).toBe('grant application form');
  });
});

// ── mode: 'modify' ──────────────────────────────────────────────

describe('handleGuide mode=modify', () => {
  it('returns form summary and modification questions', () => {
    const { registry, projectId, project } = registryWithProject();
    // Add some fields so there's something to summarize
    project.addField('name', 'Name', 'text');
    project.addField('email', 'Email', 'email');

    const result = handleGuide(registry, 'modify', projectId);
    const data = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(data.current_form).toBeDefined();
    expect(data.questions).toBeInstanceOf(Array);
  });

  it('includes field paths in form summary', () => {
    const { registry, projectId, project } = registryWithProject();
    project.addField('name', 'Name', 'text');

    const result = handleGuide(registry, 'modify', projectId);
    const data = parseResult(result);

    expect(data.current_form.fields).toBeInstanceOf(Array);
    expect(data.current_form.fields).toContain('name');
  });

  it('returns error when project_id missing', () => {
    const registry = new ProjectRegistry();
    const result = handleGuide(registry, 'modify');
    const data = parseResult(result);

    expect(result.isError).toBe(true);
    expect(data.code).toBeTruthy();
  });

  it('returns error when project not found', () => {
    const registry = new ProjectRegistry();
    const result = handleGuide(registry, 'modify', 'nonexistent');
    const data = parseResult(result);

    expect(result.isError).toBe(true);
    expect(data.code).toBe('PROJECT_NOT_FOUND');
  });
});
