/** @filedesc Modern chat message thread with rich input bar, animations, and inline actions — v2. */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useChatSession, useChatState } from '../state/ChatContext.js';
import { IconArrowUp } from '../../components/icons/index.js';

// ── Icons ────────────────────────────────────────────────────────────
// IconSparkle here has a richer two-path design for chat-v2 surfaces — it is
// intentionally distinct from the shared icon in ../../components/icons and
// stays local. IconArrowUp is shared.

function IconPaperclip() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15.2 8.5l-6.6 6.6a3.4 3.4 0 01-4.8-4.8l6.6-6.6a2.3 2.3 0 013.2 3.2L7.3 13.1a1.1 1.1 0 01-1.6-1.6l5.7-5.7" />
    </svg>
  );
}

function IconSparkle() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 1l1.5 4.5L14 7l-4.5 1.5L8 13l-1.5-4.5L2 7l4.5-1.5L8 1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="currentColor" fillOpacity="0.15" />
      <path d="M12.5 10.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" fill="currentColor" fillOpacity="0.15" />
    </svg>
  );
}

function IconPencil() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 11l-.5.5h2l5.5-5.5-1.5-1.5L2 10v1z" />
      <path d="M7.5 4.5l1.5 1.5" />
      <path d="M9 3l1.5-1.5 1.5 1.5L10.5 4.5" />
    </svg>
  );
}

function IconRotate() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1.5 6.5a5 5 0 019-2.5l.5.5" />
      <path d="M11 1v3H8" />
      <path d="M11.5 6.5a5 5 0 01-9 2.5l-.5-.5" />
      <path d="M2 12V9h3" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.5 3.5L5 9.5 2.5 7" />
    </svg>
  );
}

function IconX() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 3L3 10M3 3l7 7" />
    </svg>
  );
}

// ── ChatPanel ────────────────────────────────────────────────────────

interface ChatPanelProps {
  onUpload?: () => void;
}

export function ChatPanelV2({ onUpload }: ChatPanelProps) {
  const session = useChatSession();
  const state = useChatState();
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const [pendingText, setPendingText] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.messages.length, sending]);

  // Auto-resize textarea
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [inputValue]);

  const handleSend = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || sending) return;
    setSending(true);
    setInputValue('');
    setPendingText(text);
    try {
      await session.sendMessage(text);
    } finally {
      setSending(false);
      setPendingText(null);
      inputRef.current?.focus();
    }
  }, [inputValue, sending, session]);

  const handleResend = useCallback(async (msgId: string) => {
    if (sending) return;
    const msg = state.messages.find(m => m.id === msgId);
    if (!msg) return;
    setSending(true);
    setPendingText(msg.content);
    try {
      session.truncate(msgId, true);
      await session.sendMessage(msg.content);
    } finally {
      setSending(false);
      setPendingText(null);
    }
  }, [sending, state.messages, session]);

  const handleEdit = useCallback(async (msgId: string, newContent: string) => {
    if (sending || !newContent.trim()) return;
    setSending(true);
    setPendingText(newContent);
    try {
      session.truncate(msgId, true);
      await session.sendMessage(newContent);
    } finally {
      setSending(false);
      setPendingText(null);
    }
  }, [sending, session]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleScaffold = useCallback(async () => {
    if (sending) return;
    setSending(true);
    try {
      await session.scaffold();
    } finally {
      setSending(false);
    }
  }, [sending, session]);

  const showEmptyState = state.messages.length === 0 && !pendingText;

  return (
    <div className="v2-chat-panel flex flex-col h-full">
      {/* Messages area */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto scrollbar-none">
        {showEmptyState ? (
          <EmptyState />
        ) : (
          <div className="px-4 sm:px-6 lg:px-10 py-6 space-y-1 max-w-[760px] mx-auto w-full">
            {pendingText && state.messages.length === 0 && (
              <MessageBubble id="pending" role="user" content={pendingText} />
            )}
            {state.messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                id={msg.id}
                role={msg.role}
                content={msg.content}
                onResend={handleResend}
                onEdit={handleEdit}
                disabled={sending}
              />
            ))}
            {sending && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="v2-input-area px-4 sm:px-6 lg:px-10 pb-4 pt-2">
        <div className="max-w-[760px] mx-auto w-full space-y-3">
          {/* Generate Form CTA */}
          {state.readyToScaffold && !state.hasDefinition && !sending && (
            <div className="flex justify-center v2-fade-up">
              <button
                onClick={handleScaffold}
                className="v2-generate-btn flex items-center gap-2.5 px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 active:scale-[0.97]"
              >
                <IconSparkle />
                Generate Form
              </button>
            </div>
          )}

          {/* Input container */}
          <div className="v2-input-box relative">
            <div className="flex items-end gap-1 px-2 py-2">
              {onUpload && (
                <button
                  onClick={onUpload}
                  disabled={sending}
                  aria-label="Attach files"
                  title="Attach files (PDF, image, CSV, JSON)"
                  className="v2-icon-btn flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-150 disabled:opacity-40"
                >
                  <IconPaperclip />
                </button>
              )}
              <textarea
                ref={inputRef}
                rows={1}
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={sending}
                placeholder="Describe the form you need..."
                className="flex-1 resize-none bg-transparent text-sm leading-relaxed outline-none disabled:opacity-40 min-h-[36px] py-2 px-2 v2-input-text"
              />
              <button
                onClick={handleSend}
                disabled={sending || !inputValue.trim()}
                aria-label="Send message"
                className={[
                  'flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200',
                  inputValue.trim() && !sending
                    ? 'v2-send-btn-active'
                    : 'v2-send-btn-disabled',
                ].join(' ')}
              >
                <IconArrowUp />
              </button>
            </div>
          </div>

          <p className="v2-hint-text text-center text-[11px] select-none">
            Enter to send &middot; Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Empty State ──────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] px-6 gap-5 v2-fade-up">
      <div className="v2-empty-icon w-14 h-14 rounded-2xl flex items-center justify-center">
        <IconSparkle />
      </div>
      <div className="text-center space-y-2 max-w-[320px]">
        <h3 className="text-base font-semibold v2-text-primary">What would you like to build?</h3>
        <p className="text-sm v2-text-secondary leading-relaxed">
          Describe the form you need &mdash; fields, structure, validations.
          I'll turn your description into a working form.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2 mt-2">
        {['Patient intake form', 'Job application', 'Event registration'].map((suggestion) => (
          <span
            key={suggestion}
            className="v2-suggestion-chip px-3 py-1.5 rounded-full text-xs font-medium cursor-default select-none"
          >
            {suggestion}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Typing Indicator ─────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-start gap-3 py-3 v2-fade-up">
      <div className="v2-ai-avatar flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center">
        <IconSparkle />
      </div>
      <div className="v2-assistant-bubble rounded-2xl rounded-tl-md px-4 py-3 mt-0.5">
        <div className="flex items-center gap-1.5 h-5">
          <span className="v2-typing-dot" style={{ animationDelay: '0ms' }} />
          <span className="v2-typing-dot" style={{ animationDelay: '150ms' }} />
          <span className="v2-typing-dot" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

// ── Message Bubble ───────────────────────────────────────────────────

function MessageBubble({
  id,
  role,
  content,
  onEdit,
  onResend,
  disabled,
}: {
  id: string;
  role: string;
  content: string;
  onEdit?: (id: string, newContent: string) => void;
  onResend?: (id: string) => void;
  disabled?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(content);
  const editRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing) {
      editRef.current?.focus();
      editRef.current?.setSelectionRange(content.length, content.length);
    }
  }, [isEditing, content.length]);

  if (role === 'system') {
    return (
      <div className="flex items-center gap-3 py-3 my-2">
        <div className="flex-1 h-px v2-divider" />
        <span className="v2-system-text text-[11px] font-mono italic px-3">{content}</span>
        <div className="flex-1 h-px v2-divider" />
      </div>
    );
  }

  const isUser = role === 'user';

  const handleSaveEdit = () => {
    if (editValue.trim() && editValue !== content) {
      onEdit?.(id, editValue);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditValue(content);
    setIsEditing(false);
  };

  if (isUser) {
    return (
      <div className="flex justify-end py-1.5 group">
        <div className="flex flex-col items-end gap-1 max-w-[85%] sm:max-w-[75%]">
          <div className="v2-user-bubble rounded-2xl rounded-tr-md px-4 py-2.5 text-sm leading-relaxed">
            {isEditing ? (
              <div className="flex flex-col gap-2 min-w-[240px]">
                <textarea
                  ref={editRef}
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit(); }
                    else if (e.key === 'Escape') { handleCancelEdit(); }
                  }}
                  className="w-full bg-white/15 rounded-lg p-2 text-sm resize-none outline-none min-h-[60px] focus:bg-white/20 transition-colors v2-edit-textarea"
                />
                <div className="flex items-center justify-end gap-1.5">
                  <button onClick={handleCancelEdit} className="v2-edit-action p-1.5 rounded-md" title="Cancel">
                    <IconX />
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={!editValue.trim() || editValue === content}
                    className="v2-edit-action p-1.5 rounded-md disabled:opacity-40"
                    title="Save and resend"
                  >
                    <IconCheck />
                  </button>
                </div>
              </div>
            ) : (
              <span className="whitespace-pre-wrap">{content}</span>
            )}
          </div>

          {/* Hover actions */}
          {!isEditing && id !== 'pending' && (
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 mr-1">
              <button
                onClick={() => { setEditValue(content); setIsEditing(true); }}
                disabled={disabled}
                className="v2-msg-action p-1 rounded-md disabled:opacity-40"
                title="Edit message"
              >
                <IconPencil />
              </button>
              <button
                onClick={() => onResend?.(id)}
                disabled={disabled}
                className="v2-msg-action p-1 rounded-md disabled:opacity-40"
                title="Retry from here"
              >
                <IconRotate />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Assistant message
  return (
    <div className="flex items-start gap-3 py-3 v2-msg-appear">
      <div className="v2-ai-avatar flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center mt-0.5">
        <IconSparkle />
      </div>
      <div className="v2-assistant-bubble rounded-2xl rounded-tl-md px-4 py-3 text-sm leading-relaxed max-w-[85%] sm:max-w-[80%]">
        <span className="whitespace-pre-wrap">{content}</span>
      </div>
    </div>
  );
}
