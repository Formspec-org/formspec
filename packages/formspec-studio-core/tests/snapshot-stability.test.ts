import { describe, it, expect } from 'vitest';
import { createProject } from '../src/project.js';

describe('Project snapshot reference stability', () => {
  it('project.component returns the same reference across repeat reads with no mutation', () => {
    const project = createProject();
    const first = project.component;
    const second = project.component;
    expect(second).toBe(first);
  });

  it('project.state returns the same reference across repeat reads with no mutation', () => {
    const project = createProject();
    const first = project.state;
    const second = project.state;
    expect(second).toBe(first);
  });

  it('project.component reference changes after a mutation that touches the component tree', () => {
    const project = createProject();
    const before = project.component;
    project.addField('name', 'Full Name', 'text');
    const after = project.component;
    expect(after).not.toBe(before);
  });

  it('project.state reference changes after a mutation', () => {
    const project = createProject();
    const before = project.state;
    project.addField('name', 'Full Name', 'text');
    const after = project.state;
    expect(after).not.toBe(before);
  });
});
