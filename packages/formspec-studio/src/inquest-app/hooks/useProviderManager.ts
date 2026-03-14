import { useCallback, useEffect, useState } from 'react';
import type { ConnectionResult, InquestSessionV1 } from '../../shared/contracts/inquest';
import {
  clearProviderKey,
  loadProviderPreferences,
  rememberProviderKey,
  saveSelectedProvider,
} from '../../shared/persistence/inquest-store';
import { findProviderAdapter, inquestProviderAdapters } from '../../shared/providers';

/* ── Hook ─────────────────────────────────────── */

export interface ProviderManager {
  providerApiKey: string;
  rememberKey: boolean;
  connection: ConnectionResult | undefined;
  isTesting: boolean;
  providerReady: boolean;
  isSetupRequired: boolean;
  setProviderApiKey: (val: string) => void;
  setRememberKey: (val: boolean) => void;
  setProviderReady: (val: boolean) => void;
  handleTestConnection: () => Promise<void>;
  handleProviderSelected: (
    providerId: string,
    updateSession: (updater: (s: InquestSessionV1) => InquestSessionV1) => void,
  ) => void;
  handleCredentialsCleared: (providerId: string | undefined) => void;
}

export function useProviderManager(session: InquestSessionV1 | null): ProviderManager {
  const [providerApiKey, setProviderApiKey] = useState('');
  const [rememberKey, setRememberKey] = useState(false);
  const [connection, setConnection] = useState<ConnectionResult | undefined>();
  const [isTesting, setIsTesting] = useState(false);
  const [providerReady, setProviderReady] = useState(false);

  // Hydrate stored credentials when session first loads or provider changes
  useEffect(() => {
    if (!session?.sessionId) return;
    const prefs = loadProviderPreferences();
    const selectedProviderId = session.providerId ?? prefs.selectedProviderId ?? inquestProviderAdapters[0]?.id;
    const storedKey = selectedProviderId ? prefs.rememberedKeys[selectedProviderId] ?? '' : '';
    setProviderApiKey(storedKey);
    setRememberKey(Boolean(storedKey));
    if (storedKey) setProviderReady(true);
  // We only want to run this once per session load, keyed on sessionId
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.sessionId]);

  const handleTestConnection = useCallback(async () => {
    if (!session?.providerId) return;
    const provider = findProviderAdapter(session.providerId);
    if (!provider) return;
    setIsTesting(true);
    try {
      const result = await provider.testConnection({ apiKey: providerApiKey });
      setConnection(result);
      saveSelectedProvider(provider.id);
      if (result.ok && rememberKey) rememberProviderKey(provider.id, providerApiKey);
      if (!rememberKey) clearProviderKey(provider.id);
    } finally {
      setIsTesting(false);
    }
  }, [session?.providerId, providerApiKey, rememberKey]);

  const handleProviderSelected = useCallback((
    providerId: string,
    updateSession: (updater: (s: InquestSessionV1) => InquestSessionV1) => void,
  ) => {
    setProviderReady(false);
    setConnection(undefined);
    const prefs = loadProviderPreferences();
    const storedKey = prefs.rememberedKeys[providerId] ?? '';
    setProviderApiKey(storedKey);
    setRememberKey(Boolean(storedKey));
    saveSelectedProvider(providerId);
    updateSession((current) => ({
      ...current,
      providerId,
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const handleCredentialsCleared = useCallback((providerId: string | undefined) => {
    setProviderApiKey('');
    setRememberKey(false);
    if (providerId) clearProviderKey(providerId);
    setConnection(undefined);
  }, []);

  const isSetupRequired = !session?.providerId || !providerApiKey || !providerReady;

  return {
    providerApiKey,
    rememberKey,
    connection,
    isTesting,
    providerReady,
    isSetupRequired,
    setProviderApiKey,
    setRememberKey,
    setProviderReady,
    handleTestConnection,
    handleProviderSelected,
    handleCredentialsCleared,
  };
}
