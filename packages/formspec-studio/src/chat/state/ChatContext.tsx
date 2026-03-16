import React, { createContext, useContext, useCallback, useRef, useSyncExternalStore } from 'react';
import type { ChatSession, ChatMessage, SourceTrace, Issue, DefinitionDiff } from 'formspec-chat';
import type { ProjectBundle } from 'formspec-studio-core';
import type { FormDefinition } from 'formspec-types';

// ── State snapshot ───────────────────────────────────────────────────

export interface ChatState {
  messages: ChatMessage[];
  hasDefinition: boolean;
  readyToScaffold: boolean;
  definition: FormDefinition | null;
  bundle: ProjectBundle | null;
  lastDiff: DefinitionDiff | null;
  openIssueCount: number;
  traces: SourceTrace[];
  issues: Issue[];
}

function snapshotFrom(session: ChatSession): ChatState {
  return {
    messages: session.getMessages(),
    hasDefinition: session.hasDefinition(),
    readyToScaffold: session.isReadyToScaffold(),
    definition: session.getDefinition(),
    bundle: session.getBundle(),
    lastDiff: session.getLastDiff(),
    openIssueCount: session.getOpenIssueCount(),
    traces: session.getTraces(),
    issues: session.getIssues(),
  };
}

// ── Context ──────────────────────────────────────────────────────────

const SessionContext = createContext<ChatSession | null>(null);

// ── Provider ─────────────────────────────────────────────────────────

export function ChatProvider({ session, children }: { session: ChatSession; children: React.ReactNode }) {
  return (
    <SessionContext.Provider value={session}>
      {children}
    </SessionContext.Provider>
  );
}

// ── Hooks ────────────────────────────────────────────────────────────

export function useChatSession(): ChatSession {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useChatSession must be used within a ChatProvider');
  return session;
}

/**
 * Reactive state from the ChatSession, re-renders on onChange.
 * Caches the snapshot to avoid infinite re-render loops with useSyncExternalStore.
 */
export function useChatState(): ChatState {
  const session = useChatSession();
  const cachedRef = useRef<ChatState>(snapshotFrom(session));

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      return session.onChange(() => {
        cachedRef.current = snapshotFrom(session);
        onStoreChange();
      });
    },
    [session],
  );

  const getSnapshot = useCallback(
    () => cachedRef.current,
    [],
  );

  return useSyncExternalStore(subscribe, getSnapshot);
}
