/** @filedesc Context provider for shell panel visibility: command palette, import dialog, settings dialogs, chat panel, preview companion. */
import { createContext, useState, useEffect, type ReactNode } from 'react';
import { addStudioEventListener, STUDIO_EVENTS } from '../studio-events';

export const PREVIEW_PERSIST_KEY = 'formspec-studio:show-preview:v1';

export interface ShellPanelsState {
  showPalette: boolean;
  setShowPalette: (show: boolean) => void;
  showImport: boolean;
  setShowImport: (show: boolean) => void;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  showAppSettings: boolean;
  setShowAppSettings: (show: boolean) => void;
  assistantOpen: boolean;
  setAssistantOpen: (open: boolean) => void;
  showPreview: boolean;
  setShowPreview: (open: boolean) => void;
}

export function readPreviewVisibility(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(PREVIEW_PERSIST_KEY) === '1';
}

export function writePreviewVisibility(open: boolean): void {
  if (typeof window === 'undefined') return;
  if (open) localStorage.setItem(PREVIEW_PERSIST_KEY, '1');
  else localStorage.removeItem(PREVIEW_PERSIST_KEY);
}

export const ShellPanelsContext = createContext<ShellPanelsState | null>(null);

export function ShellPanelsProvider({ children }: { children: ReactNode }) {
  const [showPalette, setShowPalette] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAppSettings, setShowAppSettings] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [showPreview, setShowPreviewState] = useState(readPreviewVisibility);

  const setShowPreview = (open: boolean) => {
    setShowPreviewState(open);
    writePreviewVisibility(open);
  };

  useEffect(() => {
    const cleanup1 = addStudioEventListener(STUDIO_EVENTS.OPEN_SETTINGS, () => setShowSettings(true));
    const cleanup2 = addStudioEventListener(STUDIO_EVENTS.OPEN_APP_SETTINGS, () => setShowAppSettings(true));
    const cleanup3 = addStudioEventListener(STUDIO_EVENTS.TOGGLE_PREVIEW_COMPANION, (e) => {
      setShowPreview(e.detail.open ?? true);
    });
    return () => { cleanup1(); cleanup2(); cleanup3(); };
  }, []);

  const value = {
    showPalette,
    setShowPalette,
    showImport,
    setShowImport,
    showSettings,
    setShowSettings,
    showAppSettings,
    setShowAppSettings,
    assistantOpen,
    setAssistantOpen,
    showPreview,
    setShowPreview,
  };

  return (
    <ShellPanelsContext.Provider value={value}>
      {children}
    </ShellPanelsContext.Provider>
  );
}
