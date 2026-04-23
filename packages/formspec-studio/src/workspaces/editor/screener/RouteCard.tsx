/** @filedesc Expand/collapse card for a single screener routing rule with strategy-aware editing. */
import { useState, useEffect, useMemo } from 'react';
import { useProject } from '../../../state/useProject';
import { InlineExpression } from '../../../components/ui/InlineExpression';
import { ConditionBuilder, ConditionBuilderPreview } from '../../../components/ui/ConditionBuilder';
import { parseFELToGroup, type FELEditorFieldOption } from '@formspec-org/studio-core';
import type { Route } from '@formspec-org/types';
import { ExpandableCard } from '../../../components/shared/ExpandableCard';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { useFieldOptions } from '../../../hooks/useFieldOptions';

interface RouteCardProps {
  route: Route;
  index: number;
  phaseId: string;
  strategy: string;
  isExpanded: boolean;
  onToggle: () => void;
  isFirst: boolean;
  isLast: boolean;
  canDelete: boolean;
}

export function RouteCard({ route, index, phaseId, strategy, isExpanded, onToggle, isFirst, isLast, canDelete }: RouteCardProps) {
  const project = useProject();
  const [editLabel, setEditLabel] = useState(route.label ?? '');
  const [editTarget, setEditTarget] = useState(route.target);
  const [editMessage, setEditMessage] = useState(route.message ?? '');
  const [editThreshold, setEditThreshold] = useState(String(route.threshold ?? 0));
  const [editingCondition, setEditingCondition] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  useEffect(() => { setEditLabel(route.label ?? ''); }, [route.label]);
  useEffect(() => { setEditTarget(route.target); }, [route.target]);
  useEffect(() => { setEditMessage(route.message ?? ''); }, [route.message]);
  useEffect(() => { setEditThreshold(String(route.threshold ?? 0)); }, [route.threshold]);

  const screenerFields = useFieldOptions();

  const isScoreStrategy = strategy === 'score-threshold';
  const badge = isScoreStrategy ? 'SCORE' : 'IF';

  const setRouteProperty = (property: string, value: unknown) => {
    project.updateScreenRoute(phaseId, index, { [property]: value });
  };

  const handleLabelBlur = () => {
    const trimmed = editLabel.trim();
    if (trimmed !== (route.label ?? '')) {
      setRouteProperty('label', trimmed || undefined);
    }
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

  const handleConditionSave = (newValue: string) => {
    if (newValue !== route.condition) {
      setRouteProperty('condition', newValue);
    }
  };

  const handleScoreSave = (newValue: string) => {
    if (newValue !== route.score) {
      setRouteProperty('score', newValue);
    }
  };

  const handleThresholdBlur = () => {
    const num = parseFloat(editThreshold);
    if (!isNaN(num) && num !== (route.threshold ?? 0)) {
      setRouteProperty('threshold', num);
    }
  };

  const handleReorder = (direction: 'up' | 'down') => {
    project.reorderScreenRoute(phaseId, index, direction);
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    project.removeScreenRoute(phaseId, index);
    setShowDeleteConfirm(false);
  };

  // Summary for collapsed view
  const summaryText = isScoreStrategy
    ? (route.score ?? '(no score)')
    : (route.condition ?? '(no condition)');

  return (
    <>
    <ExpandableCard
      expanded={isExpanded}
      onToggle={onToggle}
      header={
        <>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber/20 text-amber text-[10px] font-bold flex-shrink-0">
                {index + 1}
              </span>
              <span className="text-[10px] font-bold text-amber uppercase tracking-wider">{badge}</span>
              {route.label ? (
                <span className="text-[13px] font-bold text-ink truncate">{route.label}</span>
              ) : (
                <code className="text-[11px] font-mono text-muted truncate">{summaryText}</code>
              )}
              {route.override && (
                <span className="text-[9px] font-bold uppercase tracking-wider text-error bg-error/10 px-1.5 py-0.5 rounded">
                  override{route.terminal ? ' (terminal)' : ''}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-1 ml-7">
              <span className="text-[10px] text-muted">&#8594;</span>
              <span className="text-[11px] text-muted font-mono truncate">{route.target || '(no target)'}</span>
            </div>
          </div>
        </>
      }
    >
      <div className="space-y-4 mt-4">
            {/* Label */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted uppercase tracking-[0.2em] block">Label</label>
              <input
                type="text"
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                onBlur={handleLabelBlur}
                placeholder="Optional display name for this rule"
                className="block w-full text-[13px] bg-subtle border border-border rounded-lg px-3 py-2.5 hover:border-accent/50 focus:border-accent focus:ring-1 focus:ring-accent/20 outline-none"
              />
            </div>

            {/* Strategy-specific fields */}
            {isScoreStrategy ? (
              <>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted uppercase tracking-[0.2em] block">Score Expression</label>
                  <InlineExpression
                    value={route.score ?? ''}
                    onSave={handleScoreSave}
                    placeholder="FEL numeric expression"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted uppercase tracking-[0.2em] block">Threshold</label>
                  <input
                    type="number"
                    step="any"
                    value={editThreshold}
                    onChange={(e) => setEditThreshold(e.target.value)}
                    onBlur={handleThresholdBlur}
                    className="block w-full text-[13px] bg-subtle border border-border rounded-lg px-3 py-2.5 hover:border-accent/50 focus:border-accent focus:ring-1 focus:ring-accent/20 outline-none"
                  />
                </div>
              </>
            ) : (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted uppercase tracking-[0.2em] block">Condition</label>
                {editingCondition ? (
                  <ConditionBuilder
                    value={route.condition ?? ''}
                    onSave={(fel) => {
                      setEditingCondition(false);
                      handleConditionSave(fel);
                    }}
                    onCancel={() => setEditingCondition(false)}
                    fields={screenerFields}
                    autoEdit
                  />
                ) : (
                  <ConditionBuilderPreview
                    value={route.condition ?? ''}
                    onClick={() => setEditingCondition(true)}
                  />
                )}
              </div>
            )}

            {/* Target */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted uppercase tracking-[0.2em] block">Target URI</label>
              <input
                type="text"
                value={editTarget}
                onChange={(e) => setEditTarget(e.target.value)}
                onBlur={handleTargetBlur}
                placeholder="urn:target-form"
                className="block w-full text-[13px] bg-subtle border border-border rounded-lg px-3 py-2.5 hover:border-accent/50 focus:border-accent focus:ring-1 focus:ring-accent/20 outline-none font-mono"
              />
            </div>

            {/* Message */}
            <div className="space-y-1.5">
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

            {/* Override toggle */}
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={route.override ?? false}
                  onChange={(e) => setRouteProperty('override', e.target.checked || undefined)}
                  className="rounded"
                />
                <span className="text-[11px] text-muted">Override route</span>
              </label>
              {route.override && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={route.terminal ?? false}
                    onChange={(e) => setRouteProperty('terminal', e.target.checked || undefined)}
                    className="rounded"
                  />
                  <span className="text-[11px] text-muted">Terminal (halts pipeline)</span>
                </label>
              )}
            </div>

            {/* Actions: reorder + delete */}
            <div className="pt-4 border-t border-border flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Move up"
                  disabled={isFirst}
                  onClick={() => handleReorder('up')}
                  className="text-[14px] px-2 py-1 text-muted hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  &#9650;
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  disabled={isLast}
                  onClick={() => handleReorder('down')}
                  className="text-[14px] px-2 py-1 text-muted hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  &#9660;
                </button>
              </div>
              {canDelete && (
                <button
                  type="button"
                  aria-label="Delete"
                  onClick={handleDelete}
                  className="text-[10px] font-bold text-muted hover:text-error uppercase tracking-widest transition-colors"
                >
                  Delete
                </button>
              )}
        </div>
      </div>
    </ExpandableCard>
    <ConfirmDialog
      open={showDeleteConfirm}
      title="Delete routing rule"
      description="Delete this routing rule?"
      confirmLabel="Delete"
      onConfirm={confirmDelete}
      onCancel={() => setShowDeleteConfirm(false)}
    />
    </>
  );
}
