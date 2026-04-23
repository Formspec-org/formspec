/** @filedesc Modern chat message thread with rich input bar, animations, and inline actions — v2. */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useChatSession, useChatState } from '../state/ChatContext.js';
import { IconArrowUp } from '../../components/icons/index.js';
import { ChatMessageListV2 } from './ChatMessageListV2.js';

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
        <ChatMessageListV2
          messages={state.messages}
          sending={sending}
          pendingText={pendingText}
          messagesEndRef={messagesEndRef}
          onEdit={handleEdit}
          onResend={handleResend}
        />
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
