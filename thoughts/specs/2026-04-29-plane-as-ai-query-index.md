# Plane as AI-queryable index over markdown content

**Status:** Design draft. Awaiting owner review.
**Owner:** Michael Deeb. Solo maintainer.
**Audience:** AI agents (primary consumer); owner inspects "once in a while."
**Supersedes:** Operational coordination layer currently spread across 10 markdown TODO/PLANNING files.
**Folds in:** [`thoughts/plans/2026-04-28-doc-restructure.md`](../plans/2026-04-28-doc-restructure.md) — the 9→7 doc-restructure plan continues as a sub-feature of this larger restructure (agent-instruction layer consolidation lands in the same migration).

## Why

Three surfaces compete today for "where work lives":

1. **ADRs** (`thoughts/adr/`) — architectural decisions.
2. **Plans** (`thoughts/plans/`) — implementation roadmaps.
3. **TODO / PLANNING markdown** (10 files, ~3,025 lines) — atomic rows + status + scoring + cluster narratives.

The third duplicates the first two. PLN-0314's body prose competes with ADR-0076's prose. PLANNING.md cluster narratives duplicate entry-point ADRs. Cross-cutting AI queries ("top P0 in `wos-server` with no open blockers", "everything blocked by ADR 0069", "all sub-tasks under `workflow-consolidation`") require regex-on-prose across multiple files.

Plane is a self-hosted graph database with REST API, modules, parent-child hierarchy, labels, relations — and the `plane` skill (55+ ops) already wires AI to it. Move operational backlog there. Kill the 10 markdown TODO/PLANNING files. Two surfaces remain: **markdown content** (why/how) and **Plane operational state** (what/where).

This design is not human-PM-tool-replacing-markdown. It is **structured-query-index over markdown for AI consumption**.

## Truth model

```text
Markdown (canonical content)  ──────▶  Plane (canonical operational state)
                              on-demand
                              sync via `plane` skill
```

- **Markdown owns** all content: title, body, priority score and tier, ADR refs, modules declaration, dependencies (declared as structured `**Gate:**` lines).
- **Plane owns** three fields: `status` (open|closed), `created_at`, `closed_at`.
- **Conflict rule:** content fields → markdown wins; state fields → Plane wins. Declared per-field, not arbitrated.
- **Sync direction:** primarily markdown → Plane. Plane → markdown only when AI closes work and absorbs done evidence into the canonical content.

## Modules (6, stable, multi-tag)

Products. Tasks belong to many.

| Module | Scope |
|---|---|
| `formspec` | intake spec + runtime; root `specs/`, `schemas/`, `packages/formspec-{engine,webcomponent,types,layout,...}/`, `crates/formspec-*`, `fel-core` |
| `wos-spec` | WOS specifications + Rust crates (submodule `wos-spec/`) |
| `formspec-studio` | authoring tool (`packages/formspec-studio/`) |
| `wos-server` | `wos-spec/crates/wos-server/` cluster |
| `trellis` | Trellis crates + specs (submodule `trellis/`) |
| `wos-studio` | (future) WOS authoring/admin surface — module created day-1 even if empty |

## Hierarchy

| Plane construct | Maps to | Notes |
|---|---|---|
| Module | Product (above) | Multi-tag. |
| Parent task | Feature/change unit | E.g. *Workflow consolidation: 27→6 schemas + Forms+ tier*. Spans 0–N ADRs. |
| Sub-task | Atomic work item with stable ID | PLN-XXXX, WS-XXX, etc. |
| Label | Priority tier (`P0`/`P1`/`P2`/`Trigger`), ADR ref (`adr:0080`), fence layer (`layer:3`) | Cross-cuts. Cheap. |
| Cycle | Skipped | Not run sprint-cadenced. |

ADRs are not Plane work items. They remain markdown documents, referenced via `adr:NNNN` labels and (when single-ADR-backed) via parent task `source_anchor`.

## Field model

### Sub-task fields

| Field | Source | Type | Notes |
|---|---|---|---|
| `title` | Markdown | string | Mirrors row title. |
| External ID | Markdown stable ID | Plane `external_id` | PLN-XXXX / WS-XXX / etc. Avoids parallel ID space. |
| `parent` | Markdown declaration | reference | One parent. |
| `modules[]` | Markdown declaration | many-to-many | Filter axis. |
| `priority_tier` | Markdown | label `P0`/`P1`/`P2`/`Trigger` | Sortable. |
| `priority_score` | Markdown | integer | `Imp × Debt`. Sortable within tier. |
| `adr_labels[]` | Markdown declaration | label `adr:NNNN` | Cross-references. |
| `source_anchor` | Markdown declaration | custom property: `path/to/file.md#anchor` | The single load-bearing field. AI fetches canonical content here. |
| `blocked_by[]` | Markdown `**Gate:**` lines, materialized | first-class Plane relation | AI walks dependency graph. |
| `status` | **Plane** | `open` \| `closed` | Plane-canonical. |
| `created_at` / `closed_at` | Plane native | timestamp | Auto. |

### Parent task fields

| Field | Source | Notes |
|---|---|---|
| `title` | Markdown (feature doc or entry-point ADR) | |
| `external_id` | Stable feature slug | e.g. `FEAT-workflow-consolidation` |
| `modules[]` | Aggregated from sub-tasks (or declared) | |
| `adr_labels[]` | All ADRs the feature touches | |
| `short_description` | Generated from feature doc / ADR intro | ≤300 chars |
| `source_anchor` | `thoughts/features/<slug>.md` or `thoughts/adr/NNNN-*.md` | Per (III) hybrid below. |

## Cluster narratives — (III) hybrid

PLANNING.md mixes atomic rows (→ Plane sub-tasks) with cluster narratives (prose explaining why a set of ADRs/PLNs belong together as one feature). Narratives are content; they need a markdown home.

- **Single-ADR feature → entry-point ADR is the anchor.** ADR prose covers the feature narrative. Plane parent `source_anchor` → ADR. No new file.
- **Multi-ADR or no-ADR feature → `thoughts/features/<slug>.md`.** Lightweight format. The cluster prose currently in PLANNING.md relocates here.

Examples (initial set):

| Feature | Anchor |
|---|---|
| `workflow-consolidation` (ADRs 0076 + 0079 + 0080) | `thoughts/features/workflow-consolidation.md` |
| `mvp-foundation` (ADR 0074 + adapter cluster) | `thoughts/features/mvp-foundation.md` |
| `studio-review-remediation` (no ADR) | `thoughts/features/studio-review-remediation.md` |
| `doc-restructure` (no ADR; folds in 9→7 plan + this design's own implementation) | `thoughts/features/doc-restructure.md` |
| `stack-closure` (ADRs 0066 + 0067 + 0068 + 0069 + 0070 + 0071 + 0072 + 0073) | `thoughts/features/stack-closure.md` |
| ADR 0066 amendment & supersession (single-ADR feature) | `thoughts/adr/0066-stack-amendment-and-supersession.md` (no new doc) |

Feature doc skeleton:

```markdown
# <Feature title>

**Status:** active | trigger | done
**Modules:** formspec, wos-spec, ...
**ADRs:** 0076, 0079, 0080
**Plans:** thoughts/plans/...
**Plane parent:** <URL once created>

<Narrative — what this feature is, why it exists, what coherent change it delivers.
The atomic backlog lives in Plane. This doc is the why.>
```

## Gate convention (structured)

Markdown declares dependencies as structured lines, parsable on sync:

```markdown
**Gate:** PLN-0330 | ADR-0069 | none
```

One line per gated item, in the row's body. Multiple gates → multiple lines. AI parses on sync, materializes as Plane `blocked_by` relations. Replaces today's prose ("Gate: ADR 0069 accepted") which doesn't parse cleanly.

## Track / Monitor disposal

Today's `TODO.md` `Track/Monitor` section ("§14 materializePagedLayout — by design", etc.) holds decision-debt logs, not backlog. Per minimum-conceptual-debt:

- **By-design observations →** code comment at the source file. Drop the global list.
- **Decisions worth future revisit →** lightweight ADR (one decision per ADR, per *Sequential ADRs, not phased deliverables* feedback).

No `decision-log.md` file. The comment-or-ADR rule covers it.

## What goes, what stays, what's new

### Goes (10 files, deleted in one commit)

- `PLANNING.md`
- `TODO.md`
- `TODO-STACK.md`
- `STUDIO-REVIEW-TODO.md`
- `thoughts/adr/TODO.md`
- `thoughts/chaos-test/2026-04-07-v1/phase4-follow-up-todos.md`
- `trellis/TODO.md` (submodule)
- `wos-spec/TODO.md` (submodule)
- `wos-spec/T4-TODO.md` (submodule)
- `wos-spec/crates/wos-server/TODO.md` (submodule)

### Stays untouched

ADRs, plans, specs, reviews, research, studio thoughts; `VISION.md`, `STACK.md`, `CLAUDE.md`, `README.md`, all submodule READMEs, all submodule `CLAUDE.md` / `VISION.md`; `LICENSING.md`, `Cargo.toml`, `package.json`, `Makefile`, etc.

### New

- `thoughts/features/<slug>.md` — multi-ADR / no-ADR feature narratives (initial set above; grows as features emerge).

## Sync mechanism — on-demand (α)

No git hooks, no daemon. AI does sync explicitly via the `plane` skill:

- **Session start:** AI checks Plane state (`work-items list ...`); if owner-mentioned work or recent markdown changes are not reflected, AI runs a diff and pushes updates.
- **New work mid-session:** AI creates the markdown row in the appropriate location (feature doc, ADR, plan) **and** the Plane sub-task in one operation. Both surfaces updated atomically.
- **Closing work:** AI sets Plane `status: closed` **and** updates the markdown source (absorbs done evidence; archives the row's source if applicable).

Owner doesn't sync. AI does.

## Stable IDs (precondition)

Every Plane sub-task has a stable ID anchored to a markdown row. Conventions:

| ID prefix | Scope | Source |
|---|---|---|
| `PLN-XXXX` | Root / Formspec parent repo | continues PLANNING.md sequence |
| `WS-XXX` | wos-server crate cluster | continues `wos-spec/crates/wos-server/TODO.md` sequence |
| `WOS-XXX` | wos-spec atoms not under wos-server | new prefix; assign on migration |
| `TR-XXX` | Trellis | new prefix; assign on migration |

Migration: **(i) stable-ID-or-no-ticket, organic.** Bulk-migrate existing IDs (PLN, WS) on day 1. Anchor-less prose bullets stay in their feature doc body until they earn an ID by being touched.

## AI query patterns (validation)

These six queries fall out of the field model trivially. If any don't, the model is wrong.

| # | Question | Plane query shape |
|---|---|---|
| 1 | Top 5 active P0 in `wos-server` with no open blockers | `modules:wos-server AND priority_tier:P0 AND status:open AND blocked_by:empty; sort: priority_score desc; limit: 5` |
| 2 | What's blocking `PLN-0314`? | recursive walk of `blocked_by` from PLN-0314 |
| 3 | Tasks spanning both `formspec` and `wos-spec` | `modules:formspec AND modules:wos-spec` |
| 4 | All sub-tasks under feature `workflow-consolidation` | `parent.external_id:FEAT-workflow-consolidation` |
| 5 | All work backed by ADR-0080 | `labels:adr:0080` |
| 6 | Most recently closed task in `trellis` | `modules:trellis AND status:closed; sort: closed_at desc; limit: 1` |

All resolve in single Plane API calls via `plane` skill.

## CLAUDE.md update (load-bearing, same-commit)

CLAUDE.md must redirect AI agents at Plane for backlog operations. Lands in the same commit as the file deletions:

- Replace TODO/PLANNING references with Plane.
- Add explicit instruction: *"For backlog state (what to work on, what's blocked, what's done), use the `plane` skill. Markdown holds content (ADRs, plans, specs, feature docs); Plane holds operational state. The files `PLANNING.md` / `TODO.md` / `TODO-STACK.md` / `STUDIO-REVIEW-TODO.md` and submodule TODO files no longer exist; do not attempt to edit them."*
- Update Operating Context section to reference Plane as the operational layer.
- Submodule `CLAUDE.md` files updated similarly.

Co-located commit prevents straddling state where some files are deleted but instructions still point at them.

## Migration sequencing

1. **Stable-ID sweep.** Backfill IDs on rows that lack them. Mostly done in PLANNING.md and `wos-server/TODO.md`; sweep needed in `TODO.md` root, `trellis/TODO.md`, `wos-spec/TODO.md`, `T4-TODO.md`, `STUDIO-REVIEW-TODO.md`.
2. **Gate convention sweep.** Convert prose `Gate: ...` lines to structured `**Gate:**` lines in surviving files (ADRs, plans, feature docs). Drives downstream `blocked_by` materialization.
3. **Feature docs created.** Per (III) hybrid: `thoughts/features/<slug>.md` for each multi-ADR / no-ADR cluster identified by the sweep (initial set above; ~5–8 docs).
4. **Plane bootstrap.** Single big sync via `plane` skill: 6 modules, ~10–15 parent tasks, ~300–500 sub-tasks, labels, blocked_by relations, source_anchors. AI runs the sync; owner spot-checks.
5. **Verification pass.** Run the 6 AI query patterns above against fresh Plane state; spot-check 10 random sub-tasks for source_anchor accuracy; compare Plane work-item count against pre-deletion markdown row count (sanity bounds: ±5%).
6. **CLAUDE.md update + file deletion** in one commit. Submodule pointer bumps for the 4 submodule TODO deletions.
7. **Post-migration:** AI sessions start with `plane` skill check; new work creates Plane items + markdown rows in appropriate location; closing work updates both.

## Risks / open items

- **Plane outage = AI blind to backlog.** Markdown is no longer a backlog fallback. Mitigation: Plane is self-hosted (owner controls uptime); AI can fall back to feature docs + git log for state reconstruction if needed. Not a near-term concern.
- **Submodule contributor access.** Killing submodule TODO files affects submodule discipline if external contributors arrive who can't see Plane. Acceptable today (solo maintainer). If/when needed, reactivate submodule TODOs as read-only mirrors generated from Plane.
- **ID continuity.** PLN-XXXX numbering continues unbroken; Plane assigns its own auto-IDs (`FORMSPEC-217`) but `external_id` carries PLN-XXXX as primary key. AI references PLN-XXXX in prose; auto-IDs invisible.
- **ADR follow-ups in `thoughts/adr/TODO.md`.** Migrate as Plane sub-tasks tagged `adr:NNNN` and parented to whichever feature owns them; loose grooming work gets an `adr-housekeeping` thematic feature parent.
- **One-time sync cost.** Bootstrap is a few hundred Plane API calls. Tokens are unlimited per owner profile; cost is real-time, not financial. Acceptable.

## Definition of done

- All 10 TODO/PLANNING files deleted.
- Plane workspace `formspec` / project `flowspec` populated with 6 modules, parent tasks (one per feature), sub-tasks (one per stable-ID row), labels, blocked-by relations matching pre-deletion markdown state.
- Six AI query patterns above succeed against Plane with correct answers.
- `CLAUDE.md` (root + submodule) updated to direct AI agents at Plane via `plane` skill; no AI session can find an instruction to edit a deleted file.
- A new task landed post-migration appears in Plane with full field set, source_anchor, modules, ADR labels, blocked_by relations — verified end-to-end on the first such task.
