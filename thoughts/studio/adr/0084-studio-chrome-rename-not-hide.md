# ADR 0084: Studio Chrome — Rename, Don't Hide

**Status:** Proposed
**Date:** 2026-04-28
**Scope:** Formspec Studio shell — `BlueprintSidebar` section labels, `StatusBar` chips, `advanced` toggle semantics
**Related:** [`thoughts/studio/2026-04-28-prd-chatgpt-forms-ide.md`](../studio/2026-04-28-prd-chatgpt-forms-ide.md) §5.4, §5.5, §8.5 (this ADR replaces "hide behind Advanced" with rename-and-surface-counts); [ADR 0055 (studio semantic workspace consolidation)](./0055-studio-semantic-workspace-consolidation.md) — direct prior art for rename-without-hiding (Logic/Data → Editor); [ADR 0082 (lift ChatSession)](./0082-lift-chat-session-above-studio.md); [ADR 0083 (right-panel live preview companion)](./0083-right-panel-live-preview-companion.md)

## Context

The PRD proposes simplifying Studio chrome by gating four sidebar sections (`Variables`, `Data Sources`, `Mappings`, `Option Sets`) and the metric chips behind an `Advanced ▾` accordion. The intent is correct — the default chrome over-indexes on technical jargon for a non-technical persona. The mechanism is wrong.

The four sections are **artifact-bearing**: AI changesets (and the manual UI) create real `Variable`, `Mapping`, and `OptionSet` entries that participate in form behavior. Hiding them behind Advanced means a user can accept an AI suggestion that produces an artifact they cannot see. Invisible-by-default state created by an opaque agent is gaslighting-by-UI — the form silently grows logic the operator never agreed to surface. The status-bar metrics are summaries, not artifacts, but they fail for the same reason: hiding `2 warnings · 1 error` behind a toggle hides whether the form is healthy, which is the one thing every persona needs.

Current section labels are technical: `Variables` ([`ShellConstants.tsx:37`](../../packages/formspec-studio/src/components/shell/ShellConstants.tsx#L37)), `Data Sources` ([`:38`](../../packages/formspec-studio/src/components/shell/ShellConstants.tsx#L38)), `Option Sets` ([`:39`](../../packages/formspec-studio/src/components/shell/ShellConstants.tsx#L39)), `Mappings` ([`:40`](../../packages/formspec-studio/src/components/shell/ShellConstants.tsx#L40)). Status-bar chips render as `bind` / `shape` / `Evidence` / `Provenance` / `Layout drift` ([`StatusBar.tsx:93,97,103,107,115`](../../packages/formspec-studio/src/components/StatusBar.tsx#L93)). The labels are the failure mode, not the visibility.

## Decision

### D-1. Rename sidebar sections; keep all visible by default

| Internal key (unchanged) | User-facing label |
|---|---|
| `Variables` | Calculations |
| `Data Sources` | External data |
| `Mappings` | Field mappings |
| `Option Sets` | Reusable choices |

Internal keys in [`ShellConstants.tsx:37–40`](../../packages/formspec-studio/src/components/shell/ShellConstants.tsx#L37) and `BLUEPRINT_SECTIONS_BY_TAB` ([`:62–67`](../../packages/formspec-studio/src/components/shell/ShellConstants.tsx#L62)) stay; only the rendered string changes. Each section is always present in its tab. Zero-count state shows a single empty-state line ("No calculations yet") and is fully collapsible. Non-zero shows a count badge inline (`Calculations ●3`). No Advanced gate.

### D-2. Default status bar; metric details on demand

Default chips: `Draft · 24 fields · Healthy · Ask AI`. The PRD's `Wizard` chip ([§8.5](../studio/2026-04-28-prd-chatgpt-forms-ide.md)) becomes a form-mode-as-Appearance setting; users do not see it as a default-state chip. Full metric set lives behind a `⋯` menu next to the health chip, with the same renaming applied:

| Internal symbol (unchanged) | User-facing label |
|---|---|
| `bind` count | Data connections |
| `shape` count | Cross-field rules |
| `Evidence` | Documents attached |
| `Provenance` | AI changes |
| `Layout drift` | Layout warnings |

Internal symbol names at [`StatusBar.tsx:24,25,28,30,107,115`](../../packages/formspec-studio/src/components/StatusBar.tsx#L24) stay. Telemetry, schemas, and APIs are untouched.

### D-3. The `advanced` toggle controls *depth*, not *artifact visibility*

A single `advanced` boolean (persisted per user) reveals technical metadata inline — raw JSON in the field inspector, FEL expressions in the calculation editor, internal symbol names alongside the renamed labels. It MUST NOT control whether artifact-bearing sections are visible. Sections in D-1 are always visible because hiding sections that the AI writes into is the failure mode this ADR exists to prevent.

### D-4. `Healthy` is the single user-facing form-health summary

The chip computes from the union of underlying metric severities (validation errors, layout drift, open patches, evidence gaps). Display: `Healthy` / `2 warnings` / `1 error`. Clickable — opens a panel listing issues with the renamed labels from D-2. Replaces ad-hoc chip-counting as the way a non-technical user judges "is this form OK to send?".

## Consequences

- AI cannot create a `Variable`, `Mapping`, or `OptionSet` invisible to the user. The artifact appears in its renamed section, with a count delta the user can read.
- Status bar becomes legible to the Program Officer persona without an Advanced toggle in the first session — `Draft · 24 fields · Healthy` is four words, not five jargon chips.
- Technical users lose nothing. `advanced=true` exposes the same depth as today; renaming is visual, not semantic.
- Internal symbol names (`Variables`, `bind`, `shape`, `Provenance`, `Layout drift`) stay in code, schemas, telemetry. No rename ripples downstream.
- PRD §5.4/§5.5/§8.5 updates to describe rename-with-counts. The Advanced accordion proposal is dropped.

## Kill criteria

- If `studio_advanced_toggled_within_first_session` fires for >40% of new users, the rename strategy alone hasn't fixed defaults — content-design problem, re-open this ADR.
- If usability testing shows renamed labels confuse users (e.g., "Calculations" mistaken for arithmetic helpers rather than field expressions; "External data" mistaken for file uploads), revisit the label set. Do **not** revert to hiding artifact-bearing sections.
