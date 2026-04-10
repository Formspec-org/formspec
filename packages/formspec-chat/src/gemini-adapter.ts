/** @filedesc AIAdapter implementation backed by the Google Gemini API. */
import {
  GoogleGenAI,
  type GenerateContentResponse,
  type FunctionDeclaration,
  type Part,
  type Content,
  FunctionCallingConfigMode,
} from '@google/genai';
import type {
  AIAdapter, ScaffoldRequest, ScaffoldResult, ScaffoldProgressCallback,
  ChatMessage, Attachment, SourceTrace,
  ConversationResponse, ToolContext, RefinementResult, ToolCallRecord,
} from './types.js';
import { TemplateLibrary } from './template-library.js';
import { deriveScaffoldSchema, scaffoldOutputToDefinition } from './scaffold-schema.js';
import definitionSchema from './definition-schema.json' with { type: 'json' };

const library = new TemplateLibrary();
const SCAFFOLD_RESPONSE_SCHEMA = deriveScaffoldSchema(definitionSchema, 'gemini');

// ── System prompt ────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a form design assistant that generates Formspec form definitions.

Formspec is a declarative form specification. Generate a JSON object with a descriptive "title" and an "items" array. The response schema defines the structure — follow it exactly.

Rules:
- Use descriptive snake_case keys (e.g., "first_name", "date_of_birth")
- Group related fields logically (e.g., address fields in an "address" group)
- For choice/multiChoice fields, always include an "options" array
- Omit "options" for non-choice fields
- Omit "children" for fields — only groups have children`;

// Scaffold response schema is derived from the canonical definition.schema.json
// at module load time via deriveScaffoldSchema() — see import above.

// ── Helpers ──────────────────────────────────────────────────────────


function flattenItemKeys(items: any[]): string[] {
  const keys: string[] = [];
  for (const item of items) {
    keys.push(item.key);
    if (item.children) keys.push(...flattenItemKeys(item.children));
  }
  return keys;
}

function extractText(response: GenerateContentResponse): string {
  const text = response.text ?? '';
  if (!text) {
    // Inspect why the response is empty — safety filter, rate limit, or model refusal
    const candidate = response.candidates?.[0];
    const finishReason = candidate?.finishReason;
    const blockReason = response.promptFeedback?.blockReason;
    const parts = [
      blockReason && `blocked: ${blockReason}`,
      finishReason && finishReason !== 'STOP' && `finishReason: ${finishReason}`,
    ].filter(Boolean);
    throw new Error(
      parts.length > 0
        ? `Gemini returned empty response (${parts.join(', ')})`
        : 'Gemini returned empty response — check API key, quota, or model availability',
    );
  }
  return text;
}

// ── Interview prompt & schema ────────────────────────────────────────

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
};

// ── GeminiAdapter ────────────────────────────────────────────────────

export class GeminiAdapter implements AIAdapter {
  private client: GoogleGenAI;
  private model: string;
  private registryHints: string;

  constructor(apiKey: string, model = 'gemini-3-flash-preview', registryHints = '') {
    this.client = new GoogleGenAI({ apiKey });
    this.model = model;
    this.registryHints = registryHints;
  }

  private get scaffoldPrompt(): string {
    return this.registryHints
      ? `${SYSTEM_PROMPT}\n\n${this.registryHints}`
      : SYSTEM_PROMPT;
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async chat(messages: ChatMessage[]): Promise<ConversationResponse> {
    const conversationParts = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n\n');

    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: conversationParts,
        config: {
          systemInstruction: INTERVIEW_SYSTEM_PROMPT,
          responseMimeType: 'application/json',
          responseJsonSchema: INTERVIEW_RESPONSE_SCHEMA,
        },
      });

      const text = extractText(response);
      const parsed = JSON.parse(text);
      return {
        message: parsed.message,
        readyToScaffold: Boolean(parsed.readyToScaffold),
      };
    } catch (err) {
      // If the API is down but the user has provided enough context, let them scaffold anyway
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

    // Convert MCP tool declarations to Gemini function declarations
    const functionDeclarations: FunctionDeclaration[] = toolContext.tools.map(t => ({
      name: t.name,
      description: t.description,
      parametersJsonSchema: t.inputSchema,
    }));

    const conversationHistory = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-6) // last few turns for context
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n\n');

    const systemPrompt = `You are a form design assistant. You modify forms using the provided tools.
Use formspec_describe to inspect the current form structure before making changes.
Make surgical edits — add, update, or remove specific fields rather than rebuilding.
When done with all changes, respond with a brief summary of what you did.`;

    // Build initial contents
    const contents: Content[] = [
      { role: 'user', parts: [{ text: `Conversation context:\n${conversationHistory}\n\nInstruction: ${instruction}` }] },
    ];

    const MAX_TURNS = 10;
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents,
        config: {
          systemInstruction: systemPrompt,
          tools: [{ functionDeclarations }],
          toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } },
        },
      });

      const candidate = response.candidates?.[0];
      if (!candidate?.content?.parts) break;

      const parts = candidate.content.parts;
      // Append model response to conversation
      contents.push({ role: 'model', parts });

      // Check for function calls
      const fnCalls = parts.filter(p => p.functionCall);
      if (fnCalls.length === 0) {
        // No more tool calls — model is done. Extract text response.
        const textParts = parts.filter(p => p.text).map(p => p.text!).join('');
        return { message: textParts || "I've updated the form.", toolCalls };
      }

      // Execute each function call and collect responses
      const responseParts: Part[] = [];
      for (const part of fnCalls) {
        const fc = part.functionCall!;
        const result = await toolContext.callTool(fc.name!, fc.args ?? {});
        toolCalls.push({
          tool: fc.name!,
          args: fc.args ?? {},
          result: result.content,
          isError: result.isError,
        });
        responseParts.push({
          functionResponse: {
            name: fc.name!,
            id: fc.id,
            response: { content: result.content, isError: result.isError },
          },
        });
      }

      // Feed function results back
      contents.push({ role: 'user', parts: responseParts });
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

  private async scaffoldFromConversation(messages: ChatMessage[], onProgress?: ScaffoldProgressCallback): Promise<ScaffoldResult> {
    const userContent = messages
      .filter(m => m.role === 'user')
      .map(m => m.content)
      .join('\n');

    const params = {
      model: this.model,
      contents: `Design a form based on this description:\n\n${userContent}`,
      config: {
        systemInstruction: this.scaffoldPrompt,
        responseMimeType: 'application/json' as const,
        responseJsonSchema: SCAFFOLD_RESPONSE_SCHEMA,
        maxOutputTokens: 65536,
      },
    };

    try {
      let text: string;

      if (onProgress) {
        // Stream so the UI can show partial JSON as it arrives
        const stream = await this.client.models.generateContentStream(params);
        let accumulated = '';
        let lastChunk: GenerateContentResponse | undefined;
        for await (const chunk of stream) {
          lastChunk = chunk;
          try {
            const part = chunk.text ?? '';
            accumulated += part;
          } catch {
            // chunk.text getter can throw if the chunk has no text parts
            continue;
          }
          onProgress(accumulated);
        }
        text = accumulated;
        if (!text) throw new Error('Gemini returned empty streamed response');
        // Check if the stream was truncated
        const finishReason = lastChunk?.candidates?.[0]?.finishReason;
        if (finishReason && finishReason !== 'STOP') {
          throw new Error(`Gemini stream ended early (${finishReason}) — response was truncated. The form may be too large for a single generation.`);
        }
      } else {
        const response = await this.client.models.generateContent(params);
        text = extractText(response);
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
    const response = await this.client.models.generateContent({
      model: this.model,
      contents: `Create a form definition from this extracted document content. Identify fields, their types, and group related fields logically:\n\n${extractedContent}`,
      config: {
        systemInstruction: this.scaffoldPrompt,
        responseMimeType: 'application/json',
        responseJsonSchema: SCAFFOLD_RESPONSE_SCHEMA,
        maxOutputTokens: 65536,
      },
    });

    const text = extractText(response);
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
