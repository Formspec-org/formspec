/** @filedesc Session controller hook — owns ChatSession lifecycle, tool dispatch, thread list, version rail. */
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ChatSession, GeminiAdapter, type ChatMessage, type SessionSummary, type ToolContext } from '@formspec-org/chat';
import { type Project, type MergeResult, type ProposalManager, type Diagnostics, type FormDefinition } from '@formspec-org/studio-core';
import { ProjectRegistry } from '@formspec-org/mcp/registry';
import { createToolDispatch } from '@formspec-org/mcp/dispatch';
import {
  createLocalChatThreadRepository,
  deriveChatProjectScope,
  type ChatThreadRepository,
} from '../components/chat/chat-thread-repository';
import {
  createLocalVersionRepository,
  type VersionRecord,
  type VersionRepository,
} from '../components/chat/version-repository';
import { emitAuthoringTelemetry, type AuthoringCapability } from '../onboarding/authoring-method-telemetry';
import { AUTHORING_FALLBACK_REASONS } from '../onboarding/authoring-fallback-reasons';
import { emitModelRoutingDecision, selectModelForOperation } from '../onboarding/authoring-model-routing';
import { getSavedProviderConfig } from '../components/AppSettingsDialog';

function capabilityForCommand(command: { kind: string; intent?: string }): AuthoringCapability {
  if (command.kind === 'init') return 'field_group_crud';
  if (command.kind === 'layout') return 'layout_overrides';
  if (command.kind === 'mapping') return 'mappings';
  if (command.kind === 'evidence') return 'evidence_links';
  if (command.kind === 'metadata') return 'metadata';
  if (command.kind === 'bind') return 'bind_rules';
  return 'export_publish';
}

function inferPatchScope(capability: AuthoringCapability): 'spec' | 'layout' | 'evidence' {
  if (capability === 'layout_overrides') return 'layout';
  if (capability === 'evidence_links') return 'evidence';
  return 'spec';
}

function inferCapability(summary: string | undefined, refs: string[]): AuthoringCapability {
  const label = (summary ?? '').toLowerCase();
  if (label.startsWith('[layout]')) return 'layout_overrides';
  if (label.startsWith('[mapping]')) return 'mappings';
  if (label.startsWith('[evidence]')) return 'evidence_links';
  if (refs.some((ref) => ref.includes('bind') || ref.includes('shape'))) return 'bind_rules';
  if (refs.some((ref) => ref.includes('mapping'))) return 'mappings';
  if (refs.some((ref) => ref.includes('layout') || ref.includes('page'))) return 'layout_overrides';
  if (refs.some((ref) => ref.includes('title') || ref.includes('status') || ref.includes('definition'))) return 'metadata';
  return 'field_group_crud';
}

function isFormDefinition(value: unknown): value is FormDefinition {
  return Boolean(value && typeof value === 'object' && 'items' in (value as object));
}

export interface ChatSessionController {
  /** Latest message list from the active session. */
  messages: ChatMessage[];
  /** Whether the session has gathered enough context to scaffold. */
  readyToScaffold: boolean;
  /** Whether the session was initialized from a snapshot. */
  initNotice: boolean;
  /** Saved thread summaries for the rail. */
  recentSessions: SessionSummary[];
  /** Currently selected thread id. */
  activeSessionId: string | null;
  /** Committed versions for the rail. */
  versions: VersionRecord[];
  /** Base version id for compare. */
  compareBaseId: string | null;
  /** Target version id for compare. */
  compareTargetId: string | null;
  /** Whether an API key is configured. */
  hasApiKey: boolean;
  /** Imperative session handle (for tool dispatch). */
  sessionRef: React.RefObject<ChatSession | null>;
  /** Proposal manager (for changeset accept/reject). */
  proposalManager: ProposalManager | null;
  /** Tool context passed to the session. */
  toolContext: ToolContext;
  /** Repository backing thread persistence. */
  repository: ChatThreadRepository;
  /** Project scope for thread isolation. */
  projectScope: string;
  /** Version store for commit/restore. */
  versionStore: VersionRepository;
  /** Resolved version scope. */
  resolvedVersionScope: string;
  /** Create a fresh ChatSession (does NOT activate it). */
  createSession: () => ChatSession | null;
  /** Activate a session and sync snapshot state. */
  setActiveSession: (session: ChatSession, revision: string | null) => void;
  /** Ensure a session exists; creates one if needed. */
  ensureSession: () => Promise<ChatSession>;
  /** Start a new session from scratch. */
  startNewSession: () => Promise<void>;
  /** Switch to a persisted thread by id. */
  switchToSession: (sessionId: string) => Promise<void>;
  /** Delete a thread by id. */
  deleteSession: (sessionId: string) => Promise<void>;
  /** Clear all threads in scope. */
  clearSessions: () => Promise<void>;
  /** Refresh the versions list. */
  refreshVersions: () => Promise<VersionRecord[]>;
  /** Refresh the recent sessions list. */
  refreshRecentSessions: () => Promise<SessionSummary[]>;
  /** Set messages directly (used by handleSend). */
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  /** Set readyToScaffold directly. */
  setReadyToScaffold: React.Dispatch<React.SetStateAction<boolean>>;
  /** Set initNotice directly. */
  setInitNotice: React.Dispatch<React.SetStateAction<boolean>>;
  /** Set compareBaseId. */
  setCompareBaseId: React.Dispatch<React.SetStateAction<string | null>>;
  /** Set compareTargetId. */
  setCompareTargetId: React.Dispatch<React.SetStateAction<string | null>>;
  /** Set versionMessage. */
  setVersionMessage: React.Dispatch<React.SetStateAction<string | null>>;
  /** Load a definition as a changeset. */
  loadDefinitionAsChangeset: (label: string, definition: NonNullable<ReturnType<ChatSession['getDefinition']>>) => void;
  /** Apply merge result diagnostics. */
  applyMergeResult: (result: MergeResult) => void;
}

export interface UseChatSessionControllerOptions {
  project: Project;
  chatThreadRepository?: ChatThreadRepository;
  chatProjectScope?: string;
  versionRepository?: VersionRepository;
  versionScope?: string;
  /** When provided, exposes workspace selection + viewport to the AI via ToolContext. */
  getWorkspaceContext?: () => { selection: { path: string; sourceTab: string } | null; viewport: 'desktop' | 'tablet' | 'mobile' | null };
}

export function useChatSessionController(options: UseChatSessionControllerOptions): ChatSessionController {
  const { project, chatThreadRepository, chatProjectScope, versionRepository, versionScope, getWorkspaceContext } = options;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [recentSessions, setRecentSessions] = useState<SessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [readyToScaffold, setReadyToScaffold] = useState(false);
  const [initNotice, setInitNotice] = useState(false);
  const [versions, setVersions] = useState<VersionRecord[]>([]);
  const [compareBaseId, setCompareBaseId] = useState<string | null>(null);
  const [compareTargetId, setCompareTargetId] = useState<string | null>(null);
  const [versionMessage, setVersionMessage] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState(() => !!getSavedProviderConfig()?.apiKey);

  const sessionRef = useRef<ChatSession | null>(null);
  const activeRevisionRef = useRef<string | null>(null);
  const initializingRef = useRef(false);
  const forkLineageParentIdRef = useRef<string | null>(null);

  const repository = useMemo(() => chatThreadRepository ?? createLocalChatThreadRepository(), [chatThreadRepository]);
  const projectScope = useMemo(() => chatProjectScope ?? deriveChatProjectScope(project), [chatProjectScope, project]);
  const resolvedVersionScope = useMemo(() => versionScope ?? projectScope, [projectScope, versionScope]);
  const versionStore = useMemo(() => versionRepository ?? createLocalVersionRepository(), [versionRepository]);

  const { toolContext, proposalManager } = useMemo(() => {
    const registry = new ProjectRegistry();
    const projectId = registry.registerOpen('studio://current', project);
    const dispatch = createToolDispatch(registry, projectId);
    const ctx: ToolContext = {
      tools: dispatch.declarations,
      async callTool(name: string, args: Record<string, unknown>) {
        return dispatch.call(name, args);
      },
      async getProjectSnapshot() {
        return { definition: project.definition };
      },
      getWorkspaceContext: getWorkspaceContext ?? undefined,
    };
    const pm: ProposalManager | null = project.proposals;
    return { toolContext: ctx, proposalManager: pm };
  }, [project]);

  const createSession = useCallback(() => {
    const config = getSavedProviderConfig();
    if (!config?.apiKey) return null;
    const route = selectModelForOperation('assistant_session');
    emitModelRoutingDecision(route);
    const adapter = new GeminiAdapter(config.apiKey, config.model ?? route.model, '');
    const session = new ChatSession({ adapter });
    session.setToolContext(toolContext);
    return session;
  }, [toolContext]);

  const syncSessionSnapshot = useCallback((session: ChatSession) => {
    setMessages(session.getMessages());
    setReadyToScaffold(session.isReadyToScaffold());
    setInitNotice(false);
  }, []);

  const setActiveSession = useCallback(
    (session: ChatSession, revision: string | null) => {
      session.setToolContext(toolContext);
      sessionRef.current = session;
      setActiveSessionId(session.id);
      activeRevisionRef.current = revision;
      syncSessionSnapshot(session);
    },
    [syncSessionSnapshot, toolContext],
  );

  const persistSession = useCallback(
    async (session: ChatSession) => {
      const state = session.toState();
      const saved = await repository.saveThread(state, {
        projectScope,
        expectedRevision: activeRevisionRef.current,
      });
      activeRevisionRef.current = saved.revision ?? null;
    },
    [projectScope, repository],
  );

  const refreshRecentSessions = useCallback(async () => {
    const listed = await repository.listThreads({ projectScope, limit: 100 });
    setRecentSessions(listed.items);
    return listed.items;
  }, [projectScope, repository]);

  const startNewSession = useCallback(async () => {
    const session = createSession();
    if (!session) return;
    setActiveSession(session, null);
  }, [createSession, setActiveSession]);

  const ensureSession = useCallback(async (): Promise<ChatSession> => {
    if (sessionRef.current) return sessionRef.current;
    const session = createSession();
    if (!session) throw new Error('Assistant session is not ready. Add API credentials and retry.');
    setActiveSession(session, null);
    return session;
  }, [createSession, setActiveSession]);

  const switchToSession = useCallback(
    async (sessionId: string) => {
      const config = getSavedProviderConfig();
      if (!config?.apiKey) return;
      const route = selectModelForOperation('assistant_session');
      emitModelRoutingDecision(route);
      const adapter = new GeminiAdapter(config.apiKey, config.model ?? route.model, '');
      const restored = await repository.loadThread(sessionId, { projectScope });
      if (!restored) return;
      const session = await ChatSession.fromState(restored, adapter);
      setActiveSession(session, String(restored.updatedAt || ''));
    },
    [projectScope, repository, setActiveSession],
  );

  const deleteSession = useCallback(
    async (sessionId: string) => {
      await repository.deleteThread(sessionId, { projectScope });
      const refreshed = await refreshRecentSessions();
      if (activeSessionId && sessionId === activeSessionId) {
        if (refreshed.length > 0) {
          await switchToSession(refreshed[0].id);
        } else {
          await startNewSession();
        }
      }
    },
    [activeSessionId, projectScope, refreshRecentSessions, repository, startNewSession, switchToSession],
  );

  const clearSessions = useCallback(async () => {
    await repository.clearThreads({ projectScope });
    setRecentSessions([]);
    await startNewSession();
  }, [projectScope, repository, startNewSession]);

  const refreshVersions = useCallback(async () => {
    const next = await versionStore.listVersions({ scope: resolvedVersionScope });
    setVersions(next);
    return next;
  }, [resolvedVersionScope, versionStore]);

  useEffect(() => {
    const check = () => setHasApiKey(!!getSavedProviderConfig()?.apiKey);
    window.addEventListener('focus', check);
    return () => window.removeEventListener('focus', check);
  }, []);

  useEffect(() => {
    if (!hasApiKey || initializingRef.current) return;
    initializingRef.current = true;
    let cancelled = false;
    void (async () => {
      try {
        const listed = await repository.listThreads({ projectScope, limit: 100 });
        if (cancelled) return;
        setRecentSessions(listed.items);
        if (sessionRef.current) return;
        if (listed.items.length === 0) {
          const session = createSession();
          if (session) setActiveSession(session, null);
          return;
        }
        await switchToSession(listed.items[0].id);
      } catch (error) {
        if (!cancelled) {
          setMessages([
            {
              id: `err-${Date.now()}`,
              role: 'system',
              content: `Thread history unavailable: ${error instanceof Error ? error.message : String(error)}`,
              timestamp: Date.now(),
            },
          ]);
          const session = createSession();
          if (session) setActiveSession(session, null);
        }
      } finally {
        if (!cancelled) initializingRef.current = false;
      }
    })();
    return () => {
      cancelled = true;
      initializingRef.current = false;
    };
  }, [createSession, hasApiKey, projectScope, repository, setActiveSession, switchToSession]);

  useEffect(() => {
    const session = sessionRef.current;
    if (!session || !hasApiKey) return;
    return session.onChange(() => {
      void (async () => {
        try {
          await persistSession(session);
          await refreshRecentSessions();
        } catch {
          // Keep chat responsive even if persistence fails.
        }
      })();
    });
  }, [hasApiKey, persistSession, refreshRecentSessions, activeSessionId]);

  useEffect(() => {
    void refreshVersions();
  }, [refreshVersions]);

  const loadDefinitionAsChangeset = useCallback(
    (label: string, definition: NonNullable<ReturnType<ChatSession['getDefinition']>>) => {
      if (proposalManager) {
        proposalManager.openChangeset();
        proposalManager.beginEntry('scaffold');
        project.loadBundle({ definition });
        proposalManager.endEntry(label);
        proposalManager.closeChangeset(label);
      } else {
        project.loadBundle({ definition });
      }
    },
    [project, proposalManager],
  );

  const applyMergeResult = useCallback((result: MergeResult) => {
    // Intentionally no-op in controller; ChatPanel owns diagnostics display
    void result;
  }, []);

  return {
    messages,
    readyToScaffold,
    initNotice,
    recentSessions,
    activeSessionId,
    versions,
    compareBaseId,
    compareTargetId,
    hasApiKey,
    sessionRef,
    proposalManager,
    toolContext,
    repository,
    projectScope,
    versionStore,
    resolvedVersionScope,
    createSession,
    setActiveSession,
    ensureSession,
    startNewSession,
    switchToSession,
    deleteSession,
    clearSessions,
    refreshVersions,
    refreshRecentSessions,
    setMessages,
    setReadyToScaffold,
    setInitNotice,
    setCompareBaseId,
    setCompareTargetId,
    setVersionMessage,
    loadDefinitionAsChangeset,
    applyMergeResult,
  };
}
