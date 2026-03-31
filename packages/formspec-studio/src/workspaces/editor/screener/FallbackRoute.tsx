/** @filedesc Visually distinct card for the catch-all fallback routing rule. */
import { useState, useEffect } from 'react';
import { useProject } from '../../../state/useProject';

interface FallbackRouteProps {
  route: { condition: string; target: string; label?: string; message?: string };
  routeIndex: number;
}

export function FallbackRoute({ route, routeIndex }: FallbackRouteProps) {
  const project = useProject();
  const [editTarget, setEditTarget] = useState(route.target);
  const [editMessage, setEditMessage] = useState(route.message ?? '');
  useEffect(() => { setEditTarget(route.target); }, [route.target]);
  useEffect(() => { setEditMessage(route.message ?? ''); }, [route.message]);

  const displayLabel = route.label || 'Everyone else';

  const setRouteProperty = (property: string, value: string | undefined) => {
    project.core.dispatch({
      type: 'definition.setRouteProperty',
      payload: { index: routeIndex, property, value },
    });
  };

  const handleTargetBlur = () => {
    const trimmed = editTarget.trim();
    if (trimmed !== route.target) {
      setRouteProperty('target', trimmed);
    }
  };

  const handleMessageBlur = () => {
    const val = editMessage.trim();
    if (val !== (route.message ?? '')) {
      setRouteProperty('message', val || undefined);
    }
  };

  return (
    <div
      data-testid="fallback-route"
      className="rounded-xl border border-amber/20 bg-amber/5 p-4 space-y-3"
    >
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber/20 text-amber text-[10px] font-bold flex-shrink-0">
          &#8727;
        </span>
        <span className="text-[13px] font-bold text-ink">{displayLabel}</span>
      </div>
      <p className="text-[11px] text-muted/70 italic ml-7">Fallback — always matches</p>

      {/* Target */}
      <div className="space-y-1.5 ml-7">
        <label className="text-[10px] font-bold text-muted uppercase tracking-[0.2em] block">Target URI</label>
        <input
          type="text"
          value={editTarget}
          onChange={(e) => setEditTarget(e.target.value)}
          onBlur={handleTargetBlur}
          placeholder="urn:default-form"
          className="block w-full text-[13px] bg-subtle border border-border rounded-lg px-3 py-2.5 hover:border-accent/50 focus:border-accent focus:ring-1 focus:ring-accent/20 outline-none font-mono"
        />
      </div>

      {/* Message */}
      <div className="space-y-1.5 ml-7">
        <label className="text-[10px] font-bold text-muted uppercase tracking-[0.2em] block">Message</label>
        <textarea
          value={editMessage}
          onChange={(e) => setEditMessage(e.target.value)}
          onBlur={handleMessageBlur}
          placeholder="Optional message shown to the respondent"
          rows={2}
          className="block w-full text-[13px] bg-subtle border border-border rounded-lg px-3 py-2.5 hover:border-accent/50 focus:border-accent focus:ring-1 focus:ring-accent/20 outline-none resize-none"
        />
      </div>
    </div>
  );
}
