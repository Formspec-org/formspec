/** @filedesc Mapping tab section that lists all top-level mapping rules with their nested inner rules. */
import { useMapping } from '../../state/useMapping';
import { Section } from '../../components/ui/Section';
import { RuleCard } from './RuleCard';
import { InnerRules } from './InnerRules';

export function RuleEditor() {
  const mapping = useMapping();
  const rules = (mapping?.rules ?? []) as Array<{
    source?: string; sourcePath?: string;
    target?: string; targetPath?: string;
    transform?: string;
    innerRules?: unknown[];
  }>;

  if (rules.length === 0) {
    return <div className="p-4 text-sm text-muted">No mapping rules defined</div>;
  }

  return (
    <Section title="Rules">
      <div className="flex flex-col gap-2">
        {rules.map((rule, i) => {
          const source = rule.source ?? rule.sourcePath ?? '';
          const target = rule.target ?? rule.targetPath ?? '';
          return (
            <div key={i}>
              <RuleCard source={source} target={target} transform={rule.transform} />
              {rule.innerRules && (
                <InnerRules innerRules={rule.innerRules as any[]} />
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}
