/** @filedesc Entry point for the Studio app; registers the formspec-render custom element and mounts App. */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initFormspecEngine, initFormspecEngineTools } from '@formspec-org/engine';
import '@formspec-org/webcomponent/formspec-default.css';
import { FormspecRender } from '@formspec-org/webcomponent';
import { App } from './App';
import {
  CANONICAL_PROVIDER_CONFIG_KEY,
  migrateLegacyProviderConfigKeys,
} from './lib/provider-config-storage';
import './index.css';

if (!customElements.get('formspec-render')) {
  customElements.define('formspec-render', FormspecRender);
}

async function bootstrap(): Promise<void> {
  migrateLegacyProviderConfigKeys();
  const devKey = import.meta.env.VITE_GEMINI_DEV_KEY;
  if (devKey && !localStorage.getItem(CANONICAL_PROVIDER_CONFIG_KEY)) {
    localStorage.setItem(
      CANONICAL_PROVIDER_CONFIG_KEY,
      JSON.stringify({ provider: 'google', apiKey: devKey }),
    );
  }
  await initFormspecEngine();
  await initFormspecEngineTools();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

void bootstrap();
