/** @filedesc Chat message thread with input box, send button, and file attachment support. */
import React, { useState, useRef, useEffect } from 'react';
import { useChatSession, useChatState } from '../state/ChatContext.js';

function IconSend() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 8H3M9 3l5 5-5 5" />
    </svg>
  );
}

function IconEdit() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 11.5v-2l6-6 2 2-6 6h-2z" />
      <path d="M7.5 4.5l2 2" />
    </svg>
  );
}

function IconRefresh() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1.5 7a5.5 5.5 0 0110-3l1 1" />
      <path d="M12.5 1.5v3.5h-3.5" />
      <path d="M12.5 7a5.5 5.5 0 01-10 3l-1-1" />
      <path d="M1.5 12.5v-3.5h3.5" />
    </svg>
  );
}

function IconSparkles() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 1.5L8.2 4.8 11.5 6 8.2 7.2 7 10.5 5.8 7.2 2.5 6 5.8 4.8 7 1.5z" />
      <path d="M11 9.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6.6-1.4z" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11.5 4.5L5.5 10.5 2.5 7.5" />
    </svg>
  );
}

function IconX() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.5 3.5l-7 7M3.5 3.5l7 7" />
    </svg>
  );
}

function IconPaperclip() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13.5 7.5l-5.8 5.8a3 3 0 01-4.2-4.2l5.8-5.8a2 2 0 012.8 2.8L6.3 11.9a1 1 0 01-1.4-1.4L10.5 5" />
    </svg>
  );
}

interface ChatPanelProps {
  onUpload?: () => void;
}

export function ChatPanel({ onUpload }: ChatPanelProps) {
  const session = useChatSession();
  const state = useChatState();
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const [pendingText, setPendingText] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.messages.length]);

  // Auto-resize textarea
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [inputValue]);

  const handleSend = async () => {
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
  };

  const handleResend = async (msgId: string) => {
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
  };

  const handleEdit = async (msgId: string, newContent: string) => {
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
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleScaffold = async () => {
    if (sending) return;
    setSending(true);
    try {
      await session.scaffold();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        {state.messages.length === 0 && !pendingText ? (
          <EmptyState />
        ) : (
          <div className="px-4 sm:px-6 lg:px-8 py-5 space-y-4 max-w-[720px] mx-auto w-full">
            {pendingText && state.messages.length === 0 && (
              <MessageBubble id="pending" role="user" content={pendingText} isLast={false} />
            )}
            {state.messages.map((msg, i) => (
              <MessageBubble
                key={msg.id}
                id={msg.id}
                role={msg.role}
                content={msg.content}
                isLast={i === state.messages.length - 1}
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
      <div className="border-t border-border bg-surface px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="max-w-[720px] mx-auto w-full space-y-3">
          {state.readyToScaffold && !state.hasDefinition && !sending && (
            <div className="flex justify-center msg-appear">
              <button
                onClick={handleScaffold}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-accent text-white text-sm font-medium hover:bg-accent/90 shadow-lg shadow-accent/20 active:scale-95 transition-all"
              >
                <IconSparkles />
                Generate Form
              </button>
            </div>
          )}

          <div className="flex items-end gap-2 rounded-lg border border-border bg-bg-default px-3 py-2.5 focus-within:border-accent/60 focus-within:ring-1 focus-within:ring-accent/20 transition-all">
            {onUpload && (
              <button
                onClick={onUpload}
                disabled={sending}
                aria-label="Attach files"
                title="Attach files (PDF, image, CSV, JSON)"
                className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-md text-muted/60 hover:text-muted hover:bg-subtle transition-all duration-150 disabled:opacity-50"
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
              placeholder="Describe what you need..."
              className="flex-1 resize-none bg-transparent text-sm text-ink placeholder:text-muted/60 outline-none disabled:opacity-50 leading-relaxed min-h-[24px]"
            />
            <button
              onClick={handleSend}
              disabled={sending || !inputValue.trim()}
              aria-label="Send message"
              className={[
                'flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-md transition-all duration-150',
                inputValue.trim() && !sending
                  ? 'bg-accent text-white hover:bg-accent/90 active:scale-95'
                  : 'bg-subtle text-muted/50 cursor-not-allowed',
              ].join(' ')}
            >
              <IconSend />
            </button>
          </div>
          <p className="text-[10px] text-muted/50 mt-1.5 ml-0.5">
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[320px] px-6 gap-4">
      <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent" aria-hidden="true">
          <path d="M3 9h12M9 4l6 5-6 5" />
        </svg>
      </div>
      <div className="text-center space-y-1 max-w-[280px]">
        <p className="text-sm font-medium text-ink">Ready when you are</p>
        <p className="text-xs text-muted leading-relaxed">
          Describe the form you need — fields, structure, validations.
          Be as specific or as vague as you like.
        </p>
      </div>
    </div>
  );
}

// ── Typing Indicator ────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-start gap-3 mr-16">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-accent">
          <path d="M6.5 1L7.5 5H11.5L8.5 7.5L9.5 11.5L6.5 9L3.5 11.5L4.5 7.5L1.5 5H5.5L6.5 1Z" stroke="currentColor" strokeWidth="1" fill="currentColor" fillOpacity="0.2" />
        </svg>
      </div>
      <div className="rounded-2xl rounded-tl-sm px-4 py-3 bg-surface border border-border">
        <div className="flex items-center gap-1 h-4">
          <span className="typing-dot w-1.5 h-1.5 rounded-full bg-muted/50" style={{ animationDelay: '0ms' }} />
          <span className="typing-dot w-1.5 h-1.5 rounded-full bg-muted/50" style={{ animationDelay: '150ms' }} />
          <span className="typing-dot w-1.5 h-1.5 rounded-full bg-muted/50" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

// ── MessageBubble ─────────────────────────────────────────────────────

function MessageBubble({
  id,
  role,
  content,
  isLast,
  onEdit,
  onResend,
  disabled,
}: {
  id: string;
  role: string;
  content: string;
  isLast: boolean;
  onEdit?: (id: string, newContent: string) => void;
  onResend?: (id: string) => void;
  disabled?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(content);
  const editInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing) {
      editInputRef.current?.focus();
      // Move cursor to end
      editInputRef.current?.setSelectionRange(content.length, content.length);
    }
  }, [isEditing]);

  if (role === 'system') {
    return (
      <div className="flex items-center gap-3 py-1">
        <div className="flex-1 h-px bg-border" />
        <span className="text-[11px] text-muted/60 font-mono italic px-2">{content}</span>
        <div className="flex-1 h-px bg-border" />
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

  return (
    <div
      className={[
        'flex items-start gap-3 group',
        !isUser && 'msg-appear',
        isUser ? 'flex-row-reverse' : 'flex-row',
      ].filter(Boolean).join(' ')}
    >
      {/* Avatar */}
      {!isUser && (
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center mt-0.5">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-accent">
            <path d="M6.5 1L7.5 5H11.5L8.5 7.5L9.5 11.5L6.5 9L3.5 11.5L4.5 7.5L1.5 5H5.5L6.5 1Z" stroke="currentColor" strokeWidth="1" fill="currentColor" fillOpacity="0.2" />
          </svg>
        </div>
      )}

      {/* Bubble */}
      <div className={['flex flex-col gap-1', isUser ? 'items-end' : 'items-start'].join(' ')}>
        <div
          className={[
            'max-w-[100%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed relative',
            isUser
              ? 'bg-accent text-white rounded-tr-sm'
              : 'bg-surface border border-border text-ink rounded-tl-sm',
          ].join(' ')}
        >
          {isEditing ? (
            <div className="flex flex-col gap-2 min-w-[240px]">
              <textarea
                ref={editInputRef}
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSaveEdit();
                  } else if (e.key === 'Escape') {
                    handleCancelEdit();
                  }
                }}
                className="w-full bg-white/10 text-white border-none focus:ring-1 focus:ring-white/50 rounded p-1 text-sm resize-none outline-none min-h-[60px]"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={handleCancelEdit}
                  className="p-1 hover:bg-white/20 rounded transition-colors text-white/80"
                  title="Cancel"
                >
                  <IconX />
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={!editValue.trim() || editValue === content}
                  className="p-1 hover:bg-white/20 rounded transition-colors text-white disabled:opacity-50"
                  title="Save and resend"
                >
                  <IconCheck />
                </button>
              </div>
            </div>
          ) : (
            content
          )}
        </div>

        {/* Action buttons (only for user messages, non-pending) */}
        {isUser && !isEditing && id !== 'pending' && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pr-1">
            <button
              onClick={() => setIsEditing(true)}
              disabled={disabled}
              className="p-1 text-muted/60 hover:text-muted hover:bg-subtle rounded transition-all disabled:opacity-50"
              title="Edit message"
            >
              <IconEdit />
            </button>
            <button
              onClick={() => onResend?.(id)}
              disabled={disabled}
              className="p-1 text-muted/60 hover:text-muted hover:bg-subtle rounded transition-all disabled:opacity-50"
              title="Retry from here"
            >
              <IconRefresh />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
