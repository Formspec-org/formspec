/** @filedesc Manages shell panel visibility: command palette, import dialog, settings dialogs, chat panel, and AI action events. */
import { useState, useEffect } from 'react';

export interface ShellPanelsState {
  showPalette: boolean;
  setShowPalette: (show: boolean) => void;
  showImport: boolean;
  setShowImport: (show: boolean) => void;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  showAppSettings: boolean;
  setShowAppSettings: (show: boolean) => void;
  showChatPanel: boolean;
  setShowChatPanel: (show: boolean) => void;
  chatPrompt: string | null;
  setChatPrompt: (prompt: string | null) => void;
}

export function useShellPanels(): ShellPanelsState {
  const [showPalette, setShowPalette] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAppSettings, setShowAppSettings] = useState(false);
  const [showChatPanel, setShowChatPanel] = useState(false);
  const [chatPrompt, setChatPrompt] = useState<string | null>(null);

  useEffect(() => {
    const onOpenSettings = () => setShowSettings(true);
    const onOpenAppSettings = () => setShowAppSettings(true);
    window.addEventListener('formspec:open-settings', onOpenSettings);
    window.addEventListener('formspec:open-app-settings', onOpenAppSettings);
    return () => {
      window.removeEventListener('formspec:open-settings', onOpenSettings);
      window.removeEventListener('formspec:open-app-settings', onOpenAppSettings);
    };
  }, []);

  useEffect(() => {
    const onAIAction = (event: Event) => {
      const { prompt } = (event as CustomEvent<{ prompt: string }>).detail ?? {};
      if (prompt) {
        setChatPrompt(prompt);
        setShowChatPanel(true);
      }
    };
    window.addEventListener('formspec:ai-action', onAIAction);
    return () => window.removeEventListener('formspec:ai-action', onAIAction);
  }, []);

  return {
    showPalette,
    setShowPalette,
    showImport,
    setShowImport,
    showSettings,
    setShowSettings,
    showAppSettings,
    setShowAppSettings,
    showChatPanel,
    setShowChatPanel,
    chatPrompt,
    setChatPrompt,
  };
}
