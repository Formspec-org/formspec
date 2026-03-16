import React, { useState, useRef, useEffect } from 'react';
import { useChatSession, useChatState } from '../state/ChatContext.js';

function IconSend() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 8H3M9 3l5 5-5 5" />
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
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
              <MessageBubble role="user" content={pendingText} isLast={false} />
            )}
            {state.messages.map((msg, i) => (
              <MessageBubble
                key={msg.id}
                role={msg.role}
                content={msg.content}
                isLast={i === state.messages.length - 1}
              />
            ))}
            {sending && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="border-t border-border bg-surface px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="max-w-[720px] mx-auto w-full">
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
  role,
  content,
  isLast,
}: {
  role: string;
  content: string;
  isLast: boolean;
}) {
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

  return (
    <div
      className={[
        'flex items-start gap-3 msg-appear',
        isUser ? 'flex-row-reverse' : 'flex-row',
      ].join(' ')}
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
      <div
        className={[
          'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
          isUser
            ? 'bg-accent text-white rounded-tr-sm'
            : 'bg-surface border border-border text-ink rounded-tl-sm',
        ].join(' ')}
      >
        {content}
      </div>
    </div>
  );
}
