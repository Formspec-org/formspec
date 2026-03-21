/** @filedesc Top-level v2 chat shell — manages sessions, file uploads, panel layout with modern design. */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import { ChatSession, GeminiAdapter, MockAdapter, SessionStore, validateProviderConfig, extractRegistryHints } from 'formspec-chat';
import type { AIAdapter, Attachment, ProviderConfig, StorageBackend } from 'formspec-chat';
import commonRegistry from '../../../../../registries/formspec-common.registry.json';
import { ChatProvider, useChatState, useChatSession } from '../state/ChatContext.js';
import { EntryScreenV2 } from './EntryScreenV2.js';
import { ChatPanelV2 } from './ChatPanelV2.js';
import { FormPreviewV2 } from './FormPreviewV2.js';
import { IssuePanelV2 } from './IssuePanelV2.js';
import { ProviderSetupV2 } from './ProviderSetupV2.js';

const PROVIDER_STORAGE_KEY = 'formspec-chat:provider';
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
    const raw = storage.getItem(PROVIDER_STORAGE_KEY);
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
    storage?.setItem(PROVIDER_STORAGE_KEY, JSON.stringify(config));
    setShowProviderSetup(false);
  }, [storage]);

  const handleClearProvider = useCallback(() => {
    setProviderConfig(null);
    storage?.removeItem(PROVIDER_STORAGE_KEY);
    setShowProviderSetup(false);
  }, [storage]);

  const handleStartBlank = useCallback(() => {
    setSession(new ChatSession({ adapter: getAdapter(providerConfig) }));
  }, [providerConfig]);

  const handleSelectTemplate = useCallback(async (templateId: string) => {
    const s = new ChatSession({ adapter: getAdapter(providerConfig) });
    await s.startFromTemplate(templateId);
    setSession(s);
  }, [providerConfig]);

  const handleUpload = useCallback(() => { fileInputRef.current?.click(); }, []);

  const handleFilesSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const s = new ChatSession({ adapter: getAdapter(providerConfig) });
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
    const restored = await ChatSession.fromState(state, getAdapter(providerConfig));
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

  const handleExport = useCallback(async () => {
    const bundle = session.exportBundle();
    const { definition } = bundle;
    const baseName = definition.title?.trim()
      ? definition.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      : 'formspec-project';

    const zip = new JSZip();
    zip.file('definition.json', JSON.stringify(bundle.definition, null, 2));
    zip.file('component.json', JSON.stringify(bundle.component, null, 2));
    zip.file('theme.json', JSON.stringify(bundle.theme, null, 2));
    if (bundle.mappings && Object.keys(bundle.mappings).length > 0) {
      const mappingsFolder = zip.folder('mappings');
      if (mappingsFolder) {
        for (const [key, mapping] of Object.entries(bundle.mappings)) {
          mappingsFolder.file(`${key}.json`, JSON.stringify(mapping, null, 2));
        }
      }
    }

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${baseName}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  }, [session]);

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
          <button onClick={onBack} className="v2-icon-btn flex items-center gap-1.5 text-xs font-medium px-2 py-1.5 rounded-lg transition-all duration-150" title="Back to start">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 3L5 7l4 4" /></svg>
            <span className="hidden sm:inline">New</span>
          </button>
          <div className="v2-header-divider w-px h-4" />
          <span className="v2-wordmark text-[10px] font-semibold tracking-[0.2em] uppercase select-none">formspec</span>
          {state.openIssueCount > 0 && (
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              data-testid="issue-count"
              className="v2-issue-badge inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-full cursor-pointer"
            >
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5.5 1.5L10 9.5H1L5.5 1.5z" /><line x1="5.5" y1="4.5" x2="5.5" y2="6.5" /><circle cx="5.5" cy="8" r="0.4" fill="currentColor" stroke="none" />
              </svg>
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

              <button onClick={handleOpenInStudio} className="v2-header-action flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg font-medium transition-all duration-150" title="Open in Studio">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 2.5h2v2M7 6l4-4M5 2H3a1 1 0 00-1 1v7a1 1 0 001 1h7a1 1 0 001-1V8" />
                </svg>
                <span className="hidden sm:inline">Studio</span>
              </button>

              <button onClick={handleExport} className="v2-header-action flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg font-medium transition-all duration-150" title="Export">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6.5 2v6.5M4 6L6.5 8.5 9 6" /><path d="M2 9.5v1.5a1 1 0 001 1h7a1 1 0 001-1V9.5" />
                </svg>
                <span className="hidden sm:inline">Export</span>
              </button>
            </>
          )}
          <button onClick={onOpenSettings} className="v2-icon-btn p-2 rounded-lg transition-all duration-150" aria-label="Settings">
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="7.5" cy="7.5" r="2" /><path d="M12.5 7.5a5 5 0 01-.3 1.6l1.2.9-1.3 2.2-1.4-.6a5 5 0 01-1.3.8l-.3 1.5H6.9l-.3-1.5a5 5 0 01-1.3-.8l-1.4.6L2.6 10l1.2-.9a5 5 0 01-.3-1.6 5 5 0 01.3-1.6l-1.2-.9L3.9 3l1.4.6a5 5 0 011.3-.8L6.9 1.3h2.2l.3 1.5a5 5 0 011.3.8l1.4-.6 1.3 2.2-1.2.9a5 5 0 01.3 1.6z" />
            </svg>
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
                onClick={() => setShowSidebar(false)}
                className="v2-icon-btn p-1 rounded-md"
                aria-label="Close sidebar"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                  <path d="M9 3L3 9M3 3l6 6" />
                </svg>
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

export function DebugLogV2({ entries }: { entries: import('formspec-chat').DebugEntry[] }) {
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
