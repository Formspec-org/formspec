import { useState, useEffect } from 'react';
import { StudioApp } from './studio-app/StudioApp';
import { SplashScreen } from './components/SplashScreen';
import { initFormspecEngine, initFormspecEngineTools } from '@formspec-org/engine';
import { CANONICAL_PROVIDER_CONFIG_KEY } from './lib/provider-config-storage';

export function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function init() {
      const devKey = import.meta.env.VITE_GEMINI_DEV_KEY;
      if (devKey && !localStorage.getItem(CANONICAL_PROVIDER_CONFIG_KEY)) {
        localStorage.setItem(
          CANONICAL_PROVIDER_CONFIG_KEY,
          JSON.stringify({ provider: 'google', apiKey: devKey }),
        );
      }
      await initFormspecEngine();
      await initFormspecEngineTools();
      setReady(true);
    }
    void init();
  }, []);

  if (!ready) {
    return <SplashScreen />;
  }

  return <StudioApp />;
}
