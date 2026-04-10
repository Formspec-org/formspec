/** @filedesc AIAdapter implementation backed by the OpenAI API. */
import OpenAI from 'openai';
import type {
  AIAdapter, ScaffoldRequest, ScaffoldResult, ScaffoldProgressCallback,
  ChatMessage, Attachment, SourceTrace,
  ConversationResponse, ToolContext, RefinementResult, ToolCallRecord,
} from './types.js';
import { TemplateLibrary } from './template-library.js';
import { deriveScaffoldSchema, scaffoldOutputToDefinition } from './scaffold-schema.js';
import definitionSchema from './definition-schema.json' with { type: 'json' };

const library = new TemplateLibrary();
const SCAFFOLD_RESPONSE_SCHEMA = deriveScaffoldSchema(definitionSchema, 'openai');

// ── System prompts ──────────────────────────────────────────────────

const SCAFFOLD_SYSTEM_PROMPT = `You are a form design assistant that generates Formspec form definitions.

Formspec is a declarative form specification. Generate a JSON object with a descriptive "title" and an "items" array. The response schema defines the structure — follow it exactly.

Rules:
- Use descriptive snake_case keys (e.g., "first_name", "date_of_birth")
- Group related fields logically (e.g., address fields in an "address" group)
- For choice/multiChoice fields, always include an "options" array
- Set "options" to null for non-choice fields
- Set "children" to null for fields — only groups have children
- Set "dataType" to null for groups — only fields have dataType`;

const INTERVIEW_SYSTEM_PROMPT = `You are a form design interviewer. Your job is to have a short, focused conversation to understand what form the user needs before generating it.

Guide the conversation through these sections (you don't need to cover all — stop when you have enough):
1. **Purpose** — What is the form for? Who fills it out? What's the context?
2. **Fields** — What data needs to be collected? What field types (text, dates, choices, etc.)?
3. **Logic** — Any conditional fields, calculated values, or validation rules?
4. **Advanced** — Multi-page layout, repeating sections, file uploads?

Rules:
- Ask 1-2 focused questions at a time, not a wall of questions
- Be conversational and encouraging
- When you have enough information to generate a good form, set readyToScaffold to true and tell the user they can generate the form
- Set readyToScaffold to true only when you have at least a clear purpose and some field ideas
- If the user's very first message is extremely detailed, you can set readyToScaffold to true immediately`;

const REFINEMENT_SYSTEM_PROMPT = `You are a form design assistant. You modify forms using the provided tools.
Use formspec_describe to inspect the current form structure before making changes.
Make surgical edits — add, update, or remove specific fields rather than rebuilding.
When done with all changes, respond with a brief summary of what you did.`;

// Scaffold response schema is derived from the canonical definition.schema.json
// at module load time via deriveScaffoldSchema() — see import above.

const INTERVIEW_RESPONSE_SCHEMA = {
  type: 'object' as const,
  description: 'Interview response with a conversational message and a readiness signal.',
  properties: {
    message: {
      type: 'string' as const,
      description: 'Conversational response to the user. Ask 1-2 focused follow-up questions, or confirm readiness to generate.',
    },
    readyToScaffold: {
      type: 'boolean' as const,
      description: 'True when enough information has been gathered (clear purpose + some field ideas). False to continue the interview.',
    },
  },
  required: ['message', 'readyToScaffold'],
  additionalProperties: false as const,
} as const;

// ── Helpers ──────────────────────────────────────────────────────────


function flattenItemKeys(items: any[]): string[] {
  const keys: string[] = [];
  for (const item of items) {
    keys.push(item.key);
    if (item.children) keys.push(...flattenItemKeys(item.children));
  }
  return keys;
}

// ── OpenAIAdapter ───────────────────────────────────────────────────

export class OpenAIAdapter implements AIAdapter {
  private client: OpenAI;
  private model: string;
  private registryHints: string;

  constructor(apiKey: string, model = 'gpt-4o', registryHints = '') {
    this.client = new OpenAI({ apiKey });
    this.model = model;
    this.registryHints = registryHints;
  }

  private get scaffoldPrompt(): string {
    return this.registryHints
      ? `${SCAFFOLD_SYSTEM_PROMPT}\n\n${this.registryHints}`
      : SCAFFOLD_SYSTEM_PROMPT;
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async chat(messages: ChatMessage[]): Promise<ConversationResponse> {
    const openaiMessages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: INTERVIEW_SYSTEM_PROMPT },
      ...messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
    ];

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: openaiMessages,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'interview_response',
            strict: true,
            schema: INTERVIEW_RESPONSE_SCHEMA,
          },
        },
      });

      const text = response.choices[0]?.message?.content;
      if (!text) throw new Error('OpenAI returned empty response');

      const parsed = JSON.parse(text);
      return {
        message: parsed.message,
        readyToScaffold: Boolean(parsed.readyToScaffold),
      };
    } catch (err) {
      const userMessageCount = messages.filter(m => m.role === 'user').length;
      return {
        message: userMessageCount >= 3
          ? `I encountered a temporary issue connecting to the AI provider, but you've provided enough context. Click **Generate Form** when you're ready.`
          : `I'd love to help you build a form! Could you tell me more about what you need? (Note: I encountered a temporary issue, but we can continue.)`,
        readyToScaffold: userMessageCount >= 3,
      };
    }
  }

  async generateScaffold(request: ScaffoldRequest, onProgress?: ScaffoldProgressCallback): Promise<ScaffoldResult> {
    switch (request.type) {
      case 'template':
        return this.scaffoldFromTemplate(request.templateId);
      case 'conversation':
        return this.scaffoldFromConversation(request.messages, onProgress);
      case 'upload':
        return this.scaffoldFromUpload(request.extractedContent);
    }
  }

  async refineForm(
    messages: ChatMessage[],
    instruction: string,
    toolContext: ToolContext,
  ): Promise<RefinementResult> {
    const toolCalls: ToolCallRecord[] = [];

    const tools: OpenAI.ChatCompletionTool[] = toolContext.tools.map(t => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        strict: true,
        parameters: ensureStrictSchema(t.inputSchema),
      },
    }));

    const conversationHistory = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-6)
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n\n');

    const openaiMessages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: REFINEMENT_SYSTEM_PROMPT },
      { role: 'user', content: `Conversation context:\n${conversationHistory}\n\nInstruction: ${instruction}` },
    ];

    const MAX_TURNS = 10;
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: openaiMessages,
        tools,
        parallel_tool_calls: false,
      });

      const choice = response.choices[0];
      if (!choice) break;

      const message = choice.message;
      openaiMessages.push(message);

      const fnCalls = message.tool_calls ?? [];
      if (fnCalls.length === 0) {
        return { message: message.content || "I've updated the form.", toolCalls };
      }

      for (const tc of fnCalls) {
        const args = JSON.parse(tc.function.arguments);
        const result = await toolContext.callTool(tc.function.name, args);
        toolCalls.push({
          tool: tc.function.name,
          args,
          result: result.content,
          isError: result.isError,
        });
        openaiMessages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: result.content,
        });
      }
    }

    return {
      message: toolCalls.length > 0
        ? "I've made changes to the form."
        : "I wasn't able to determine what changes to make. Try being more specific.",
      toolCalls,
    };
  }

  async extractFromFile(attachment: Attachment): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'user',
            content: `Extract all form field names, labels, and structure from this document content. Return a plain text description of the fields found.\n\nDocument name: ${attachment.name}\nContent:\n${attachment.data}`,
          },
        ],
      });

      return response.choices[0]?.message?.content || attachment.data;
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

  private async scaffoldFromConversation(messages: ChatMessage[], onProgress?: ScaffoldProgressCallback): Promise<ScaffoldResult> {
    const userContent = messages
      .filter(m => m.role === 'user')
      .map(m => m.content)
      .join('\n');

    const openaiMessages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: this.scaffoldPrompt },
      { role: 'user', content: `Design a form based on this description:\n\n${userContent}` },
    ];

    try {
      let text: string;

      if (onProgress) {
        const stream = await this.client.chat.completions.create({
          model: this.model,
          messages: openaiMessages,
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'form_scaffold',
              strict: true,
              schema: SCAFFOLD_RESPONSE_SCHEMA,
            },
          },
          stream: true,
        });

        let accumulated = '';
        let finishReason: string | null = null;
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) {
            accumulated += delta;
            onProgress(accumulated);
          }
          finishReason = chunk.choices[0]?.finish_reason ?? finishReason;
        }
        text = accumulated;
        if (!text) throw new Error('OpenAI returned empty streamed response');
        if (finishReason && finishReason !== 'stop') {
          throw new Error(`OpenAI stream ended early (${finishReason}) — response may be truncated.`);
        }
      } else {
        const response = await this.client.chat.completions.create({
          model: this.model,
          messages: openaiMessages,
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'form_scaffold',
              strict: true,
              schema: SCAFFOLD_RESPONSE_SCHEMA,
            },
          },
        });

        text = response.choices[0]?.message?.content ?? '';
        if (!text) {
          const reason = response.choices[0]?.finish_reason;
          throw new Error(
            reason && reason !== 'stop'
              ? `OpenAI returned empty response (finish_reason: ${reason})`
              : 'OpenAI returned empty response — check API key, quota, or model availability',
          );
        }
      }

      const parsed = JSON.parse(text);
      const definition = scaffoldOutputToDefinition(parsed);

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
      throw new Error(`Form generation failed: ${(err as Error).message}`);
    }
  }

  private async scaffoldFromUpload(extractedContent: string): Promise<ScaffoldResult> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: this.scaffoldPrompt },
        {
          role: 'user',
          content: `Create a form definition from this extracted document content. Identify fields, their types, and group related fields logically:\n\n${extractedContent}`,
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'form_scaffold',
          strict: true,
          schema: SCAFFOLD_RESPONSE_SCHEMA,
        },
      },
    });

    const text = response.choices[0]?.message?.content;
    if (!text) throw new Error('OpenAI returned empty response');

    const parsed = JSON.parse(text);
    const definition = scaffoldOutputToDefinition(parsed);

    const traces: SourceTrace[] = flattenItemKeys(parsed.items).map(key => ({
      elementPath: key,
      sourceType: 'upload' as const,
      sourceId: 'upload',
      description: 'Extracted from uploaded document',
      timestamp: Date.now(),
    }));

    return { definition, traces, issues: [] };
  }
}

// ── Schema strictness helper ────────────────────────────────────────

/**
 * Ensure an MCP tool's inputSchema meets OpenAI strict mode requirements.
 * Adds additionalProperties: false to all objects and puts all properties
 * in required. This is best-effort — deeply nested schemas may need
 * manual adjustment.
 */
function ensureStrictSchema(schema: Record<string, unknown>): Record<string, unknown> {
  if (typeof schema !== 'object' || schema === null) return schema;

  const result: Record<string, unknown> = { ...schema };

  if (result.type === 'object') {
    result.additionalProperties = false;
    const props = result.properties as Record<string, unknown> | undefined;
    if (props) {
      // All properties must be in required for strict mode
      result.required = Object.keys(props);
      // Recurse into each property
      const strictProps: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(props)) {
        strictProps[key] = ensureStrictSchema(val as Record<string, unknown>);
      }
      result.properties = strictProps;
    }
  }

  if (result.type === 'array' && result.items) {
    result.items = ensureStrictSchema(result.items as Record<string, unknown>);
  }

  if (result.anyOf) {
    result.anyOf = (result.anyOf as any[]).map(s => ensureStrictSchema(s));
  }

  // Strip constraints OpenAI doesn't support in strict mode
  delete result.minItems;
  delete result.maxItems;
  delete result.minimum;
  delete result.maximum;
  delete result.minLength;
  delete result.maxLength;
  delete result.pattern;

  return result;
}
