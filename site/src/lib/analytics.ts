/** @filedesc Firebase Analytics singleton — lazy init + event tracking with global click delegation. */
import { getFirebasePublicConfig } from "./firebase-public-config";
import type { Analytics } from "firebase/analytics";

let analytics: Analytics | null = null;
let _logEvent: ((a: Analytics, name: string, params?: Record<string, unknown>) => void) | null = null;
let initPromise: Promise<void> | null = null;

/** Lazily initialise Firebase Analytics. No-ops when env vars are missing or browser unsupported. */
export function initAnalytics(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const config = getFirebasePublicConfig();
    if (!config) return;
    const { initializeApp } = await import("firebase/app");
    const mod = await import("firebase/analytics");
    if (!(await mod.isSupported())) return;
    const app = initializeApp(config);
    analytics = mod.getAnalytics(app);
    _logEvent = mod.logEvent;
  })();
  return initPromise;
}

/** Fire a GA4 custom event. Silently no-ops if analytics is not initialised. */
export function track(eventName: string, params?: Record<string, unknown>): void {
  if (analytics && _logEvent) _logEvent(analytics, eventName, params);
}
