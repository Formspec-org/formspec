/** @filedesc Bottom status bar showing formspec version, form status, field count, and bind/shape counts with interactive enhancements. */
import { useState } from 'react';
import { countDefinitionFields } from '@formspec-org/studio-core';
import { useDefinition } from '../state/useDefinition';

function plural(n: number, singular: string): string {
  return `${n} ${singular}${n === 1 ? '' : 's'}`;
}

/**
 * Technical status bar shown at the bottom of the shell.
 * Displays version, status, and entity counts with refined visual hierarchy,
 * interactive elements, and enhanced visual polish.
 */
export function StatusBar() {
  const definition = useDefinition();
  const [copied, setCopied] = useState(false);

  const formspecVersion = definition.$formspec ?? '1.0';
  const status = definition.status ?? 'draft';
  const items = definition.items ?? [];
  const fieldCount = countDefinitionFields(items);
  const bindCount = definition.binds?.length ?? 0;
  const shapeCount = definition.shapes?.length ?? 0;
  const varCount = definition.variables?.length ?? 0;

  const presentation = definition.formPresentation ?? {};
  const pageMode = presentation.pageMode;
  const defaultCurrency = presentation.defaultCurrency;
  const density = presentation.density;

  // Status color indicator
  const statusColor = status === 'active' ? 'bg-emerald-500'
    : status === 'retired' ? 'bg-slate-400'
    : 'bg-amber-500';

  const statusBorderColor = status === 'active' ? 'border-emerald-500/30'
    : status === 'retired' ? 'border-slate-400/30'
    : 'border-amber-500/30';

  const statusBgColor = status === 'active' ? 'bg-emerald-500/5'
    : status === 'retired' ? 'bg-slate-400/5'
    : 'bg-amber-500/5';

  const statusGlow = status === 'active' ? 'shadow-[0_0_6px_rgba(16,185,129,0.5)]'
    : status === 'retired' ? 'shadow-[0_0_6px_rgba(100,116,139,0.4)]'
    : 'shadow-[0_0_6px_rgba(217,119,6,0.5)]';

  const statusTextColor = status === 'active' ? 'text-emerald-400'
    : status === 'retired' ? 'text-slate-400'
    : 'text-amber-400';

  // Entity icons for visual density
  const FieldIcon = () => <span className="text-[40px] opacity-70 leading-none flex items-center justify-center -translate-y-0.5">▦</span>;
  const BindIcon = () => <span className="text-[40px] opacity-70 leading-none flex items-center justify-center -translate-y-0.5">⇄</span>;
  const ShapeIcon = () => <span className="text-[40px] opacity-70 leading-none flex items-center justify-center -translate-y-0.5">◯</span>;

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <footer
      data-testid="status-bar"
      className={`h-10 bg-gradient-to-r from-surface via-surface to-surface/90 border-t border-border/40 px-4 flex items-center justify-between font-mono shrink-0 cursor-default overflow-visible hover:border-border/60 transition-colors relative`}
      style={{
        borderBottom: `2px solid rgba(${
          status === 'active' ? '16,185,129'
          : status === 'retired' ? '100,116,139'
          : '217,119,6'
        }, 0.15)`
      }}
    >
      {/* Gradient separator accent bar */}
      <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-border/20 to-transparent" />

      <div className="flex items-center gap-8 min-w-0 flex-1 relative z-10">
        {/* Version & Status Section - Pill shaped background */}
        <div
          className={`flex items-center gap-3 shrink-0 px-3 py-1.5 rounded-full ${statusBgColor} border ${statusBorderColor} transition-all hover:bg-opacity-[0.08]`}
          title={`Specification version and lifecycle status: ${status}`}
        >
          {/* Status Indicator */}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${statusColor} ${statusGlow} transition-all`} />
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-black tracking-widest uppercase text-ink leading-none">
                FORMSPEC {formspecVersion}
              </span>
              <span className={`text-[11px] font-semibold tracking-wide uppercase ${statusTextColor} leading-none`}>
                {status}
              </span>
            </div>
          </div>
        </div>

        {/* Presentation Section */}
        <div className="hidden md:flex items-center gap-3 shrink-0" title="Page mode, default currency, and density">
          {/* Gradient separator */}
          <div className="h-4 w-px bg-gradient-to-b from-transparent via-border/50 to-transparent" />
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-muted/80 uppercase tracking-wide leading-none">
              Mode · Currency
            </span>
            <span className="text-[11px] font-semibold text-ink/90 leading-none">
              {pageMode || 'standard'} · {(defaultCurrency as string) || 'USD'}
            </span>
          </div>
          {/* Gradient separator */}
          <div className="h-4 w-px bg-gradient-to-b from-transparent via-border/50 to-transparent" />
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-muted/80 uppercase tracking-wide leading-none">
              Density
            </span>
            <span className="text-[11px] font-semibold text-ink/90 leading-none">
              {(density as string) || 'comfortable'}
            </span>
          </div>
        </div>

        {/* Counts Section with entity type icons */}
        <div className="hidden sm:flex items-center gap-4 shrink-0" title="Entity counts across the definition">
          {/* Gradient separator */}
          <div className="h-4 w-px bg-gradient-to-b from-transparent via-border/50 to-transparent" />
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-12 h-12 flex items-center justify-center">
                <FieldIcon />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-muted/80 uppercase tracking-wide leading-none">
                  Fields
                </span>
                <span className="text-[11px] font-semibold text-accent leading-none">
                  {plural(fieldCount, 'field')}
                </span>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-2">
              <div className="w-12 h-12 flex items-center justify-center -my-3">
                <BindIcon />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-muted/80 uppercase tracking-wide leading-none">
                  Binds
                </span>
                <span className="text-[11px] font-semibold text-ink/90 leading-none">
                  {plural(bindCount, 'bind')}
                </span>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-2">
              <div className="w-12 h-12 flex items-center justify-center -my-3">
                <ShapeIcon />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-muted/80 uppercase tracking-wide leading-none">
                  Shapes
                </span>
                <span className="text-[11px] font-semibold text-ink/90 leading-none">
                  {plural(shapeCount, 'shape')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* URL Section with copy button */}
      <div className="flex items-center gap-3 shrink-0 min-w-fit ml-8 relative z-10">
        {definition.url && (
          <>
            {/* Gradient separator */}
            <div className="h-4 w-px bg-gradient-to-b from-transparent via-border/50 to-transparent" />
            <div className="flex items-center gap-2">
              <a
                href={definition.url}
                title={definition.url}
                className="text-[11px] text-muted/85 hover:text-accent font-semibold tracking-wide uppercase transition-colors underline-offset-2 hover:underline truncate max-w-[140px] sm:max-w-[240px]"
              >
                {definition.url}
              </a>
              <button
                onClick={() => handleCopyUrl(definition.url)}
                title="Copy URL"
                className="shrink-0 w-4 h-4 flex items-center justify-center rounded opacity-40 hover:opacity-70 hover:bg-border/20 transition-all duration-200"
              >
                <span className="text-[11px] leading-none">{copied ? '✓' : '⎘'}</span>
              </button>
            </div>
          </>
        )}
      </div>
    </footer>
  );
}
