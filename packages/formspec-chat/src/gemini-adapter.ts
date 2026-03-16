import { GoogleGenAI, type GenerateContentResponse } from '@google/genai';
import type {
  AIAdapter, ScaffoldRequest, ScaffoldResult,
  ChatMessage, Attachment, SourceTrace, Issue,
} from './types.js';
import type { FormDefinition } from 'formspec-types';
import { TemplateLibrary } from './template-library.js';

const library = new TemplateLibrary();

// ── System prompt ────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a form design assistant. You generate Formspec form definitions as JSON.

Formspec is a declarative form specification. A form definition has a "title" and an array of "items".

Each item is one of:
- **field**: A data-collecting element. Properties: key (snake_case), type: "field", label (human-readable), dataType (one of: "string", "text", "number", "integer", "decimal", "boolean", "date", "email", "choice", "multiChoice"). For choice/multiChoice fields, include an "options" array of { "value": string, "label": string }.
- **group**: A container for related fields. Properties: key (snake_case), type: "group", label (human-readable), children (array of items).

Rules:
- Use descriptive snake_case keys (e.g., "first_name", "date_of_birth")
- Every field must have a label and dataType
- Group related fields logically (e.g., address fields in an "address" group)
- Use appropriate dataTypes: "email" for emails, "date" for dates, "integer" for whole numbers, "decimal" for money, "boolean" for yes/no, "choice" for single-select, "multiChoice" for multi-select
- Generate a meaningful title that describes the form's purpose

Respond with a JSON object containing "title" (string) and "items" (array of items).`;

// ── Response schema for Gemini structured output ─────────────────────

// Gemini doesn't support $ref in response schemas, so we inline one level of
// nesting: top-level items can be groups with children, but children are leaf items.
// The system prompt encourages flat groups which covers most real forms.

const OPTION_SCHEMA = {
  type: 'object' as const,
  properties: {
    value: { type: 'string' as const },
    label: { type: 'string' as const },
  },
  required: ['value', 'label'] as const,
};

const LEAF_ITEM_SCHEMA = {
  type: 'object' as const,
  properties: {
    key: { type: 'string' as const },
    type: { type: 'string' as const, enum: ['field', 'group'] },
    label: { type: 'string' as const },
    dataType: { type: 'string' as const },
    options: { type: 'array' as const, items: OPTION_SCHEMA },
  },
  required: ['key', 'type', 'label'] as const,
};

const ITEM_SCHEMA = {
  type: 'object' as const,
  properties: {
    key: { type: 'string' as const },
    type: { type: 'string' as const, enum: ['field', 'group'] },
    label: { type: 'string' as const },
    dataType: { type: 'string' as const },
    options: { type: 'array' as const, items: OPTION_SCHEMA },
    children: { type: 'array' as const, items: LEAF_ITEM_SCHEMA },
  },
  required: ['key', 'type', 'label'] as const,
};

const RESPONSE_SCHEMA = {
  type: 'object' as const,
  properties: {
    title: { type: 'string' as const },
    items: {
      type: 'array' as const,
      items: ITEM_SCHEMA,
    },
  },
  required: ['title', 'items'],
};

// ── Helpers ──────────────────────────────────────────────────────────

function wrapAsDefinition(parsed: { title: string; items: any[] }): FormDefinition {
  return {
    $formspec: '1.0',
    url: `urn:formspec:chat:${Date.now()}`,
    version: '0.1.0',
    status: 'draft',
    title: parsed.title,
    items: parsed.items,
  } as FormDefinition;
}

function flattenItemKeys(items: any[]): string[] {
  const keys: string[] = [];
  for (const item of items) {
    keys.push(item.key);
    if (item.children) keys.push(...flattenItemKeys(item.children));
  }
  return keys;
}

function extractText(response: GenerateContentResponse): string {
  return response.text ?? '';
}

function minimalFallback(title: string): FormDefinition {
  return {
    $formspec: '1.0',
    url: `urn:formspec:chat:${Date.now()}`,
    version: '0.1.0',
    status: 'draft',
    title,
    items: [
      { key: 'field_1', type: 'field', label: 'Field 1', dataType: 'string' },
    ],
  } as FormDefinition;
}

// ── GeminiAdapter ────────────────────────────────────────────────────

export class GeminiAdapter implements AIAdapter {
  private client: GoogleGenAI;
  private model: string;

  constructor(apiKey: string, model = 'gemini-2.5-flash') {
    this.client = new GoogleGenAI({ apiKey });
    this.model = model;
  }

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
    messages: ChatMessage[],
    currentDefinition: FormDefinition,
    instruction: string,
  ): Promise<ScaffoldResult> {
    const conversationHistory = messages
      .filter(m => m.role === 'user')
      .map(m => m.content)
      .join('\n');

    const prompt = `Here is the current form definition:\n\`\`\`json\n${JSON.stringify(currentDefinition, null, 2)}\n\`\`\`\n\nConversation context:\n${conversationHistory}\n\nInstruction: ${instruction}\n\nUpdate the form definition according to the instruction. Return the complete updated form definition.`;

    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
        },
      });

      const text = extractText(response);
      const parsed = JSON.parse(text);
      const definition = wrapAsDefinition(parsed);
      // Preserve the original URL
      definition.url = currentDefinition.url;

      const traces: SourceTrace[] = flattenItemKeys(parsed.items).map(key => ({
        elementPath: key,
        sourceType: 'message' as const,
        sourceId: 'refinement',
        description: `Updated: ${instruction.slice(0, 60)}`,
        timestamp: Date.now(),
      }));

      return { definition, traces, issues: [] };
    } catch (err) {
      return {
        definition: currentDefinition,
        traces: [],
        issues: [{
          severity: 'error',
          category: 'missing-config',
          title: 'Refinement failed',
          description: `Gemini API error: ${(err as Error).message}`,
          sourceIds: [],
        }],
      };
    }
  }

  async extractFromFile(attachment: Attachment): Promise<string> {
    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: `Extract all form field names, labels, and structure from this document content. Return a plain text description of the fields found.\n\nDocument name: ${attachment.name}\nContent:\n${attachment.data}`,
      });

      return extractText(response) || attachment.data;
    } catch {
      return attachment.data;
    }
  }

  // ── Private ──────────────────────────────────────────────────────

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

  private async scaffoldFromConversation(messages: ChatMessage[]): Promise<ScaffoldResult> {
    const userContent = messages
      .filter(m => m.role === 'user')
      .map(m => m.content)
      .join('\n');

    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: `Design a form based on this description:\n\n${userContent}`,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
        },
      });

      const text = extractText(response);
      const parsed = JSON.parse(text);
      const definition = wrapAsDefinition(parsed);

      const msgId = messages.find(m => m.role === 'user')?.id ?? 'unknown';
      const traces: SourceTrace[] = flattenItemKeys(parsed.items).map(key => ({
        elementPath: key,
        sourceType: 'message' as const,
        sourceId: msgId,
        description: 'Generated from your description',
        timestamp: Date.now(),
      }));

      return { definition, traces, issues: [] };
    } catch (err) {
      return {
        definition: minimalFallback(userContent.slice(0, 80) || 'Untitled Form'),
        traces: [],
        issues: [{
          severity: 'error',
          category: 'missing-config',
          title: 'Generation failed',
          description: `Gemini API error: ${(err as Error).message}`,
          sourceIds: messages.map(m => m.id),
        }],
      };
    }
  }

  private async scaffoldFromUpload(extractedContent: string): Promise<ScaffoldResult> {
    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: `Create a form definition from this extracted document content. Identify fields, their types, and group related fields logically:\n\n${extractedContent}`,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
        },
      });

      const text = extractText(response);
      const parsed = JSON.parse(text);
      const definition = wrapAsDefinition(parsed);

      const traces: SourceTrace[] = flattenItemKeys(parsed.items).map(key => ({
        elementPath: key,
        sourceType: 'upload' as const,
        sourceId: 'upload',
        description: 'Extracted from uploaded document',
        timestamp: Date.now(),
      }));

      return { definition, traces, issues: [] };
    } catch (err) {
      return {
        definition: minimalFallback('Uploaded Form'),
        traces: [],
        issues: [{
          severity: 'error',
          category: 'missing-config',
          title: 'Upload processing failed',
          description: `Gemini API error: ${(err as Error).message}`,
          sourceIds: [],
        }],
      };
    }
  }
}
