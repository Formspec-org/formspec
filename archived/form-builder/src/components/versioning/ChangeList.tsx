import type { ChangelogChange } from '../../state/versioning';

interface ChangeListProps {
  changes: ChangelogChange[];
}

export function ChangeList(props: ChangeListProps) {
  if (props.changes.length === 0) {
    return (
      <p class="inspector-hint" data-testid="version-change-empty">
        No changes since last publish.
      </p>
    );
  }

  return (
    <ul class="version-change-list" data-testid="version-change-list">
      {props.changes.map((change, index) => (
        <li class="version-change-list__item" data-testid={`version-change-${index}`} key={`${change.path}:${change.type}:${index}`}>
          <span class={`version-impact-badge is-${change.impact}`}>{change.impact}</span>
          <span class="version-change-list__type">{change.type}</span>
          <span class="version-change-list__target">{change.key ?? change.target}</span>
          {change.description ? (
            <span class="version-change-list__description">{change.description}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
