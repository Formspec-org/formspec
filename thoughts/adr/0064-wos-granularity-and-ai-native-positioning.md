# ADR 0064: WOS Granularity and AI-Native Positioning

**Status:** Accepted
**Date:** 2026-04-16
**Scope:** `wos-spec/` submodule
**Supersedes:** prior-reviewer recommendations to collapse schemas and demote the AI layer (see §7 of the handoff reference below)

## Context

An external architecture review of `wos-spec/` ([`architecture-review-handoff.md`](../../wos-spec/architecture-review-handoff.md), now archived) opened with two structural critiques and retracted both after maintainer pushback:

1. **"Collapse 18 schemas to 4."** The reviewer read the fine-grained schema split (kernel / companions / governance / ai / advanced / profiles / sidecars / assurance, 18 files total) as bloat.
2. **"Demote AI from normative to informative."** The reviewer read the 666-line AI Integration spec as scope creep from a governance standard.

Both were rejected. This ADR captures the reasoning so future reviewers (human or agent) do not re-litigate the same ground, and so the decisions are anchored to a written rationale rather than to conversational memory.

The handoff document itself covers the full review (both the retracted critiques and the remaining hygiene backlog). This ADR records only the architectural decisions validated by the exchange.

## Decision

The following four architectural properties of `wos-spec/` are accepted as load-bearing and MUST NOT be restructured without a superseding ADR.

### D-1. Fine-grained schemas are load-bearing for the development loop

The repository is organized around the loop:

```
spec → schema → lint → conformance → runtime → reference impl → spec iteration
```

Each of the 18 schemas is a cohesive lint surface paired with a fixture family. Collapsing them into 4 coarse files would erase the unit of lint precision: a rule like `K-023` can target a specific structural failure in `wos-kernel.schema.json` because the schema's scope matches the rule's scope. A 4-schema world forces cross-cutting rules that are harder to author, harder to debug, and harder to evolve independently.

The granularity is a feature of the methodology, not incidental overhead. Any future restructuring proposal must show how it preserves the one-rule-per-failure-mode property of the current split.

### D-2. AI Integration stays a first-class normative layer

The AI Integration spec (`specs/ai/*`) defines agents as first-class runtime actors via the kernel's `actorExtension` seam — autonomy levels, confidence gates, deontic constraints, drift monitoring. This is one of the two load-bearing claims behind WOS (see [POSITIONING.md](../../wos-spec/POSITIONING.md)): agents as runtime actors (Claim B). Demoting it to informative would undercut the pitch and the competitive differentiation against BPMN and SCXML, neither of which can retrofit the seam.

Layer 3 (advanced governance, equity, formal verification) remains appropriately labelled as research-grade optional — that disclosure is a feature of piecemeal adoption, not a reason to demote the AI layer beside it.

### D-3. Named sidecars carry semantic intent

`correspondence`, `policy`, and `assertion` sidecars are named rather than generic-attachment because the name itself is part of the contract. A generic `attachments[]` mechanism discards the epistemic type of the attachment (notice-of-adverse-action vs. policy citation vs. verifiable claim). Lint and conformance can apply different rules to each because the names are structural.

### D-4. Dual lifecycle/runtime companions stay split

`specs/companions/lifecycle-detail.md` covers design-time structure (states, transitions, guards, timer scoping, compensation topology). `specs/companions/runtime.md` covers instance dynamics (event queuing, durability, timer firing, host interfaces). The distinction mirrors a real conceptual seam that BPMN conflates and suffers for. Both stay normative. A newly-added **Normative Precedence** clause in each file (see §4.3 in the handoff) resolves any apparent conflict by giving each companion authority over its own half of the split.

## Consequences

**Positive:**

- Future reviewers have a written anchor for the "why 18 schemas, why AI normative" decisions. The answer is not "legacy" — it is "the methodology requires it."
- Plans and backlog items derived from the handoff (the §4 hygiene fixes and §5 LLM-authoring work) inherit this framing: they *extend* the granularity and AI-nativity, they do not attempt to roll it back.
- The Claim A / Claim B separation in [POSITIONING.md](../../wos-spec/POSITIONING.md) and [README.md](../../wos-spec/README.md) is consistent with D-2: Claim A (LLM-authored workflows) leverages the schema granularity D-1 mandates; Claim B (agent runtime actors) depends on the AI layer D-2 preserves.

**Negative:**

- The repository surface is legitimately larger than a minimal workflow standard. Onboarding material must compensate — `POSITIONING.md`, `WOS-FEATURE-MATRIX.md`, and layered READMEs remain important.
- Reviewers unfamiliar with the loop methodology will continue to pattern-match "this looks big." The `POSITIONING.md` + this ADR are the canonical counter-argument; cite them rather than re-arguing from first principles.

**Neutral:**

- DRAFTS (v2–v7 of the kernel) are iteration artifacts. They stay in `DRAFTS/` rather than being deleted — they are loop output, not dead code. A separate hygiene pass can relocate them to a `history/` directory with pointer ADRs, but their existence is correct.

## Alternatives Considered

1. **Collapse 18 schemas to 4 (kernel / governance / ai / advanced).** Rejected per D-1 — erases lint-surface precision that the loop depends on. Revisit only if rule coverage metrics (§4.2 in the handoff) show that rules cross schema boundaries routinely.
2. **Demote AI Integration to informative annex.** Rejected per D-2 — undercuts Claim B and the competitive differentiation.
3. **Merge lifecycle-detail and runtime into a single `execution-semantics.md`.** Held open as the heavier, cleaner alternative to the precedence clause (noted in §4.3 of the handoff). Not adopted now because the precedence clause is a one-paragraph fix that eliminates the latent defect; the merge is a week of work with no additional semantic gain. Revisit if COMP-001 lint rule surfaces drift in practice.

## References

- [architecture-review-handoff.md](../../wos-spec/architecture-review-handoff.md) — the review that prompted this ADR (to be archived after this ADR lands)
- [POSITIONING.md](../../wos-spec/POSITIONING.md) — Claim A / Claim B framing
- [README.md](../../wos-spec/README.md) — public-facing two-line pitch
- `wos-spec/LINT-MATRIX.md` — rule registry that benefits from D-1
- `wos-spec/specs/ai/` — the AI Integration layer preserved by D-2
- `wos-spec/specs/companions/{lifecycle-detail,runtime}.md` — the split preserved by D-4
