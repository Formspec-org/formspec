/** @filedesc Top-level v2 chat shell — manages sessions, file uploads, panel layout with modern design. */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { ChatSession, GeminiAdapter, MockAdapter, SessionStore, validateProviderConfig, extractRegistryHints } from '@formspec-org/chat';
import type { AIAdapter, Attachment, ProviderConfig, StorageBackend } from '@formspec-org/chat';
import { buildBundleFromDefinition, commonRegistry } from '@formspec-org/studio-core';
import { exportProjectZip } from '../../lib/export-zip';
import { ChatProvider, useChatState, useChatSession } from '../state/ChatContext.js';
import { EntryScreenV2 } from './EntryScreenV2.js';
import { ChatPanelV2 } from './ChatPanelV2.js';
import { FormPreviewV2 } from './FormPreviewV2.js';
import { IssuePanelV2 } from './IssuePanelV2.js';
import { ProviderSetupV2 } from './ProviderSetupV2.js';
import {
  CANONICAL_PROVIDER_CONFIG_KEY,
  migrateLegacyProviderConfigKeys,
} from '../../lib/provider-config-storage.js';

import {
  IconChevronLeft,
  IconWarning,
  IconExternal,
  IconDownload,
  IconSettings,
  IconClose,
} from '../../components/icons';
const UPLOAD_ACCEPT = '.pdf,.png,.jpg,.jpeg,.csv,.tsv,.xlsx,.json';

function attachmentTypeFromFilename(name: string): Attachment['type'] {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf') return 'pdf';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return 'image';
  if (['csv', 'tsv', 'xlsx', 'xls'].includes(ext)) return 'spreadsheet';
  return 'json';
}

function fileToAttachment(file: File, text: string): Attachment {
  return {
    id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: attachmentTypeFromFilename(file.name),
    name: file.name,
    data: text,
  };
}

const registryHints = extractRegistryHints(commonRegistry);

function getAdapter(config: ProviderConfig | null): AIAdapter {
  if (!config) return new MockAdapter();
  return new GeminiAdapter(config.apiKey, config.model, registryHints);
}

interface ChatShellProps {
  store?: SessionStore;
  storage?: StorageBackend;
}

export function ChatShellV2({ store, storage }: ChatShellProps = {}) {
  const [session, setSession] = useState<ChatSession | null>(null);
  const [recentSessions, setRecentSessions] = useState(() => store?.list() ?? []);
  const [providerConfig, setProviderConfig] = useState<ProviderConfig | null>(() => {
    if (!storage) return null;
    migrateLegacyProviderConfigKeys(storage);
    const raw = storage.getItem(CANONICAL_PROVIDER_CONFIG_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return validateProviderConfig(parsed).length === 0 ? parsed : null;
    } catch { return null; }
  });
  const [showProviderSetup, setShowProviderSetup] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasShownInitialSetup = useRef(false);

  useEffect(() => {
    if (!providerConfig && !hasShownInitialSetup.current) {
      hasShownInitialSetup.current = true;
      setShowProviderSetup(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshSessions = useCallback(() => {
    setRecentSessions(store?.list() ?? []);
  }, [store]);

  useEffect(() => {
    if (!session || !store) return;
    return session.onChange(() => { store.save(session.toState()); });
  }, [session, store]);

  const handleSaveProvider = useCallback((config: ProviderConfig) => {
    setProviderConfig(config);
    storage?.setItem(CANONICAL_PROVIDER_CONFIG_KEY, JSON.stringify(config));
    setShowProviderSetup(false);
  }, [storage]);

  const handleClearProvider = useCallback(() => {
    setProviderConfig(null);
    storage?.removeItem(CANONICAL_PROVIDER_CONFIG_KEY);
    setShowProviderSetup(false);
  }, [storage]);

  const handleStartBlank = useCallback(() => {
    setSession(new ChatSession({ adapter: getAdapter(providerConfig), buildBundle: buildBundleFromDefinition }));
  }, [providerConfig]);

  const handleSelectTemplate = useCallback(async (templateId: string) => {
    const s = new ChatSession({ adapter: getAdapter(providerConfig), buildBundle: buildBundleFromDefinition });
    await s.startFromTemplate(templateId);
    setSession(s);
  }, [providerConfig]);

  const handleUpload = useCallback(() => { fileInputRef.current?.click(); }, []);

  const handleFilesSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const s = new ChatSession({ adapter: getAdapter(providerConfig), buildBundle: buildBundleFromDefinition });
    const firstText = await files[0].text();
    await s.startFromUpload(fileToAttachment(files[0], firstText));
    for (let i = 1; i < files.length; i++) {
      const text = await files[i].text();
      await s.startFromUpload(fileToAttachment(files[i], text));
    }
    setSession(s);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [providerConfig]);

  const handleResumeSession = useCallback(async (sessionId: string) => {
    if (!store) return;
    const state = store.load(sessionId);
    if (!state) return;
    const restored = await ChatSession.fromState(state, getAdapter(providerConfig), buildBundleFromDefinition);
    setSession(restored);
  }, [store, providerConfig]);

  const handleDeleteSession = useCallback((sessionId: string) => {
    store?.delete(sessionId);
    refreshSessions();
  }, [store, refreshSessions]);

  const handleBack = useCallback(() => {
    setSession(null);
    refreshSessions();
  }, [refreshSessions]);

  const handleOpenSettings = useCallback(() => { setShowProviderSetup(true); }, []);

  const content = !session ? (
    <EntryScreenV2
      onStartBlank={handleStartBlank}
      onSelectTemplate={handleSelectTemplate}
      onUpload={handleUpload}
      onResumeSession={handleResumeSession}
      recentSessions={recentSessions}
      providerConfig={providerConfig}
      onOpenSettings={handleOpenSettings}
      onDeleteSession={handleDeleteSession}
    />
  ) : (
    <ChatProvider session={session}>
      <ActiveSessionV2 onBack={handleBack} onUpload={handleUpload} onOpenSettings={handleOpenSettings} />
    </ChatProvider>
  );

  return (
    <>
      {content}
      <input ref={fileInputRef} type="file" accept={UPLOAD_ACCEPT} multiple onChange={handleFilesSelected} className="hidden" aria-hidden="true" />
      <ProviderSetupV2
        open={showProviderSetup}
        onClose={() => setShowProviderSetup(false)}
        onSave={handleSaveProvider}
        initialConfig={providerConfig ?? undefined}
        onClear={handleClearProvider}
        isInitialSetup={!providerConfig && !session}
      />
    </>
  );
}

// ── Active Session Layout ────────────────────────────────────────────

function ActiveSessionV2({ onBack, onUpload, onOpenSettings }: { onBack: () => void; onUpload: () => void; onOpenSettings: () => void }) {
  const session = useChatSession();
  const state = useChatState();
  const [mobileView, setMobileView] = useState<'chat' | 'preview'>('chat');
  const [showSidebar, setShowSidebar] = useState(false);

  const handleExport = useCallback(() => exportProjectZip(session.exportBundle()), [session]);

  const handleOpenInStudio = useCallback(() => {
    const bundle = session.exportBundle();
    const handoffId = Math.random().toString(36).substring(2, 11);
    const storageKey = `formspec-handoff:${handoffId}`;
    try {
      localStorage.setItem(storageKey, JSON.stringify(bundle));
      window.location.href = `/studio/?h=${handoffId}`;
    } catch (err) {
      console.error('Handoff failed', err);
      alert('Failed to prepare project for Studio. The definition may be too large for local storage.');
    }
  }, [session]);

  const hasPreview = state.hasDefinition || state.scaffoldingText != null;

  return (
    <div className="v2-session flex flex-col h-screen">
      {/* Header */}
      <header className="v2-session-header flex items-center justify-between px-4 sm:px-5 py-2.5 shrink-0">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} className="v2-icon-btn flex items-center gap-1.5 text-xs font-medium px-2 py-1.5 rounded-lg transition-all duration-150" aria-label="Back to start" title="Back to start">
            <IconChevronLeft />
            <span className="hidden sm:inline">New</span>
          </button>
          <div className="v2-header-divider w-px h-4" />
          <span className="v2-wordmark text-[10px] font-semibold tracking-[0.2em] uppercase select-none">formspec</span>
          {state.openIssueCount > 0 && (
            <button
              type="button"
              onClick={() => setShowSidebar(!showSidebar)}
              data-testid="issue-count"
              className="v2-issue-badge inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-full cursor-pointer"
              aria-label={"Issues: " + state.openIssueCount}
            >
              <IconWarning />
              {state.openIssueCount}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {hasPreview && (
            <>
              {/* Mobile view toggle */}
              <div className="flex lg:hidden v2-tab-group items-center rounded-lg p-0.5">
                <button
                  onClick={() => setMobileView('chat')}
                  aria-pressed={mobileView === 'chat'}
                  data-testid="mobile-chat-btn"
                  className={`v2-tab px-3 py-1 text-xs font-medium rounded-md transition-all duration-150 ${mobileView === 'chat' ? 'v2-tab-active' : ''}`}
                >Chat</button>
                <button
                  onClick={() => setMobileView('preview')}
                  aria-pressed={mobileView === 'preview'}
                  data-testid="mobile-preview-btn"
                  className={`v2-tab px-3 py-1 text-xs font-medium rounded-md transition-all duration-150 ${mobileView === 'preview' ? 'v2-tab-active' : ''}`}
                >Preview</button>
              </div>

              <button type="button" onClick={handleOpenInStudio} className="v2-header-action flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg font-medium transition-all duration-150" aria-label="Open in Studio" title="Open in Studio">
                <IconExternal />
                <span className="hidden sm:inline">Studio</span>
              </button>

              <button type="button" onClick={handleExport} className="v2-header-action flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg font-medium transition-all duration-150" aria-label="Export" title="Export">
                <IconDownload />
                <span className="hidden sm:inline">Export</span>
              </button>
            </>
          )}
          <button type="button" onClick={onOpenSettings} className="v2-icon-btn p-2 rounded-lg transition-all duration-150" aria-label="Settings">
            <IconSettings />
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar — issues/debug */}
        {showSidebar && (
          <div className="v2-sidebar hidden lg:flex flex-col w-[280px] shrink-0">
            <div className="v2-sidebar-header flex items-center justify-between px-3 py-2 shrink-0">
              <span className="v2-section-label text-[11px] font-semibold tracking-[0.15em] uppercase">
                Issues ({state.openIssueCount})
              </span>
              <button
                type="button"
                onClick={() => setShowSidebar(false)}
                className="v2-icon-btn p-1 rounded-md"
                aria-label="Close sidebar"
              >
                <IconClose />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0 scrollbar-none">
              <IssuePanelV2 />
            </div>
          </div>
        )}

        {/* Chat pane */}
        <div className={[
          'flex flex-col',
          mobileView === 'chat' ? 'flex-1' : 'hidden',
          'lg:flex lg:flex-1 lg:min-w-0',
        ].join(' ')}>
          <ChatPanelV2 onUpload={onUpload} />
        </div>

        {/* Preview pane */}
        {hasPreview && (
          <div className={[
            'flex flex-col v2-preview-pane',
            mobileView === 'preview' ? 'flex-1' : 'hidden',
            'lg:flex lg:w-[45%] lg:max-w-[560px] lg:shrink-0',
          ].join(' ')}>
            <FormPreviewV2 />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Debug Log (kept simple) ──────────────────────────────────────────

export function DebugLogV2({ entries }: { entries: import('@formspec-org/chat').DebugEntry[] }) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-full px-4">
        <p className="text-xs v2-text-tertiary italic">No debug entries yet</p>
      </div>
    );
  }

  return (
    <div className="px-3 py-3 space-y-1.5">
      {entries.map((entry, i) => {
        const time = new Date(entry.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const dirIcon = { sent: '\u2192', received: '\u2190', error: '\u2717' }[entry.direction];
        const dirClass = { sent: 'v2-text-accent', received: 'v2-debug-received', error: 'v2-debug-error' }[entry.direction];
        const expanded = expandedIdx === i;

        let preview: string;
        try {
          const s = JSON.stringify(entry.data);
          preview = s.length > 80 ? s.slice(0, 80) + '\u2026' : s;
        } catch { preview = String(entry.data); }

        return (
          <div key={i} className="v2-debug-entry rounded-xl text-xs">
            <button
              type="button"
              onClick={() => setExpandedIdx(expanded ? null : i)}
              className="w-full flex items-center gap-1.5 px-3 py-2 text-left transition-colors duration-100"
            >
              <span className={`font-mono font-bold ${dirClass}`}>{dirIcon}</span>
              <span className="font-mono v2-text-tertiary">{time}</span>
              <span className="font-medium v2-text-primary truncate">{entry.label}</span>
              <span className="ml-auto v2-text-tertiary text-[10px]">{expanded ? '\u25BC' : '\u25B6'}</span>
            </button>
            {!expanded && (
              <div className="px-3 pb-2 -mt-0.5">
                <span className="font-mono text-[10px] v2-text-tertiary break-all">{preview}</span>
              </div>
            )}
            {expanded && (
              <pre className="v2-debug-pre px-3 pb-3 font-mono text-[10px] overflow-x-auto max-h-[300px] overflow-y-auto whitespace-pre-wrap break-all mt-0.5 pt-2">
                {JSON.stringify(entry.data, null, 2)}
              </pre>
            )}
          </div>
        );
      })}
    </div>
  );
}
