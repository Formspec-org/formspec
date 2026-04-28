/** @filedesc Manages shell panel visibility: command palette, import dialog, settings dialogs, chat panel. */
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
  /** Assistant chat panel open state (right rail in Shell). */
  assistantOpen: boolean;
  setAssistantOpen: (open: boolean) => void;
}

export function useShellPanels(): ShellPanelsState {
  const [showPalette, setShowPalette] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAppSettings, setShowAppSettings] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);

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

  return {
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
  };
}
