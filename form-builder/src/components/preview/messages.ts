import type { FormspecDefinition } from 'formspec-engine';
import type { FormspecComponentDocument, FormspecThemeDocument } from '../../state/project';

export const PREVIEW_MESSAGE_CHANNEL = 'formspec-studio.preview.v1';

export interface PreviewArtifacts {
  definition: FormspecDefinition;
  component: FormspecComponentDocument;
  theme: FormspecThemeDocument;
}

export interface PreviewSyncMessage {
  channel: typeof PREVIEW_MESSAGE_CHANNEL;
  type: 'sync';
  payload: PreviewArtifacts;
}

export interface PreviewReadyMessage {
  channel: typeof PREVIEW_MESSAGE_CHANNEL;
  type: 'ready';
}

export function createPreviewSyncMessage(payload: PreviewArtifacts): PreviewSyncMessage {
  return {
    channel: PREVIEW_MESSAGE_CHANNEL,
    type: 'sync',
    payload
  };
}

export function createPreviewReadyMessage(): PreviewReadyMessage {
  return {
    channel: PREVIEW_MESSAGE_CHANNEL,
    type: 'ready'
  };
}

export function isPreviewReadyMessage(value: unknown): value is PreviewReadyMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<PreviewReadyMessage>;
  return candidate.channel === PREVIEW_MESSAGE_CHANNEL && candidate.type === 'ready';
}

export function isPreviewSyncMessage(value: unknown): value is PreviewSyncMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<PreviewSyncMessage>;
  return candidate.channel === PREVIEW_MESSAGE_CHANNEL && candidate.type === 'sync' && !!candidate.payload;
}
