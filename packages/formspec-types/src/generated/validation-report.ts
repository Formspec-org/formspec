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
 * A standalone Validation Report aggregating all validation results for a Response at a point in time (§5.4). The report is the primary output of the Revalidate phase (§2.4 Phase 3) and is the sole input to conformance determination: valid = (zero error-severity results). Reports are produced by evaluating all Bind constraints, required checks, type checks, cardinality checks, and Validation Shapes against the current Instance data, then merging any external validation results injected by server-side systems. Non-relevant fields are guaranteed absent — the processor MUST suppress all validation for fields whose 'relevant' Bind evaluates to false (§5.6 rule 1). Reports MAY be persisted alongside the Response as a snapshot, but consumers SHOULD treat persisted reports as potentially stale if the Response data has changed since the timestamp. The three validation modes — continuous (evaluate on every change), deferred (evaluate on explicit request), disabled (skip entirely) — control when reports are generated but not their structure (§5.5).
 */
export interface ValidationReport {
  /**
   * Validation report specification version. MUST be '1.0'.
   */
  $formspecValidationReport: '1.0';
  /**
   * The canonical URL of the Definition that was validated against. Matches the Response's definitionUrl. Together with definitionVersion, identifies the exact Definition whose Binds, Shapes, and item tree governed this validation run. Enables consumers to retrieve the Definition for constraint introspection or re-validation.
   */
  definitionUrl?: string;
  /**
   * The version of the Definition that was validated against. A report is always produced against the Response's pinned version (Pinning Rule VP-01), never against a newer version. Version string interpretation depends on the Definition's versionAlgorithm (semver, date, integer, natural).
   */
  definitionVersion?: string;
  /**
   * true if and only if the results array contains zero entries with severity 'error'. This is the sole conformance indicator — warning and info results do NOT affect validity (deliberate divergence from SHACL, where any result indicates non-conformance). A Response with valid=false MUST NOT transition to 'completed' status. A Response with valid=true MAY have warning and info results and is still submittable. Invariant: valid = (counts.error === 0). Processors MUST ensure this invariant holds.
   */
  valid: boolean;
  /**
   * Complete ordered set of validation findings across all sources: Bind constraints, Bind required checks, type checks, repeatable group cardinality checks, Validation Shapes (including composed shapes), and external validation injections. Empty array means no findings of any severity — the Response is fully clean. Results for non-relevant fields are guaranteed absent. Each entry is a self-contained ValidationResult with path, severity, constraintKind, and human-readable message. Consumers can filter by severity, constraintKind, source, path prefix, or shapeId to build targeted error displays.
   */
  results: FormspecValidationResult[];
  /**
   * Pre-aggregated counts of results by severity level. Invariant: counts.error + counts.warning + counts.info = results.length. Invariant: valid = (counts.error === 0). Processors MUST ensure both invariants hold. Useful for summary badges, progress indicators, and report-level QA without iterating the full results array.
   */
  counts: {
    /**
     * Count of error-severity results. When > 0, valid MUST be false and the Response MUST NOT transition to 'completed'.
     */
    error: number;
    /**
     * Count of warning-severity results. Warnings flag suspect data but never block submission.
     */
    warning: number;
    /**
     * Count of info-severity results. Informational observations requiring no user action.
     */
    info: number;
  };
  /**
   * ISO 8601 date-time (with timezone) indicating when this validation run was performed. Used for staleness detection when a report is persisted alongside its Response — if the Response's 'authored' timestamp is later than this timestamp, the report may be stale. Also serves as an audit trail element and ordering key when multiple reports exist for the same Response.
   */
  timestamp: string;
  /**
   * Implementor-specific extension data on the report itself. All keys MUST be prefixed with 'x-'. Processors MUST ignore unrecognized extensions and MUST preserve them during round-tripping. Extensions MUST NOT alter the valid flag or core validation semantics. Common uses: workflow metadata, audit annotations, performance metrics.
   */
  extensions?: {};
}
