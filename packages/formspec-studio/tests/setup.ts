/** @filedesc Vitest global setup for formspec-studio: jest-dom matchers, cleanup, and module mocks. */
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

vi.mock('../src/workspaces/preview/formspec-base-css-url', () => ({
  formspecBaseCssHref: '',
}));

afterEach(() => {
  cleanup();
});
