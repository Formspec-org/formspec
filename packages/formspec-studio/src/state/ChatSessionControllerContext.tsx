/** @filedesc React context for the lifted ChatSession controller (ADR 0082). */
import { createContext, type ReactNode } from 'react';
import type { ChatSessionController } from '../hooks/useChatSessionController';

const ChatSessionControllerContext = createContext<ChatSessionController | null>(null);

export function ChatSessionControllerProvider({
  controller,
  children,
}: {
  controller: ChatSessionController;
  children: ReactNode;
}): JSX.Element {
  return (
    <ChatSessionControllerContext.Provider value={controller}>{children}</ChatSessionControllerContext.Provider>
  );
}
