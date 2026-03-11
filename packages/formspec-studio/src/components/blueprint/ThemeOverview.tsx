import { useProjectState } from '../../state/useProjectState';
import { Section } from '../ui/Section';
import { Pill } from '../ui/Pill';

export function ThemeOverview() {
  const state = useProjectState();
  const theme = state.theme;
  const tokens = theme.tokens ?? {};
  const selectors = theme.selectors ?? [];
  const defaults = theme.defaults ?? {};
  const tokenCount = Object.keys(tokens).length;
  const selectorCount = Array.isArray(selectors) ? selectors.length : 0;
  const defaultCount = Object.keys(defaults).length;

  const hasSomething = tokenCount > 0 || selectorCount > 0 || defaultCount > 0;

  if (!hasSomething) {
    return (
      <Section title="Theme">
        <p className="text-xs text-muted py-2">No theme configured</p>
      </Section>
    );
  }

  return (
    <Section title="Theme">
      <div className="flex flex-wrap gap-2 py-1">
        {tokenCount > 0 && (
          <Pill text={`${tokenCount} tokens`} color="accent" size="sm" />
        )}
        {selectorCount > 0 && (
          <Pill text={`${selectorCount} selectors`} color="muted" size="sm" />
        )}
        {defaultCount > 0 && (
          <Pill text={`${defaultCount} defaults`} color="muted" size="sm" />
        )}
      </div>
    </Section>
  );
}
