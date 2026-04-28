# ADR 0087: AI Mutation Provenance Surface

**Status:** Proposed
**Date:** 2026-04-28
**Scope:** Studio chat-side authoring — pre-accept review of AI-proposed changesets that mutate non-visible structure
**Related:** [`thoughts/studio/2026-04-26-studio-unified-feature-matrix.md`](../studio/2026-04-26-studio-unified-feature-matrix.md) §M2 — direct predecessor; ships the `FieldProvenance` struct this ADR's surface renders; [ADR 0074 (formspec-native field-level transparency)](./0074-formspec-native-field-level-transparency.md) — establishes per-field provenance as a primitive (background motivation); [ADR 0080 (governed output-commit pipeline)](./0080-governed-output-commit-pipeline.md) — accepted Studio mutations flow into this WOS pipeline post-accept (downstream seam); [ADR 0081 (content-addressed artifact identity)](./0081-content-addressed-artifact-identity.md); [ADR 0082 (lift ChatSession)](./0082-lift-chat-session-above-studio.md) — sibling; [`thoughts/studio/2026-04-28-prd-chatgpt-forms-ide.md`](../studio/2026-04-28-prd-chatgpt-forms-ide.md) — source PRD has no trust-model section; this ADR fills the gap every audit agent flagged; [`packages/formspec-studio-core/src/studio-intelligence.ts:10`](../../packages/formspec-studio-core/src/studio-intelligence.ts) — `FieldProvenance`; [`packages/formspec-studio/src/components/chat/ChangesetReviewSection.tsx`](../../packages/formspec-studio/src/components/chat/ChangesetReviewSection.tsx) — host component

## Context

ADR 0074 establishes per-field provenance — origin, rationale, confidence, source refs — as a first-class primitive. M2 (patch + provenance spine, per `2026-04-26-studio-unified-feature-matrix.md` §M2) landed the writer plumbing: `FieldProvenance` is persisted at `packages/formspec-studio-core/src/studio-intelligence.ts:10` and threaded through AI accept/reject flows in `studio-intelligence-writer.ts`.

The chat-side accept gate is `ChangesetReviewSection` (`packages/formspec-studio/src/components/chat/ChangesetReviewSection.tsx:21`). Its inline preview covers visible field changes — labels, hint text, choice labels, ordering — but is silent on **non-visible structural mutation**: a `bind.calculate` swap, a new shape rule, a new `Variable`, a `Mapping` change, an `OptionSet` content edit. These redefine what the form means without showing in the rendered preview.

The PRD (`2026-04-28-prd-chatgpt-forms-ide.md`) has no trust-model section. Every audit pass flagged the same failure mode: AI silently mutates structure invisible in the rendered form, user clicks accept, regrets later. For non-technical authors — this surface's whole point — that is a liability.

The fix is not a new primitive. `FieldProvenance` already carries origin + rationale + sourceRefs. The fix is a surface contract: when a changeset mutates the closed list below, render an explicit provenance panel as part of the accept gate, sourced from `FieldProvenance`, gated against banner-blindness.

## Decision

### D-1. Closed mutation-class list that triggers the surface

The provenance panel renders when, and only when, a proposed changeset includes:

- `bind` — `required`, `constraint`, `readonly`, `calculate` (the field-level FEL expression bindings)
- `shape` — cross-field validation rules
- `Variable` — add / edit / remove (a top-level computed value distinct from any field's `bind.calculate`)
- `Mapping` — add / edit / remove
- `OptionSet` — content change (not a reference swap to an existing set)

Field renames, hint-text edits, choice-label edits, and visible-property changes are *not* in this list — the inline preview in `ChangesetReviewSection` already covers them. Closed list; no extension without an ADR amendment.

### D-2. Surface contract

When a changeset matches D-1, `ChangesetReviewSection` MUST render a sibling "What changes behind the scenes" panel adjacent to the inline preview. Per affected entry, sourced from the corresponding `FieldProvenance` record:

- Field path (canonical `objectRef`).
- Mutation class from D-1.
- Before/after summary in user-facing language ("This field will recalculate when *X* changes", not raw FEL).
- One-line AI-authored rationale (the existing `FieldProvenance.rationale` field).

The panel cannot be auto-collapsed — it is part of the accept gate, not disclosure-on-demand.

### D-3. Accept-gate behavior

The `Accept this proposal` action — the per-group accept button corresponding to `onAcceptGroup` — does not commit until the provenance panel has scrolled into view at least once OR has been explicitly dismissed by the user. `Accept all` (`onAcceptAll`) is reserved for explicit queue drains and is not the affordance gated here. The scroll-or-dismiss requirement prevents banner-blindness.

### D-4. Telemetry

Emit per accept of a D-1-matching changeset:

- `studio_provenance_panel_viewed` — panel scrolled into view at least once before accept.
- `studio_provenance_panel_dismissed_unread` — accept proceeded via explicit dismissal without view.

The dismissed-unread rate is the failure signal: users accepting non-visible mutations without engaging the explanation means the surface has stopped working. See kill criteria.

### D-5. Out of scope

Localization of rationale text. Provenance UI inside the IDE-mode field inspector. AI-side prompt changes to *generate* better rationales (orthogonal — the surface contract holds regardless). In scope: the surface contract, the closed mutation-class list, the accept-gate.

## Consequences

- Closes the load-bearing trust gap every audit agent identified. Silent slip is no longer the path of least resistance — the user must look at the panel or dismiss it.
- Builds on existing `FieldProvenance` (ADR 0074 + M2 spine). No new spec primitive, no new persistence layer; the surface is render-time over data already on disk.
- Modest UI cost in `ChangesetReviewSection` — a sibling panel, not a redesign.
- Measurable safety surface: dismissed-unread rate is a continuous check on whether the panel still works, not a launch metric.
- Pins what `Accept all` is *not* — a queue-drain power tool, distinct from per-proposal gating — so the distinction cannot drift.

## Kill criteria

- If `studio_provenance_panel_dismissed_unread` exceeds 60% of accepts in production, the panel is theatre — users are clicking past it. Redesign the affordance, do not remove it.
- If the closed mutation-class list (D-1) admits a class that turns out to be uninteresting to users (high false-positive rate, friction without value), narrow the list. Do not remove a class that maps to a known surprise vector.
- If the panel is ever made auto-dismissible in service of feel-good UX metrics, the ADR is dead — re-open before shipping that change.
