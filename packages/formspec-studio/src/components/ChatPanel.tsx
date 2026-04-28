/** @filedesc Integrated studio chat panel — shares the studio Project, routes AI through MCP, shows changeset review. */
import { useState, useRef, useEffect, useCallback, useMemo, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { ChatSession, GeminiAdapter, type Attachment, type ChatMessage, type SessionSummary, type ToolContext } from '@formspec-org/chat';
import {
  type Project,
  type Changeset,
  type MergeResult,
  type ProposalManager,
  type Diagnostic,
  type Diagnostics,
  type FormDefinition,
} from '@formspec-org/studio-core';
import { ProjectRegistry } from '@formspec-org/mcp/registry';
import { createToolDispatch } from '@formspec-org/mcp/dispatch';
import { type ChangesetReviewData } from './ChangesetReview.js';
import { getSavedProviderConfig } from './AppSettingsDialog.js';
import { IconSparkle, IconArrowUp, IconClose, IconUpload, IconPlus, IconTrash } from './icons/index.js';
import { ChatMessageList } from './chat/ChatMessageList.js';
import { ChatSelectionFocusStrip } from './chat/ChatSelectionFocusStrip.js';
import { ChangesetReviewSection } from './chat/ChangesetReviewSection.js';
import {
  createLocalChatThreadRepository,
  deriveChatProjectScope,
  type ChatThreadRepository,
} from './chat/chat-thread-repository.js';
import {
  createLocalVersionRepository,
  type VersionRecord,
  type VersionRepository,
} from './chat/version-repository.js';
import { recordAiPatchLifecycle } from '../workspaces/shared/studio-intelligence-writer.js';
import { ASSISTANT_COMPOSER_INPUT_TEST_ID } from '../constants/assistant-dom.js';
import { emitAuthoringTelemetry, type AuthoringCapability } from '../onboarding/authoring-method-telemetry.js';
import { AUTHORING_FALLBACK_REASONS } from '../onboarding/authoring-fallback-reasons.js';
import { emitModelRoutingDecision, selectModelForOperation } from '../onboarding/authoring-model-routing.js';

// ── Types ──────────────────────────────────────────────────────────

/** Where to mount the versions + conversations rail (defaults to docked left). */
export type WorkspaceRailAttach = 'dock' | 'omit' | 'portal';

export interface WorkspaceRailPlacement {
  readonly attach: WorkspaceRailAttach;
  /** Required when `attach` is `portal` — typically a slot inside the assistant setup drawer. */
  readonly portalContainer?: HTMLElement;
}

export interface ChatPanelProps {
  project: Project;
  onClose: () => void;
  hideHeader?: boolean;
  chatThreadRepository?: ChatThreadRepository;
  chatProjectScope?: string;
  versionRepository?: VersionRepository;
  versionScope?: string;
  /** Shell rail vs full primary assistant surface (onboarding omits this). */
  surfaceLayout?: 'rail' | 'primary';
  /** When set, pre-fills the input with this prompt and clears it after applying. */
  initialPrompt?: string | null;
  /** Called after the user sends a message, before assistant/tool work resolves. */
  onUserMessage?: () => void;
  onUploadHandlerReady?: (handler: ((file: File) => void) | null) => void;
  onSourceUploadStart?: (file: File) => void;
  onSourceUploadComplete?: (summary: SourceUploadSummary) => void;
  emptyDescription?: string;
  placeholder?: string;
  inputId?: string;
  /** `data-testid` on the composer textarea (defaults to assistant composer id). */
  composerInputTestId?: string;
  inputAriaLabel?: string;
  /**
   * Versions + conversation threads rail placement.
   * Use `{ attach: 'portal', portalContainer }` to render the rail into another DOM node (e.g. setup drawer).
   */
  workspaceRail?: WorkspaceRailPlacement;
}

type AuthoringMode = 'intent' | 'draft' | 'review' | 'commit';

export interface SourceUploadSummary {
  name: string;
  type: Attachment['type'];
  fieldCount: number;
  message: string;
}

interface DiagnosticEntry {
  severity: 'error' | 'warning';
  message: string;
  path?: string;
}

type CapabilityCommand =
  | { kind: 'init' }
  | { kind: 'layout'; intent: string }
  | { kind: 'mapping'; intent: string }
  | { kind: 'evidence'; intent: string }
  | { kind: 'metadata'; intent: string }
  | { kind: 'bind'; intent: string }
  | { kind: 'export'; intent: string };

function capabilityForCommand(command: CapabilityCommand): AuthoringCapability {
  if (command.kind === 'init') return 'field_group_crud';
  if (command.kind === 'layout') return 'layout_overrides';
  if (command.kind === 'mapping') return 'mappings';
  if (command.kind === 'evidence') return 'evidence_links';
  if (command.kind === 'metadata') return 'metadata';
  if (command.kind === 'bind') return 'bind_rules';
  return 'export_publish';
}

function toSlashRefinementInstruction(command: CapabilityCommand): string {
  if (command.kind === 'init') return 'Initialize assistant authoring context from the current project snapshot.';
  return `Apply ${command.kind} update via MCP tools. User intent: ${command.intent}`;
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

function inferPatchScope(capability: AuthoringCapability): 'spec' | 'layout' | 'evidence' {
  if (capability === 'layout_overrides') return 'layout';
  if (capability === 'evidence_links') return 'evidence';
  return 'spec';
}

function parseCapabilityCommand(text: string): CapabilityCommand | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith('/')) return null;
  const splitAt = trimmed.indexOf(' ');
  const command = (splitAt === -1 ? trimmed : trimmed.slice(0, splitAt)).toLowerCase();
  const intent = (splitAt === -1 ? '' : trimmed.slice(splitAt + 1)).trim();
  if (command === '/layout') return { kind: 'layout', intent };
  if (command === '/init') return { kind: 'init' };
  if (command === '/mapping') return { kind: 'mapping', intent };
  if (command === '/evidence') return { kind: 'evidence', intent };
  if (command === '/metadata') return { kind: 'metadata', intent };
  if (command === '/bind') return { kind: 'bind', intent };
  if (command === '/export') return { kind: 'export', intent };
  return null;
}

function normalizeAffectedRef(path: string): string {
  const trimmed = path.replace(/^definition\./, '');
  if (!trimmed) return path;
  return trimmed;
}

function affectedRefsForChangeset(changeset: Changeset, groupIndices?: number[]): string[] {
  const refs = new Set<string>();
  const includePaths = (paths: readonly string[] | undefined) => {
    for (const path of paths ?? []) refs.add(normalizeAffectedRef(path));
  };
  const aiEntries = groupIndices
    ? groupIndices.map((index) => changeset.aiEntries[index]).filter(Boolean)
    : changeset.aiEntries;
  const overlayEntries = groupIndices
    ? groupIndices.map((index) => changeset.userOverlay[index]).filter(Boolean)
    : changeset.userOverlay;
  for (const entry of aiEntries) includePaths(entry.affectedPaths);
  for (const entry of overlayEntries) includePaths(entry.affectedPaths);
  if (refs.size === 0) {
    for (const entry of changeset.aiEntries) includePaths(entry.affectedPaths);
    for (const entry of changeset.userOverlay) includePaths(entry.affectedPaths);
  }
  return [...refs].filter(Boolean);
}

function resolvedAffectedRefs(project: Project, changeset: Changeset, groupIndices?: number[]): string[] {
  const refs = affectedRefsForChangeset(changeset, groupIndices);
  if (refs.length > 0) return refs;
  return project.fieldPaths();
}

// ── Changeset → ReviewData adapter ─────────────────────────────────

function isFormDefinition(value: unknown): value is FormDefinition {
  return Boolean(value && typeof value === 'object' && 'items' in (value as object));
}

function changelogStoredChangeCount(record: VersionRecord): number {
  const cl = record.changelog as { changes?: unknown[] } | null;
  return Array.isArray(cl?.changes) ? cl.changes.length : 0;
}

function governanceMigrationWarnings(changelog: ReturnType<Project['previewChangelog']>): string[] {
  const warnings: string[] = [];
  for (const change of changelog.changes) {
    if (change.impact !== 'breaking') continue;
    const hint = (change as { migrationHint?: string }).migrationHint?.trim();
    if (!hint) warnings.push(`Breaking change at ${change.path} has no migrationHint (changelog-spec §3).`);
  }
  return warnings;
}

function changesetToReviewData(changeset: Readonly<Changeset>): ChangesetReviewData {
  return {
    id: changeset.id,
    status: changeset.status,
    label: changeset.label,
    aiEntries: changeset.aiEntries.map((e) => ({
      toolName: e.toolName,
      summary: e.summary,
      affectedPaths: e.affectedPaths,
      warnings: e.warnings,
    })),
    userOverlay: changeset.userOverlay.map((e) => ({
      summary: e.summary,
      affectedPaths: e.affectedPaths,
    })),
    dependencyGroups: changeset.dependencyGroups.map((g) => ({
      entries: g.entries,
      reason: g.reason,
    })),
  };
}

// ── ChatPanel ──────────────────────────────────────────────────────

export function ChatPanel({
  project,
  onClose,
  hideHeader = false,
  chatThreadRepository,
  chatProjectScope,
  versionRepository,
  versionScope,
  surfaceLayout = 'rail',
  workspaceRail = { attach: 'dock' },
  initialPrompt,
  onUserMessage,
  onUploadHandlerReady,
  onSourceUploadStart,
  onSourceUploadComplete,
  emptyDescription,
  placeholder,
  inputId,
  composerInputTestId = ASSISTANT_COMPOSER_INPUT_TEST_ID,
  inputAriaLabel,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [recentSessions, setRecentSessions] = useState<SessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticEntry[]>([]);
  const [mergeMessage, setMergeMessage] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState(() => !!getSavedProviderConfig()?.apiKey);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<ChatSession | null>(null);
  const activeRevisionRef = useRef<string | null>(null);
  const initializingRef = useRef(false);

  const [readyToScaffold, setReadyToScaffold] = useState(false);
  const [scaffolding, setScaffolding] = useState(false);
  const [initNotice, setInitNotice] = useState(false);
  const [threadsCollapsed, setThreadsCollapsed] = useState(false);
  const [versions, setVersions] = useState<VersionRecord[]>([]);
  const [authoringMode, setAuthoringMode] = useState<AuthoringMode>('intent');
  const [versionMessage, setVersionMessage] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [compareBaseId, setCompareBaseId] = useState<string | null>(null);
  const [compareTargetId, setCompareTargetId] = useState<string | null>(null);
  const forkLineageParentIdRef = useRef<string | null>(null);
  const repository = useMemo(() => chatThreadRepository ?? createLocalChatThreadRepository(), [chatThreadRepository]);
  const projectScope = useMemo(() => chatProjectScope ?? deriveChatProjectScope(project), [chatProjectScope, project]);
  const resolvedVersionScope = useMemo(() => versionScope ?? projectScope, [projectScope, versionScope]);
  const versionStore = useMemo(() => versionRepository ?? createLocalVersionRepository(), [versionRepository]);
  const hasThreadHistory = recentSessions.length > 0;

  const refreshVersions = useCallback(async () => {
    const next = await versionStore.listVersions({ scope: resolvedVersionScope });
    setVersions(next);
    return next;
  }, [resolvedVersionScope, versionStore]);

  // Re-check API key when panel gains focus (user may have just saved one)
  useEffect(() => {
    const check = () => setHasApiKey(!!getSavedProviderConfig()?.apiKey);
    window.addEventListener('focus', check);
    return () => window.removeEventListener('focus', check);
  }, []);

  // Create the in-process tool context once
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

  const refreshRecentSessions = useCallback(async () => {
    const listed = await repository.listThreads({ projectScope, limit: 100 });
    setRecentSessions(listed.items);
    return listed.items;
  }, [projectScope, repository]);

  const setActiveSession = useCallback((session: ChatSession, revision: string | null) => {
    session.setToolContext(toolContext);
    sessionRef.current = session;
    setActiveSessionId(session.id);
    activeRevisionRef.current = revision;
    syncSessionSnapshot(session);
  }, [syncSessionSnapshot, toolContext]);

  const persistSession = useCallback(async (session: ChatSession) => {
    const state = session.toState();
    const saved = await repository.saveThread(state, {
      projectScope,
      expectedRevision: activeRevisionRef.current,
    });
    activeRevisionRef.current = saved.revision ?? null;
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

  const switchToSession = useCallback(async (sessionId: string) => {
    const config = getSavedProviderConfig();
    if (!config?.apiKey) return;
    const route = selectModelForOperation('assistant_session');
    emitModelRoutingDecision(route);
    const adapter = new GeminiAdapter(config.apiKey, config.model ?? route.model, '');
    const restored = await repository.loadThread(sessionId, { projectScope });
    if (!restored) return;
    const session = await ChatSession.fromState(restored, adapter);
    setActiveSession(session, String(restored.updatedAt || ''));
  }, [projectScope, repository, setActiveSession]);

  const deleteSession = useCallback(async (sessionId: string) => {
    await repository.deleteThread(sessionId, { projectScope });
    const refreshed = await refreshRecentSessions();
    if (activeSessionId && sessionId === activeSessionId) {
      if (refreshed.length > 0) {
        await switchToSession(refreshed[0].id);
      } else {
        await startNewSession();
      }
    }
  }, [activeSessionId, projectScope, refreshRecentSessions, repository, startNewSession, switchToSession]);

  const clearSessions = useCallback(async () => {
    await repository.clearThreads({ projectScope });
    setRecentSessions([]);
    await startNewSession();
  }, [projectScope, repository, startNewSession]);

  // Initialize/resume thread state when API key becomes available.
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
          setMessages([{
            id: `err-${Date.now()}`,
            role: 'system',
            content: `Thread history unavailable: ${error instanceof Error ? error.message : String(error)}`,
            timestamp: Date.now(),
          }]);
          const session = createSession();
          if (session) setActiveSession(session, null);
        }
      } finally {
        if (!cancelled) initializingRef.current = false;
      }
    })();
    return () => {
      cancelled = true;
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

  // Subscribe to changeset transitions — no polling.
  // useSyncExternalStore re-renders only when ProposalManager notifies.
  // Client-only bundle: getServerSnapshot matches getSnapshot. If ChatPanel is ever
  // rendered under SSR, supply a real server snapshot (or gate this path) per React 18.
  const changeset = useSyncExternalStore(
    useCallback(
      (onStoreChange) => proposalManager?.subscribe(onStoreChange) ?? (() => {}),
      [proposalManager],
    ),
    useCallback(() => proposalManager?.getChangeset() ?? null, [proposalManager]),
    useCallback(() => proposalManager?.getChangeset() ?? null, [proposalManager]),
  );

  const projectDiagnostics = useMemo(() => project.diagnose(), [project, changeset, messages.length]);

  useEffect(() => {
    if (!changeset || (changeset.status !== 'pending' && changeset.status !== 'open')) return;
    const affectedRefs = affectedRefsForChangeset(changeset);
    const capability = inferCapability(changeset.label, affectedRefs);
    recordAiPatchLifecycle(project, {
      changesetId: changeset.id,
      summary: changeset.label || 'AI-proposed changeset',
      affectedRefs,
      status: 'open',
      capability,
      scope: inferPatchScope(capability),
    });
  }, [changeset, project]);

  // Apply initialPrompt when it changes
  useEffect(() => {
    if (initialPrompt) {
      setInputValue(initialPrompt);
      // Focus the input after a tick so the panel is visible
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [initialPrompt]);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, sending]);

  // Auto-resize textarea
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [inputValue]);

  const handleSend = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || sending) return;
    setSending(true);
    setInputValue('');
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    onUserMessage?.();

    try {
      emitModelRoutingDecision(selectModelForOperation('compose_patch'));
      const capabilityCommand = parseCapabilityCommand(text);
      if (capabilityCommand) {
        const session = await ensureSession();
        try {
          if (!session.hasDefinition()) {
            const initialized = await session.initializeFromSnapshot();
            if (initialized) setInitNotice(true);
          }
          const capabilityFromCommand = capabilityForCommand(capabilityCommand);
          if (capabilityCommand.kind === 'init') {
            emitAuthoringTelemetry({
              name: 'authoring_capability_method_used',
              capability: capabilityFromCommand,
              method: 'ai_only',
              surface: 'assistant',
              outcome: 'applied',
            });
            setMessages(session.getMessages());
            setReadyToScaffold(false);
            return;
          }
          const translatedInstruction = toSlashRefinementInstruction(capabilityCommand);
          emitAuthoringTelemetry({
            name: 'authoring_capability_method_used',
            capability: capabilityFromCommand,
            method: 'ai_only',
            surface: 'assistant',
            outcome: 'open',
          });
          await session.sendMessage(translatedInstruction);
          setMessages(session.getMessages());
          setReadyToScaffold(false);
          return;
        } catch (error) {
          emitAuthoringTelemetry({
            name: 'authoring_capability_fallback',
            capability: capabilityCommand.kind === 'layout'
              ? 'layout_overrides'
              : capabilityCommand.kind === 'mapping'
                ? 'mappings'
                : capabilityCommand.kind === 'evidence'
                  ? 'evidence_links'
                  : capabilityCommand.kind === 'metadata'
                    ? 'metadata'
                    : capabilityCommand.kind === 'bind'
                      ? 'bind_rules'
                      : 'export_publish',
            method: 'mixed',
            surface: 'assistant',
            outcome: 'fallback',
            fallbackReason: AUTHORING_FALLBACK_REASONS.CAPABILITY_COMMAND_EXECUTION_ERROR,
          });
          throw error;
        }
      }
      const session = await ensureSession();
      await session.sendMessage(text);
      setMessages(session.getMessages());
      setReadyToScaffold(session.isReadyToScaffold());
    } catch (err) {
      if (text.startsWith('/')) {
        emitAuthoringTelemetry({
          name: 'authoring_capability_fallback',
          capability: 'unknown',
          method: 'mixed',
          surface: 'assistant',
          outcome: 'fallback',
          fallbackReason: AUTHORING_FALLBACK_REASONS.CAPABILITY_COMMAND_PARSE_ERROR,
        });
      }
      const errMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'system',
        content: `Error: ${err instanceof Error ? err.message : String(err)}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [ensureSession, inputValue, onUserMessage, sending]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  // ── Changeset actions ────────────────────────────────────────────

  const handleAcceptGroup = useCallback(
    (groupIndex: number) => {
      if (!proposalManager) return;
      const active = proposalManager.getChangeset();
      if (active) {
        const affectedRefs = resolvedAffectedRefs(project, active, [groupIndex]);
        const capability = inferCapability(active.label, affectedRefs);
        recordAiPatchLifecycle(project, {
          changesetId: active.id,
          summary: active.label || 'AI-proposed changeset',
          affectedRefs,
          status: 'accepted',
          capability,
          scope: inferPatchScope(capability),
        });
      }
      const result = proposalManager.acceptChangeset([groupIndex]);
      applyMergeResult(result);
    },
    [project, proposalManager],
  );

  const handleRejectGroup = useCallback(
    (groupIndex: number) => {
      if (!proposalManager) return;
      const active = proposalManager.getChangeset();
      if (active) {
        const affectedRefs = resolvedAffectedRefs(project, active, [groupIndex]);
        const capability = inferCapability(active.label, affectedRefs);
        recordAiPatchLifecycle(project, {
          changesetId: active.id,
          summary: active.label || 'AI-proposed changeset',
          affectedRefs,
          status: 'rejected',
          capability,
          scope: inferPatchScope(capability),
          fallbackReason: AUTHORING_FALLBACK_REASONS.GROUP_REJECTED_BY_USER,
        });
      }
      const result = proposalManager.rejectChangeset([groupIndex]);
      applyMergeResult(result);
    },
    [project, proposalManager],
  );

  const handleAcceptAll = useCallback(() => {
    if (!proposalManager) return;
    const active = proposalManager.getChangeset();
    if (active) {
      const affectedRefs = resolvedAffectedRefs(project, active);
      const capability = inferCapability(active.label, affectedRefs);
      recordAiPatchLifecycle(project, {
        changesetId: active.id,
        summary: active.label || 'AI-proposed changeset',
        affectedRefs,
        status: 'accepted',
        capability,
        scope: inferPatchScope(capability),
      });
    }
    const result = proposalManager.acceptChangeset();
    applyMergeResult(result);
  }, [project, proposalManager]);

  const handleRejectAll = useCallback(() => {
    if (!proposalManager) return;
    const active = proposalManager.getChangeset();
    if (active) {
      const affectedRefs = resolvedAffectedRefs(project, active);
      const capability = inferCapability(active.label, affectedRefs);
      recordAiPatchLifecycle(project, {
        changesetId: active.id,
        summary: active.label || 'AI-proposed changeset',
        affectedRefs,
        status: 'rejected',
        capability,
        scope: inferPatchScope(capability),
        fallbackReason: AUTHORING_FALLBACK_REASONS.ALL_REJECTED_BY_USER,
      });
    }
    const result = proposalManager.rejectChangeset();
    applyMergeResult(result);
  }, [project, proposalManager]);

  // ── Scaffold as changeset ────────────────────────────────────────

  const handleGenerateForm = useCallback(async () => {
    if (scaffolding) return;

    setScaffolding(true);
    try {
      const session = await ensureSession();
      // Generate the scaffold via ChatSession
      await session.scaffold();
      const definition = session.getDefinition();
      if (!definition) return;

      loadDefinitionAsChangeset(`Initial scaffold: ${definition.items?.length ?? 0} field(s)`, definition);

      setMessages(session.getMessages());
      setReadyToScaffold(false);
    } catch (err) {
      const errMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'system',
        content: `Scaffold failed: ${err instanceof Error ? err.message : String(err)}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setScaffolding(false);
    }
  }, [ensureSession, project, proposalManager, scaffolding]);

  const handleUploadFile = useCallback(async (file: File | null) => {
    if (!file || uploading) return;

    setUploading(true);
    onSourceUploadStart?.(file);
    try {
      const session = await ensureSession();
      const attachment = await fileToAttachment(file);
      await session.startFromUpload(attachment);
      const definition = session.getDefinition();
      if (!definition) return;
      loadDefinitionAsChangeset(`Upload scaffold from ${file.name}: ${definition.items?.length ?? 0} field(s)`, definition);
      setMessages(session.getMessages());
      setReadyToScaffold(false);
      onUserMessage?.();
      onSourceUploadComplete?.({
        name: file.name,
        type: attachment.type,
        fieldCount: definition.items?.length ?? 0,
        message: `Generated ${definition.items?.length ?? 0} field(s) from ${file.name}. Review the proposed changes before they modify the form.`,
      });
    } catch (err) {
      const errMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'system',
        content: `Upload failed: ${err instanceof Error ? err.message : String(err)}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      inputRef.current?.focus();
    }
  }, [ensureSession, onSourceUploadComplete, onSourceUploadStart, onUserMessage, uploading]);

  useEffect(() => {
    if (!onUploadHandlerReady) return;
    if (!hasApiKey) {
      onUploadHandlerReady(null);
      return () => onUploadHandlerReady(null);
    }
    onUploadHandlerReady((file: File) => void handleUploadFile(file));
    return () => onUploadHandlerReady(null);
  }, [handleUploadFile, hasApiKey, onUploadHandlerReady]);

  function loadDefinitionAsChangeset(label: string, definition: NonNullable<ReturnType<ChatSession['getDefinition']>>) {
    if (proposalManager) {
      proposalManager.openChangeset();
      proposalManager.beginEntry('scaffold');
      project.loadBundle({ definition });
      proposalManager.endEntry(label);
      proposalManager.closeChangeset(label);
    } else {
      project.loadBundle({ definition });
    }
  }

  function applyMergeResult(result: MergeResult) {
    if (result.ok) {
      setMergeMessage('Changes applied successfully.');
      setDiagnostics(extractDiagnostics(result.diagnostics));
    } else if ('replayFailure' in result) {
      setMergeMessage(
        `Replay failed at ${result.replayFailure.phase} entry #${result.replayFailure.entryIndex}: ${result.replayFailure.error.message}`,
      );
      setDiagnostics([{ severity: 'error', message: result.replayFailure.error.message }]);
    } else if ('diagnostics' in result) {
      setMergeMessage('Merge blocked — structural validation errors found.');
      setDiagnostics(extractDiagnostics(result.diagnostics));
    }
    // Changeset state updates flow through useSyncExternalStore subscription.
  }

  function extractDiagnostics(diagnostics: Diagnostics): DiagnosticEntry[] {
    const all = [
      ...(diagnostics.structural || []),
      ...(diagnostics.expressions || []),
      ...(diagnostics.extensions || []),
      ...(diagnostics.consistency || []),
    ];
    return all.map((d: Diagnostic) => ({
      severity: d.severity === 'warning' ? 'warning' as const : 'error' as const,
      message: d.message ?? String(d),
      path: d.path,
    }));
  }

  const showReview = Boolean(changeset && (changeset.status === 'pending' || changeset.status === 'open'));
  const reviewAffectedRefCount = changeset ? affectedRefsForChangeset(changeset).length : 0;
  const showConversationRibbon = Boolean(showReview && hasApiKey && (messages.length > 0 || sending));
  const railDock = workspaceRail.attach === 'dock';
  const railPortal =
    workspaceRail.attach === 'portal' && workspaceRail.portalContainer ? workspaceRail.portalContainer : null;
  const fieldCount = project.statistics().fieldCount;
  const pendingChangelog = useMemo(() => project.previewChangelog(), [project, changeset, messages.length]);
  const pendingChangeCount = pendingChangelog.changes.length;

  useEffect(() => {
    let nextMode: AuthoringMode = 'intent';
    if (showReview) {
      nextMode = 'review';
    } else if (pendingChangeCount > 0) {
      nextMode = 'commit';
    } else if (messages.length > 0 || fieldCount > 0) {
      nextMode = 'draft';
    }
    setAuthoringMode(nextMode);
  }, [fieldCount, messages.length, pendingChangeCount, showReview]);

  const handleCommitVersion = useCallback(async () => {
    if (showReview) {
      setVersionMessage('Finish reviewing the open changeset (accept or reject) before committing a version.');
      return;
    }
    if (pendingChangeCount === 0) {
      setVersionMessage('Nothing to commit — no definition changes vs baseline.');
      return;
    }
    const migrationWarnings = governanceMigrationWarnings(pendingChangelog);
    if (migrationWarnings.length > 0) {
      const proceed = window.confirm(
        `Governance — migration hints:\n${migrationWarnings.join('\n')}\n\nCommit this version anyway?`,
      );
      if (!proceed) return;
    }
    if (pendingChangelog.semverImpact === 'breaking') {
      const ok = window.confirm(
        'This changelog is classified as breaking (major semver). Commit anyway?',
      );
      if (!ok) return;
    }
    emitModelRoutingDecision(selectModelForOperation('commit_version'));
    const session = sessionRef.current;
    const summary = pendingChangelog.changes[0]?.description
      ? `AI draft: ${pendingChangelog.changes[0].description}`
      : `Commit from ${authoringMode} mode`;
    const parentVersionId = forkLineageParentIdRef.current;
    forkLineageParentIdRef.current = null;
    await versionStore.commitVersion({
      scope: resolvedVersionScope,
      changelog: pendingChangelog,
      snapshot: project.definition,
      summary,
      sessionId: session?.id ?? null,
      parentVersionId,
    });
    emitAuthoringTelemetry({
      name: 'authoring_capability_method_used',
      capability: 'patch_lifecycle',
      method: 'ai_only',
      surface: 'assistant',
      outcome: 'applied',
    });
    setVersionMessage('Version committed to timeline.');
    await refreshVersions();
  }, [
    authoringMode,
    pendingChangelog,
    pendingChangeCount,
    project.definition,
    refreshVersions,
    resolvedVersionScope,
    showReview,
    versionStore,
  ]);

  const handleRestoreVersion = useCallback(
    async (versionId: string) => {
      const ok = window.confirm(
        'Replace the working definition with this snapshot? Any open AI review (changeset) will be discarded.',
      );
      if (!ok) return;
      const record = await versionStore.restoreVersion(versionId, resolvedVersionScope);
      if (!record || !isFormDefinition(record.snapshot)) {
        setVersionMessage('Could not load that version.');
        return;
      }
      if (proposalManager?.hasActiveChangeset) {
        proposalManager.rejectChangeset();
      }
      project.loadBundle({ definition: record.snapshot });
      forkLineageParentIdRef.current = null;
      if (record.sessionId) {
        try {
          await switchToSession(record.sessionId);
        } catch {
          setVersionMessage(`Restored ${record.version} (saved chat thread was missing).`);
          return;
        }
      }
      setVersionMessage(`Restored ${record.version}.`);
    },
    [project, proposalManager, resolvedVersionScope, switchToSession, versionStore],
  );

  const handleForkFromVersion = useCallback(
    async (versionId: string) => {
      const record = await versionStore.restoreVersion(versionId, resolvedVersionScope);
      if (!record || !isFormDefinition(record.snapshot)) {
        setVersionMessage('Could not fork — version missing.');
        return;
      }
      const ok = window.confirm(
        `Start a new chat from snapshot ${record.version}? The working definition will match that version.`,
      );
      if (!ok) return;
      if (proposalManager?.hasActiveChangeset) {
        proposalManager.rejectChangeset();
      }
      project.loadBundle({ definition: record.snapshot });
      forkLineageParentIdRef.current = record.id;
      await startNewSession();
      setVersionMessage(`Forked from ${record.version} — new conversation. Next commit records lineage.`);
    },
    [proposalManager, project, resolvedVersionScope, startNewSession, versionStore],
  );

  useEffect(() => {
    const ids = new Set(versions.map((v) => v.id));
    if (compareBaseId && !ids.has(compareBaseId)) setCompareBaseId(null);
    if (compareTargetId && !ids.has(compareTargetId)) setCompareTargetId(null);
  }, [compareBaseId, compareTargetId, versions]);

  const compareBase = versions.find((v) => v.id === compareBaseId) ?? null;
  const compareTarget = versions.find((v) => v.id === compareTargetId) ?? null;
  const structuralDiagnosticRows = extractDiagnostics(projectDiagnostics);

  const workspaceRailSections = (
    <>
      <section className="space-y-2" data-testid="version-rail">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Versions</p>
          <span className="rounded-full border border-border px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em] text-muted">
            {authoringMode}
          </span>
        </div>
        {pendingChangeCount > 0 && (
          <div className="rounded-md border border-amber/35 bg-amber/10 px-2 py-2">
            <p className="text-[10px] font-medium text-ink">Pending draft</p>
            <p className="text-[10px] text-muted">{pendingChangeCount} change(s) ready for review/commit.</p>
            <button
              type="button"
              onClick={() => void handleCommitVersion()}
              disabled={showReview}
              className="mt-2 w-full rounded-md border border-amber/40 bg-white px-2 py-1 text-[10px] font-semibold text-ink hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-40"
            >
              Commit version
            </button>
          </div>
        )}
        {versions.length === 0 && (
          <p className="rounded-md border border-dashed border-border px-2 py-3 text-[11px] text-muted">No committed versions yet.</p>
        )}
        <div className="space-y-1">
          {versions.slice(0, 12).map((version) => (
            <div key={version.id} className="space-y-1.5 rounded-md border border-border bg-surface px-2 py-2">
              <div>
                <p className="text-[11px] font-semibold text-ink">{version.version}</p>
                <p className="text-[10px] text-muted">
                  {version.semverImpact} impact
                  {version.parentVersionId ? ' · branched' : ''}
                </p>
                {version.summary && (
                  <p className="mt-0.5 line-clamp-2 text-[10px] text-muted">{version.summary}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => void handleRestoreVersion(version.id)}
                  className="rounded border border-border px-1.5 py-0.5 text-[10px] font-medium text-ink hover:bg-subtle"
                >
                  Restore
                </button>
                <button
                  type="button"
                  onClick={() => void handleForkFromVersion(version.id)}
                  className="rounded border border-border px-1.5 py-0.5 text-[10px] font-medium text-ink hover:bg-subtle"
                >
                  Fork
                </button>
              </div>
            </div>
          ))}
        </div>
        {versionMessage && <p className="text-[10px] text-accent">{versionMessage}</p>}
        {hideHeader && (
          <button
            type="button"
            onClick={() => setDetailsOpen(true)}
            className="w-full rounded-md border border-border py-1.5 text-[10px] font-medium text-muted hover:bg-subtle hover:text-ink"
          >
            Workspace details
          </button>
        )}
      </section>
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Conversations</p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => void startNewSession()}
              disabled={!hasApiKey}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-ink hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Start new chat"
            >
              <IconPlus size={12} />
              New
            </button>
            <button
              type="button"
              onClick={() => void clearSessions()}
              disabled={!hasApiKey || !hasThreadHistory}
              className="rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted hover:bg-subtle hover:text-ink disabled:opacity-40"
              aria-label="Clear all threads"
            >
              Clear all
            </button>
          </div>
        </div>
        {!hasApiKey && (
          <p className="rounded-md border border-dashed border-border px-2 py-2 text-[10px] text-muted">
            Add an API key in settings to enable assistant threads. Versions and restore still work offline.
          </p>
        )}
        {hasApiKey && recentSessions.length === 0 && (
          <p className="rounded-md border border-dashed border-border px-2 py-3 text-[11px] text-muted">No saved threads yet.</p>
        )}
        <div className="space-y-1">
          {hasApiKey &&
            recentSessions.map((thread) => (
              <div
                key={thread.id}
                className={`group rounded-md border px-2 py-2 ${
                  activeSessionId === thread.id ? 'border-accent/35 bg-accent/5' : 'border-transparent hover:border-border hover:bg-subtle'
                }`}
              >
                <button
                  type="button"
                  onClick={() => void switchToSession(thread.id)}
                  className="w-full text-left"
                  data-testid={`chat-thread-${thread.id}`}
                >
                  <p className="truncate text-[12px] font-medium text-ink">{thread.preview || 'New conversation'}</p>
                  <p className="mt-0.5 text-[10px] text-muted">{thread.messageCount} messages</p>
                </button>
                <button
                  type="button"
                  onClick={() => void deleteSession(thread.id)}
                  aria-label={`Delete thread ${thread.preview || thread.id}`}
                  className="mt-1 inline-flex items-center gap-1 text-[10px] text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-ink"
                >
                  <IconTrash size={11} />
                  Delete
                </button>
              </div>
            ))}
        </div>
      </section>
    </>
  );

  return (
    <div
      data-testid="chat-panel"
      className={`flex h-full min-h-0 bg-surface ${surfaceLayout === 'primary' ? 'border-0' : 'border-l border-border'}`}
    >
      {railDock && !threadsCollapsed && (
        <aside className="w-[260px] shrink-0 border-r border-border bg-bg-default/35" data-testid="chat-thread-list">
          <div className="flex items-center justify-between border-b border-border/70 px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Workspace</p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setThreadsCollapsed(true)}
                className="rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted hover:bg-subtle hover:text-ink"
                aria-label="Collapse chat threads"
                title="Collapse chat threads"
              >
                Hide
              </button>
            </div>
          </div>
          <div className="max-h-[calc(100%-42px)] space-y-3 overflow-y-auto p-2">{workspaceRailSections}</div>
        </aside>
      )}

      {railPortal &&
        createPortal(
          <div data-testid="chat-thread-list" className="bg-bg-default/35 px-1 pb-2 pt-1">
            <div className="space-y-3 px-1">{workspaceRailSections}</div>
          </div>,
          railPortal,
        )}

      {railDock && threadsCollapsed && (
        <aside className="flex w-11 shrink-0 flex-col items-center gap-2 border-r border-border bg-bg-default/35 py-3">
          <button
            type="button"
            onClick={() => setThreadsCollapsed(false)}
            className="rounded-md border border-border px-1.5 py-1 text-[10px] font-medium text-muted hover:bg-subtle hover:text-ink"
            aria-label="Expand workspace rail"
            title="Workspace"
          >
            WS
          </button>
          <button
            type="button"
            onClick={() => setDetailsOpen(true)}
            className="rounded-md border border-border px-1.5 py-1 text-[10px] font-medium text-muted hover:bg-subtle hover:text-ink"
            aria-label="Open workspace details"
            title="Details"
          >
            ⋯
          </button>
        </aside>
      )}

      <div className="flex min-h-0 flex-1 min-w-0 flex-row">
        <div className="flex min-h-0 flex-1 min-w-0 flex-col">
      {/* ── Header ──────────────────────────────────────── */}
        {!hideHeader && (
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-2">
            <IconSparkle />
            <h2 className="text-sm font-semibold text-ink">Assistant</h2>
            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted">
              {authoringMode}
            </span>
            {changeset && (
              <span className="rounded-full border border-amber/30 bg-amber/10 px-2 py-0.5 text-[10px] font-medium text-amber">
                review {changeset.status}
              </span>
            )}
          </div>
          {showReview && (
            <p className="text-[11px] text-muted leading-snug">
              Review impacted scope ({reviewAffectedRefCount} refs) before accept/reject.
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          {authoringMode === 'commit' && !showReview && (
            <button
              type="button"
              onClick={() => void handleCommitVersion()}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-[11px] font-semibold text-ink hover:bg-subtle transition-colors"
            >
              Commit version
            </button>
          )}
          {hasApiKey && threadsCollapsed && (
            <button
              type="button"
              onClick={() => void startNewSession()}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-[11px] font-semibold text-ink hover:bg-subtle transition-colors"
              aria-label="Start new chat"
            >
              <IconPlus size={12} />
              New chat
            </button>
          )}
          <button
            type="button"
            onClick={() => setDetailsOpen((open) => !open)}
            className={`rounded-md border px-2 py-1.5 text-[11px] font-medium transition-colors ${
              detailsOpen ? 'border-accent/40 bg-accent/5 text-ink' : 'border-border text-muted hover:bg-subtle hover:text-ink'
            }`}
            aria-expanded={detailsOpen}
            aria-controls="chat-workspace-details"
          >
            Details
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded hover:bg-subtle transition-colors"
            aria-label="Close chat panel"
          >
            <IconClose />
          </button>
        </div>
          </div>
        )}

      {/* ── Content: conversation + review (review does not replace chat) ── */}
      <div className="flex-1 flex flex-col min-h-0">
        {showConversationRibbon && (
          <div className="shrink-0 flex flex-col max-h-[38%] min-h-0 border-b border-border/80 bg-bg-default/40">
            <p className="px-4 pt-2 pb-1 text-[10px] font-mono uppercase tracking-[0.14em] text-muted">
              Conversation
            </p>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <ChatMessageList
                messages={messages}
                sending={sending}
                hasApiKey={hasApiKey}
                messagesEndRef={messagesEndRef}
                emptyDescription={emptyDescription}
                variant="ribbon"
              />
            </div>
          </div>
        )}
        <div className={`flex-1 min-h-0 overflow-y-auto ${showReview ? '' : 'flex flex-col'}`}>
          {showReview ? (
            <ChangesetReviewSection
              changeset={changesetToReviewData(changeset!)}
              diagnostics={diagnostics}
              mergeMessage={mergeMessage}
              onAcceptGroup={handleAcceptGroup}
              onRejectGroup={handleRejectGroup}
              onAcceptAll={handleAcceptAll}
              onRejectAll={handleRejectAll}
              project={project}
            />
          ) : (
            <ChatMessageList
              messages={messages}
              sending={sending}
              hasApiKey={hasApiKey}
              messagesEndRef={messagesEndRef}
              emptyDescription={emptyDescription}
            />
          )}
        </div>
      </div>

      {/* ── Generate Form button ─────────────────────────── */}
      {readyToScaffold && !scaffolding && !showReview && (
        <div className="px-4 pb-2 shrink-0">
          <button
            type="button"
            onClick={handleGenerateForm}
            className="w-full py-2 px-4 rounded-lg text-[13px] font-semibold bg-accent text-white hover:bg-accent/90 transition-colors"
          >
            Generate Form
          </button>
        </div>
      )}

      {/* ── Composer + form field inspector (single footer band) ─ */}
      <div className="shrink-0 border-t border-border bg-bg-default/25">
      {hasApiKey && (
        <div className="px-4 pb-2 pt-2 shrink-0">
          <div className="flex items-end gap-1 border border-border rounded-xl px-2 py-1.5 bg-bg-default focus-within:border-accent/50 transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.json,.txt,.md,application/pdf,application/json,text/plain,text/markdown"
              className="sr-only"
              aria-label="Upload source file"
              onChange={(event) => void handleUploadFile(event.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending || uploading}
              aria-label="Upload PDF, JSON, or text source"
              title="Upload PDF, JSON, or text source"
              className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg text-muted hover:bg-subtle hover:text-ink disabled:opacity-40 transition-colors"
            >
              <IconUpload size={17} />
            </button>
            <textarea
              id={inputId}
              ref={inputRef}
              data-testid={composerInputTestId}
              rows={1}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sending || uploading}
              aria-label={inputAriaLabel ?? 'Assistant message'}
              placeholder={placeholder ?? 'Describe the form or request a change…'}
              className="flex-1 resize-none bg-transparent text-[13px] leading-relaxed outline-none disabled:opacity-40 min-h-[32px] py-1 px-1"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || uploading || !inputValue.trim()}
              aria-label="Send message"
              className={`flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
                inputValue.trim() && !sending && !uploading
                  ? 'bg-accent text-white hover:bg-accent/90'
                  : 'bg-subtle text-muted'
              }`}
            >
              <IconArrowUp />
            </button>
          </div>
          {initNotice && (
            <p className="mt-1 text-center text-[10px] font-medium text-accent">
              Assistant context initialized from the current draft.
            </p>
          )}
          <p className="text-center text-[10px] text-muted mt-1 select-none">
            {uploading
              ? 'Processing uploaded source...'
              : 'Enter to send · Shift+Enter for new line · /init /layout /mapping /evidence /metadata /bind /export'}
          </p>
        </div>
      )}
      <ChatSelectionFocusStrip project={project} />
      </div>
        </div>

        {detailsOpen && (
          <aside
            id="chat-workspace-details"
            className="flex w-[min(100%,340px)] shrink-0 flex-col border-l border-border bg-bg-default/55"
            aria-label="Workspace details"
          >
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <p className="text-[11px] font-semibold text-ink">Details</p>
              <button
                type="button"
                onClick={() => setDetailsOpen(false)}
                className="rounded p-1 text-muted hover:bg-subtle hover:text-ink"
                aria-label="Close details panel"
              >
                <IconClose />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 text-[11px]">
              <section className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Definition</p>
                <p className="text-ink">{typeof project.definition.title === 'string' ? project.definition.title : 'Untitled'}</p>
                <p className="text-muted">{project.statistics().fieldCount} fields · scope {resolvedVersionScope}</p>
              </section>

              {mergeMessage && (
                <section className="space-y-1 rounded-md border border-border bg-surface px-2 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Merge</p>
                  <p className="text-ink">{mergeMessage}</p>
                </section>
              )}

              <section className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Pending changelog</p>
                <p className="text-muted">
                  Impact <span className="font-mono text-ink">{pendingChangelog.semverImpact}</span> ·{' '}
                  {pendingChangeCount} change(s)
                </p>
                {pendingChangelog.changes.slice(0, 5).map((c, idx) => (
                  <p key={`${idx}-${c.path}-${c.type}`} className="truncate text-[10px] text-muted">
                    {c.type} {c.path}
                  </p>
                ))}
                {pendingChangeCount > 5 && <p className="text-[10px] text-muted">…and {pendingChangeCount - 5} more</p>}
              </section>

              <section className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Compare versions</p>
                <label className="block space-y-0.5">
                  <span className="text-[10px] text-muted">Base</span>
                  <select
                    className="w-full rounded-md border border-border bg-surface px-2 py-1 text-[11px]"
                    value={compareBaseId ?? ''}
                    onChange={(e) => setCompareBaseId(e.target.value || null)}
                  >
                    <option value="">Select…</option>
                    {versions.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.version} ({changelogStoredChangeCount(v)} changes)
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-0.5">
                  <span className="text-[10px] text-muted">Target</span>
                  <select
                    className="w-full rounded-md border border-border bg-surface px-2 py-1 text-[11px]"
                    value={compareTargetId ?? ''}
                    onChange={(e) => setCompareTargetId(e.target.value || null)}
                  >
                    <option value="">Select…</option>
                    {versions.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.version} ({changelogStoredChangeCount(v)} changes)
                      </option>
                    ))}
                  </select>
                </label>
                {compareBase && compareTarget && compareBase.id !== compareTarget.id && (
                  <div className="rounded-md border border-dashed border-border px-2 py-2 text-[10px] text-muted">
                    <p className="font-medium text-ink">Recorded changelogs</p>
                    <p>
                      Base <span className="font-mono">{compareBase.version}</span>:{' '}
                      {changelogStoredChangeCount(compareBase)} stored change(s), impact {compareBase.semverImpact}.
                    </p>
                    <p>
                      Target <span className="font-mono">{compareTarget.version}</span>:{' '}
                      {changelogStoredChangeCount(compareTarget)} stored change(s), impact {compareTarget.semverImpact}.
                    </p>
                    <p className="mt-1 text-[10px]">
                      Full snapshot-to-snapshot diff uses the editor baseline when you restore a version.
                    </p>
                  </div>
                )}
              </section>

              <section className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Project diagnostics</p>
                {structuralDiagnosticRows.length === 0 && <p className="text-[10px] text-muted">No issues reported.</p>}
                {structuralDiagnosticRows.slice(0, 12).map((row, i) => (
                  <p key={`${row.path ?? i}-${row.message}`} className={`text-[10px] ${row.severity === 'error' ? 'text-red-600' : 'text-amber-700'}`}>
                    {row.path ? `${row.path}: ` : ''}
                    {row.message}
                  </p>
                ))}
              </section>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

async function fileToAttachment(file: File): Promise<Attachment> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const type: Attachment['type'] =
    extension === 'pdf' || file.type === 'application/pdf'
      ? 'pdf'
      : extension === 'json' || file.type === 'application/json'
        ? 'json'
        : 'text';
  const data = type === 'pdf' ? await readFileAsDataUrl(file) : await file.text();
  return {
    id: `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type,
    name: file.name,
    data,
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read file.'));
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsDataURL(file);
  });
}
