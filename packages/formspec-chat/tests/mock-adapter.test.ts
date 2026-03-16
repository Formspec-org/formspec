import { describe, it, expect } from 'vitest';
import { MockAdapter } from '../src/mock-adapter.js';
import type { ScaffoldRequest, ScaffoldResult } from '../src/types.js';

describe('MockAdapter', () => {
  const adapter = new MockAdapter();

  describe('isAvailable', () => {
    it('is always available (no API key needed)', async () => {
      expect(await adapter.isAvailable()).toBe(true);
    });
  });

  describe('generateScaffold', () => {
    it('returns template definition when type is template', async () => {
      const request: ScaffoldRequest = {
        type: 'template',
        templateId: 'housing-intake',
      };
      const result = await adapter.generateScaffold(request);

      expect(result.definition).toBeDefined();
      expect(result.definition.title).toMatch(/housing/i);
      expect(result.traces.length).toBeGreaterThan(0);
      // All traces should be template-sourced
      expect(result.traces.every(t => t.sourceType === 'template')).toBe(true);
    });

    it('throws for unknown template ID', async () => {
      const request: ScaffoldRequest = {
        type: 'template',
        templateId: 'nonexistent',
      };
      await expect(adapter.generateScaffold(request)).rejects.toThrow(/not found/i);
    });

    it('generates a basic scaffold from conversation input', async () => {
      const request: ScaffoldRequest = {
        type: 'conversation',
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            content: 'I need a patient intake form with name, date of birth, and insurance info',
            timestamp: 1000,
          },
        ],
      };
      const result = await adapter.generateScaffold(request);

      expect(result.definition).toBeDefined();
      expect(result.definition.items.length).toBeGreaterThan(0);
      expect(result.definition.title).toBeTruthy();
    });

    it('generates a scaffold from extracted upload content', async () => {
      const request: ScaffoldRequest = {
        type: 'upload',
        extractedContent: 'Fields: Name, Email, Phone, Department, Start Date',
      };
      const result = await adapter.generateScaffold(request);

      expect(result.definition).toBeDefined();
      expect(result.definition.items.length).toBeGreaterThan(0);
    });

    it('includes issues for low-confidence elements', async () => {
      const request: ScaffoldRequest = {
        type: 'conversation',
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            content: 'I need a form',
            timestamp: 1000,
          },
        ],
      };
      const result = await adapter.generateScaffold(request);

      // Minimal input should produce at least one low-confidence issue
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues.some(i => i.category === 'low-confidence')).toBe(true);
    });
  });

  describe('refineForm', () => {
    it('returns the current definition unchanged (mock cannot refine)', async () => {
      const baseDef = (await adapter.generateScaffold({
        type: 'template',
        templateId: 'patient-intake',
      })).definition;

      const result = await adapter.refineForm(
        [],
        baseDef,
        'Add a field for blood type',
      );

      // Mock adapter can't meaningfully refine —
      // it returns an issue explaining it needs an AI provider
      expect(result.issues.length).toBeGreaterThan(0);
      expect(
        result.issues.some(i => i.category === 'missing-config'),
      ).toBe(true);
    });
  });

  describe('extractFromFile', () => {
    it('returns a placeholder message (cannot extract without AI)', async () => {
      const content = await adapter.extractFromFile({
        id: 'att-1',
        type: 'pdf',
        name: 'form.pdf',
        data: 'binary-data',
      });
      expect(typeof content).toBe('string');
      expect(content.length).toBeGreaterThan(0);
    });
  });
});
