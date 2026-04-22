/** @filedesc Message list for the studio chat panel — renders user, assistant, and system messages with typing indicator. */
import type { ChatMessage } from '@formspec/chat';
import { IconSparkle } from '../icons/index.js';

function IconWarning() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 5v3M7 10h.01" />
      <path d="M6.13 1.87l-4.9 8.5A1 1 0 002.1 12h9.8a1 1 0 00.87-1.5l-4.9-8.5a1 1 0 00-1.74-.13z" />
    </svg>
  );
}

export interface ChatMessageListProps {
  messages: ChatMessage[];
  sending: boolean;
  hasApiKey: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

export function ChatMessageList({ messages, sending, hasApiKey, messagesEndRef }: ChatMessageListProps) {
  return (
    <div className="px-4 py-4 space-y-1">
      {!hasApiKey ? (
        <div className="flex flex-col items-center justify-center min-h-[200px] gap-4 text-center">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber/10 text-amber">
            <IconWarning />
          </div>
          <div className="space-y-1.5 max-w-[260px]">
            <p className="text-[14px] font-semibold text-ink">API key required</p>
            <p className="text-[13px] text-muted leading-relaxed">
              Add your AI provider API key in App Settings to use the assistant.
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('formspec:open-app-settings'))}
            className="px-4 py-2 text-[13px] font-semibold rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors"
          >
            Open App Settings
          </button>
        </div>
      ) : messages.length === 0 && !sending ? (
        <div className="flex flex-col items-center justify-center min-h-[200px] gap-3 text-center">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-accent/10 text-accent">
            <IconSparkle />
          </div>
          <p className="text-[13px] text-muted max-w-[240px]">
            Ask the AI to modify your form — add fields, set validation, change layout.
          </p>
        </div>
      ) : null}
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`py-1.5 ${msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}`}
        >
          {msg.role === 'assistant' && (
            <div className="flex items-start gap-2 max-w-[90%]">
              <div className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center bg-accent/10 text-accent mt-0.5">
                <IconSparkle />
              </div>
              <div className="rounded-xl rounded-tl-sm px-3 py-2 text-[13px] leading-relaxed bg-subtle text-ink">
                <span className="whitespace-pre-wrap">{msg.content}</span>
              </div>
            </div>
          )}
          {msg.role === 'user' && (
            <div className="max-w-[85%]">
              <div className="rounded-xl rounded-tr-sm px-3 py-2 text-[13px] leading-relaxed bg-accent text-white">
                <span className="whitespace-pre-wrap">{msg.content}</span>
              </div>
            </div>
          )}
          {msg.role === 'system' && (
            <div className="w-full text-center">
              <span className="text-[11px] font-mono italic text-muted px-3">{msg.content}</span>
            </div>
          )}
        </div>
      ))}
      {sending && (
        <div className="flex items-start gap-2 py-1.5">
          <div className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center bg-accent/10 text-accent">
            <IconSparkle />
          </div>
          <div className="rounded-xl rounded-tl-sm px-3 py-2.5 bg-subtle">
            <div className="flex items-center gap-1 h-4">
              <span className="w-1.5 h-1.5 rounded-full bg-muted animate-pulse" />
              <span className="w-1.5 h-1.5 rounded-full bg-muted animate-pulse" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-muted animate-pulse" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}
