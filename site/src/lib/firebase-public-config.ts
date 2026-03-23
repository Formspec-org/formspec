/** @filedesc Builds Firebase web config from Astro public env when all required keys are set. */
import type { FirebaseOptions } from "firebase/app";

const KEYS = [
  "PUBLIC_FIREBASE_API_KEY",
  "PUBLIC_FIREBASE_AUTH_DOMAIN",
  "PUBLIC_FIREBASE_PROJECT_ID",
  "PUBLIC_FIREBASE_STORAGE_BUCKET",
  "PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "PUBLIC_FIREBASE_APP_ID",
  "PUBLIC_FIREBASE_MEASUREMENT_ID",
] as const;

/**
 * Returns Firebase client config for Analytics when every `PUBLIC_FIREBASE_*` value is non-empty.
 * Otherwise returns `null` so the site ships without analytics in local/dev builds.
 */
export function getFirebasePublicConfig(): FirebaseOptions | null {
  const env = import.meta.env;
  const values: Record<(typeof KEYS)[number], string | undefined> = {
    PUBLIC_FIREBASE_API_KEY: env.PUBLIC_FIREBASE_API_KEY,
    PUBLIC_FIREBASE_AUTH_DOMAIN: env.PUBLIC_FIREBASE_AUTH_DOMAIN,
    PUBLIC_FIREBASE_PROJECT_ID: env.PUBLIC_FIREBASE_PROJECT_ID,
    PUBLIC_FIREBASE_STORAGE_BUCKET: env.PUBLIC_FIREBASE_STORAGE_BUCKET,
    PUBLIC_FIREBASE_MESSAGING_SENDER_ID: env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    PUBLIC_FIREBASE_APP_ID: env.PUBLIC_FIREBASE_APP_ID,
    PUBLIC_FIREBASE_MEASUREMENT_ID: env.PUBLIC_FIREBASE_MEASUREMENT_ID,
  };
  for (const key of KEYS) {
    const v = values[key];
    if (typeof v !== "string" || v.trim() === "") return null;
  }
  return {
    apiKey: values.PUBLIC_FIREBASE_API_KEY!,
    authDomain: values.PUBLIC_FIREBASE_AUTH_DOMAIN!,
    projectId: values.PUBLIC_FIREBASE_PROJECT_ID!,
    storageBucket: values.PUBLIC_FIREBASE_STORAGE_BUCKET!,
    messagingSenderId: values.PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
    appId: values.PUBLIC_FIREBASE_APP_ID!,
    measurementId: values.PUBLIC_FIREBASE_MEASUREMENT_ID!,
  };
}
