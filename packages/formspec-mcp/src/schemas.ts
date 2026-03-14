/**
 * Zod schemas for structured LLM output — re-used from formspec-studio/shared/providers/schemas.ts
 */

import { z } from 'zod';

const confidenceSchema = z.enum(['high', 'medium', 'low']);
const issueSeveritySchema = z.enum(['error', 'warning', 'info']);
const issueSourceSchema = z.enum(['analysis', 'proposal', 'diagnostic', 'handoff', 'provider']);
const issueStateSchema = z.enum(['open', 'resolved', 'deferred']);
const bindKindSchema = z.enum(['required', 'relevant', 'constraint', 'calculate', 'readonly']);

export const issueSchema = z.object({
  id: z.string(),
  title: z.string(),
  message: z.string(),
  severity: issueSeveritySchema,
  source: issueSourceSchema,
  status: issueStateSchema.default('open'),
  blocking: z.boolean(),
  confidence: confidenceSchema.optional(),
  fieldPath: z.string().optional(),
  traceIds: z.array(z.string()).optional(),
});

const traceRefSchema = z.object({
  id: z.string(),
  type: z.enum(['template', 'description', 'upload', 'analysis', 'proposal', 'diagnostic']),
  label: z.string(),
  sourceId: z.string().optional(),
  excerpt: z.string().optional(),
  fieldPath: z.string().optional(),
});

export const traceMapSchema = z.record(z.string(), z.array(traceRefSchema));

const analysisFieldSchema = z.object({
  id: z.string(),
  key: z.string(),
  label: z.string(),
  dataType: z.string(),
  sectionId: z.string().optional(),
  required: z.boolean(),
  included: z.boolean(),
  confidence: confidenceSchema,
  sourceIds: z.array(z.string()),
});

const analysisSectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  fieldIds: z.array(z.string()),
});

const analysisRuleSchema = z.object({
  id: z.string(),
  label: z.string(),
  kind: bindKindSchema,
  expression: z.string().optional(),
  explanation: z.string(),
  fieldPaths: z.array(z.string()),
  confidence: confidenceSchema,
  sourceIds: z.array(z.string()),
});

const analysisRepeatSchema = z.object({
  id: z.string(),
  label: z.string(),
  fieldIds: z.array(z.string()),
  min: z.number().optional(),
  max: z.number().optional(),
  confidence: confidenceSchema,
});

const analysisRouteSchema = z.object({
  id: z.string(),
  label: z.string(),
  condition: z.string(),
  target: z.string(),
  confidence: confidenceSchema,
});

export const analysisSchema = z.object({
  summary: z.string(),
  requirements: z.object({
    fields: z.array(analysisFieldSchema),
    sections: z.array(analysisSectionSchema),
    rules: z.array(analysisRuleSchema),
    repeats: z.array(analysisRepeatSchema),
    routes: z.array(analysisRouteSchema),
  }),
  issues: z.array(issueSchema),
  trace: traceMapSchema,
});

const proposalSummarySchema = z.object({
  fieldCount: z.number(),
  sectionCount: z.number(),
  bindCount: z.number(),
  shapeCount: z.number(),
  variableCount: z.number(),
  coverage: z.number(),
});

export const proposalSchema = z.object({
  definition: z.record(z.string(), z.unknown()),
  component: z.record(z.string(), z.unknown()).optional(),
  issues: z.array(issueSchema),
  trace: traceMapSchema,
  summary: proposalSummarySchema,
});

const commandSchema = z.object({
  type: z.string(),
  payload: z.record(z.string(), z.unknown()),
});

export const commandPatchSchema = z.object({
  commands: z.array(commandSchema),
  issues: z.array(issueSchema),
  explanation: z.string().optional(),
});
