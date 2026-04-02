/** @filedesc Ordered phase list with per-phase route management for screener authoring. */
import { useState } from 'react';
import { useScreener } from '../../../state/useScreener';
import { useProject } from '../../../state/useProject';
import { PhaseCard } from './PhaseCard';
import type { Phase } from '@formspec-org/types';

const STRATEGY_OPTIONS = [
  { value: 'first-match', label: 'First Match' },
  { value: 'fan-out', label: 'Fan Out (all matches)' },
  { value: 'score-threshold', label: 'Score Threshold' },
] as const;

export function PhaseList() {
  const screener = useScreener();
  const project = useProject();
  const phases = (screener?.evaluation ?? []) as Phase[];

  const [expandedPhaseId, setExpandedPhaseId] = useState<string | null>(
    phases.length > 0 ? phases[0].id : null
  );
  const [isAdding, setIsAdding] = useState(false);
  const [newId, setNewId] = useState('');
  const [newStrategy, setNewStrategy] = useState('first-match');

  const handleAddPhase = () => {
    const trimmed = newId.trim().replace(/\s+/g, '-').toLowerCase();
    if (!trimmed) return;
    project.addEvaluationPhase(trimmed, newStrategy);
    setExpandedPhaseId(trimmed);
    setNewId('');
    setNewStrategy('first-match');
    setIsAdding(false);
  };

  const handleAddKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAddPhase();
    if (e.key === 'Escape') { setIsAdding(false); setNewId(''); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-1">
        <h4 className="text-[12px] font-bold text-muted uppercase tracking-wider">Evaluation Phases</h4>
        {!isAdding && (
          <button
            type="button"
            aria-label="Add phase"
            onClick={() => setIsAdding(true)}
            className="text-[11px] text-accent hover:text-accent-hover font-bold uppercase tracking-wider transition-colors"
          >
            + Add Phase
          </button>
        )}
      </div>

      {/* Inline add form */}
      {isAdding && (
        <div className="border border-accent/30 rounded-xl bg-accent/5 p-4 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center gap-2">
            <select
              value={newStrategy}
              onChange={(e) => setNewStrategy(e.target.value)}
              className="bg-transparent border border-border rounded-lg px-2 py-1.5 text-[12px] text-ink outline-none focus:border-accent"
            >
              {STRATEGY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <input
              autoFocus
              type="text"
              placeholder="Phase ID (e.g. eligibility)"
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
              onKeyDown={handleAddKeyDown}
              className="flex-1 bg-transparent border-none outline-none text-sm text-ink placeholder:text-muted/40"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { setIsAdding(false); setNewId(''); }}
              className="text-[10px] uppercase font-bold text-muted hover:text-ink transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddPhase}
              className="text-[10px] uppercase font-bold text-accent hover:text-accent-hover transition-colors"
            >
              Add
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {phases.length === 0 && !isAdding && (
        <div className="py-8 border-2 border-dashed border-border/50 rounded-2xl flex flex-col items-center justify-center text-center px-6">
          <p className="text-sm text-muted font-medium mb-2">No evaluation phases defined.</p>
          <p className="text-[12px] text-muted/70 leading-relaxed max-w-[400px]">
            Add phases to define how respondents are routed. Each phase uses a strategy
            (first-match, fan-out, or score-threshold) and contains routing rules.
          </p>
        </div>
      )}

      {/* Phase cards */}
      {phases.map((phase, i) => (
        <PhaseCard
          key={phase.id}
          phase={phase}
          isExpanded={expandedPhaseId === phase.id}
          onToggle={() => setExpandedPhaseId(expandedPhaseId === phase.id ? null : phase.id)}
          isFirst={i === 0}
          isLast={i === phases.length - 1}
        />
      ))}
    </div>
  );
}
