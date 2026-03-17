/** @filedesc Persists and retrieves chat sessions via a pluggable StorageBackend. */
import type { StorageBackend, ChatSessionState, SessionSummary } from './types.js';

const KEY_PREFIX = 'formspec-chat:session:';
const INDEX_KEY = 'formspec-chat:session-index';

/**
 * Persists chat sessions to a StorageBackend (localStorage in browser,
 * in-memory Map in tests). Each session is stored as a separate key;
 * a separate index key tracks all session IDs for listing.
 */
export class SessionStore {
  private storage: StorageBackend;

  constructor(storage: StorageBackend) {
    this.storage = storage;
  }

  save(session: ChatSessionState): void {
    this.storage.setItem(
      KEY_PREFIX + session.id,
      JSON.stringify(session),
    );
    // Update index
    const ids = this.getIndex();
    if (!ids.includes(session.id)) ids.push(session.id);
    this.storage.setItem(INDEX_KEY, JSON.stringify(ids));
  }

  load(id: string): ChatSessionState | null {
    const raw = this.storage.getItem(KEY_PREFIX + id);
    if (!raw) return null;
    return JSON.parse(raw);
  }

  delete(id: string): void {
    this.storage.removeItem(KEY_PREFIX + id);
    const ids = this.getIndex().filter(i => i !== id);
    this.storage.setItem(INDEX_KEY, JSON.stringify(ids));
  }

  list(): SessionSummary[] {
    const ids = this.getIndex();
    const summaries: SessionSummary[] = [];

    for (const id of ids) {
      const session = this.load(id);
      if (!session) continue;
      summaries.push(toSummary(session));
    }

    // Most recent first
    summaries.sort((a, b) => b.updatedAt - a.updatedAt);
    return summaries;
  }

  private getIndex(): string[] {
    const raw = this.storage.getItem(INDEX_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  }
}

function toSummary(session: ChatSessionState): SessionSummary {
  const firstUserMsg = session.messages.find(m => m.role === 'user');
  let preview = firstUserMsg?.content ?? '';
  if (preview.length > 100) preview = preview.slice(0, 100) + '...';

  return {
    id: session.id,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    messageCount: session.messages.length,
    templateId: session.templateId,
    preview,
  };
}
