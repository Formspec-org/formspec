/** @filedesc Mapping tab section that lists all top-level mapping rules with their nested inner rules. */
import { useState } from 'react';
import { useMapping } from '../../state/useMapping';
import { Section } from '../../components/ui/Section';
import { RuleCard } from './RuleCard';
import { InnerRules } from './InnerRules';
import { useProject } from '../../state/useProject';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import type { MappingRule } from './types';

export function RuleEditor() {
  const mapping = useMapping();
  const rules = (mapping?.rules ?? []) as MappingRule[];
  const project = useProject();
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const addRule = () => {
    project.addMappingRule({ transform: 'preserve' });
  };

  const autoGenerate = () => {
    project.autoGenerateMappingRules({ replace: false });
  };

  const clearAll = () => {
    setShowClearConfirm(true);
  };

  const confirmClear = () => {
    project.clearMappingRules();
    setShowClearConfirm(false);
  };

  return (
    <Section title={`Rules (${rules.length})`}>
      <ConfirmDialog
        open={showClearConfirm}
        title="Clear all rules"
        description="Are you sure you want to clear all mapping rules? This cannot be undone."
        confirmLabel="Clear All"
        onConfirm={confirmClear}
        onCancel={() => setShowClearConfirm(false)}
      />
      <div className="flex items-center gap-2 mb-3">
        <button
          type="button"
          onClick={addRule}
          className="px-3 py-1 bg-accent text-surface rounded text-[11px] font-bold uppercase tracking-normal transition-colors shadow-sm"
        >
          Add Rule
        </button>
        <button
          type="button"
          onClick={autoGenerate}
          className="px-3 py-1 bg-subtle text-ink rounded text-[11px] font-bold uppercase tracking-normal hover:bg-border transition-colors border border-border"
        >
          Auto-Generate
        </button>
        {rules.length > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="px-3 py-1 bg-rust/[0.04] text-rust rounded text-[11px] font-bold uppercase tracking-normal hover:bg-rust/[0.08] transition-colors border border-rust/20 ml-auto"
          >
            Clear All
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1.5 max-h-[600px] overflow-y-auto pr-1 custom-scrollbar">
        {rules.length === 0 ? (
          <div className="p-8 rounded border border-dashed border-border bg-subtle flex flex-col items-center justify-center text-center">
            <div className="w-10 h-10 rounded bg-surface border border-border flex items-center justify-center text-xl mb-3 shadow-sm">
              📝
            </div>
            <h4 className="text-[14px] font-bold text-ink mb-1">No Rules Yet</h4>
            <p className="text-[11px] text-muted max-w-[200px] leading-relaxed mb-4">
              Connect your form fields to the target schema to start transforming data.
            </p>
            <button
               onClick={autoGenerate}
               className="text-[11px] font-bold text-accent hover:underline uppercase tracking-normal"
            >
              Get started with Auto-Mapping
            </button>
          </div>
        ) : (
          rules.map((rule, i) => {
            const source = rule.source ?? rule.sourcePath ?? '';
            const target = rule.target ?? rule.targetPath ?? '';
            return (
              <div key={i}>
                <RuleCard
                  index={i}
                  source={source}
                  target={target}
                  transform={rule.transform}
                  rule={rule}
                />
                {rule.innerRules && (
                  <InnerRules innerRules={rule.innerRules} />
                )}
              </div>
            );
          })
        )}
      </div>
    </Section>
  );
}
