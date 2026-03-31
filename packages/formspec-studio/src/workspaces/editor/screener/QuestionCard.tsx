/** @filedesc Expand/collapse card for a single screening question with inline editing. */
import { useState, useEffect } from 'react';
import { useProject } from '../../../state/useProject';
import { FieldIcon } from '../../../components/ui/FieldIcon';
import type { ScreenerQuestion } from './types';

interface QuestionCardProps {
  item: ScreenerQuestion;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  isFirst: boolean;
  isLast: boolean;
  isRequired: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  boolean: 'Yes / No',
  choice: 'Choose One',
  integer: 'Number',
  money: 'Dollar Amount',
  string: 'Short Text',
  date: 'Date',
};

export function QuestionCard({ item, index, isExpanded, onToggle, isFirst, isLast, isRequired }: QuestionCardProps) {
  const project = useProject();
  const [editLabel, setEditLabel] = useState(item.label ?? '');
  const [editHelpText, setEditHelpText] = useState(item.helpText ?? '');
  useEffect(() => { setEditLabel(item.label ?? ''); }, [item.label]);
  useEffect(() => { setEditHelpText(item.helpText ?? ''); }, [item.helpText]);

  const displayLabel = item.label || item.key;
  const typeBadge = TYPE_LABELS[item.dataType ?? ''] ?? item.dataType ?? 'field';

  const handleLabelBlur = () => {
    const trimmed = editLabel.trim();
    if (trimmed && trimmed !== item.label) {
      project.updateScreenField(item.key, { label: trimmed });
    }
  };

  const handleHelpTextBlur = () => {
    const val = editHelpText.trim();
    if (val !== (item.helpText ?? '')) {
      project.updateScreenField(item.key, { helpText: val || undefined });
    }
  };

  const handleRequiredToggle = () => {
    project.updateScreenField(item.key, { required: !isRequired });
  };

  const handleReorder = (direction: 'up' | 'down') => {
    project.reorderScreenField(item.key, direction);
  };

  const handleDelete = () => {
    if (window.confirm(`Delete "${displayLabel}"?`)) {
      project.removeScreenField(item.key);
    }
  };

  return (
    <div
      data-testid={`question-card-${item.key}`}
      className={`rounded-xl border transition-all ${isExpanded ? 'border-accent shadow-md ring-1 ring-accent/10 bg-surface' : 'border-border bg-surface/50 hover:border-muted hover:bg-surface'}`}
    >
      {/* Collapsed header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3 min-w-0">
          <FieldIcon dataType={item.dataType ?? 'string'} className="text-lg flex-shrink-0" />
          <div className="min-w-0">
            <div className="font-bold text-[14px] text-ink truncate">{displayLabel}</div>
            {!isExpanded && (
              <div className="text-[11px] text-muted truncate mt-0.5">
                <span className="font-mono">{item.key}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-[10px] text-muted font-mono uppercase tracking-wider">{typeBadge}</span>
          {isRequired && (
            <span className="text-[10px] text-amber font-bold uppercase tracking-wider">Required</span>
          )}
          <div className={`text-[12px] text-muted transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>&#9660;</div>
        </div>
      </div>

      {/* Expanded editor */}
      {isExpanded && (
        <div className="p-6 pt-0 border-t border-border animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="space-y-4 mt-4">
            {/* Key display */}
            <div className="flex items-center gap-2 px-3 py-2 bg-accent/5 rounded-lg border border-accent/10">
              <span className="text-[11px] text-muted">Key:</span>
              <code className="text-[12px] font-mono font-bold text-accent">{item.key}</code>
            </div>

            {/* Label */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted uppercase tracking-[0.2em] block">Label</label>
              <input
                type="text"
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                onBlur={handleLabelBlur}
                placeholder="Question label"
                className="block w-full text-[13px] bg-subtle border border-border rounded-lg px-3 py-2.5 hover:border-accent/50 focus:border-accent focus:ring-1 focus:ring-accent/20 outline-none"
              />
            </div>

            {/* Help text */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted uppercase tracking-[0.2em] block">Help Text</label>
              <textarea
                value={editHelpText}
                onChange={(e) => setEditHelpText(e.target.value)}
                onBlur={handleHelpTextBlur}
                placeholder="Optional guidance for the respondent"
                rows={2}
                className="block w-full text-[13px] bg-subtle border border-border rounded-lg px-3 py-2.5 hover:border-accent/50 focus:border-accent focus:ring-1 focus:ring-accent/20 outline-none resize-none"
              />
            </div>

            {/* Required toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isRequired}
                onChange={handleRequiredToggle}
                className="rounded border-border text-accent focus:ring-accent/20"
              />
              <span className="text-[12px] text-ink">Required</span>
            </label>

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
              <button
                type="button"
                aria-label="Delete"
                onClick={handleDelete}
                className="text-[10px] font-bold text-muted hover:text-error uppercase tracking-widest transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
