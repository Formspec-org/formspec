import type { FormspecItem } from 'formspec-engine';

interface LinkedSubformMetadata {
  ref?: string;
  sourceLabel?: string;
  importedAt?: string;
}

interface LinkedBadgeProps {
  item: FormspecItem;
  path: string;
}

export function LinkedBadge(props: LinkedBadgeProps) {
  const metadata = getLinkedSubformMetadata(props.item);
  if (!metadata) {
    return null;
  }

  const title = metadata.ref
    ? `Linked sub-form: ${metadata.ref}`
    : metadata.sourceLabel
      ? `Linked sub-form: ${metadata.sourceLabel}`
      : 'Linked sub-form';

  return (
    <span
      class="linked-subform-badge"
      data-testid={`linked-subform-badge-${props.path}`}
      title={title}
      aria-label="Linked sub-form"
    >
      Linked
    </span>
  );
}

export function isLinkedSubform(item: FormspecItem): boolean {
  return getLinkedSubformMetadata(item) !== null;
}

function getLinkedSubformMetadata(item: FormspecItem): LinkedSubformMetadata | null {
  if (item.type !== 'group') {
    return null;
  }

  const extensions = item.extensions;
  if (!isRecord(extensions)) {
    return null;
  }

  const metadata = extensions['x-linkedSubform'];
  if (!isRecord(metadata)) {
    return null;
  }

  return metadata;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
