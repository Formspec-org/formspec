/** @filedesc Question list manager with accordion cards and inline add form for screener authoring. */
import { useState } from 'react';
import { sanitizeIdentifier } from '@formspec-org/studio-core';
import { useScreener } from '../../../state/useScreener';
import { useProject } from '../../../state/useProject';
import { QuestionCard } from './QuestionCard';
import { InlineCreateForm } from '../../../components/shared/InlineCreateForm';
import { EmptyWorkspaceState } from '../../../components/shared/EmptyWorkspaceState';

const TYPE_OPTIONS = [
  { value: 'boolean', label: 'Yes / No' },
  { value: 'choice', label: 'Choose One' },
  { value: 'integer', label: 'Number' },
  { value: 'money', label: 'Dollar Amount' },
  { value: 'string', label: 'Short Text' },
  { value: 'date', label: 'Date' },
] as const;

export function ScreenerQuestions() {
  const screener = useScreener();
  const project = useProject();
  const items = (screener?.items ?? []) as Array<{ key: string; type: string; dataType?: string; label?: string; helpText?: string; [k: string]: unknown }>;
  const binds = (screener?.binds ?? []) as Array<{ path: string; required?: string }>;

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
        <InlineCreateForm
          onCancel={() => { setIsAdding(false); setNewLabel(''); }}
          onCreate={handleAdd}
          createLabel="Add"
        >
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
              className="flex-1 bg-transparent border-none outline-none text-sm text-ink placeholder:text-muted"
            />
          </div>
        </InlineCreateForm>
      )}

      {/* Empty state */}
      {items.length === 0 && !isAdding && (
        <EmptyWorkspaceState
          message="No screening questions defined."
          description="Add questions to collect eligibility data before the respondent starts the full form."
        />
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
