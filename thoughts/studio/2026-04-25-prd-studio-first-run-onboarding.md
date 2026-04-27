# PRD: Studio first-run onboarding (full-screen + assistant)

| Field | Value |
| --- | --- |
| **Status** | In progress |
| **Product** | Formspec Studio (`packages/formspec-studio`) |
| **Related** | [Formspec Studio PRD](./2026-03-05-product-requirements-v2.md) (vision and editing model; onboarding implements a concrete first-run path) |

### Implementation alignment (codebase, 2026-04)

- The assistant surface reuses **`Header`** (with `assistantSurface`), **`StatusBar`** (`variant="assistant"` hides evidence/provenance/patch/drift chips until the tabbed shell), and **`StudioWorkspaceModals`** (command palette, import, form settings, app settings)—same modal layer as `Shell`.
- **Escape** is ordered: import → form settings → app settings → palette → mobile bottom sheet → mobile orientation dismiss → `deselect`. Overlays that attach **`useEscapeKey`** call `preventDefault`; the window shortcut handler skips Escape when `defaultPrevented` so confirm/import/settings keep correct behavior.
- Shortcut routing uses **`ASSISTANT_KEYBOARD_WORKSPACE`** (currently the literal workspace name `Evidence`) so **Delete/Backspace** never invokes Editor/Layout deletion from `keyboard.ts`.
- **Enter workspace** appears in both the header and the snapshot panel **on purpose** (discoverability). Telemetry event **`onboarding_enter_workspace_intent`** includes **`enterWorkspaceSource`**: `header` | `snapshot_panel` | `snapshot_mobile_sheet`.
- **Still out of scope on assistant:** blueprint sidebar/drawer; palette copy stays draft-scoped (not prototype “global AI commands”).

---

## 1. Summary

Ship a **first-run onboarding experience** that runs **before** the main Studio shell and opens directly into a **full-screen assistant workspace** backed by an immediate minimal blank project. The product should feel like **ChatGPT for forms**: the conversation owns the center, while persistent start controls and a live form snapshot make the artifact visible as the thing being shaped. A short orientation layer explains the available start paths--starter catalog, blank form, import, and direct Studio entry--then the author either replaces the blank seed with a starter/import or describes the form they want in the **same AI assistant** used in the editor. The **default product configuration** assumes a **deployment-provided API key** so authors are not blocked on provider setup in demo/internal builds.

This PRD specifies UX, persistence, and **downstream implications for the form-filling (respondent) experience**, which is entirely driven by the Formspec artifacts authors produce—even when those artifacts are shaped partly through onboarding and AI assistance.

---

## 2. Problem and opportunity

### 2.1 Problem

- New authors land directly in a dense shell (blueprint, workspaces, tabs) seeded with a single implicit example, with **no narrative** for what Studio is or how to start.
- The in-shell assistant lives in a **narrow panel**, which is appropriate for iterative editing but not for a **first conversational session** that establishes intent and trust.
- Example content is **not discoverable** as explicit choices; one fixture is silently loaded.

### 2.2 Opportunity

- **Reduce time-to-first-success** by foregrounding starters and optional natural-language goals before chrome-heavy editing.
- **Align mental model** with conversational authoring: chat and structure editing share one project and one tool stack.
- **Make example quality explicit** via a starter catalog that can grow over time without changing bootstrap code in multiple places.

---

## 3. Goals and non-goals

### 3.1 Goals

1. **G1 — First-run gate (configurable):** On first visit (per policy below), show onboarding **instead of** `Shell` until the author enters Studio.
2. **G2 — Assistant-first workspace:** Open directly into a full-screen assistant workspace with a central conversation, persistent project-start controls, live form snapshot, bottom-fixed composer, clear send and enter-Studio actions, and starter-aware prompts.
3. **G3 — Immediate project root:** Create a minimal blank project before the first assistant message so every onboarding action operates against a concrete project identity, command stream, diagnostics state, and undo root.
4. **G4 — Short orientation:** Present a concise, dismissible side panel on desktop and bottom sheet on mobile that explains the start paths: choose a starter, create blank, import, ask the assistant, or enter Studio.
5. **G5 — Explicit starters:** Present a **catalog of example definitions** (initially the current default fixture; additional examples as the catalog grows) plus **blank** and **import** paths from inside the assistant-first workspace.
6. **G6 — Single project continuity:** The current project identity, command history, pending changesets, diagnostics, and undo history continue through onboarding chat and into `Shell` (no silent re-seed that drops assistant-driven edits).
7. **G7 — Default assistant availability:** In the **default demo/internal configuration**, provider credentials are **pre-populated** when the deployment supplies them (same class of behavior as build-time env seeding today), so the assistant workspace is usable without opening App Settings first.

### 3.2 Non-goals

- **NG1 — New runtime or respondent app:** No change to Formspec **runtime** filling UX is *required* by this feature; any impact is **indirect** via authored definition/component/theme/mapping.
- **NG2 — Replacing in-shell `ChatPanel`:** The right-rail assistant remains; onboarding uses a **dedicated full-screen surface** that may **share** hooks/components with `ChatPanel`.
- **NG3 — Multi-tenant org onboarding:** Team invites, SSO, and org-level policies are out of scope unless explicitly added later.
- **NG4 — Offline-only Studio:** Assistant steps that depend on cloud LLM APIs remain **degraded or skippable** when no key exists (non-default builds).

---

## 4. Personas and scope boundary

| Persona | Role in this PRD |
| --- | --- |
| **Author** | Uses Studio onboarding and subsequent editing; in scope. |
| **Respondent** | Fills a published or previewed form produced from Studio artifacts; **not** a direct user of this onboarding UI, but **affected** by authoring outcomes. |

All **form-filling** implications in this document refer to **respondents** and **preview consumers** experiencing the **output** of Studio (documents + engine behavior), not a new onboarding UI for respondents.

---

## 5. Product overview (approach A)

**Approach A (selected):** A **full-screen assistant-first onboarding workspace** runs **before** the main `Shell`. After completion, the app renders the existing Studio shell with the **already-constructed** `Project`.

High-level phases:

1. **Assistant workspace opens** — Full-screen authoring surface with product header, start rail, central transcript, composer, live form snapshot, and an immediate minimal blank `Project`.
2. **Orientation appears once** — A short side panel on desktop or bottom sheet on mobile explains the start paths and names the main Studio screens/flows: author with assistant, inspect structure, preview respondent behavior, validate diagnostics, export/integrate.
3. **Choose or replace the starting point** — Starter catalog, blank reset, import, or assistant prompt operates against the current `Project`; starter/import replacement after mutation requires confirmation.
4. **Assistant remains available** — Same assistant capabilities as in-editor chat (tooling bound to current `Project`); **Continue to Studio** enters the shell without requiring further chat.
5. **Enter Studio** — Transition to `Shell`; persist onboarding completion for return visits.

**Handoff wins:** Existing URL/localStorage handoff for bundles from other surfaces (e.g. `?h=`) **bypasses** onboarding and opens the handoff bundle directly.

---

## 6. User flows

### 6.1 Happy path (default build with key)

1. Author opens Studio for the first time on device → sees the full-screen assistant workspace backed by a minimal blank project, with a short orientation layer.
2. Author dismisses or completes orientation → sees starter/import/blank controls, the assistant composer, and the live form snapshot in the same workspace.
3. Author selects **Section 8 HCV intake** (or another catalog item), imports a bundle, starts blank, or asks the assistant to scaffold a form.
4. The current blank `Project` is replaced by the selected/imported seed or mutated by assistant commands (plus existing registry bootstrap behavior unchanged).
5. Author sends one or more messages; assistant may propose changesets; author accepts/rejects with inline review controls.
6. Author taps **Continue to Studio** → `Shell` appears; same project identity, pending changesets, diagnostics, undo history, and command history.

### 6.2 Blank start

1. First-run already starts with a blank project. Author may use **Blank form** to reset back to the minimal valid seed (implementation must align with `createProject` / core empty semantics).
2. If the current project has been mutated, blank reset requires confirmation. Assistant remains available to scaffold fields; author may continue chatting or enter Studio.

### 6.3 Import-first

1. Author chooses **Import** inside the assistant workspace → existing import dialog or equivalent.
2. On successful import, the imported bundle replaces the current project. If the current project has been mutated, replacement requires confirmation.

### 6.4 Return visit

1. Onboarding does not repeat once completion is recorded (policy in F9), unless author resets from App Settings or uses a dev/query override.

### 6.5 Build without deployment-provided key

1. Assistant workspace shows the **existing** “configure provider” pattern with an App Settings CTA and a clear **Continue to Studio** action. The assistant is disabled until configured; onboarding is never auto-skipped silently.

---

## 7. Functional requirements

### 7.1 Starter catalog

- **F1** Maintain a **code-defined catalog** of starters: `id`, display title, short description, tags, locale assumptions, document stats, mapping/integration indicators, and reference to `FormDefinition` (or lazy module).
- **F2** Initial catalog **must** include the current default: **Section 8 HCV intake** (`example-definition` fixture).
- **F3** Adding a starter is **additive** (new fixture file + catalog entry), without changing unrelated bootstrap paths.
- **F3a** Every starter must pass starter health checks before appearing in the catalog: schema validity, mapping validity when mappings exist, declared locale coverage, and preview smoke result.

### 7.2 Project lifecycle

- **F4** First-run onboarding immediately creates a minimal blank project through `createStudioProject({ seed: blank })` or its successor before the first assistant message.
- **F4a** One project identity, command history, undo history, diagnostics state, and pending changeset set continue from onboarding boot through shell mount **unless** the author explicitly abandons and starts over (confirm destructive action).
- **F4b** Starter selection, import, or blank reset may replace the initial blank project without confirmation only while the project is unmutated. After any assistant message, accepted changeset, manual command, import, or other project mutation, replacement requires explicit confirmation.
- **F5** `createStudioProject` (or successor) remains the **single** place for registry merge + handoff resolution; onboarding passes an explicit `seed` when a starter or import is chosen.

### 7.3 Assistant behavior

- **F6** Onboarding assistant uses the **same** chat/session stack and **same** MCP tool dispatch model as `ChatPanel`, bound to the onboarding `Project`.
- **F7** Suggested prompts are starter-aware after a starter/import seed is selected and blank-project-aware while the initial blank project is active.
- **F8** **Continue to Studio** requires no LLM calls; land in `Shell` with current document state.
- **F8a** The assistant workspace is always skippable; no deployment segment may require LLM use before entering Studio.

### 7.4 Persistence and controls

- **F9** Persist onboarding completion in **localStorage** (or existing storage abstraction) with a **versioned key** only when the author enters `Shell`; selecting a starter, importing, or opening the assistant does not mark onboarding complete.
- **F10** App Settings (or equivalent): **“Show onboarding again”** clears the completion flag.
- **F11** Document dev overrides: e.g. `?skipOnboarding=1`, `?onboarding=1` for QA.

### 7.5 Default API key

- **F12** When the deployment provides a default key (e.g. build-time env mirrored into provider config **before** first interaction, consistent with current dev bootstrap), **do not** require the author to visit App Settings to send the first onboarding message.
- **F13** Authors who **replace** provider config in App Settings always take precedence over build-time defaults (no overwrite of explicit user config).
- **F14** Production/customer deployments that cannot make the provider trust boundary true for their users must disable deployment-provided keys and require org/user-controlled provider configuration.

---

## 8. UX specification

### 8.1 Visual thesis

The onboarding surface is a calm, high-trust drafting room: white or near-white background, strong typography, thin dividers, almost no color except one precise action accent, and status colors only for diagnostics. It should feel like ChatGPT for forms, not a landing page, dashboard, wizard, or Studio shell.

The first screen communicates one idea: **the author can talk to the form, and the form is already real**. Chat owns the center. The form artifact owns the frame.

### 8.2 Layout: full-screen onboarding

- **Viewport:** Use full height (`100dvh` pattern) to avoid mobile browser chrome issues.
- **Default surface:** Open directly in the assistant workspace; do not show a marketing-style welcome screen before chat.
- **Orientation:** A short side panel appears on desktop and a bottom sheet appears on mobile. It explains the available start paths and the core Studio flows in plain product language: choose/import/create, ask the assistant, inspect structure, preview, validate, export.
- **Desktop structure:** Three persistent regions: left start rail, center conversation, right form snapshot. The header spans the workspace with product name, current project name/status, provider status, and **Continue to Studio**.
- **Mobile structure:** Header, conversation, and fixed composer remain primary. Start controls, form snapshot, and diagnostics move into bottom-sheet tabs: **Start**, **Snapshot**, **Diagnostics**.
- **Start rail:** Contains blank/reset, import, starter catalog, and recent starters when available. Starter, import, and blank/reset controls remain visible without opening a menu on desktop; the author can always see what project they are editing and how to replace it.
- **Conversation:** The center column is the closest part to ChatGPT: readable transcript, operational assistant messages, inline changeset review, fixed composer, and restrained prompt suggestions. Assistant copy describes concrete form edits, not generic encouragement.
- **Form snapshot:** The right panel always answers what form exists now: title, pages/sections, field count, diagnostics count, mapping status, compact outline, preview action, and continue action where appropriate.
- **Visual language:** Reuse Studio tokens and components (`ChatMessageList` patterns, icons, accent colors) so onboarding feels **native**, not a separate microsite.

### 8.3 First viewport

The first viewport is usable before explanation. It shows the blank project, active composer, visible start controls, and form snapshot.

Primary prompt:

> What form are you building?

Primary start actions:

- **Describe it** — focuses the composer.
- **Use a starter** — focuses the starter rail or opens the mobile Start sheet.
- **Import** — opens import.

Do not show a centered “Welcome to Studio” screen, marketing hero, dashboard card mosaic, decorative gradient, or blocking modal before the workspace appears.

### 8.4 Starter catalog

Starters are document templates, not marketing cards. Use dense rows or compact entries with:

- Title.
- Purpose sentence.
- Field count.
- Page/section count.
- Locale coverage.
- Mapping/integration indicators.
- Diagnostic status.
- **Use starter** action.

Selecting a starter opens or updates its detail preview in the form snapshot region. If the current project is mutated, **Use starter** becomes an explicit replacement action with confirmation.

### 8.5 Changesets during onboarding

- If the assistant produces a pending changeset, surface inline minimal review controls in the full-screen flow using the same accept/reject semantics as the shell. Authors must never land in Studio with invisible pending proposals; unresolved changesets remain visibly pending after shell entry.
- Assistant changeset copy should be operational and concrete. Example: “I created a 5-page intake structure: applicant, household, income, preferences, review. Review the proposed changes before they modify the form.”

Inline changeset summaries should name the artifact deltas:

```text
 Add page: Household members
 Add repeat group: householdMembers
 Add fields: name, relationship, birthDate, income
 Add validation: birthDate required
```

Actions: **Accept**, **Reject**, **Inspect**.

### 8.6 Motion

Use motion to show that the form artifact is live, not for decoration:

- First load: conversation column fades in; start rail and form snapshot move subtly into place.
- Starter hover/focus: row reveals the preview affordance.
- Accepted changeset: form snapshot updates with a short highlight pulse.
- Orientation dismisses into a small help affordance.

Avoid decorative motion, animated gradients, and large entrance sequences.

### 8.7 Accessibility

- **Keyboard:** Focus order orientation → starter/import/blank controls → assistant composer → Continue to Studio; visible focus rings; skip link where appropriate.
- **Screen readers:** Message list and composer labeled; live region for “assistant is typing” / errors per existing patterns.

---

## 9. Implications for the greater form-filling experience

Onboarding does not ship a new respondent UI. It **shapes** the artifacts that drive filling. The following are **behavioral and UX consequences** authors and product should treat as first-class.

### 9.1 Artifact quality and respondent burden

- **Starter choice sets the baseline journey:** Example definitions encode **page mode** (e.g. wizard vs single scroll), **density**, **non-relevant behavior**, repeat groups, and validation. Respondents inherit those patterns immediately. Onboarding makes that choice **explicit**, which can **increase** use of rich templates—good for demos, but authors must still **validate** that the template matches their program’s accessibility and comprehension requirements.
- **AI edits before first shell visit** can add or change fields, labels, help text, relevance rules, and validation. Any error or over-constraint **flows straight** to preview and to exported bundles consumed by runtimes. **Mitigation:** surface **Form health / diagnostics** prominently on first shell mount after onboarding, and preserve **undo** history from assistant-applied commands where the core already supports it.

### 9.2 Consistency: preview vs production

- Authors may believe “chat fixed everything.” **Respondent-visible behavior** is still defined only by the **documents** and **engine**. Product copy in onboarding should avoid implying a separate “filling mode”; filling is always **the same Formspec evaluation model** as today.
- **Preview** in Studio after onboarding shows the same runtime semantics as other preview entry points; no second truth.

### 9.3 Trust, safety, and governance

- **Deployment-provided API key** means author prompts and **definition snapshots** sent to the provider are a **deployment trust boundary**. For regulated customers, deployments **must** disable deployment-provided keys and use org-controlled keys; onboarding should **not** claim data residency that the deployment cannot guarantee.
- **AI-proposed changes** should be reviewable (changesets) before authors treat the form as “ready,” especially when downstream filling collects **sensitive** data (PII, eligibility). Poorly reviewed AI layout can increase **abandonment** or **invalid submissions** at fill time.

### 9.4 Localization and plain language

- Onboarding UI strings are **author-facing** (English or deployment locale). **Respondent-facing** copy remains in the definition/locale documents. If the assistant generates English-only labels, **non-English** filling experiences suffer until authors localize. Starter catalog entries should note **locale assumptions** where relevant.

### 9.5 Mapping, integrations, and post-fill workflows

- Starters may include **mapping** or integration hooks. AI might alter fields that downstream mappings expect. **Implication:** after onboarding, **mapping health** and **export smoke tests** remain critical; onboarding increases the chance authors skip straight to preview without visiting mapping tabs. On first shell entry, surface mapping diagnostics when mappings or integration hooks exist.

### 9.6 No change to respondent onboarding within forms

- **Screener**, **wizard steps**, and **in-form instructions** are unchanged by this PRD. Studio onboarding is **not** the same as an agency’s **program intake** UX; conflating the two in copy risks confusion. Use distinct terminology: **“Studio setup”** vs **“your form’s pages.”**

---

## 10. Configuration and compliance matrix

| Deployment | Expected behavior |
| --- | --- |
| **Demo / internal default** | Deployment-provided key seeded; full flow including assistant. |
| **Enterprise (customer key)** | No deployment-provided key; user supplies key in App Settings; assistant workspace remains usable for starter/import/blank and shows provider setup CTA for chat. |
| **Air-gapped / offline** | No LLM; assistant workspace remains usable for starter/import/blank and direct Studio entry. |

---

## 11. Success metrics

- **Time to first meaningful edit:** e.g. first field added or first preview opened (telemetry if available).
- **Onboarding completion rate** and **drop-off per step** (orientation → seed selection/import/blank → assistant workspace → Shell).
- **Starter distribution:** which templates are chosen (informs catalog investment).
- **Post-onboarding diagnostic severity:** average errors/warnings immediately after shell (proxy for AI- or template-induced issues affecting fill quality).

---

## 12. Product decisions

1. **Entry surface:** First-run opens directly into the assistant workspace, not a separate welcome page.
2. **Project root:** First-run creates a minimal blank project immediately; chat, starters, import, diagnostics, and Studio entry all operate against that project.
3. **Orientation:** A short first-run side panel on desktop or bottom sheet on mobile explains start paths and Studio flows; it is dismissible and does not block direct use.
4. **Replacement:** Starter/import/blank reset replaces the current project directly only before mutation; after mutation, replacement requires confirmation.
5. **Changeset review:** AI changesets require inline minimal review during onboarding and remain visibly pending in Studio until resolved.
6. **Handoff:** Handoff bundles bypass onboarding and open directly.
7. **Assistant availability:** Assistant use is always optional; Studio entry never depends on LLM availability.
8. **Starter presentation:** Starter entries carry durable metadata and preview affordances; do not ship placeholder icon-only starters.

---

## 13. Implementation references (non-normative)

- `packages/formspec-studio/src/studio-app/StudioApp.tsx` — project creation and handoff.
- `packages/formspec-studio/src/components/ChatPanel.tsx` — assistant session and tools.
- `packages/formspec-studio/src/components/chat/ChatMessageList.tsx` — transcript presentation.
- `packages/formspec-studio/src/main.tsx` — optional dev key seeding into provider config.
- `packages/formspec-studio/src/fixtures/example-definition.ts` — first catalog entry source.

---

## 14. Revision history

| Date | Author | Change |
| --- | --- | --- |
| 2026-04-25 | — | Initial draft from agreed assistant-first approach and deployment-provided key assumption. |

---

## 15. Delivery tracking (working log)

This section tracks implementation against requirements so the PRD remains execution-grade.

### 15.1 Landed or substantially in progress

- Onboarding gate and first-run persistence plumbing in Studio app flow (`F9`/`F10` policy path).
- Dedicated onboarding workspace shell with assistant-first entry and explicit Studio continuation action (`G2`, `F8`, `F8a`).
- Starter catalog abstraction plus blank-definition seed fixtures (`F1`, `F2`, `F4`).
- Import/replace and blank reset pathways wired into onboarding surface (`F4b`, `F5`).
- Handoff precedence hardened: handoff query (`?h=`) bypasses onboarding even when forced-onboarding query flags are present (`F5`).
- Accessibility polish pass in onboarding shell: skip-link to composer, explicit starter focus action, and labeled onboarding composer.
- Onboarding telemetry baseline landed: viewed/completed/first-meaningful-edit/starter-selected events with variant + build-mode payload metadata.
- Initial onboarding-focused tests covering storage policy and workspace rendering paths.

### 15.2 Remaining to reach PRD-complete

- M1 implementation scope is complete in code and test coverage (`sections 16.1`-`16.4` all checked).
- Remaining PRD work is now post-M1 hardening: extended e2e matrix across deployment modes and telemetry pipeline/reporting integration.

### 15.3 Next implementation slices

1. M2 complete: patch/provenance spine baseline delivered and covered by targeted tests.
2. Expanded e2e verification matrix for onboarding deployment modes.
3. Telemetry sink/dashboard wiring and metric quality validation.
4. M3 kickoff: layout document durability + drift resolution baseline.

---

## 16. Implementation checklist (engineering-ready)

Legend: `[ ]` not started, `[~]` in progress, `[x]` completed.

### 16.1 Gate, continuity, and replacement safety

- `[x]` On first visit, route to onboarding instead of `Shell` (`G1`, `F9`).
- `[x]` Preserve one project identity from onboarding into Studio (`G6`, `F4a`).
- `[x]` Allow starter/import/blank replacement without confirmation only when unmutated (`F4b`).
- `[x]` Require explicit destructive confirmation after any mutation path (`F4b` hard rule).
- `[x]` Add regression tests covering mutation-trigger replacement confirmations for assistant interaction, accepted changesets, JSON import, and manual mutation (`F4b`).

Acceptance criteria:

- Fresh session: starter swap is direct.
- Mutated session: starter/import/blank reset always prompts before replacement.
- Entering Studio does not create a second project or lose undo/changeset history.

### 16.2 Orientation and accessibility completion

- `[x]` Desktop orientation side panel implemented and dismissible (`G4`, section 8.2).
- `[x]` Mobile bottom-sheet orientation and tab choreography implemented (`G4`, section 8.2).
- `[x]` Keyboard focus order verified: orientation → start controls → composer → continue action (section 8.7).
- `[x]` Screen-reader labels/live regions verified for onboarding transcript and composer (section 8.7).

Acceptance criteria:

- No blocking modal required before first composition or starter selection.
- Orientation can be dismissed and does not reappear unexpectedly in same session.
- Keyboard-only path can complete onboarding and enter Studio.

### 16.3 Handoff and provider-mode correctness

- `[x]` Ensure handoff (`?h=` / storage bundle) bypasses onboarding reliably (`F5`, section 5).
- `[x]` Confirm demo/internal builds can send first message without settings detour when deployment key exists (`F12`).
- `[x]` Confirm user-saved provider settings override deployment defaults (`F13`).
- `[x]` Confirm enterprise/air-gapped behavior keeps onboarding usable without LLM (`F14`, section 10).

Acceptance criteria:

- Handoff URL opens directly in Studio with imported artifact.
- No key: assistant disabled + clear CTA + explicit Continue to Studio still available.
- User-provided key/config is never overwritten by startup defaults.

### 16.4 Telemetry and observable outcomes

- `[x]` Emit `onboarding_viewed` and `onboarding_completed` events (section 11).
- `[x]` Emit first meaningful edit signal (first field add or preview open).
- `[x]` Emit starter selection distribution event with starter id.
- `[x]` Emit post-onboarding diagnostics severity snapshot after first Studio mount.

Acceptance criteria:

- Events fire exactly once per triggering action (no duplicate sends on re-render).
- Event payloads are versioned and include onboarding variant/build mode fields.
- Metrics can segment by starter/import/blank path.
