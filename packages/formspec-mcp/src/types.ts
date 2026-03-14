/**
 * Shared Formspec Inquest types — adapted from formspec-studio contracts.
 * Kept as a self-contained copy so this package has no dependency on the
 * browser-targeted formspec-studio package.
 */

export type InquestWorkflowMode = 'draft-fast' | 'verify-carefully';
export type InquestConfidence = 'high' | 'medium' | 'low';
export type InquestIssueSeverity = 'error' | 'warning' | 'info';
export type InquestIssueSource = 'analysis' | 'proposal' | 'diagnostic' | 'handoff' | 'provider';
export type InquestIssueState = 'open' | 'resolved' | 'deferred';

export interface InquestIssue {
  id: string;
  title: string;
  message: string;
  severity: InquestIssueSeverity;
  source: InquestIssueSource;
  status: InquestIssueState;
  blocking: boolean;
  confidence?: InquestConfidence;
  fieldPath?: string;
  traceIds?: string[];
}

export interface InquestTraceRef {
  id: string;
  type: 'template' | 'description' | 'upload' | 'analysis' | 'proposal' | 'diagnostic';
  label: string;
  sourceId?: string;
  excerpt?: string;
  fieldPath?: string;
}

export type TraceMapV1 = Record<string, InquestTraceRef[]>;

export interface AnalysisField {
  id: string;
  key: string;
  label: string;
  dataType: string;
  sectionId?: string;
  required: boolean;
  included: boolean;
  confidence: InquestConfidence;
  sourceIds: string[];
}

export interface AnalysisSection {
  id: string;
  title: string;
  fieldIds: string[];
}

export interface AnalysisRule {
  id: string;
  label: string;
  kind: 'required' | 'relevant' | 'constraint' | 'calculate' | 'readonly';
  expression?: string;
  explanation: string;
  fieldPaths: string[];
  confidence: InquestConfidence;
  sourceIds: string[];
}

export interface AnalysisRepeat {
  id: string;
  label: string;
  fieldIds: string[];
  min?: number;
  max?: number;
  confidence: InquestConfidence;
}

export interface AnalysisRoute {
  id: string;
  label: string;
  condition: string;
  target: string;
  confidence: InquestConfidence;
}

export interface AnalysisV1 {
  summary: string;
  requirements: {
    fields: AnalysisField[];
    sections: AnalysisSection[];
    rules: AnalysisRule[];
    repeats: AnalysisRepeat[];
    routes: AnalysisRoute[];
  };
  issues: InquestIssue[];
  trace: TraceMapV1;
}

export interface ProposalSummary {
  fieldCount: number;
  sectionCount: number;
  bindCount: number;
  shapeCount: number;
  variableCount: number;
  coverage: number;
}

export interface ProposalV1 {
  definition: unknown;
  component?: unknown;
  issues: InquestIssue[];
  trace: TraceMapV1;
  summary: ProposalSummary;
}

export interface CommandPatchV1 {
  commands: Array<{ type: string; payload: Record<string, unknown> }>;
  issues: InquestIssue[];
  explanation?: string;
}

export interface SeedField {
  key: string;
  label: string;
  dataType: string;
  required?: boolean;
  sectionId?: string;
}

export interface SeedSection {
  id: string;
  title: string;
}

export interface SeedRule {
  id: string;
  label: string;
  kind: AnalysisRule['kind'];
  expression?: string;
  explanation: string;
  fieldPaths: string[];
}

export interface SeedRepeat {
  id: string;
  label: string;
  fieldIds: string[];
  min?: number;
  max?: number;
}

export interface SeedRoute {
  id: string;
  label: string;
  condition: string;
  target: string;
}

export interface InquestTemplate {
  id: string;
  version: string;
  name: string;
  category: string;
  description: string;
  tags: string[];
  starterPrompts: string[];
  seedAnalysis: {
    sections: SeedSection[];
    fields: SeedField[];
    rules: SeedRule[];
    repeats?: SeedRepeat[];
    routes?: SeedRoute[];
  };
  seedScaffold?: {
    definition?: unknown;
    component?: unknown;
  };
  sourceNotes?: string[];
}

/** Minimal session shape needed by provider functions. */
export interface McpFormSession {
  sessionId: string;
  title: string;
  workflowMode: InquestWorkflowMode;
  providerId?: string;
  input: {
    templateId?: string;
    description: string;
    uploads: [];
    messages: [];
  };
}

export interface InquestModelInput {
  session: McpFormSession;
  template?: InquestTemplate;
  analysis?: AnalysisV1;
  proposal?: ProposalV1;
  prompt?: string;
}

export interface ConnectionResult {
  ok: boolean;
  message: string;
}
