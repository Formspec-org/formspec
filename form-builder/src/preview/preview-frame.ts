import { FormspecRender } from 'formspec-webcomponent';
import {
  createPreviewReadyMessage,
  isPreviewSyncMessage
} from '../components/preview/messages';

interface PreviewRendererElement extends HTMLElement {
  definition: unknown;
  componentDocument: unknown;
  themeDocument: unknown;
}

if (!customElements.get('formspec-render')) {
  customElements.define('formspec-render', FormspecRender);
}

const previewRoot = document.getElementById('preview-root');
if (!previewRoot) {
  throw new Error('Missing #preview-root container in preview frame');
}

const renderer = document.createElement('formspec-render') as PreviewRendererElement;
renderer.setAttribute('data-testid', 'preview-renderer');
previewRoot.appendChild(renderer);

window.addEventListener('message', (event) => {
  if (event.source !== window.parent) {
    return;
  }

  if (!isPreviewSyncMessage(event.data)) {
    return;
  }

  const { definition, component, theme } = event.data.payload;
  renderer.definition = definition;
  renderer.componentDocument = component;
  renderer.themeDocument = theme;
});

window.parent.postMessage(createPreviewReadyMessage(), '*');
