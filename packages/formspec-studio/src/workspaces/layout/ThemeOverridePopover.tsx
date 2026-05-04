/** @filedesc Per-item theme cascade popover — shows provenance and override controls for a clicked field in Theme mode. */
import { useState, useEffect } from 'react';
import {
  getPropertySources,
  getEditableThemeProperties,
  type PropertySource,
  type EditableThemeProperty,
} from '@formspec-org/studio-core';
import { Project } from '@formspec-org/studio-core';
import { DirtyGuardConfirm, useDirtyGuard } from './DirtyGuardConfirm';
import { useOptionalLayoutMode } from './LayoutModeContext';

export interface ThemeOverridePopoverProps {
  open: boolean;
  itemKey: string;
  /** Screen-space position for the popover anchor (from ThemeAuthoringOverlay click). */
  position: { x: number; y: number };
  project: Project;
  onClose: () => void;
  onSetOverride: (itemKey: string, prop: string, value: string) => void;
  onClearOverride: (itemKey: string, prop: string) => void;
}

// ── Cascade source badge ──────────────────────────────────────────────────────

function SourceBadge({ source, detail, prop }: { source: PropertySource['source']; detail?: string; prop: string }) {
  const label = source === 'item-override' ? 'override' : source === 'selector' ? (detail ?? 'selector') : 'default';
  const color =
    source === 'item-override' ? 'bg-accent/10 text-accent border-accent/25' :
    source === 'selector' ? 'bg-subtle text-muted border-border/60' :
    'bg-subtle text-muted border-border/40';
  return (
    <span
      data-testid={`cascade-source-${source}-${prop}`}
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-mono ${color}`}
    >
      {label}
    </span>
  );
}

// ── Per-property override row ─────────────────────────────────────────────────

interface OverrideRowProps {
  propInfo: EditableThemeProperty;
  sources: PropertySource[];
  onCommit: (prop: string, value: string) => void;
  onClear: (prop: string) => void;
  onDirtyChange: (id: string, isDirty: boolean) => void;
}

function OverrideRow({ propInfo, sources, onCommit, onClear, onDirtyChange }: OverrideRowProps) {
  const prop = propInfo.prop;
  const hasOverride = sources.some((s) => s.source === 'item-override');
  const overrideSource = sources.find((s) => s.source === 'item-override');
  const initialValue = typeof overrideSource?.value === 'string' ? overrideSource.value : '';
  const [draft, setDraft] = useState(initialValue);

  useEffect(() => {
    setDraft(initialValue);
  }, [initialValue]);

  const handleChange = (value: string) => {
    setDraft(value);
    onDirtyChange(`override-input-${prop}`, value !== initialValue);
  };

  const handleBlur = () => {
    onDirtyChange(`override-input-${prop}`, false);
    onCommit(prop, draft.trim());
  };

  return (
    <div data-testid={`theme-prop-${prop}`} className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-mono text-muted">{prop}</span>
        <div className="flex flex-wrap gap-1">
          {sources.map((s, i) => (
            <SourceBadge key={i} source={s.source} detail={s.sourceDetail} prop={prop} />
          ))}
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        {propInfo.type === 'enum' && propInfo.options ? (
          <select
            data-testid={`override-select-${prop}`}
            aria-label={prop}
            value={draft}
            onChange={(e) => handleChange(e.currentTarget.value)}
            onBlur={handleBlur}
            className="flex-1 h-6 rounded border border-border bg-surface px-2 text-[12px] font-mono text-ink outline-none focus:border-accent transition-colors"
          >
            <option value="">—</option>
            {propInfo.options.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            data-testid={`override-input-${prop}`}
            aria-label={prop}
            value={draft}
            placeholder={propInfo.type === 'object' ? 'Object…' : 'Override value…'}
            onChange={(e) => handleChange(e.currentTarget.value)}
            onBlur={handleBlur}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur(); }}
            className="flex-1 h-6 rounded border border-border bg-surface px-2 text-[12px] font-mono text-ink outline-none placeholder:text-muted focus:border-accent transition-colors"
          />
        )}
        {hasOverride && (
          <button
            type="button"
            data-testid={`clear-override-${prop}`}
            aria-label={`Clear ${prop} override`}
            onClick={() => onClear(prop)}
            className="h-6 px-2 rounded border border-border text-[10px] text-muted hover:border-error hover:text-error transition-colors focus-outline-none"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ThemeOverridePopover({
  open,
  itemKey,
  position,
  project,
  onClose,
  onSetOverride,
  onClearOverride,
}: ThemeOverridePopoverProps) {
  const { isDirty, markDirty: trackDirty, reset: resetDirty } = useDirtyGuard();
  const [showDirtyGuard, setShowDirtyGuard] = useState(false);
  const layoutMode = useOptionalLayoutMode();

  useEffect(() => {
    if (!open) {
      resetDirty();
      setShowDirtyGuard(false);
    }
  }, [open, resetDirty]);

  useEffect(() => {
    if (!layoutMode) return;
    const popoverId = 'theme-override-popover';
    if (open && isDirty) {
      layoutMode.registerDirtyPopover(popoverId);
    } else {
      layoutMode.clearDirtyPopover(popoverId);
    }
    return () => layoutMode.clearDirtyPopover(popoverId);
  }, [layoutMode, open, isDirty]);

  function requestClose() {
    if (isDirty) {
      setShowDirtyGuard(true);
    } else {
      onClose();
    }
  }

  if (!open) return null;

  const props = getEditableThemeProperties(project, itemKey);
  const item =
    typeof project.itemAt === 'function'
      ? (project.itemAt(itemKey) as { type?: string; dataType?: string } | undefined)
      : undefined;
  const itemType = item?.type ?? 'field';
  const itemDataType = item?.dataType;

  // Calculate clamped position to prevent viewport overflow
  const popoverWidth = 320; // w-80 = 320px
  const popoverHeight = 480; // maxHeight: 480px
  const clampedLeft = Math.min(position.x, (typeof window !== 'undefined' ? window.innerWidth : Infinity) - popoverWidth);
  const clampedTop = Math.min(position.y, (typeof window !== 'undefined' ? window.innerHeight : Infinity) - popoverHeight);

  return (
    <div
      data-testid="theme-override-popover"
      role="dialog"
      aria-label={`Theme overrides for ${itemKey}`}
      tabIndex={-1}
      className="fixed z-50 w-80 rounded border border-border bg-surface shadow-lg flex flex-col overflow-hidden"
      style={{
        left: Math.max(0, clampedLeft),
        top: Math.max(0, clampedTop),
        maxHeight: 'min(480px, calc(100vh - 32px))',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface shrink-0">
        <div>
          <span className="text-[13px] font-semibold text-ink font-ui">Theme Override</span>
          <span className="ml-2 text-[11px] font-mono text-muted">{itemKey}</span>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={requestClose}
          className="text-muted hover:text-ink transition-colors focus-ring"
        >
          ×
        </button>
      </div>

      {/* Property rows */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {props.map((propInfo) => {
          const sources = getPropertySources(project, itemKey, propInfo.prop, itemType, itemDataType);
          return (
            <OverrideRow
              key={propInfo.prop}
              propInfo={propInfo}
              sources={sources}
              onCommit={(p, v) => onSetOverride(itemKey, p, v)}
              onClear={(p) => onClearOverride(itemKey, p)}
              onDirtyChange={trackDirty}
            />
          );
        })}
      </div>

      {/* Dirty guard overlay */}
      {showDirtyGuard && (
        <DirtyGuardConfirm
          onDiscard={() => { setShowDirtyGuard(false); onClose(); }}
          onCancel={() => setShowDirtyGuard(false)}
        />
      )}
    </div>
  );
}
