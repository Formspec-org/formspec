/** @filedesc Question list manager with accordion cards and inline add form for screener authoring. */
import { useState } from 'react';
import { sanitizeIdentifier } from '@formspec-org/studio-core';
import { useDefinition } from '../../../state/useDefinition';
import { useProject } from '../../../state/useProject';
import { QuestionCard } from './QuestionCard';
import type { ScreenerQuestion } from './types';

const TYPE_OPTIONS = [
  { value: 'boolean', label: 'Yes / No' },
  { value: 'choice', label: 'Choose One' },
  { value: 'integer', label: 'Number' },
  { value: 'money', label: 'Dollar Amount' },
  { value: 'string', label: 'Short Text' },
  { value: 'date', label: 'Date' },
] as const;

export function ScreenerQuestions() {
  const definition = useDefinition();
  const project = useProject();
  const screener = definition?.screener as { items?: ScreenerQuestion[]; binds?: { path: string; required?: string }[] } | undefined;
  const items = screener?.items ?? [];
  const binds = screener?.binds ?? [];

  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState('boolean');

  const isRequiredForKey = (key: string): boolean => {
    const bind = binds.find(b => b.path === key);
    return bind?.required === 'true';
  };

  const handleAdd = () => {
    const trimmed = newLabel.trim();
    if (!trimmed) return;
    const key = 'screen_' + sanitizeIdentifier(trimmed);
    project.addScreenField(key, trimmed, newType);
    setExpandedKey(key);
    setNewLabel('');
    setNewType('boolean');
    setIsAdding(false);
  };

  const handleAddKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAdd();
    if (e.key === 'Escape') { setIsAdding(false); setNewLabel(''); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-1">
        <h4 className="text-[12px] font-bold text-muted uppercase tracking-wider">Screening Questions</h4>
        {!isAdding && (
          <button
            type="button"
            aria-label="Add question"
            onClick={() => setIsAdding(true)}
            className="text-[11px] text-accent hover:text-accent-hover font-bold uppercase tracking-wider transition-colors"
          >
            + Add Question
          </button>
        )}
      </div>

      {/* Inline add form */}
      {isAdding && (
        <div className="border border-accent/30 rounded-xl bg-accent/5 p-4 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center gap-2">
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="bg-transparent border border-border rounded-lg px-2 py-1.5 text-[12px] text-ink outline-none focus:border-accent"
            >
              {TYPE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <input
              autoFocus
              type="text"
              placeholder="Question label"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={handleAddKeyDown}
              className="flex-1 bg-transparent border-none outline-none text-sm text-ink placeholder:text-muted/40"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { setIsAdding(false); setNewLabel(''); }}
              className="text-[10px] uppercase font-bold text-muted hover:text-ink transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAdd}
              className="text-[10px] uppercase font-bold text-accent hover:text-accent-hover transition-colors"
            >
              Add
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 && !isAdding && (
        <div className="py-8 border-2 border-dashed border-border/50 rounded-2xl flex flex-col items-center justify-center text-center px-6">
          <p className="text-sm text-muted font-medium mb-2">No screening questions defined.</p>
          <p className="text-[12px] text-muted/70 leading-relaxed max-w-[400px]">
            Add questions to collect eligibility data before the respondent starts the full form.
          </p>
        </div>
      )}

      {/* Question cards */}
      {items.map((item, i) => (
        <QuestionCard
          key={item.key}
          item={item}
          index={i}
          isExpanded={expandedKey === item.key}
          onToggle={() => setExpandedKey(expandedKey === item.key ? null : item.key)}
          isFirst={i === 0}
          isLast={i === items.length - 1}
          isRequired={isRequiredForKey(item.key)}
        />
      ))}
    </div>
  );
}
