/**
 * AUTO-GENERATED — DO NOT EDIT
 *
 * Generated from schemas/*.schema.json by scripts/generate-types.mjs.
 * Re-run: npm run types:generate
 */

/* eslint-disable */
/**
 * A Formspec Determination Record — the structured output artifact produced by evaluating a Screener Document against respondent inputs. A Determination Record captures the complete evaluation outcome: which routes matched, which were eliminated and why, computed scores, the respondent's input values with answer states, and evaluation metadata. The record references the specific screener version that produced it via the (screener.url, screener.version) tuple. Determination Records are immutable once produced; status may transition from 'completed' to 'expired' when the screener's resultValidity duration elapses, but the evaluation data itself is never modified. Status 'unavailable' indicates the screener was outside its availability window and no evaluation was performed.
 */
export interface DeterminationRecord {
  /**
   * Determination Record specification version. MUST be '1.0'.
   */
  $formspecDetermination: '1.0';
  /**
   * Reference to the Screener Document that produced this record. The (url, version) tuple uniquely identifies the screener revision whose evaluation logic was applied.
   */
  screener: {
    /**
     * Canonical URI of the screener that produced this record.
     */
    url: string;
    /**
     * Semantic version of the screener that produced this record.
     */
    version: string;
  };
  /**
   * ISO 8601 date-time when the evaluation completed.
   */
  timestamp: string;
  /**
   * The version of the Screener Document's evaluation logic that was applied. Reflects the evaluationBinding policy: if 'submission', this is the screener version at session start; if 'completion', the version at evaluation time.
   */
  evaluationVersion: string;
  /**
   * 'completed': all items answered and evaluation finished. 'partial': not all items answered; evaluation ran on available data. 'expired': result validity duration exceeded post-evaluation. 'unavailable': screener was outside its availability window, no evaluation performed.
   */
  status: 'completed' | 'partial' | 'expired' | 'unavailable';
  /**
   * Results of override route evaluation. Override routes are hoisted out of their declaring phase and evaluated before all phases.
   */
  overrides: {
    /**
     * Override routes that fired. Empty array when no overrides matched.
     */
    matched: RouteResult[];
    /**
     * true if a terminal override halted the pipeline. When true, the phases array is empty because no phases were evaluated.
     */
    halted: boolean;
  };
  /**
   * Per-phase evaluation results in declaration order. Empty array if overrides halted the pipeline.
   */
  phases: PhaseResult[];
  /**
   * Map of item path to { value, state } for every screener item. Keys use Formspec path syntax including indexed repeat paths (e.g., 'group[0].field').
   */
  inputs: {
    [k: string]: InputEntry;
  };
  /**
   * Expiration metadata derived from the screener's resultValidity duration. Omitted when the screener does not declare resultValidity.
   */
  validity?: {
    /**
     * When this Determination Record expires. Computed as timestamp + resultValidity.
     */
    validUntil?: string;
    /**
     * The original ISO 8601 duration from the Screener Document.
     */
    resultValidity?: string;
  };
  /**
   * Extension data on the Determination Record. Uses the same x-prefixed extension mechanism as other Formspec documents.
   */
  extensions?: {};
}
/**
 * A single route's evaluation outcome within a phase or override block. Present in both 'matched' and 'eliminated' arrays. Eliminated results include a reason explaining why the route did not match.
 *
 * This interface was referenced by `DeterminationRecord`'s JSON-Schema
 * via the `definition` "RouteResult".
 */
export interface RouteResult {
  /**
   * The route's target URI. Matches the 'target' property of the corresponding Route in the Screener Document.
   */
  target: string;
  /**
   * The route's human-readable label, copied from the Screener Document.
   */
  label?: string;
  /**
   * The route's respondent-facing message. Preserved so consuming applications can display it without re-reading the Screener Document. If the Screener Route contained {{expression}} interpolation sequences, the message is the post-interpolation result.
   */
  message?: string;
  /**
   * The computed score for score-threshold routes. Present only when the route was evaluated under a 'score-threshold' strategy.
   */
  score?: number;
  /**
   * Why the route was eliminated: 'condition-false', 'below-threshold', 'max-exceeded', 'null-score'. Present only in the 'eliminated' array. 'null-score' indicates the score expression evaluated to null (e.g., due to non-relevant items).
   */
  reason?: string;
  /**
   * The route's arbitrary metadata, copied from the Screener Document without interpretation.
   */
  metadata?: {
    [k: string]: unknown;
  };
}
/**
 * Evaluation result for a single phase in the pipeline. Captures the phase's status, strategy, matched and eliminated routes, and any phase-level warnings.
 *
 * This interface was referenced by `DeterminationRecord`'s JSON-Schema
 * via the `definition` "PhaseResult".
 */
export interface PhaseResult {
  /**
   * Phase identifier, matching the 'id' of the corresponding Phase in the Screener Document.
   */
  id: string;
  /**
   * 'evaluated': phase ran normally. 'skipped': phase's activeWhen expression evaluated to false. 'unsupported-strategy': processor does not support this phase's strategy (Core conformance only requires 'first-match').
   */
  status: 'evaluated' | 'skipped' | 'unsupported-strategy';
  /**
   * The evaluation strategy that was used (or would have been used if skipped/unsupported).
   */
  strategy: string;
  /**
   * Routes that matched in this phase.
   */
  matched: RouteResult[];
  /**
   * Routes that did not match in this phase, with reasons for elimination.
   */
  eliminated: RouteResult[];
  /**
   * Phase-level warnings emitted during evaluation (e.g., 'below-minimum' when fan-out matches fewer than config.minMatches).
   */
  warnings?: string[];
}
/**
 * A single screener item's captured value and answer state at evaluation time. The key in the inputs map is the item's Formspec path, which may include indexed repeat paths (e.g., 'group[0].field') for items inside repeatable groups.
 *
 * This interface was referenced by `DeterminationRecord`'s JSON-Schema
 * via the `definition` "InputEntry".
 */
export interface InputEntry {
  /**
   * The item's value at evaluation time. May be any JSON type (string, number, boolean, array, object, null). null when state is 'declined' or 'not-presented'.
   */
  value?: {
    [k: string]: unknown;
  };
  /**
   * 'answered': respondent provided a value. 'declined': item was presented but respondent explicitly declined to answer. 'not-presented': item was not shown to the respondent (e.g., relevance was false).
   */
  state: 'answered' | 'declined' | 'not-presented';
}
