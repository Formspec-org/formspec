/** @filedesc Properties panel section for editing inline choice options (value, label, optional keywords) on a field. */
import {
  type Project,
  formatCommaSeparatedKeywords,
  parseCommaSeparatedKeywords,
} from '@formspec-org/studio-core';
import type { FormItem } from '@formspec-org/types';
import { Section } from '../../../components/ui/Section';

type ChoiceOptionRow = { value: string; label: string; keywords?: string[] };

export function OptionsSection({
  path,
  item,
  project,
}: {
  path: string;
  item: FormItem;
  project: Project;
}) {
  const rawChoiceOptions = item.options ?? item.choices;
  const choiceOptions = Array.isArray(rawChoiceOptions)
    ? (rawChoiceOptions as ChoiceOptionRow[])
    : [];

  const updateOption = (index: number, property: 'value' | 'label', value: string) => {
    const nextOptions = choiceOptions.map((option, optionIndex) =>
      optionIndex === index ? { ...option, [property]: value } : option,
    );
    project.updateItem(path, { options: nextOptions });
  };

  const updateOptionKeywords = (index: number, raw: string) => {
    const keywords = parseCommaSeparatedKeywords(raw);
    const nextOptions = choiceOptions.map((option, optionIndex) => {
      if (optionIndex !== index) return option;
      const next: ChoiceOptionRow = { ...option, value: option.value, label: option.label };
      if (keywords) next.keywords = keywords;
      else delete next.keywords;
      return next;
    });
    project.updateItem(path, { options: nextOptions });
  };

  const addOption = () => {
    project.updateItem(path, { options: [...choiceOptions, { value: '', label: '' }] });
  };

  const removeOption = (index: number) => {
    project.updateItem(path, { options: choiceOptions.filter((_, optionIndex) => optionIndex !== index) });
  };

  return (
    <Section title="Options">
      <div className="space-y-2">
        {choiceOptions.map((option, index) => (
          <div
            key={`opt-${path}-${index}`}
            className="rounded-[4px] border border-border bg-subtle/40 px-2 py-2 space-y-2 relative"
          >
            <button
              type="button"
              aria-label="Remove option"
              className="absolute top-1 right-1 text-[10px] text-muted hover:text-error cursor-pointer transition-colors"
              onClick={() => removeOption(index)}
            >
              ✕
            </button>
            <div className="space-y-1">
              <label className="font-mono text-[10px] text-muted uppercase tracking-wider block" htmlFor={`${path}-option-${index}-value`}>
                Option {index + 1} Value
              </label>
              <input
                id={`${path}-option-${index}-value`}
                aria-label={`Option ${index + 1} Value`}
                type="text"
                className="w-full px-2 py-1 text-[12px] font-mono border border-border rounded-[4px] bg-surface outline-none focus:border-accent transition-colors"
                defaultValue={option.value}
                onBlur={(event) => updateOption(index, 'value', event.currentTarget.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="font-mono text-[10px] text-muted uppercase tracking-wider block" htmlFor={`${path}-option-${index}-label`}>
                Option {index + 1} Label
              </label>
              <input
                id={`${path}-option-${index}-label`}
                aria-label={`Option ${index + 1} Label`}
                type="text"
                className="w-full px-2 py-1 text-[12px] border border-border rounded-[4px] bg-surface outline-none focus:border-accent transition-colors"
                defaultValue={option.label ?? option.value}
                onBlur={(event) => updateOption(index, 'label', event.currentTarget.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="font-mono text-[10px] text-muted uppercase tracking-wider block" htmlFor={`${path}-option-${index}-keywords`}>
                Option {index + 1} Keywords (optional)
              </label>
              <input
                id={`${path}-option-${index}-keywords`}
                aria-label={`Option ${index + 1} search keywords`}
                type="text"
                className="w-full px-2 py-1 text-[12px] border border-border rounded-[4px] bg-surface outline-none focus:border-accent transition-colors"
                placeholder="US, USA, America"
                defaultValue={formatCommaSeparatedKeywords(option.keywords)}
                onBlur={(event) => updateOptionKeywords(index, event.currentTarget.value)}
              />
              <p className="text-[10px] text-muted/80">Comma-separated. Used for searchable Select / combobox type-ahead.</p>
            </div>
          </div>
        ))}
        <button
          type="button"
          aria-label="Add option"
          className="w-full py-1.5 border border-dashed border-border rounded-[4px] font-mono text-[11px] text-muted hover:text-accent hover:border-accent transition-colors cursor-pointer"
          onClick={addOption}
        >
          + Add Option
        </button>
      </div>
    </Section>
  );
}
