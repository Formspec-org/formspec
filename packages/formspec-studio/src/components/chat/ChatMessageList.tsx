/** @filedesc Message list for the studio chat panel — renders user, assistant, and system messages with typing indicator. */
import type { ChatMessage } from '@formspec/chat';
import { IconSparkle, IconTriangleWarning as IconWarning } from '../icons/index.js';

export interface ChatMessageListProps {
  messages: ChatMessage[];
  sending: boolean;
  hasApiKey: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  emptyDescription?: string;
  /** Tighter strip above changeset review; skips centered empty state when there is nothing to show. */
  variant?: 'default' | 'ribbon';
}

export function ChatMessageList({
  messages,
  sending,
  hasApiKey,
  messagesEndRef,
  emptyDescription,
  variant = 'default',
}: ChatMessageListProps) {
  const ribbon = variant === 'ribbon';
  if (ribbon && messages.length === 0 && !sending) {
    return null;
  }

  return (
    <div
      className={ribbon ? 'px-3 py-2 space-y-0.5' : 'px-4 py-4 space-y-1'}
      data-testid={ribbon ? 'chat-message-list-ribbon' : 'chat-message-list'}
    >
      {!hasApiKey ? (
        <div className={`flex flex-col items-center justify-center gap-4 text-center ${ribbon ? 'min-h-[120px]' : 'min-h-[200px]'}`}>
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
        <div className={`flex flex-col items-center justify-center gap-3 text-center ${ribbon ? 'min-h-0 py-2' : 'min-h-[200px]'}`}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-accent/10 text-accent">
            <IconSparkle />
          </div>
          <p className={`text-muted max-w-[240px] ${ribbon ? 'text-[12px]' : 'text-[13px]'}`}>
            {emptyDescription ?? 'Ask the AI to modify your form — add fields, set validation, change layout.'}
          </p>
        </div>
      ) : null}
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`py-1.5 ${msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}`}
        >
          {msg.role === 'assistant' && (
            <div className={`flex items-start gap-2 ${ribbon ? 'max-w-[95%]' : 'max-w-[90%]'}`}>
              <div className={`flex-shrink-0 rounded-lg flex items-center justify-center bg-accent/10 text-accent mt-0.5 ${ribbon ? 'w-5 h-5' : 'w-6 h-6'}`}>
                <IconSparkle />
              </div>
              <div className={`rounded-xl rounded-tl-sm leading-relaxed bg-subtle text-ink ${ribbon ? 'px-2.5 py-1.5 text-[12px]' : 'px-3 py-2 text-[13px]'}`}>
                <span className="whitespace-pre-wrap">{msg.content}</span>
              </div>
            </div>
          )}
          {msg.role === 'user' && (
            <div className={ribbon ? 'max-w-[95%]' : 'max-w-[85%]'}>
              <div className={`rounded-xl rounded-tr-sm leading-relaxed bg-accent text-white ${ribbon ? 'px-2.5 py-1.5 text-[12px]' : 'px-3 py-2 text-[13px]'}`}>
                <span className="whitespace-pre-wrap">{msg.content}</span>
              </div>
            </div>
          )}
          {msg.role === 'system' && (
            <div className="w-full text-center">
              <span className={`font-mono italic text-muted px-3 ${ribbon ? 'text-[10px]' : 'text-[11px]'}`}>{msg.content}</span>
            </div>
          )}
        </div>
      ))}
      {sending && (
        <div className="flex items-start gap-2 py-1.5">
          <div className={`flex-shrink-0 rounded-lg flex items-center justify-center bg-accent/10 text-accent ${ribbon ? 'w-5 h-5' : 'w-6 h-6'}`}>
            <IconSparkle />
          </div>
          <div className={`rounded-xl rounded-tl-sm bg-subtle ${ribbon ? 'px-2.5 py-2' : 'px-3 py-2.5'}`}>
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
