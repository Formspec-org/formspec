# PRD — Playthrough (deferred)

**Status:** Deferred — not in current Studio delivery scope.  
**Related:** [2026-04-26-studio-unified-feature-matrix.md](./2026-04-26-studio-unified-feature-matrix.md) (ranked items 10, 16, 18, 21; Slice E).

## Problem statement

Respondent-facing forms fail in ways static validation cannot catch: ordering, density, attachment friction, and channel-specific copy. The Direction 7 prototype treats **playthrough** as a first-class loop: pick a persona, run against a **layout under test**, capture reactions and friction notes, and route outcomes into **reviewable patches** rather than silent spec edits.

## What we explored (spike, now removed)

A short-lived implementation added:

- **`x-studio` persistence:** `playthroughSessions` array on the Studio extension alongside patches and provenance.
- **Types in `@formspec-org/studio-core`:** `PlaythroughSession`, `PlaythroughEvent`, and `getStudioIntelligence(...).playthrough.sessions` for normalized reads.
- **Studio UI (removed):** A `PlaythroughWorkspace` spike ran mock persona sessions, wrote layout-scoped patches with `source: 'playthrough'`, appended session records, and supported accept/reject from a session log; the tab and file were later removed entirely.
- **Tests:** Vitest coverage for the above writer and workspace behavior.

This proved the **data shape** and **UI skeleton** were plausible, but it front-loaded surface area before layout documents, evidence citations, and patch lifecycle were fully productized elsewhere.

## Decision: defer and delete spike code

Playthrough is **explicitly out of scope** until:

1. **M2-class patch plus provenance spine** is the default path for every authoring change (already underway).
2. **Layout documents plus drift** (matrix Slice C / M3) give a real “layout under test” object.
3. **Evidence workbench** (Slice D) is far enough along that friction notes can cite real sources where needed.

Until then:

- **No** Studio shell tab or workspace route for playthrough (no stub UI).
- **No** persisted `playthroughSessions`, **no** `getStudioIntelligence` playthrough branch, **no** `upsertPlaythroughSession` writer API.
- Legacy `formspec:navigate-workspace` events with `tab: 'Playthrough'` fall back to **Editor** so older integrations do not break silently.

`StudioOrigin` and patch `scope` may still include `'playthrough'` for forward compatibility when the feature returns.

## Non-goals (until re-scoped)

- Live or embedded respondent runtime inside Studio.
- AI-generated fix suggestions from playthrough without human review (patches remain the boundary).
- Direct spec mutation from a persona run.

## Re-entry criteria (draft)

- Ship M3 layout baseline and at least evidence document plus coverage primitives from Slice D.
- Define whether sessions attach to `layoutRef` only or also to a future preview session id.
- UX review: mobile persona strip, session log density, and status bar integration per matrix row 21.

## Implementation checklist (when picked up)

- [ ] Restore normalized `PlaythroughSession` (and events) in studio-core `getStudioIntelligence` **or** keep sessions UI-local until export format is stable.
- [ ] Restore `playthroughSessions` (or renamed) in `WritableStudioExtension` and writer upserts.
- [ ] Reintroduce shell tab plus workspace with persona, layout-under-test, and patch lifecycle wired to real preview when available.
- [ ] Vitest plus Playwright for run, accept, reject, and persistence round-trip.
