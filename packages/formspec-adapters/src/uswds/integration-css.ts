/** @filedesc USWDS integration CSS — GENERATED, DO NOT EDIT. Regenerate with `npm run build:css && npm run build:integration-css`. */

// Generated from src/uswds/uswds-formspec.scss — see ADR 0048.
// This file is overwritten by scripts/generate-integration-css.mjs.
//
// BOOTSTRAP FALLBACK: The content below is a hand-written subset that ships
// until the first Sass build runs. Once `npm run prebuild` executes, this
// file is replaced with the full compiled USWDS output. The fallback covers
// the same overrides as before (ADR 0047) so tests pass without Sass.
export const integrationCSS = `\
/* USWDS integration overrides for formspec layout primitives */

.formspec-grid .usa-form-group,
.formspec-stack .usa-form-group { margin-top: 0; }

.formspec-grid .usa-input,
.formspec-grid .usa-textarea,
.formspec-grid .usa-select { max-width: 100%; }

.formspec-container .usa-fieldset { border: 0; padding: 0; margin: 0; }
.formspec-container .usa-label { margin-top: 0; }
.formspec-container .usa-hint { margin-top: 0; }

.formspec-wizard .usa-step-indicator__heading { font-size: 1rem; }
.formspec-wizard .usa-step-indicator__current-step {
  width: 2rem; height: 2rem; padding: 0;
  font-size: 0.875rem; line-height: 2rem;
}
.formspec-wizard .usa-step-indicator__heading-text { font-weight: 600; }
`;
