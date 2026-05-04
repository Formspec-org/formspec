/** @filedesc AskAI context menu — pre-fills chat composer with structured field context. */
import { type ReactElement } from 'react';

export interface AskAIContextMenuProps {
  /** Field path being acted on. */
  fieldPath: string;
  /** Field label for display. */
  fieldLabel?: string;
  /** Field type (field/group). */
  fieldType?: string;
  /** Data type if field. */
  dataType?: string;
  /** Position for the context menu. */
  position: { x: number; y: number };
  /** Called when the user selects an AI action. */
  onAskAI: (prompt: string) => void;
  /** Called when the menu should close. */
  onClose: () => void;
}

interface AskAIAction {
  label: string;
  prompt: (ctx: { path: string; label?: string; type?: string; dataType?: string }) => string;
}

const ACTIONS: AskAIAction[] = [
  {
    label: 'Add validation',
    prompt: (ctx) => `Add validation rules to the "${ctx.label ?? ctx.path}" field.`,
  },
  {
    label: 'Make conditional',
    prompt: (ctx) => `Make "${ctx.label ?? ctx.path}" conditionally visible based on another field's value.`,
  },
  {
    label: 'Add help text',
    prompt: (ctx) => `Add helpful description and hint text to "${ctx.label ?? ctx.path}".`,
  },
  {
    label: 'Change field type',
    prompt: (ctx) => `Change the type of "${ctx.label ?? ctx.path}"${ctx.dataType ? ` (currently ${ctx.dataType})` : ''} to something more appropriate.`,
  },
  {
    label: 'Add related fields',
    prompt: (ctx) => `Add fields related to "${ctx.label ?? ctx.path}" that are commonly collected together.`,
  },
  {
    label: 'Explain this field',
    prompt: (ctx) => `Explain what the "${ctx.label ?? ctx.path}" field does, its validation rules, and any logic connected to it.`,
  },
];

export function AskAIContextMenu({
  fieldPath,
  fieldLabel,
  fieldType,
  dataType,
  position,
  onAskAI,
  onClose,
}: AskAIContextMenuProps): ReactElement {
  const ctx = { path: fieldPath, label: fieldLabel, type: fieldType, dataType };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        onContextMenu={(e) => { e.preventDefault(); onClose(); }}
      />
      {/* Menu */}
      <div
        className="fixed z-50 min-w-[200px] rounded-lg border border-border bg-surface shadow-xl py-1"
        style={{ left: position.x, top: position.y }}
        role="menu"
        aria-label="Ask AI about this field"
        data-testid="ask-ai-context-menu"
      >
        <div className="px-3 py-1.5 border-b border-border/60">
          <div className="text-[11px] font-mono uppercase tracking-[0.16em] text-muted">Ask AI</div>
          <div className="text-[13px] font-medium text-ink truncate max-w-[220px]">
            {fieldLabel ?? fieldPath}
          </div>
        </div>
        {ACTIONS.map((action) => (
          <button
            key={action.label}
            type="button"
            role="menuitem"
            className="w-full text-left px-3 py-2 text-[13px] text-ink hover:bg-accent/5 hover:text-accent transition-colors focus-ring"
            onClick={() => {
              onAskAI(action.prompt(ctx));
              onClose();
            }}
          >
            {action.label}
          </button>
        ))}
        <div className="border-t border-border/60 mt-1 pt-1">
          <button
            type="button"
            role="menuitem"
            className="w-full text-left px-3 py-2 text-[13px] text-muted hover:text-ink hover:bg-subtle transition-colors focus-ring"
            onClick={() => {
              onAskAI(`Help me with the "${fieldLabel ?? fieldPath}" field.`);
              onClose();
            }}
          >
            Ask something else…
          </button>
        </div>
      </div>
    </>
  );
}
