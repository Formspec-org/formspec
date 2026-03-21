/** @filedesc React context and hooks for ChatSession state — v2 chat UI. */
import React, { createContext, useContext, useCallback, useRef, useSyncExternalStore } from 'react';
import type { ChatSession, ChatMessage, SourceTrace, Issue, DefinitionDiff, DebugEntry } from 'formspec-chat';
import type { ProjectBundle } from 'formspec-studio-core';
import type { FormDefinition } from 'formspec-types';

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
  debugLog: DebugEntry[];
  scaffoldingText: string | null;
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
    debugLog: session.getDebugLog(),
    scaffoldingText: session.getScaffoldingText(),
  };
}

const SessionContext = createContext<ChatSession | null>(null);

export function ChatProvider({ session, children }: { session: ChatSession; children: React.ReactNode }) {
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useChatSession(): ChatSession {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useChatSession must be used within a ChatProvider');
  return session;
}

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

  const getSnapshot = useCallback(() => cachedRef.current, []);

  return useSyncExternalStore(subscribe, getSnapshot);
}
