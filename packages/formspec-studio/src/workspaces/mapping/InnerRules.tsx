/** @filedesc Indented list of nested inner mapping rules rendered beneath a parent RuleCard. */
import { RuleCard } from './RuleCard';

interface InnerRulesProps {
  innerRules: Array<{ source?: string; sourcePath?: string; target?: string; targetPath?: string; transform?: string }>;
}

export function InnerRules({ innerRules }: InnerRulesProps) {
  if (!innerRules || innerRules.length === 0) return null;

  return (
    <div className="ml-4 mt-1 flex flex-col gap-1 border-l-2 border-border pl-2">
      {innerRules.map((rule, i) => (
        <RuleCard
          key={i}
          source={rule.source ?? rule.sourcePath ?? ''}
          target={rule.target ?? rule.targetPath ?? ''}
          transform={rule.transform}
        />
      ))}
    </div>
  );
}
