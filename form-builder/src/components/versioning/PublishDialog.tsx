import { useEffect, useState } from 'preact/hooks';
import type { SemverImpact } from '../../state/versioning';

interface PublishDialogProps {
  open: boolean;
  recommendedBump: SemverImpact;
  pendingChangeCount: number;
  onConfirm: (input: { bump: SemverImpact; summary: string }) => void;
  onCancel: () => void;
}

export function PublishDialog(props: PublishDialogProps) {
  const [bump, setBump] = useState<SemverImpact>(props.recommendedBump);
  const [summary, setSummary] = useState('');

  useEffect(() => {
    if (!props.open) {
      return;
    }
    setBump(props.recommendedBump);
    setSummary('');
  }, [props.open, props.recommendedBump]);

  if (!props.open) {
    return null;
  }

  return (
    <div class="publish-dialog" role="dialog" aria-modal="true" aria-label="Publish version" data-testid="publish-dialog">
      <p class="publish-dialog__title">Publish version</p>
      <p class="publish-dialog__meta">{props.pendingChangeCount} change(s) will be included in this release.</p>

      <label class="inspector-control">
        <span class="inspector-control__label">Version bump</span>
        <select
          class="inspector-input"
          value={bump}
          data-testid="publish-bump-input"
          onChange={(event) => {
            setBump((event.currentTarget as HTMLSelectElement).value as SemverImpact);
          }}
        >
          <option value="major">major</option>
          <option value="minor">minor</option>
          <option value="patch">patch</option>
        </select>
      </label>

      <label class="inspector-control">
        <span class="inspector-control__label">Changelog summary (optional)</span>
        <textarea
          class="inspector-input"
          rows={3}
          value={summary}
          data-testid="publish-summary-input"
          onInput={(event) => {
            setSummary((event.currentTarget as HTMLTextAreaElement).value);
          }}
        />
      </label>

      <div class="publish-dialog__actions">
        <button type="button" class="publish-dialog__button" data-testid="publish-cancel-button" onClick={props.onCancel}>
          Cancel
        </button>
        <button
          type="button"
          class="publish-dialog__button publish-dialog__button--primary"
          data-testid="publish-confirm-button"
          onClick={() => {
            props.onConfirm({ bump, summary });
          }}
        >
          Publish
        </button>
      </div>
    </div>
  );
}
