/**
 * AUTO-GENERATED — DO NOT EDIT
 *
 * Generated from schemas/*.schema.json by scripts/generate-types.mjs.
 * Re-run: npm run types:generate
 */

/* eslint-disable */
import type { ValidationResult as FormspecValidationResult } from './validation-result.js';
export type { FormspecValidationResult };
/**
 * A Formspec Response document — a completed or in-progress Instance pinned to a specific Definition version (§2.1.6). A Response is the unit of data capture: the filled-in form. It references exactly one Definition by the immutable tuple (definitionUrl, definitionVersion). A conformant processor MUST reject a Response whose definitionVersion does not match any known Definition at the given definitionUrl. Responses are always validated against their pinned Definition version, even if a newer version exists (Response Pinning Rule VP-01). The tuple (definitionUrl, definitionVersion) combined with the Response 'id' uniquely identifies a single form submission across all systems.
 */
export interface FormResponse {
  /**
   * Response specification version. MUST be '1.0'.
   */
  $formspecResponse: '1.0';
  /**
   * The canonical URL of the Definition this Response was created against. This is the stable logical-form identifier shared across all versions of the same form. Combined with definitionVersion to form the immutable identity reference. MUST match the 'url' property of a known Definition.
   */
  definitionUrl: string;
  /**
   * The exact version of the Definition against which this Response was created. Interpretation of the version string is governed by the Definition's versionAlgorithm (default: semver). A Response is always validated against this specific version, never against a newer version — even if one exists (Pinning Rule VP-01). Once set, this value MUST NOT change for the lifetime of the Response.
   */
  definitionVersion: string;
  /**
   * The current lifecycle status of this Response. 'in-progress': actively being edited, MAY contain validation errors. 'completed': all error-severity validation results resolved, form submitted — a Response with one or more error-severity results MUST NOT be marked completed. 'amended': previously completed, reopened for modification. 'stopped': abandoned before completion, data preserved for audit. Saving data MUST never be blocked by validation status (VE-05) — only the transition to 'completed' requires zero error-level results.
   */
  status: 'in-progress' | 'completed' | 'amended' | 'stopped';
  /**
   * The primary Instance — the form data. Structure mirrors the Definition's item tree: field Items produce scalar properties, non-repeatable group Items produce nested objects, repeatable group Items produce arrays of objects, display Items have no representation. Non-relevant fields are handled per the Definition's nonRelevantBehavior setting: 'remove' (default) omits them entirely, 'empty' retains the key with null value, 'keep' retains the last value. Calculated fields (those with a 'calculate' Bind) are included with their computed values.
   */
  data: {
    [k: string]: unknown;
  };
  /**
   * When the Response was last modified (ISO 8601 date-time with timezone). Updated on every save, not just on status transitions. Used for conflict detection, audit trails, and ordering Responses chronologically.
   */
  authored: string;
  /**
   * A globally unique identifier for this Response (e.g., UUID v4). While optional in the schema, implementations SHOULD generate an id for every Response to support cross-system correlation, audit trails, amendment chains, and deduplication.
   */
  id?: string;
  /**
   * Identifier and display name of the person or system that authored the Response. For human authors, 'id' is typically a user account identifier; for automated systems, 'id' identifies the service or integration.
   */
  author?: {
    /**
     * Unique identifier of the author within the host system.
     */
    id: string;
    /**
     * Display name of the author. For human authors, typically their full name.
     */
    name?: string;
  };
  /**
   * The entity this Response is about — the grant, patient, project, or other domain object the form data describes. Distinct from 'author' (who filled in the form).
   */
  subject?: {
    /**
     * Unique identifier of the subject entity within the host system.
     */
    id: string;
    /**
     * The type of the subject entity. Implementations SHOULD use consistent type labels within a system.
     */
    type?: string;
  };
  /**
   * The most recent set of ValidationResult entries for this Response. Includes results from all sources: bind constraints, validation shapes, required checks, type checks, and external validation. Only error-severity results block the transition to 'completed' status. Warning and info results are advisory. Non-relevant fields MUST NOT produce results. When persisted alongside the Response, this array represents a snapshot — it may be stale if the data has changed since the last validation run.
   */
  validationResults?: FormspecValidationResult[];
  /**
   * Implementor-specific extension data. All keys MUST be prefixed with 'x-'. Processors MUST ignore unrecognized extensions and MUST preserve them during round-tripping. Extensions MUST NOT alter core semantics (validation, calculation, relevance, required state).
   */
  extensions?: {};
}
