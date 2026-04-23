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
      <div className="flex items-center gap-2 mb-4">
        <button
          type="button"
          onClick={addRule}
          className="px-3 py-1.5 bg-accent text-white rounded-md text-[11px] font-bold uppercase tracking-wider hover:bg-accent/90 transition-colors shadow-sm"
        >
          Add Rule
        </button>
        <button
          type="button"
          onClick={autoGenerate}
          className="px-3 py-1.5 bg-subtle text-ink rounded-md text-[11px] font-bold uppercase tracking-wider hover:bg-border transition-colors border border-border"
        >
          Auto-Generate
        </button>
        {rules.length > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="px-3 py-1.5 bg-rust/5 text-rust rounded-md text-[11px] font-bold uppercase tracking-wider hover:bg-rust/10 transition-colors border border-rust/20 ml-auto"
          >
            Clear All
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
        {rules.length === 0 ? (
          <div className="p-8 rounded-xl border-2 border-dashed border-border/40 bg-subtle/20 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-full bg-subtle flex items-center justify-center text-xl mb-3">
              📝
            </div>
            <h4 className="text-sm font-bold text-ink mb-1">No Rules Yet</h4>
            <p className="text-[11px] text-muted max-w-[200px] leading-relaxed mb-4">
              Connect your form fields to the target schema to start transforming data.
            </p>
            <button
               onClick={autoGenerate}
               className="text-[11px] font-bold text-accent hover:underline uppercase tracking-wider"
            >
              Get started with Auto-Mapping
            </button>
          </div>
        ) : (
          rules.map((rule, i) => {
            const source = rule.source ?? rule.sourcePath ?? '';
            const target = rule.target ?? rule.targetPath ?? '';
            return (
              <div key={i} className="animate-in fade-in slide-in-from-bottom-1 duration-300" style={{ animationDelay: `${i * 30}ms` }}>
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
