/** @filedesc Entry point for the Studio app; registers the formspec-render custom element and mounts App. */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initFormspecEngine } from 'formspec-engine';
import 'formspec-webcomponent/formspec-default.css';
import { FormspecRender } from 'formspec-webcomponent';
import { App } from './App';
import './index.css';

if (!customElements.get('formspec-render')) {
  customElements.define('formspec-render', FormspecRender);
}

async function bootstrap(): Promise<void> {
  await initFormspecEngine();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

void bootstrap();
