/**
 * AI provider — adapted from formspec-studio/shared/providers/ai-sdk-provider.ts
 * Reads API keys from environment variables.
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText, Output } from 'ai';
import type { AnalysisV1, CommandPatchV1, InquestModelInput, ProposalV1 } from './types.js';
import { analysisSchema, commandPatchSchema, proposalSchema } from './schemas.js';
import {
  ANALYSIS_SYSTEM,
  PROPOSAL_SYSTEM,
  EDIT_SYSTEM,
  buildAnalysisUserPrompt,
  buildProposalUserPrompt,
  buildEditUserPrompt,
} from './prompts.js';
import { buildAnalysis, buildEditPatch, buildProposal } from './deterministic.js';

export type ProviderId = 'anthropic' | 'openai' | 'gemini';

export interface ProviderConfig {
  providerId: ProviderId;
  apiKey: string;
}

function resolveConfig(): ProviderConfig {
  const providerId = (process.env['FORMSPEC_MCP_PROVIDER'] ?? 'anthropic') as ProviderId;

  const keyMap: Record<ProviderId, string | undefined> = {
    anthropic: process.env['ANTHROPIC_API_KEY'],
    openai: process.env['OPENAI_API_KEY'],
    gemini: process.env['GOOGLE_GENERATIVE_AI_API_KEY'] ?? process.env['GEMINI_API_KEY'],
  };

  const apiKey = process.env['FORMSPEC_MCP_API_KEY'] ?? keyMap[providerId] ?? '';
  return { providerId, apiKey };
}

function getModel(providerId: ProviderId, apiKey: string) {
  switch (providerId) {
    case 'gemini':
      return createGoogleGenerativeAI({ apiKey })('gemini-2.5-flash-preview');
    case 'openai':
      return createOpenAI({ apiKey })('gpt-4o');
    case 'anthropic':
      return createAnthropic({ apiKey })('claude-sonnet-4-5-20250514');
    default:
      throw new Error(`Unsupported provider: ${String(providerId)}`);
  }
}

export async function runAnalysis(input: InquestModelInput): Promise<AnalysisV1> {
  const { providerId, apiKey } = resolveConfig();
  if (!apiKey) return buildAnalysis(input);

  try {
    const { output } = await generateText({
      model: getModel(providerId, apiKey),
      system: ANALYSIS_SYSTEM,
      prompt: buildAnalysisUserPrompt(input),
      output: Output.object({ schema: analysisSchema }),
    });
    if (!output) return buildAnalysis(input);
    return output as AnalysisV1;
  } catch {
    return buildAnalysis(input);
  }
}

export async function runProposal(input: InquestModelInput): Promise<ProposalV1> {
  const { providerId, apiKey } = resolveConfig();
  if (!apiKey) return buildProposal(input);

  const analysis = input.analysis ?? await runAnalysis(input);
  try {
    const { output } = await generateText({
      model: getModel(providerId, apiKey),
      system: PROPOSAL_SYSTEM,
      prompt: buildProposalUserPrompt(input, analysis),
      output: Output.object({ schema: proposalSchema }),
    });
    if (!output) return buildProposal({ ...input, analysis });
    return output as ProposalV1;
  } catch {
    return buildProposal({ ...input, analysis });
  }
}

export async function runEdit(input: InquestModelInput): Promise<CommandPatchV1> {
  const { providerId, apiKey } = resolveConfig();
  if (!apiKey) return buildEditPatch(input);

  try {
    const { output } = await generateText({
      model: getModel(providerId, apiKey),
      system: EDIT_SYSTEM,
      prompt: buildEditUserPrompt(input),
      output: Output.object({ schema: commandPatchSchema }),
    });
    if (!output) return buildEditPatch(input);
    return output as CommandPatchV1;
  } catch {
    return buildEditPatch(input);
  }
}

/** Return a summary of the configured provider for display. */
export function getProviderInfo(): { providerId: string; hasApiKey: boolean } {
  const { providerId, apiKey } = resolveConfig();
  return { providerId, hasApiKey: !!apiKey };
}
