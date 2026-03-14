#!/usr/bin/env node
/**
 * Formspec MCP Server
 *
 * Exposes AI-powered form generation as MCP tools:
 *   - list_templates         List available form templates
 *   - analyze_form           Analyze a description → structured requirements
 *   - propose_form           Generate a complete Formspec definition
 *   - edit_form              Apply natural language edits to an existing definition
 *
 * Provider configuration via environment variables:
 *   FORMSPEC_MCP_PROVIDER    Provider to use: anthropic (default), openai, gemini
 *   FORMSPEC_MCP_API_KEY     Override API key (else falls back to provider-specific key)
 *   ANTHROPIC_API_KEY        Anthropic API key
 *   OPENAI_API_KEY           OpenAI API key
 *   GOOGLE_GENERATIVE_AI_API_KEY  Google/Gemini API key
 *
 * Without an API key, all tools fall back to deterministic (rule-based) generation.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { inquestTemplates, findInquestTemplate } from './templates.js';
import { runAnalysis, runProposal, runEdit, getProviderInfo } from './provider.js';
import type { McpFormSession, ProposalV1 } from './types.js';

// ── Helpers ────────────────────────────────────────────────────────

function makeSession(
  description: string,
  title?: string,
  templateId?: string,
  workflowMode: McpFormSession['workflowMode'] = 'draft-fast',
): McpFormSession {
  return {
    sessionId: Math.random().toString(36).slice(2, 12),
    title: title ?? (description.split(/\n/)[0].slice(0, 60).trim() || 'Form Draft'),
    workflowMode,
    input: {
      description,
      templateId,
      uploads: [],
      messages: [],
    },
  };
}

// ── Server setup ──────────────────────────────────────────────────

const server = new McpServer({
  name: 'formspec-mcp',
  version: '0.1.0',
});

// ── Tool: list_templates ──────────────────────────────────────────

server.tool(
  'list_templates',
  'List available Formspec form templates. Each template provides seed fields, sections, and rules as a starting point for form generation.',
  {},
  async () => {
    const templates = inquestTemplates.map((t) => ({
      id: t.id,
      name: t.name,
      category: t.category,
      description: t.description,
      tags: t.tags,
      starterPrompts: t.starterPrompts,
      seedFieldCount: t.seedAnalysis.fields.length,
      seedSectionCount: t.seedAnalysis.sections.length,
    }));

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ templates }, null, 2),
        },
      ],
    };
  },
);

// ── Tool: analyze_form ────────────────────────────────────────────

server.tool(
  'analyze_form',
  'Analyze a form description to extract structured requirements: fields, sections, conditional rules, and repeating groups. Returns an AnalysisV1 object. Use this before propose_form for the verify-carefully workflow.',
  {
    description: z.string().describe('Natural language description of the form to build'),
    templateId: z.string().optional().describe('Optional template ID to use as a starting point (see list_templates)'),
    title: z.string().optional().describe('Optional title for the form'),
    thoroughness: z.enum(['draft-fast', 'verify-carefully']).optional().describe('How thorough to be (default: draft-fast)'),
  },
  async ({ description, templateId, title, thoroughness }) => {
    const session = makeSession(description, title, templateId, thoroughness ?? 'draft-fast');
    const template = findInquestTemplate(templateId);
    const analysis = await runAnalysis({ session, template });

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(analysis, null, 2),
        },
      ],
    };
  },
);

// ── Tool: propose_form ────────────────────────────────────────────

server.tool(
  'propose_form',
  'Generate a complete, valid Formspec Definition JSON from a description. Optionally accepts a pre-computed analysis. Returns a ProposalV1 with the definition, summary stats, and any issues.',
  {
    description: z.string().describe('Natural language description of the form to build'),
    templateId: z.string().optional().describe('Optional template ID to use as a starting point (see list_templates)'),
    title: z.string().optional().describe('Optional form title'),
    analysis: z.string().optional().describe('Optional pre-computed AnalysisV1 JSON string from analyze_form'),
    thoroughness: z.enum(['draft-fast', 'verify-carefully']).optional().describe('How thorough to be (default: draft-fast)'),
  },
  async ({ description, templateId, title, analysis: analysisJson, thoroughness }) => {
    const session = makeSession(description, title, templateId, thoroughness ?? 'draft-fast');
    const template = findInquestTemplate(templateId);

    let parsedAnalysis;
    if (analysisJson) {
      try {
        parsedAnalysis = JSON.parse(analysisJson);
      } catch {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: 'Invalid analysis JSON provided' }],
        };
      }
    }

    const proposal = await runProposal({ session, template, analysis: parsedAnalysis });

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(proposal, null, 2),
        },
      ],
    };
  },
);

// ── Tool: edit_form ───────────────────────────────────────────────

server.tool(
  'edit_form',
  'Apply a natural language edit instruction to an existing Formspec definition. Returns a CommandPatchV1 with commands to apply, plus the updated definition after applying those commands.',
  {
    definition: z.string().describe('Current Formspec definition JSON (from a previous propose_form call)'),
    instruction: z.string().describe('Natural language edit instruction, e.g. "make email required", "add a phone field", "show income only when hasIncome is true"'),
    description: z.string().optional().describe('Original form description for context'),
    title: z.string().optional().describe('Form title for context'),
  },
  async ({ definition: definitionJson, instruction, description, title }) => {
    let parsedDefinition: unknown;
    try {
      parsedDefinition = JSON.parse(definitionJson);
    } catch {
      return {
        isError: true,
        content: [{ type: 'text' as const, text: 'Invalid definition JSON provided' }],
      };
    }

    const session = makeSession(description ?? '', title);
    const liveProposal: ProposalV1 = {
      definition: parsedDefinition,
      issues: [],
      trace: {},
      summary: { fieldCount: 0, sectionCount: 0, bindCount: 0, shapeCount: 0, variableCount: 0, coverage: 0 },
    };

    const patch = await runEdit({ session, proposal: liveProposal, prompt: instruction });

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            patch,
            note: 'Apply patch.commands to your definition using Formspec Studio or the formspec-studio-core project.dispatch() API.',
          }, null, 2),
        },
      ],
    };
  },
);

// ── Tool: provider_info ───────────────────────────────────────────

server.tool(
  'provider_info',
  'Returns the currently configured AI provider and whether an API key is set. When no API key is configured, all tools fall back to deterministic (rule-based) generation.',
  {},
  async () => {
    const info = getProviderInfo();
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            ...info,
            status: info.hasApiKey ? 'AI-powered generation active' : 'No API key — using deterministic fallback',
            envVars: {
              FORMSPEC_MCP_PROVIDER: 'Provider selection (anthropic/openai/gemini)',
              FORMSPEC_MCP_API_KEY: 'Override API key',
              ANTHROPIC_API_KEY: 'Anthropic API key',
              OPENAI_API_KEY: 'OpenAI API key',
              GOOGLE_GENERATIVE_AI_API_KEY: 'Google/Gemini API key',
            },
          }, null, 2),
        },
      ],
    };
  },
);

// ── Start server ──────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Server is running — MCP communicates over stdio
}

main().catch((err) => {
  process.stderr.write(`Formspec MCP server error: ${String(err)}\n`);
  process.exit(1);
});
