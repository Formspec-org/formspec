import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createProject, type ProjectBundle } from 'formspec-studio-core';
import { InquestDraft } from '../../shared/authoring/inquest-draft';
import { diagnosticsToInquestIssues, mergeIssueSets } from '../../shared/authoring/diagnostics-issues';
import type {
  AnalysisV1,
  InquestIssue,
  InquestMessage,
  InquestSessionTarget,
  InquestSessionV1,
  InquestUploadSummary,
  ProposalV1,
} from '../../shared/contracts/inquest';
import {
  deleteInquestSession,
  listRecentInquestSessions,
  loadBootstrapProject,
  loadInquestSession,
  saveInquestSession,
  type RecentSessionEntry,
} from '../../shared/persistence/inquest-store';
import { findInquestTemplate } from '../../shared/templates/templates';
import { inquestPath } from '../../shared/transport/routes';

/* ── Helpers ─────────────────────────────────── */

function nowIso(): string {
  return new Date().toISOString();
}

function extractSessionId(pathname: string): string | undefined {
  return pathname.match(/^\/inquest\/session\/([^/?#]+)/)?.[1];
}

function collectGroupPaths(items: any[], prefix = ''): string[] {
  const paths: string[] = [];
  for (const item of items ?? []) {
    if (item?.type !== 'group' || typeof item.key !== 'string') continue;
    const path = prefix ? `${prefix}.${item.key}` : item.key;
    paths.push(path);
    paths.push(...collectGroupPaths(item.children ?? [], path));
  }
  return paths;
}

function inferSessionTitle(session: InquestSessionV1): string {
  const template = findInquestTemplate(session.input.templateId);
  if (template) return template.name;
  if (session.input.description.trim()) {
    return session.input.description.trim().split(/\n+/)[0].slice(0, 48);
  }
  return 'Untitled Project';
}

function createBlankSession(params: URLSearchParams, target?: InquestSessionTarget): InquestSessionV1 {
  const sessionId = crypto.randomUUID();
  return {
    version: 1,
    sessionId,
    title: 'Untitled Project',
    createdAt: nowIso(),
    updatedAt: nowIso(),
    phase: 'inputs',
    mode: params.get('mode') === 'import-subform' ? 'import-subform' : 'new-project',
    workflowMode: params.get('workflowMode') === 'draft-fast' ? 'draft-fast' : 'verify-carefully',
    input: {
      description: '',
      uploads: [],
      messages: [
        {
          id: crypto.randomUUID(),
          role: 'assistant' as const,
          text: 'Hello! I am your Stack Assistant. I can help you build powerful, accessible forms for Formspec. What are we building today? You can describe a form from scratch, or I can suggest a template to get us started.',
          createdAt: nowIso(),
        },
      ],
    },
    issues: [],
    target,
  };
}

export function createDraftFromBundle(bundle: Partial<ProjectBundle>): InquestDraft {
  return new InquestDraft(createProject({ seed: bundle }));
}

export function syncIssueStatuses(nextIssues: InquestIssue[], previousIssues: InquestIssue[]): InquestIssue[] {
  const previousById = new Map(previousIssues.map((issue) => [issue.id, issue]));
  return nextIssues.map((issue) => {
    const previous = previousById.get(issue.id);
    return previous ? { ...issue, status: previous.status } : issue;
  });
}

export function issueBundle(
  existingIssues: InquestIssue[],
  analysis?: AnalysisV1,
  proposal?: ProposalV1,
  draft?: InquestDraft | null,
): InquestIssue[] {
  return syncIssueStatuses(
    mergeIssueSets(
      analysis?.issues ?? [],
      proposal?.issues ?? [],
      existingIssues.filter((issue) => issue.source !== 'diagnostic'),
      draft ? diagnosticsToInquestIssues(draft.diagnose()) : [],
    ),
    existingIssues,
  );
}

export async function summarizeUpload(file: File): Promise<InquestUploadSummary> {
  let excerpt: string | undefined;
  if (file.type.startsWith('text/') || file.type === 'application/json') {
    excerpt = (await file.text()).slice(0, 240);
  }
  return {
    id: crypto.randomUUID(),
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
    status: 'processed',
    excerpt,
    createdAt: nowIso(),
  };
}

/* ── Hook ─────────────────────────────────────── */

export interface SessionLifecycle {
  session: InquestSessionV1 | null;
  draft: InquestDraft | null;
  saveState: 'idle' | 'saving' | 'saved' | 'error';
  recentSessions: RecentSessionEntry[];
  updateSession: (updater: (current: InquestSessionV1) => InquestSessionV1) => void;
  setDraft: (draft: InquestDraft | null) => void;
  handleCreateFreshSession: () => void;
  handleDeleteSession: (sessionId: string) => Promise<void>;
  handleOpenSession: (sessionId: string) => void;
}

export function useSessionLifecycle(
  locationPathname: string,
  locationSearch: string,
): SessionLifecycle {
  const [session, setSession] = useState<InquestSessionV1 | null>(null);
  const [draft, setDraft] = useState<InquestDraft | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const isInitialLoadRef = useRef(true);

  const updateSession = useCallback((updater: (current: InquestSessionV1) => InquestSessionV1) => {
    setSession((current) => current ? updater(current) : current);
  }, []);

  // Load or create session on mount
  useEffect(() => {
    let disposed = false;

    async function load() {
      const params = new URLSearchParams(locationSearch);
      const sessionId = extractSessionId(locationPathname);
      const bootstrapId = params.get('bootstrap') ?? undefined;
      let target: InquestSessionTarget | undefined;

      if (bootstrapId) {
        const bootstrap = await loadBootstrapProject(bootstrapId);
        target = {
          projectId: bootstrapId,
          availableGroups: collectGroupPaths((bootstrap?.definition as any)?.items ?? []),
        };
      }

      const nextSession = sessionId
        ? await loadInquestSession(sessionId) ?? createBlankSession(params, target)
        : createBlankSession(params, target);

      if (target) {
        nextSession.target = {
          ...target,
          ...nextSession.target,
          groupPath: nextSession.target?.groupPath ?? target.availableGroups?.[0],
        };
        nextSession.mode = 'import-subform';
      }

      nextSession.title = inferSessionTitle(nextSession);

      if (disposed) return;

      if (!sessionId) {
        window.history.replaceState({}, '', inquestPath(nextSession.sessionId, params.toString()));
      }

      // Mark as initial load so we don't immediately re-save the loaded session
      isInitialLoadRef.current = true;
      setSession(nextSession);

      if (nextSession.draftBundle?.definition) {
        setDraft(createDraftFromBundle(nextSession.draftBundle));
      } else if (nextSession.proposal) {
        const nextDraft = new InquestDraft();
        nextDraft.loadProposal(nextSession.proposal);
        setDraft(nextDraft);
      }
    }

    void load();
    return () => { disposed = true; };
  }, [locationPathname, locationSearch]);

  // Sync draft changes back to session
  useEffect(() => {
    if (!draft || !session) return;
    return draft.getProject().onChange(() => {
      setSession((current) => {
        if (!current) return current;
        const nextIssues = issueBundle(current.issues, current.analysis, current.proposal, draft);
        return {
          ...current,
          phase: 'refine',
          draftBundle: draft.export(),
          issues: nextIssues,
          updatedAt: nowIso(),
        };
      });
    });
  }, [draft, session?.sessionId]);

  // Persist session on every meaningful change (skip initial load)
  useEffect(() => {
    if (!session) return;
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      return;
    }
    let disposed = false;
    setSaveState('saving');
    void saveInquestSession(session)
      .then(() => { if (!disposed) setSaveState('saved'); })
      .catch(() => { if (!disposed) setSaveState('error'); });
    return () => { disposed = true; };
  }, [session]);

  const recentSessions = useMemo(
    () => listRecentInquestSessions(),
    // Re-derive when session updatedAt changes (covers create/delete/update)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session?.updatedAt],
  );

  const handleCreateFreshSession = useCallback(() => {
    window.location.assign(inquestPath(undefined, new URLSearchParams().toString()));
  }, []);

  const handleDeleteSession = useCallback(async (sessionId: string) => {
    await deleteInquestSession(sessionId);
    updateSession((current) => ({ ...current, updatedAt: nowIso() }));
  }, [updateSession]);

  const handleOpenSession = useCallback((sessionId: string) => {
    window.location.assign(inquestPath(sessionId));
  }, []);

  return {
    session,
    draft,
    saveState,
    recentSessions,
    updateSession,
    setDraft,
    handleCreateFreshSession,
    handleDeleteSession,
    handleOpenSession,
  };
}

