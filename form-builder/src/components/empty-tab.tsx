import type { ArtifactKind } from '../types';

const TAB_INFO: Record<string, { icon: string; description: string }> = {
  component: {
    icon: '◇',
    description: 'Component documents define how your form renders.',
  },
  theme: {
    icon: '◈',
    description: 'Theme documents control colors, typography, and layout.',
  },
  mapping: {
    icon: '⬡',
    description: 'Mapping documents transform form data to external formats.',
  },
  registry: {
    icon: '▢',
    description: 'Registry documents declare extensions and dependencies.',
  },
  changelog: {
    icon: '▤',
    description: 'Changelog documents track version history.',
  },
};

export function EmptyTab({ kind }: { kind: ArtifactKind }) {
  const info = TAB_INFO[kind];
  if (!info) {
    return null;
  }

  const title = `${kind.slice(0, 1).toUpperCase()}${kind.slice(1)}`;

  return (
    <div class="empty-tab">
      <span class="empty-tab-icon">{info.icon}</span>
      <h2 class="empty-tab-title">{title} not configured</h2>
      <p class="empty-tab-desc">{info.description}</p>
      <div class="empty-tab-actions">
        <button class="btn-primary">Create from Scratch</button>
        <button class="btn-ghost">Import JSON</button>
      </div>
    </div>
  );
}
