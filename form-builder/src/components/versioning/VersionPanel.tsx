import type { Signal } from '@preact/signals';
import { useMemo, useState } from 'preact/hooks';
import { publishVersion } from '../../state/mutations';
import type { ProjectState } from '../../state/project';
import {
  generateDefinitionChangelog,
  validateGeneratedChangelog,
  type FormspecChangelogDocument
} from '../../state/versioning';
import { ChangeList } from './ChangeList';
import { PublishDialog } from './PublishDialog';

interface VersionPanelProps {
  project: Signal<ProjectState>;
}

export function VersionPanel(props: VersionPanelProps) {
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const state = props.project.value;
  const lastRelease = state.versioning.releases[state.versioning.releases.length - 1] ?? null;

  const pendingChangelog = useMemo(
    () =>
      generateDefinitionChangelog(
        state.versioning.baselineDefinition,
        state.definition,
        state.definition.url
      ),
    [state.versioning.baselineDefinition, state.definition]
  );
  const validation = useMemo(() => validateGeneratedChangelog(pendingChangelog), [pendingChangelog]);

  return (
    <div class="version-panel" data-testid="version-panel">
      <div class="version-panel__meta">
        <p class="version-panel__line" data-testid="version-current">
          Current version: <strong>{state.definition.version}</strong>
        </p>
        <p class="version-panel__line" data-testid="version-last-published">
          Last published: {lastRelease ? `v${lastRelease.version} (${formatDateTime(lastRelease.publishedAt)})` : 'Never'}
        </p>
      </div>

      <div class="version-panel__impact-row">
        <span class={`version-impact-badge is-${pendingChangelog.semverImpact}`} data-testid="version-impact">
          {pendingChangelog.semverImpact}
        </span>
        <span class="version-panel__impact-text">
          {pendingChangelog.changes.length} change(s) since last publish
        </span>
      </div>

      {!validation.valid ? (
        <p class="version-panel__error" data-testid="version-validation-error">
          Changelog failed schema validation: {validation.errors[0]}
        </p>
      ) : null}

      <ChangeList changes={pendingChangelog.changes} />

      {publishError ? (
        <p class="version-panel__error" data-testid="version-publish-error">
          {publishError}
        </p>
      ) : null}

      <div class="version-panel__actions">
        <button
          type="button"
          class="version-panel__button version-panel__button--primary"
          data-testid="version-open-publish-dialog"
          onClick={() => {
            setPublishDialogOpen(true);
            setPublishError(null);
          }}
        >
          Publish
        </button>
        <button
          type="button"
          class="version-panel__button"
          data-testid="version-export-changelog"
          onClick={() => {
            downloadJson(pendingChangelog, buildFilename(state.definition.title, 'changelog.json'));
          }}
        >
          Export changelog
        </button>
        <button
          type="button"
          class="version-panel__button"
          data-testid="version-export-bundle"
          onClick={() => {
            downloadJson(
              {
                definition: state.definition,
                component: state.component,
                theme: state.theme,
                mapping: state.mapping,
                changelogs: state.versioning.releases.map((release) => release.changelog)
              },
              buildFilename(state.definition.title, 'bundle.json')
            );
          }}
        >
          Export bundle
        </button>
      </div>

      <PublishDialog
        open={publishDialogOpen}
        recommendedBump={pendingChangelog.semverImpact}
        pendingChangeCount={pendingChangelog.changes.length}
        onCancel={() => {
          setPublishDialogOpen(false);
        }}
        onConfirm={(input) => {
          try {
            const changelog = publishVersion(props.project, {
              bump: input.bump,
              summary: input.summary
            });
            setPublishDialogOpen(false);
            setPublishError(null);
            downloadJson(changelog, buildFilename(state.definition.title, 'release-changelog.json'));
          } catch (error) {
            setPublishError(error instanceof Error ? error.message : String(error));
          }
        }}
      />
    </div>
  );
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return value;
  }
  return date.toISOString();
}

function buildFilename(title: string | undefined, suffix: string): string {
  const normalizedTitle =
    title
      ?.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') ?? 'form';
  return `${normalizedTitle || 'form'}-${suffix}`;
}

function downloadJson(payload: unknown, filename: string): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return;
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
}
