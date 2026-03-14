import { useCallback, useState } from 'react';
import type { AnyCommand } from 'formspec-studio-core';
import { InquestDraft } from '../../shared/authoring/inquest-draft';
import { diagnosticsToInquestIssues, mergeIssueSets } from '../../shared/authoring/diagnostics-issues';
import type {
  InquestIssue,
  InquestProviderAdapter,
  InquestSessionV1,
  InquestTemplate,
  ProposalV1,
} from '../../shared/contracts/inquest';
import { saveHandoffPayload } from '../../shared/persistence/inquest-store';
import { buildHandoffPayload } from '../../shared/transport/handoff';
import { studioPath } from '../../shared/transport/routes';
import { issueBundle, syncIssueStatuses } from './useSessionLifecycle';

function nowIso(): string {
  return new Date().toISOString();
}

function draftCommandBundle(draft: InquestDraft): AnyCommand[] {
  return draft.log()
    .map((entry) => entry.command)
    .filter((command) => command.type !== 'project.import');
}

/* ── Hook ─────────────────────────────────────── */

export interface InquestOps {
  isAnalyzing: boolean;
  handleAnalyze: (text?: string) => Promise<void>;
  handleChatNew: (text: string) => Promise<void>;
  handleGenerateProposal: () => Promise<void>;
  handleEnterRefine: () => void;
  handleApplyPrompt: (prompt: string) => Promise<void>;
  handleOpenStudio: () => Promise<void>;
}

export function useInquestOps(
  session: InquestSessionV1 | null,
  draft: InquestDraft | null,
  setDraft: (draft: InquestDraft | null) => void,
  provider: InquestProviderAdapter | undefined,
  template: InquestTemplate | undefined,
  updateSession: (updater: (current: InquestSessionV1) => InquestSessionV1) => void,
): InquestOps {
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyze = useCallback(async (text?: string) => {
    if (!provider || !session) return;
    const description = text ?? session.input.description;
    if (!description.trim()) return;

    setIsAnalyzing(true);
    try {
      const analysis = await provider.runAnalysis({
        session: { ...session, input: { ...session.input, description } },
        template,
      });
      updateSession((current) => ({
        ...current,
        title: current.input.description.trim().split(/\n+/)[0].slice(0, 48) || current.title,
        phase: 'review',
        analysis,
        issues: syncIssueStatuses(analysis.issues, current.issues),
        updatedAt: nowIso(),
        input: {
          ...current.input,
          messages: [
            ...current.input.messages,
            {
              id: crypto.randomUUID(),
              role: 'assistant' as const,
              text: analysis.summary,
              createdAt: nowIso(),
            },
          ],
        },
      }));
    } finally {
      setIsAnalyzing(false);
    }
  }, [provider, session, template, updateSession]);

  const handleChatNew = useCallback(async (text: string) => {
    updateSession((current) => ({
      ...current,
      input: {
        ...current.input,
        description: text,
        messages: [
          ...current.input.messages,
          { id: crypto.randomUUID(), role: 'user' as const, text, createdAt: nowIso() },
        ],
      },
      updatedAt: nowIso(),
    }));
    await handleAnalyze(text);
  }, [handleAnalyze, updateSession]);

  const handleGenerateProposal = useCallback(async () => {
    if (!provider || !session) return;
    setIsAnalyzing(true);
    try {
      const analysis = session.analysis ?? await provider.runAnalysis({ session, template });
      const proposal = await provider.runProposal({ session, template, analysis });
      const nextDraft = new InquestDraft();
      nextDraft.loadProposal(proposal);
      const nextIssues = issueBundle(session.issues, analysis, proposal, nextDraft);
      setDraft(nextDraft);
      updateSession((current) => ({
        ...current,
        phase: 'review',
        analysis,
        proposal,
        draftBundle: nextDraft.export(),
        issues: nextIssues,
        updatedAt: nowIso(),
      }));
    } finally {
      setIsAnalyzing(false);
    }
  }, [provider, session, template, setDraft, updateSession]);

  const handleEnterRefine = useCallback(() => {
    if (!session) return;
    if (!draft && session.proposal) {
      const nextDraft = new InquestDraft();
      nextDraft.loadProposal(session.proposal);
      setDraft(nextDraft);
    }
    updateSession((current) => ({ ...current, phase: 'refine', updatedAt: nowIso() }));
  }, [draft, session, setDraft, updateSession]);

  const handleApplyPrompt = useCallback(async (prompt: string) => {
    if (!provider || !draft || !session) return;
    const liveBundle = draft.export();
    const liveProposal: ProposalV1 = {
      ...(session.proposal ?? {
        definition: liveBundle.definition,
        component: liveBundle.component,
        issues: [],
        trace: {},
        summary: { fieldCount: 0, sectionCount: 0, bindCount: 0, shapeCount: 0, variableCount: 0, coverage: 0 },
      }),
      definition: liveBundle.definition,
      component: liveBundle.component,
    };

    const patch = await provider.runEdit({ session, proposal: liveProposal, prompt });
    if (patch.commands.length > 0) draft.applyCommands(patch.commands);

    updateSession((current) => ({
      ...current,
      issues: syncIssueStatuses(
        mergeIssueSets(
          current.issues.filter((issue) => issue.source !== 'provider'),
          patch.issues,
          diagnosticsToInquestIssues(draft.diagnose()),
        ),
        current.issues,
      ),
      draftBundle: draft.export(),
      updatedAt: nowIso(),
    }));
  }, [provider, draft, session, updateSession]);

  const handleOpenStudio = useCallback(async () => {
    if (!draft || !session?.proposal) return;
    const handoffId = session.handoffId ?? crypto.randomUUID();
    const payload = buildHandoffPayload(
      { ...session, handoffId },
      draft.export(),
      draftCommandBundle(draft),
    );
    await saveHandoffPayload(payload);
    updateSession((current) => ({ ...current, handoffId, updatedAt: nowIso() }));
    window.location.assign(studioPath(`h=${encodeURIComponent(handoffId)}`));
  }, [draft, session, updateSession]);

  return {
    isAnalyzing,
    handleAnalyze,
    handleChatNew,
    handleGenerateProposal,
    handleEnterRefine,
    handleApplyPrompt,
    handleOpenStudio,
  };
}

export type { InquestIssue };
