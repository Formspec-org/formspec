# Plan: Document restructure — single ownership

**Status:** Proposed. Owner review pending.
**Scope:** 9 agent-instruction files → 7. One canonical home per concept; pointers, not restatement.
**Why:** Each fact in the agent-instruction layer has one right home. Today the economic model lives in 4+ places, wos-server architecture in 3, per-spec commitments in both VISION.md and submodule CLAUDE.md. Single ownership makes the read chain a graph the agent traverses, not a parallel-text the agent reconciles.

---

## Target state

```
.claude/user_profile.md    PERSON   owner model + behavioral interrupts (absorbs operating-mode.md)
CLAUDE.md                  REPO     layout, build, arch, testing, writing contract, submodule conventions
VISION.md                  STACK    Q1–Q4, composition, commitments, trust postures, cross-spec bindings,
                                     rejection list, open contracts, authoritative references
STACK.md                   EXTERNAL public-facing integrative doc (role unchanged)
trellis/CLAUDE.md          TRELLIS  deltas, heuristics, arch, build, spec contract
wos-spec/CLAUDE.md         WOS      identity/claims + genuine invention (absorbs POSITIONING.md),
                                     heuristics, arch, build, spec contract
wos-spec/CONVENTIONS.md    RUBRIC   three-section spec authoring rubric (unchanged)
```

**Eliminated:** `.claude/operating-mode.md`, `wos-spec/POSITIONING.md`

---

## Ownership contract

Every surviving file gets an ownership header: **Owns / Does not own / Update when.**

| Doc | Owns | Does not own |
|---|---|---|
| `user_profile.md` | Economic model, design prefs, communication style, behavioral interrupts, writing style, rejection preferences | Architecture, repo layout, spec content |
| `CLAUDE.md` | Repo layout, build/test, Formspec arch, package layering, testing philosophy, commit convention, submodule conventions, writing contract (semantic density), decision heuristics (Formspec-scope) | Economic model, stack-wide commitments |
| `VISION.md` | Q1–Q4, composition diagram, platform commitments, trust postures, cross-spec bindings, rejection list, open contracts, authoritative references | Per-spec operational detail, reference-architecture implementation, repo layout |
| `STACK.md` | Public framing, five contracts, proof packages, compliance mapping, positioning | Internal detail |
| `trellis/CLAUDE.md` | Trellis arch, spec contract, build/test, decision heuristics (Trellis-scope) | Stack-wide commitments |
| `wos-spec/CLAUDE.md` | WOS identity/claims, schema structure, arch, spec contract, build/test, decision heuristics (WOS-scope) | Stack-wide commitments |
| `wos-spec/CONVENTIONS.md` | Spec authoring rubric | Everything else |

No document restates what a document above it in the read chain owns.

---

## Delegation chain

```
Agent starts task
  │
  ▼
user_profile.md          "how the human wants things done"
  │
  ├─► CLAUDE.md          "where things live, how to build/test, Formspec rules"
  │     │
  │     └─► VISION.md    "what the stack is building toward" (cross-subsystem decisions)
  │           │
  │           └─► STACK.md   "what we tell the outside world" (external-facing only)
  │
  ├─► trellis/CLAUDE.md  "Trellis everything" (if working in trellis/)
  │
  └─► wos-spec/CLAUDE.md "WOS everything" (if working in wos-spec/)
        │
        └─► CONVENTIONS.md  "spec authoring rubric" (if authoring specs)
```

---

## Changes

### 1. Merge `operating-mode.md` into `user_profile.md`

Behavioral interrupts belong with the user model — they describe how the agent behaves around this user. Land as `§Behavioral interrupts` with a one-line preamble distinguishing genre: profile content describes the user; this section interrupts default agent behavior.

### 2. Merge `POSITIONING.md` into `wos-spec/CLAUDE.md`

Identity claims (A/B) and Genuine Invention belong in the same section as the spec's identity. Land both in `§Identity` with the one-line thesis. Update `wos-spec/README.md` to point at `CLAUDE.md§Identity`.

### 3. Collapse VISION.md §IX/X/XI to per-spec framing pointers

Settled per-spec commitments live in specs and ADRs; per-spec heuristics live in each `CLAUDE.md`. Restating them in VISION is the drift surface this plan targets.

Replace §IX/X/XI with one-paragraph framing per spec:

```
## Per-spec framing

- **Formspec** — see [`CLAUDE.md`](CLAUDE.md). Heuristics in §Decision heuristics + §Testing philosophy. Economic model: [`.claude/user_profile.md`](.claude/user_profile.md).
- **WOS** — see [`wos-spec/CLAUDE.md`](wos-spec/CLAUDE.md).
- **Trellis** — see [`trellis/CLAUDE.md`](trellis/CLAUDE.md).
```

Active-uncertainty bullets are decision-register material with no other home. Migrate first, then delete:

- §IX (standalone-reference scope; DocuSign surface in standalone Formspec) → platform decision register (`thoughts/specs/2026-04-22-platform-decisioning-forks-and-options.md`)
- §X (DocuSign 100% parity bar; multi-tenant model on Temporal/Restate; rendering service) → `wos-spec/TODO.md`
- §XI (anchor substrate; `custodyHook` contract; SCITT strictness; Federation Profile substance; AEAD nonce determinism; User-content Attestation primitive; tenant-scope export shape) → `trellis/TODO.md`

### 4. Move VISION.md §III reference-architecture to canonical homes

VISION.md §III restates content owned downstream. Move each block to its one home:

- Crate clusters → `wos-spec/crates/wos-server/VISION.md` (wos-server, canonical) + root `CLAUDE.md§Architecture` (formspec-server bullet list)
- Frontend surfaces → root `CLAUDE.md§Architecture`
- Adapter defaults table → `STACK.md§Composition at deploy time`
- API surface → owning project's reference architecture (`wos-spec/crates/wos-server/VISION.md` for WOS, root `CLAUDE.md` for Formspec)

VISION.md keeps the composition diagram, layer-roles table, cross-layer contracts list, and deployment configurations.

wos-server has one canonical home (`wos-spec/crates/wos-server/VISION.md`). Don't restate it in root CLAUDE.md.

### 5. Promote root CLAUDE.md to canonical home for Formspec heuristics and submodule conventions

**§Decision heuristics** — Formspec-scope heuristics from VISION.md §IX, placed by topic so each lives where it's used:

| Heuristic | Home |
|---|---|
| Placement-before-prohibition | root `CLAUDE.md§Decision heuristics` |
| Seam-repair reflex | root `CLAUDE.md§Decision heuristics` |
| Conformance is the portability bar | root `CLAUDE.md§Testing philosophy` (testing-scope rule) |
| User-value/debt tie-break | Drop — `user_profile.md` owns the economic model |

This mirrors the submodule pattern (`trellis/CLAUDE.md§Decision heuristics`, `wos-spec/CLAUDE.md§Decision heuristics`).

**§Submodule conventions** — separate commits, never `--amend`/`--force`/`--no-verify` without sanction, AI commits include `Co-Authored-By: Claude <noreply@anthropic.com>` footer, submodule edits ship with parent submodule-pointer bumps.

Submodule `CLAUDE.md` files keep one line preserving the load-bearing prohibitions for cold readers (someone landing on the submodule via GitHub):

> Commits separate from parent; never `--amend`/`--force`/`--no-verify` without sanction; AI commits include `Co-Authored-By: Claude <noreply@anthropic.com>` footer. Full convention: parent [`../CLAUDE.md`](../CLAUDE.md) §Submodule conventions.

### 6. Ownership headers

Each surviving file opens with:

```
<!--
Owns: [what this file is authoritative for]
Does not own: [what to find elsewhere]
Update when: [trigger]
-->
```

Reading-order guidance lives in each file's existing §Read first / §Operating Context / §Read this first section, not in this header.

### 7. Link census

Run `grep -nE "operating-mode\.md|POSITIONING\.md" $(git ls-files)` before commit. Update every match. Land as one commit.

---

## VISION.md after diet

Before: 669 lines, four jobs.
After: ~350 lines, one job.

| Section | Est. lines | Content |
|---|---|---|
| Header + status | ~6 | Unchanged |
| Read this first | ~15 | Unchanged |
| §I Operating frame | ~15 | Pointer to user_profile.md + stance consequences |
| §II Q1–Q4 | ~45 | Unchanged |
| §III Stack composition | ~60 | Diagram + layer roles + contracts list + product stack + deployment configs. No crate clusters, no frontend surfaces, no adapter defaults, no API surface. |
| §IV Deployment axes | ~35 | Unchanged |
| §V Platform commitments | ~60 | Unchanged |
| §VI Cross-spec bindings | ~50 | Unchanged |
| §VII Compliance constraints | ~25 | Unchanged |
| §VIII Rejection list | ~25 | Unchanged |
| §IX Per-spec framing | ~10 | One paragraph + pointer per spec (replaces §IX/X/XI) |
| §X Authoritative references | ~30 | Unchanged (renumbered from §XIII) |
| §XI What this is not | ~10 | Unchanged (renumbered from §XIV) |
| §XII Provenance | ~20 | Unchanged (renumbered from §XV) |

---

## Migration sequence

Single commit. Order:

1. Merge `operating-mode.md` → `user_profile.md§Behavioral interrupts`
2. Merge `POSITIONING.md` → `wos-spec/CLAUDE.md§Identity`
3. Migrate Active-uncertainty bullets to decision register / per-spec TODOs (per §3)
4. Add `§Decision heuristics` and `§Testing philosophy` bullets to root CLAUDE.md (Formspec heuristics by topic, per §5)
5. Add `§Submodule conventions` to root CLAUDE.md; submodule files keep 1-line stub + pointer
6. Move VISION.md §III reference-architecture to canonical homes (per §4)
7. Delete VISION.md §IX/X/XI; replace with per-spec framing paragraph
8. Add ownership headers to all 7 files
9. Run link census; update all pointers
10. Delete `operating-mode.md` and `POSITIONING.md`
11. `npm run docs:generate` then `npm run docs:check`
12. Bump submodule pointers in parent so submodule CLAUDE.md edits land in `trellis/` and `wos-spec/`
