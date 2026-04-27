/** @filedesc Lets Shell open the full-screen assistant workspace owned by StudioApp. */
import { createContext, useContext, type ReactElement, type ReactNode } from 'react';

/** Dispatched so App Settings (or tests) can open the assistant workspace without Shell context. */
export const OPEN_ASSISTANT_WORKSPACE_EVENT = 'formspec:open-assistant-workspace';

export type OpenAssistantWorkspaceEventDetail = {
  /** When true, clears first-run keys (same as New Form reset) before opening assistant. */
  resetFirstRun?: boolean;
};

export type OpenAssistantWorkspace = () => void;

const StudioWorkspaceViewContext = createContext<OpenAssistantWorkspace | null>(null);

export function StudioWorkspaceViewProvider({
  openAssistantWorkspace,
  children,
}: {
  openAssistantWorkspace: OpenAssistantWorkspace;
  children: ReactNode;
}): ReactElement {
  return <StudioWorkspaceViewContext.Provider value={openAssistantWorkspace}>{children}</StudioWorkspaceViewContext.Provider>;
}

export function useOpenAssistantWorkspace(): OpenAssistantWorkspace | null {
  return useContext(StudioWorkspaceViewContext);
}
