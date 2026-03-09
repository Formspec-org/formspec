/**
 * Configuration for the reference-app smoke test suite.
 * Playwright-free — plain TypeScript constants consumed by the .mjs scripts
 * at runtime via process.env overrides.
 */

export const REFERENCES_BASE_URL =
  process.env.REFERENCES_URL ?? 'http://localhost:8082';

/** Directory under which per-form screenshot subdirectories are created. */
export const SCREENSHOTS_ROOT = new URL('./screenshots', import.meta.url).pathname;
