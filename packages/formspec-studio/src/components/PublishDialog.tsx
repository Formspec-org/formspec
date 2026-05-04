/** @filedesc Publish dialog — Draft → Review → Published state machine with URL mint and embed snippet. */
import { useState, useMemo, type ReactElement } from 'react';
import { useProject } from '../state/useProject';
import { useProjectState } from '../state/useProjectState';
import { exportProjectZip } from '../lib/export-zip';

type PublishState = 'draft' | 'review' | 'published';

interface PublishDialogProps {
  open: boolean;
  onClose: () => void;
}

export function PublishDialog({ open, onClose }: PublishDialogProps): ReactElement | null {
  if (!open) return null;

  const project = useProject();
  const state = useProjectState();
  const { definition } = state;
  const [publishState, setPublishState] = useState<PublishState>('draft');
  const [copied, setCopied] = useState<'url' | 'embed' | null>(null);

  const hasTheme = Boolean(state.theme);
  const hasComponent = Boolean(state.component);
  const formTitle = definition.title?.trim() || 'Untitled form';

  // Generate a URL from the form name (spec constraint: publish does not require Theme/Component)
  const publishUrl = useMemo(() => {
    const slug = formTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    return `https://formspec.org/forms/${slug}`;
  }, [formTitle]);

  const embedSnippet = `<formspec-render config-url="${publishUrl}"></formspec-render>`;

  const handleCopy = (text: string, type: 'url' | 'embed') => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleExport = async () => {
    await exportProjectZip(project.exportBundle());
    project.markClean();
  };

  const handlePublish = () => {
    setPublishState('published');
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div
        className="fixed inset-x-4 top-[15%] z-50 mx-auto max-w-lg rounded-xl border border-border bg-surface shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Publish form"
        data-testid="publish-dialog"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-[17px] font-semibold text-ink tracking-tight">{
            publishState === 'published' ? 'Published!' : 'Publish form'
          }</h2>
          <button
            type="button"
            aria-label="Close"
            className="rounded p-1 hover:bg-subtle focus-ring"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* State indicator */}
          <div className="flex items-center gap-3">
            {(['draft', 'review', 'published'] as const).map((step, i) => (
              <div key={step} className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                  publishState === step
                    ? 'bg-accent text-white'
                    : (['draft', 'review', 'published'].indexOf(publishState) > i
                        ? 'bg-accent/20 text-accent'
                        : 'bg-subtle text-muted')
                }`}>
                  {i + 1}
                </div>
                <span className={`text-[13px] ${publishState === step ? 'font-semibold text-ink' : 'text-muted'}`}>
                  {step.charAt(0).toUpperCase() + step.slice(1)}
                </span>
                {i < 2 && <div className="w-6 h-px bg-border" />}
              </div>
            ))}
          </div>

          {/* Draft state */}
          {publishState === 'draft' && (
            <div className="space-y-3">
              <div className="rounded-lg border border-border bg-subtle/50 px-4 py-3">
                <div className="text-[14px] font-medium text-ink">{formTitle}</div>
                <div className="text-[12px] text-muted mt-1">
                  {definition.items?.length ?? 0} items
                  {hasTheme && ' · Theme attached'}
                  {hasComponent && ' · Components attached'}
                </div>
              </div>
              {!hasTheme && !hasComponent && (
                <div className="rounded-lg border border-amber-400/30 bg-amber-500/5 px-4 py-3">
                  <div className="text-[12px] text-amber-700 dark:text-amber-300">
                    <strong>No theme or components attached.</strong> That's fine — a bare Definition is a publishable artifact. Theme and components are optional enrichments.
                  </div>
                </div>
              )}
              <button
                type="button"
                className="w-full rounded-lg bg-accent py-2.5 text-[13px] font-semibold text-white hover:bg-accent/90 transition-colors"
                onClick={() => setPublishState('review')}
              >
                Continue to review
              </button>
            </div>
          )}

          {/* Review state */}
          {publishState === 'review' && (
            <div className="space-y-3">
              <div className="rounded-lg border border-border bg-subtle/50 px-4 py-3 space-y-2">
                <div className="text-[13px] font-medium text-ink">Publish URL</div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-[12px] text-accent bg-accent/5 rounded px-2 py-1 truncate">
                    {publishUrl}
                  </code>
                  <button
                    type="button"
                    className="shrink-0 rounded border border-border px-2.5 py-1 text-[12px] hover:bg-subtle transition-colors"
                    onClick={() => handleCopy(publishUrl, 'url')}
                  >
                    {copied === 'url' ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-lg border border-border py-2.5 text-[13px] font-medium text-ink hover:bg-subtle transition-colors"
                  onClick={() => setPublishState('draft')}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-lg bg-accent py-2.5 text-[13px] font-semibold text-white hover:bg-accent/90 transition-colors"
                  onClick={handlePublish}
                  data-testid="publish-confirm"
                >
                  Publish
                </button>
              </div>
            </div>
          )}

          {/* Published state */}
          {publishState === 'published' && (
            <div className="space-y-3">
              <div className="text-center py-2">
                <div className="text-[32px]">✓</div>
                <div className="text-[15px] font-semibold text-ink mt-1">{formTitle} is live</div>
              </div>
              <div className="rounded-lg border border-border bg-subtle/50 px-4 py-3 space-y-2">
                <div className="text-[13px] font-medium text-ink">Form URL</div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-[12px] text-accent bg-accent/5 rounded px-2 py-1 truncate">
                    {publishUrl}
                  </code>
                  <button
                    type="button"
                    className="shrink-0 rounded border border-border px-2.5 py-1 text-[12px] hover:bg-subtle transition-colors"
                    onClick={() => handleCopy(publishUrl, 'url')}
                  >
                    {copied === 'url' ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-subtle/50 px-4 py-3 space-y-2">
                <div className="text-[13px] font-medium text-ink">Embed snippet</div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-[12px] text-muted bg-surface rounded px-2 py-1 truncate">
                    {embedSnippet}
                  </code>
                  <button
                    type="button"
                    className="shrink-0 rounded border border-border px-2.5 py-1 text-[12px] hover:bg-subtle transition-colors"
                    onClick={() => handleCopy(embedSnippet, 'embed')}
                  >
                    {copied === 'embed' ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-lg border border-border py-2.5 text-[13px] font-medium text-ink hover:bg-subtle transition-colors"
                  onClick={handleExport}
                >
                  Export ZIP
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-lg bg-accent py-2.5 text-[13px] font-semibold text-white hover:bg-accent/90 transition-colors"
                  onClick={onClose}
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
