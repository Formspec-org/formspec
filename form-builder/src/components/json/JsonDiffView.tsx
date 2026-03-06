export type JsonArtifactKey = 'definition' | 'component' | 'theme';

interface JsonDiffViewProps {
  baseline: Record<JsonArtifactKey, string>;
  current: Record<JsonArtifactKey, string>;
}

interface DiffSummary {
  changed: boolean;
  added: number;
  removed: number;
}

const ARTIFACT_META: Record<JsonArtifactKey, string> = {
  definition: 'Definition',
  component: 'Component',
  theme: 'Theme'
};

export function JsonDiffView(props: JsonDiffViewProps) {
  return (
    <section class="json-diff-view" data-testid="json-diff-view">
      <h4 class="json-diff-view__title">Diff Since Opened</h4>
      <ul class="json-diff-view__list">
        {(Object.keys(ARTIFACT_META) as JsonArtifactKey[]).map((artifact) => {
          const summary = summarizeLineDiff(props.baseline[artifact], props.current[artifact]);
          return (
            <li
              key={artifact}
              class={`json-diff-view__item${summary.changed ? ' is-changed' : ''}`}
              data-testid={`json-diff-${artifact}`}
            >
              <span class="json-diff-view__label">{ARTIFACT_META[artifact]}</span>
              {summary.changed ? (
                <span class="json-diff-view__change">
                  +{summary.added} / -{summary.removed}
                </span>
              ) : (
                <span class="json-diff-view__unchanged">unchanged</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function summarizeLineDiff(before: string, after: string): DiffSummary {
  if (before === after) {
    return {
      changed: false,
      added: 0,
      removed: 0
    };
  }

  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  const maxLines = Math.max(beforeLines.length, afterLines.length);
  let added = 0;
  let removed = 0;

  for (let line = 0; line < maxLines; line += 1) {
    const beforeLine = beforeLines[line];
    const afterLine = afterLines[line];

    if (beforeLine === afterLine) {
      continue;
    }

    if (beforeLine === undefined) {
      added += 1;
      continue;
    }

    if (afterLine === undefined) {
      removed += 1;
      continue;
    }

    added += 1;
    removed += 1;
  }

  return {
    changed: added > 0 || removed > 0,
    added,
    removed
  };
}
