import { type ReactNode, useCallback, useEffect, useRef } from 'react';
import {
  AssistantRuntimeProvider,
  ThreadPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  MessagePartPrimitive,
  useExternalStoreRuntime,
  type AppendMessage,
  type ExternalStoreMessageConverter,
} from '@assistant-ui/react';
import type { InquestMessage } from '../shared/contracts/inquest';

/* ── Avatars ──────────────────────────────────── */

function UserAvatar() {
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    </div>
  );
}

function AssistantAvatar() {
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
      <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
        <rect x="2" y="1.5" width="8" height="2" rx=".4" fill="currentColor" />
        <rect x="2" y="5" width="8" height="2" rx=".4" fill="currentColor" fillOpacity=".7" />
        <rect x="2" y="8.5" width="8" height="2" rx=".4" fill="currentColor" fillOpacity=".4" />
      </svg>
    </div>
  );
}

/* ── Typing indicator ─────────────────────────── */

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <AssistantAvatar />
      <div className="flex items-center gap-[5px] rounded-2xl rounded-tl-sm border border-slate-100 bg-white px-4 py-3 shadow-sm">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-[5px] w-[5px] rounded-full bg-slate-300 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s`, animationDuration: '1s' }}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Inline text renderer: basic markdown-lite ── */

function InlineText({ text }: { text: string }) {
  // Split on **bold**, *italic*, and `code` for lightweight rendering
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('*') && part.endsWith('*')) {
          return <em key={i}>{part.slice(1, -1)}</em>;
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code key={i} className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[13px] text-slate-700">
              {part.slice(1, -1)}
            </code>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function AssistantText({ text }: { text: string }) {
  // Split by newlines to preserve paragraph structure
  const paragraphs = text.split(/\n{2,}/);
  return (
    <div className="space-y-2">
      {paragraphs.map((para, i) => {
        const lines = para.split('\n');
        return (
          <p key={i} className="leading-relaxed">
            {lines.map((line, j) => (
              <span key={j}>
                {j > 0 && <br />}
                <InlineText text={line} />
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

/* ── Message components ───────────────────────── */

function UserMessage() {
  return (
    <MessagePrimitive.Root className="flex justify-end animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex max-w-[78%] items-end gap-2">
        <div className="rounded-2xl rounded-tr-sm bg-accent px-4 py-3 text-[14px] leading-relaxed text-white shadow-sm">
          <MessagePrimitive.Content
            components={{
              Text: () => (
                <MessagePartPrimitive.Text className="whitespace-pre-wrap" />
              ),
            }}
          />
        </div>
        <UserAvatar />
      </div>
    </MessagePrimitive.Root>
  );
}

function AssistantTextPart({ text }: { text: string; type?: string }) {
  return <AssistantText text={text} />;
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex max-w-[82%] items-end gap-2">
        <AssistantAvatar />
        <div className="rounded-2xl rounded-tl-sm border border-slate-100 bg-white px-4 py-3 text-[14px] text-slate-800 shadow-sm">
          <MessagePrimitive.Content
            components={{ Text: AssistantTextPart }}
          />
        </div>
      </div>
    </MessagePrimitive.Root>
  );
}

const messageComponents = { UserMessage, AssistantMessage };

/* ── Stable message converter ─────────────────── */

function useStableConverter(): ExternalStoreMessageConverter<InquestMessage> {
  return useCallback((msg: InquestMessage) => ({
    role: msg.role as 'user' | 'assistant',
    content: msg.text,
    id: msg.id,
    createdAt: new Date(msg.createdAt),
  }), []);
}

/* ── Scroll anchor ─────────────────────────────── */

function ScrollAnchor({ trigger }: { trigger: unknown }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [trigger]);
  return <div ref={ref} />;
}

/* ── Thread ───────────────────────────────────── */

interface InquestThreadProps {
  messages: InquestMessage[];
  isRunning?: boolean;
  disabled?: boolean;
  onNew?: (text: string) => Promise<void>;
  afterMessages?: ReactNode;
  belowComposer?: ReactNode;
}

export function InquestThread({
  messages,
  isRunning,
  disabled,
  onNew,
  afterMessages,
  belowComposer,
}: InquestThreadProps) {
  const convertMessage = useStableConverter();

  const handleNew = useCallback(async (message: AppendMessage) => {
    const text = message.content
      .filter((p) => p.type === 'text')
      .map((p) => (p as { type: 'text'; text: string }).text)
      .join('');
    if (!text.trim() || !onNew) return;
    await onNew(text);
  }, [onNew]);

  const runtime = useExternalStoreRuntime({
    messages,
    isRunning: isRunning ?? false,
    isDisabled: disabled || isRunning,
    convertMessage,
    onNew: handleNew,
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadPrimitive.Root className="relative flex flex-1 flex-col overflow-hidden">
        <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto scroll-smooth">
          <div className="mx-auto w-full max-w-3xl space-y-5 px-8 py-8">
            <ThreadPrimitive.Messages components={messageComponents} />
            <ThreadPrimitive.If running>
              <TypingIndicator />
            </ThreadPrimitive.If>
            {afterMessages}
            {/* Scroll anchor: scrolls into view whenever messages length or isRunning changes */}
            <ScrollAnchor trigger={`${messages.length}:${String(isRunning)}`} />
          </div>
        </ThreadPrimitive.Viewport>

        <div className="shrink-0 border-t border-slate-100 bg-white/96 backdrop-blur-sm px-6 pb-6 pt-4">
          <div className="mx-auto max-w-3xl">
            <ComposerPrimitive.Root className="relative flex items-end">
              <ComposerPrimitive.Input
                className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3.5 pr-14 text-[14px] leading-relaxed outline-none transition-all focus:border-accent/50 focus:bg-white focus:ring-4 focus:ring-accent/8 disabled:cursor-not-allowed disabled:opacity-50 placeholder:text-slate-400"
                placeholder="Describe what you're building…"
                submitMode="enter"
                rows={2}
              />
              <ComposerPrimitive.Send className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white shadow-md transition-all hover:scale-105 hover:bg-slate-800 active:scale-95 disabled:scale-100 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </ComposerPrimitive.Send>
            </ComposerPrimitive.Root>
            {belowComposer}
          </div>
        </div>
      </ThreadPrimitive.Root>
    </AssistantRuntimeProvider>
  );
}
