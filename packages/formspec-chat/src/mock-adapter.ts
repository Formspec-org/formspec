import type {
  AIAdapter, ScaffoldRequest, ScaffoldResult,
  ChatMessage, Attachment, SourceTrace, Issue,
} from './types.js';
import type { FormDefinition } from 'formspec-types';
import { TemplateLibrary } from './template-library.js';

const library = new TemplateLibrary();

/**
 * Offline test adapter — works without an API key.
 * Uses templates for scaffold generation and simple heuristics for
 * conversation-based scaffolding. Cannot meaningfully refine forms.
 *
 * Intended for unit/integration tests only. Production uses GeminiAdapter.
 */
export class MockAdapter implements AIAdapter {
  async isAvailable(): Promise<boolean> {
    return true;
  }

  async generateScaffold(request: ScaffoldRequest): Promise<ScaffoldResult> {
    switch (request.type) {
      case 'template':
        return this.scaffoldFromTemplate(request.templateId);
      case 'conversation':
        return this.scaffoldFromConversation(request.messages);
      case 'upload':
        return this.scaffoldFromUpload(request.extractedContent);
    }
  }

  async refineForm(
    _messages: ChatMessage[],
    currentDefinition: FormDefinition,
    _instruction: string,
  ): Promise<ScaffoldResult> {
    return {
      definition: currentDefinition,
      traces: [],
      issues: [{
        severity: 'info',
        category: 'missing-config',
        title: 'AI provider required for refinement',
        description: 'The mock adapter cannot refine forms. Configure an AI provider to enable conversational refinement.',
        sourceIds: [],
      }],
    };
  }

  async extractFromFile(_attachment: Attachment): Promise<string> {
    return 'File extraction requires an AI provider. Configure an API key to enable document analysis.';
  }

  private scaffoldFromTemplate(templateId: string): ScaffoldResult {
    const template = library.getById(templateId);
    if (!template) throw new Error(`Template not found: ${templateId}`);

    const traces: SourceTrace[] = flattenItemKeys(template.definition.items).map(key => ({
      elementPath: key,
      sourceType: 'template' as const,
      sourceId: templateId,
      description: `From ${template.name} template`,
      timestamp: Date.now(),
    }));

    return { definition: template.definition, traces, issues: [] };
  }

  private scaffoldFromConversation(messages: ChatMessage[]): ScaffoldResult {
    const userContent = messages
      .filter(m => m.role === 'user')
      .map(m => m.content)
      .join(' ');

    const match = findBestTemplate(userContent);
    if (match) {
      const result = this.scaffoldFromTemplate(match.id);
      const msgId = messages.find(m => m.role === 'user')?.id ?? 'unknown';
      result.traces = result.traces.map(t => ({
        ...t,
        sourceType: 'message' as const,
        sourceId: msgId,
        description: `Matched from your description`,
      }));
      return result;
    }

    const title = userContent.slice(0, 80) || 'Untitled Form';
    const definition: FormDefinition = {
      $formspec: '1.0',
      url: `urn:formspec:chat:${Date.now()}`,
      version: '0.1.0',
      status: 'draft',
      title,
      items: [
        { key: 'field_1', type: 'field', label: 'Field 1', dataType: 'string' },
      ],
    } as FormDefinition;

    const issues: Omit<Issue, 'id' | 'status'>[] = [{
      severity: 'info',
      category: 'low-confidence',
      title: 'Minimal scaffold generated',
      description: 'The input was too vague for detailed generation. An AI provider would produce better results.',
      sourceIds: messages.map(m => m.id),
    }];

    return { definition, traces: [], issues };
  }

  private scaffoldFromUpload(extractedContent: string): ScaffoldResult {
    const fieldNames = extractedContent
      .replace(/^Fields:\s*/i, '')
      .split(/[,\n]+/)
      .map(s => s.trim())
      .filter(Boolean);

    const items = fieldNames.map((name, i) => ({
      key: toKey(name, i),
      type: 'field' as const,
      label: name,
      dataType: 'string',
    }));

    const definition: FormDefinition = {
      $formspec: '1.0',
      url: `urn:formspec:chat:upload:${Date.now()}`,
      version: '0.1.0',
      status: 'draft',
      title: 'Uploaded Form',
      items: items.length > 0 ? items : [{ key: 'field_1', type: 'field', label: 'Field 1', dataType: 'string' }],
    } as FormDefinition;

    return { definition, traces: [], issues: [] };
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

function flattenItemKeys(items: any[]): string[] {
  const keys: string[] = [];
  for (const item of items) {
    keys.push(item.key);
    if (item.children) keys.push(...flattenItemKeys(item.children));
  }
  return keys;
}

const TEMPLATE_KEYWORDS: Record<string, string[]> = {
  'housing-intake': ['housing', 'tenant', 'rental', 'apartment', 'income eligibility'],
  'grant-application': ['grant', 'funding', 'budget', 'proposal'],
  'patient-intake': ['patient', 'medical', 'health', 'clinic', 'doctor', 'intake'],
  'compliance-checklist': ['compliance', 'checklist', 'audit', 'review', 'inspection'],
  'employee-onboarding': ['employee', 'onboarding', 'new hire', 'hr'],
};

function findBestTemplate(text: string): { id: string } | null {
  const lower = text.toLowerCase();
  let bestId: string | null = null;
  let bestScore = 0;

  for (const [id, keywords] of Object.entries(TEMPLATE_KEYWORDS)) {
    const score = keywords.filter(kw => lower.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestId = id;
    }
  }

  return bestScore > 0 ? { id: bestId! } : null;
}

function toKey(name: string, index: number): string {
  const key = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return key || `field_${index + 1}`;
}
