# ADR 0077: Canonical Kernel Extension Seams

**Status:** Implemented — all 5 decisions landed. Six canonical seams enumerated in Kernel §10 (`actorExtension`, `contractHook`, `provenanceLayer`, `lifecycleHook`, `custodyHook`, `extensions`/`x-`). Five invented seam names retired. CI lint gate (`check-canonical-seams.py`) wired into `.github/workflows/schema-regression.yml`. `wos-spec/TODO.md` confirms "fully implemented."
**Date:** 2026-04-24
**Scope:** WOS Kernel
**Related:** [`wos-spec/specs/kernel/spec.md`](../../wos-spec/specs/kernel/spec.md) §10; [`wos-spec/CLAUDE.md`](../../wos-spec/CLAUDE.md) Q3 heuristic; [`wos-spec/counter-proposal-disposition.md`](../../wos-spec/counter-proposal-disposition.md) rows FP-02, E1, E7, architectural-posture on `formRef`; [`wos-spec/thoughts/2026-04-24-standards-absorption-gap-analysis.md`](../../wos-spec/thoughts/2026-04-24-standards-absorption-gap-analysis.md) §Refactor Target; [`wos-spec/schemas/kernel/wos-kernel.schema.json`](../../wos-spec/schemas/kernel/wos-kernel.schema.json)

## Context

Three WOS working documents name the kernel extension seams with non-matching vocabularies. The named-seams invariant in `wos-spec/CLAUDE.md` (Q3: "Inventing new seams is a Q3 violation") requires one canonical enumeration; without it, disposition landings and absorption waves cannot tell whether a new extension point attaches to an existing seam or creates a new one.

The three sources:

| Source | Seam names used |
|---|---|
| `wos-spec/CLAUDE.md` "Six kernel seams are the only extension surface" | `actorExtension`, `attachmentExtension`, `caseFieldExtension`, `eventExtension`, `outcomeExtension`, `sidecarExtension` |
| `counter-proposal-disposition.md` (rows FP-02, architectural-posture, E7) | `contractHook`, `lifecycleHook` |
| `thoughts/2026-04-24-standards-absorption-gap-analysis.md` §Refactor Target | `lifecycleHook`, `contractHook`, `provenanceLayer` |

None of `CLAUDE.md`'s six appears in Kernel §10 prose or in `wos-kernel.schema.json`. The disposition and gap-analysis names do appear in Kernel §10 — but the count and exact set diverge across all three documents.

The kernel spec's own introductory abstract compounds the confusion: `specs/kernel/spec.md` §Abstract says "five named extension seams," and the schema `description` (line 5) likewise says "five"; Kernel §10 intro then says "six extension seams" and enumerates §10.1 through §10.6. The enumeration wins — §10 is normative, the abstract is prefatory prose.

## Decision

### D-1. Kernel §10 is authoritative

The canonical seam list is what `specs/kernel/spec.md` §10 enumerates. Six subsections, six named seams. Every other WOS document aligns to this enumeration.

### D-2. Canonical enumeration

| # | Seam | Kernel § | Purpose (one line) |
|---|---|---|---|
| 1 | `actorExtension` | §10.1 | Register additional actor types beyond kernel `human` / `system`. Layer 2 uses this to register `agent`. |
| 2 | `contractHook` | §10.2 | Inject data-validation bindings. Formspec is the recommended binding; JSON Schema is baseline. Layer 1 attaches validation pipelines; Layer 2 uses Formspec-as-validator here. |
| 3 | `provenanceLayer` | §10.3 | Inject audit tiers above kernel Facts. Layer 1 adds Reasoning and Counterfactual; Layer 2 adds Narrative. |
| 4 | `lifecycleHook` | §10.4 | Primary governance attachment. Governance documents match on semantic transition tags; transition-specific overrides permitted. |
| 5 | `custodyHook` | §10.5 | Declare custody posture. Monolithic binding declares a single posture; Trellis binds a full Trust Profile. |
| 6 | `extensions` and `x-` keys | §10.6 | Vendor/implementation escape hatch. Two equivalent mechanisms: `extensions` container of `x-`-prefixed keys, and sibling `x-<namespace>-<name>` keys on any object. `x-wos-` reserved. |

Seams 1–5 are content-attachment surfaces; seam 6 is the vendor escape hatch. The enumeration is six. Drop the "five vs. six" drift in the kernel abstract and schema description in a follow-up editorial pass; this ADR does not edit those surfaces.

### D-3. Disposition of disputed names

| Disputed name | Where it appears | Classification |
|---|---|---|
| `contractHook` | Disposition FP-02, architectural-posture (`formRef`); gap-analysis §Refactor Target item 2 | **Canonical.** Kernel §10.2. The disposition and gap analysis are correct; `CLAUDE.md` was wrong to omit it. |
| `lifecycleHook` | Disposition E7; gap-analysis §Refactor Target item 1 | **Canonical.** Kernel §10.4. Same correction. |
| `provenanceLayer` | Gap-analysis §Refactor Target items 2 and 3 | **Canonical.** Kernel §10.3. Same correction. |
| `custodyHook` | Kernel §10.5 and schema top-level property | **Canonical.** Not named by `CLAUDE.md`, the disposition, or the gap analysis, but present as a normative kernel surface and a schema field. |
| `attachmentExtension` | `CLAUDE.md` only | **Invented.** Not in kernel spec or schema. Delete from `CLAUDE.md`. |
| `caseFieldExtension` | `CLAUDE.md` only; disposition row E9 cites it | **Invented as a seam name.** Not in Kernel §10. Case-state field extensibility is an `x-` extensions usage inside the `CaseFile` / `MutationRecord` shapes (§5, §10.6), not a distinct named seam. Disposition E9 HELD disposition stands on its behavior, but the name does not earn a §10 slot. Delete from the seam list. |
| `eventExtension` | `CLAUDE.md` only | **Invented.** Event extensibility today is the `TransitionEvent` discriminant plus `x-` extensions (§4.5, §10.6). No §10 seam by this name. Delete. |
| `outcomeExtension` | `CLAUDE.md` only | **Invented.** `outcomeCode` on final states (§4.3) and the `outcome` open enum on provenance records (§8.2.2) are existing surfaces with their own extension discipline (`x-` prefix). No §10 seam by this name. Delete. |
| `sidecarExtension` | `CLAUDE.md` only | **Invented.** Sidecars are companion documents (Business Calendar, Due Process Config, Agent Config, etc.); they are not attached through a named §10 seam. Delete. |

The `CLAUDE.md` six-seam list was a freestanding fiction. It does not correspond to earlier Kernel §10 drafts in git history, to any schema field, or to any cited section elsewhere in the spec suite.

### D-4. Schema conformance

Two seams appear as top-level schema properties in `wos-kernel.schema.json`:

- `custodyHook` — object, `additionalProperties: true` (§10.5 leaves concrete shape to the binding);
- `extensions` — via `$ref: "#/$defs/ExtensionsMap"` which enforces the `^x-` key prefix via `propertyNames: {"pattern": "^x-"}` (§10.6).

The other four canonical seams (`actorExtension`, `contractHook`, `provenanceLayer`, `lifecycleHook`) are **structural seams, not top-level schema fields**. They are realized through already-present schema mechanisms:

| Seam | Schema realization |
|---|---|
| `actorExtension` | Kernel schema declares `ActorDeclaration.type` as a closed enum `["human", "system"]`. Openness is **architectural, not kernel-schema-local**: higher-layer schemas (AI Integration `wos-ai-integration.schema.json`) extend the set by introducing their own actor type (`agent`). Vendor actor types ride on `x-` keys, not on the kernel enum. |
| `contractHook` | `ContractReference` / `contractRef` on tasks and actions, plus kernel-processor binding resolution. |
| `provenanceLayer` | `auditLayer` field on the provenance-record envelope (`wos-provenance-record.schema.json`); kernel emits `facts`, higher layers emit `reasoning` / `counterfactual` / `narrative` through the same envelope. |
| `lifecycleHook` | `tags` arrays on `State` and `Transition`; governance schemas attach rules keyed on tag or transition id. |

No schema gap. The schema matches Kernel §10 once the distinction between "top-level property seam" and "structural attachment seam" is understood. Future schema documentation SHOULD surface this mapping in a table so readers do not expect four missing top-level fields.

### D-5. Landing of corrections

This ADR lands two edits in-session:

1. `wos-spec/CLAUDE.md` "Six kernel seams are the only extension surface: ..." line — replaced with the Kernel §10 enumeration. Count stays six; names change.

Two edits are flagged for separate follow-up passes, **not** touched by this ADR:

2. `counter-proposal-disposition.md` rows that continue to use the stale `CLAUDE.md` names or that flag the drift as unresolved:
   - §Seam vocabulary drift section (the whole section becomes obsolete — delete or replace with a single line referencing this ADR);
   - Row **E1** ("Custom node types"): the phrase "Kernel §10.1–§10.6" is correct in spirit but needs the name list attached, and the "Kernel intro prose may still say 'five'" caveat stays until the editorial pass lands;
   - Row **E9** ("Field type extensions"): "`caseFieldExtension` seam" reference is wrong — case-field extensibility uses `x-` extensions, not a named §10 seam. Rewrite as "kernel §10.6 `x-` extensions on case-file fields."
   - Row **FP-02** and architectural-posture row ("`formRef` names Formspec as case data model"): the `contractHook` citation is **correct** — retain.
   - Row **E7** ("Execution hooks"): the `lifecycleHook` citation is **correct** — retain.

3. `thoughts/2026-04-24-standards-absorption-gap-analysis.md` §Refactor Target: `contractHook`, `provenanceLayer`, and `lifecycleHook` citations are all **correct**. No edits required; flag only for confirmation when the gap analysis is next revised.

4. Kernel spec abstract + schema description: "five named extension seams" → "six named extension seams." Folded into ADR 0076's workflow-consolidation pass — lands on the same branch.

## Consequences

**Positive.**

- One canonical list. The Q3 named-seams invariant becomes checkable: any new spec prose that names a seam outside the six-item list is a violation.
- Absorption waves (disposition Waves 1–5) can unambiguously say which seam a new extension point attaches to. `outputBindings` / `eventContract` / `taskActions` all land at `contractHook` + `provenanceLayer`; `retryPolicy` on `invokeService` is inside kernel actions and extends nothing; `escalationLevels` extends Governance §10 without a new kernel seam.
- A lint rule becomes writable: reject WOS spec prose that names a seam identifier not in the canonical six. (Candidate lint target — not this ADR's scope to implement.)

**Negative.**

- `CLAUDE.md` loses four names it previously advertised. Anyone who internalized those names must re-learn the canonical list. Mitigation: the seam count stays six, so the one-liner shape is unchanged.
- The "five vs. six" drift in the kernel abstract and schema description persists until the next editorial revision of those surfaces. Not blocking; flagged here.

**Neutral.**

- Sidecars, attachments, case fields, events, and outcomes still have extension stories — via `x-` keys (§10.6) and their respective schema shapes — they just aren't named §10 seams.
- Schema does not grow four new top-level properties. The two that exist (`custodyHook`, `extensions`) are the right two.

## Lint rule candidate

A future lint rule SHOULD reject any WOS specification prose or schema comment that names a seam identifier other than one of the canonical six: `actorExtension`, `contractHook`, `provenanceLayer`, `lifecycleHook`, `custodyHook`, or `extensions`. Scope: markdown files under `wos-spec/specs/**` and `$comment` / `description` text in `wos-spec/schemas/**`. Implementation is out of scope for this ADR; capture as a WOS-lint backlog entry.
