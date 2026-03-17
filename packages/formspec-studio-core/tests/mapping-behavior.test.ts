import { describe, it, expect } from 'vitest';
import { createProject } from '../src/project.js';

describe('Mapping Behavior & Preview', () => {
  it('executes a basic forward mapping transformation', () => {
    const project = createProject();

    // 1. Setup Form Structure
    project.addField('firstName', 'First Name', 'text');
    project.addField('lastName', 'Last Name', 'text');
    project.addField('emailAddress', 'Email', 'email');

    // 2. Setup Mapping Configuration
    project.setMappingProperty('direction', 'forward');
    project.setMappingTargetSchema('format', 'json');

    // 3. Add Rules
    project.addMappingRule({ sourcePath: 'firstName', targetPath: 'user.first' });
    project.addMappingRule({ sourcePath: 'lastName', targetPath: 'user.last' });
    project.addMappingRule({ sourcePath: 'emailAddress', targetPath: 'contact.email' });

    // 4. Run Preview with Real Data
    const sampleData = {
      firstName: 'Jane',
      lastName: 'Doe',
      emailAddress: 'jane@example.com'
    };

    const result = project.previewMapping({
      sampleData,
      direction: 'forward'
    });

    // 5. Validate Output Data
    expect(result.output).toEqual({
      user: {
        first: 'Jane',
        last: 'Doe'
      },
      contact: {
        email: 'jane@example.com'
      }
    });
  });

  it('handles reverse mapping (inflation)', () => {
    const project = createProject();
    project.addField('username', 'Username', 'text');

    project.addMappingRule({ sourcePath: 'username', targetPath: 'ext_user_id' });

    const externalData = {
      ext_user_id: 'user_12345'
    };

    const result = project.previewMapping({
      sampleData: externalData,
      direction: 'reverse'
    });

    expect(result.output).toEqual({
      username: 'user_12345'
    });
  });

  it('executes complex transforms (valueMap)', () => {
    const project = createProject();
    project.addField('status', 'Status', 'choice');

    // Map with a valueMap transform
    project.addMappingRule({
      sourcePath: 'status',
      targetPath: 'externalStatus',
      transform: 'valueMap'
    });
    project.updateMappingRule(0, 'valueMap', {
      'draft': 0,
      'published': 1,
      'archived': 2
    });

    const sampleData = {
      status: 'published'
    };

    const result = project.previewMapping({
      sampleData,
      direction: 'forward'
    });

    expect(result.output).toEqual({
      externalStatus: 1
    });
  });

  it('auto-generates rules from form structure', () => {
    const project = createProject();
    project.addField('fullName', 'Name', 'text');
    project.addField('age', 'Age', 'integer');

    project.autoGenerateMappingRules({ replace: true });

    const mapping = project.mapping as any;
    expect(mapping.rules.length).toBe(2);
    expect(mapping.rules.some((r: any) => r.sourcePath === 'fullName' && r.targetPath === 'fullName')).toBe(true);

    const result = project.previewMapping({
      sampleData: { fullName: 'Bob', age: 40 },
      direction: 'forward'
    });

    expect(result.output).toEqual({
      fullName: 'Bob',
      age: 40
    });
  });

  it('handles XML root and namespaces in target schema', () => {
    const project = createProject();
    project.addField('patientId', 'ID', 'text');

    project.setMappingTargetSchema('format', 'xml');
    project.setMappingTargetSchema('rootElement', 'Record');
    project.setMappingTargetSchema('namespaces', { 'ns': 'urn:test' });

    project.addMappingRule({ sourcePath: 'patientId', targetPath: 'ID' });

    // Note: The previewMapping for XML might return a JSON structure representing the XML
    // or the actual XML string depending on implementation. 
    // In studio-core, it returns the structured output before adapter serialization if only previewing.
    const result = project.previewMapping({
      sampleData: { patientId: 'P123' },
      direction: 'forward'
    });

    // Even for XML target, the preview output is often the object structure that the XML adapter would consume
    expect(result.output).toEqual({
      ID: 'P123'
    });
  });

  it('honors the autoMap setting in the mapping document', () => {
    const project = createProject();
    project.addField('name', 'Name', 'text');
    project.addField('age', 'Age', 'integer');

    // Set autoMap to true
    project.setMappingProperty('autoMap', true);

    // No explicit rules added!

    const result = project.previewMapping({
      sampleData: { name: 'Alice', age: 30 },
      direction: 'forward'
    });

    // autoMap should have dynamically inferred the rules
    expect(result.output).toEqual({
      name: 'Alice',
      age: 30
    });
  });
});
