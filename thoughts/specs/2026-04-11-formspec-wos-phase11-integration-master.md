---
title: Formspec ↔ WOS Phase 11 — Integration master (gaps, plan, Runtime S15 landing)
date: 2026-04-11
status: proposed
supersedes_as_single_index:
  - thoughts/archive/specs/2026-04-10-formspec-integration-gaps.md
  - thoughts/archive/specs/2026-04-11-wos-s15-formspec-coprocessor-proposal.md
  - thoughts/plans/2026-04-11-phase11-coprocessor-fel.md
note: >-
  This file merges the three sources above into one narrative. The older inputs
  live under thoughts/archive/specs/; prefer this document for Phase 11 handoff.
---

# Formspec ↔ WOS Phase 11 — Integration master

## 1. Document control

| Source (merged) | Role in this master |
|-----------------|---------------------|
| `thoughts/archive/specs/2026-04-10-formspec-integration-gaps.md` | Original gap analysis, coprocessor narrative, FEL gap specs |
| `thoughts/archive/specs/2026-04-11-wos-s15-formspec-coprocessor-proposal.md` | Refined Runtime §15 / §12.9 draft, executive decisions, pin semantics |
| `thoughts/plans/2026-04-11-phase11-coprocessor-fel.md` | North star, biases, shipped inventory, sequencing, next actions |

**Normative home:** WOS coprocessor changes now live in `wos-spec/` (Runtime Companion §12.9 / §15, Kernel §9.2 / §11.3, kernel schema, case-instance schema, and typed Rust model). Formspec changes live in `specs/` and `schemas/`. This `thoughts/` file is the Phase 11 integration index; use the WOS specs as the behavior source of truth.

---

## 2. North star and stakeholders

Phase 11 is not “close gaps between documents.” It is **make multi-document workflows trustworthy for the people inside them.**

**Primary outcome:** A respondent or caseworker can **complete a form-backed task**, know **whether the system accepted it**, recover from **errors and outages** without losing work or duplicating submissions, and leave an **auditable trail** that matches what actually happened. An integrator can **implement once** from normative text and get the **same behavior** in browser, server, and review tools.

**Decision bias:** Favor designs that reduce **limbo** (stuck tasks), **ambiguity** (“did it validate?”), and **runtime mismatch**. See **§4 Eight review biases**.

### 2.1 Who must be served

| Who | Need |
|-----|------|
| **Respondent / applicant** | Honest success/failure; retry without phantom “done”; survive outages. |
| **Caseworker / assignee** | Task state matches reality; invalid work **rejectable**, not frozen in **claimed**. |
| **Auditor / appeals** | Separate **response identity** (ledger) from **notice compliance**; pin **which form version** bound. |
| **Integrator / host** | One protocol: context → render → `submitTaskResponse` → validate → map. |

---

## 3. Three gaps — summary and status

| # | Gap | Original severity | Status (2026-04-11) |
|---|-----|-------------------|---------------------|
| **1** | **Formspec coprocessor** — no specified WOS↔Formspec handoff | Critical | **Landed** in WOS Runtime §12.9 / §15, Kernel §9.2 / §11.3, `wos-kernel.schema.json`, `wos-case-instance.schema.json`, and typed Rust model. Backlog behavior questions are closed; the P11-BL-050 publication-rule checklist is treated as complete for this handoff. |
| **2** | **`every` / `some` / `duration`** missing from Core catalog | High | **Resolved** in Formspec: Core §3.5, `fel-functions.schema.json`, fel-core, Python/WASM/engine tests. |
| **3** | **Record arrays + predicates** (string vs expression `$`) | High | **Resolved** in Core §3.5.1: FEL expression predicates; **`$.field`** on object elements; WOS examples updated (`ai-integration.md`). **ADR-0060** (`thoughts/archive/adr/0060-fel-constraint-self-dollar-nesting.md`): constraint `$` vs predicate `$`. |

---

## 4. Eight review biases (coprocessor)

When prose conflicted (e.g. validation failure leaves **claimed** vs **failed**), resolution follows this table.

| # | Bias |
|---|------|
| **1** | **Separate** Respondent Ledger and **notice** delivery. |
| **2** | **Validate full Response envelope** + pin — not **`data` alone**. |
| **3** | **Failed validation → `claimed` → `failed`** — not silent **claimed** limbo. |
| **4** | **`contractRef` on `createTask` + `ContractReference`** — stable task↔contract pointer. |
| **5** | **Predictable validation trigger** before case advances — coprocessor gate at **`submitTaskResponse`** vs **`contractHook`** (Runtime §5.5) distinguished in §6.3. |
| **6** | Prefill: **`direction: "both"`** on Mapping where one doc maps both ways. |
| **7** | **Idempotent `submitTaskResponse`** + host retry when processor unavailable. |
| **8** | **`actorId`** vs **`assignedActor`** + delegation (Runtime §12.5, §8.4). |

---

## 5. Workstreams and sequencing

Technical order: **functions → record semantics → coprocessor prose** (authors need FEL before examples; integrators need S15 last).

1. **FEL-QUANTIFIERS** — **Done** (`every`, `some`, `duration`; wos-lint AG-012 narrowed).
2. **FEL-RECORDS** — **Done** (Core prose, tests, ADR-0060, WOS grep clean).
3. **COPROCESSOR** — **Landed** in `wos-spec/specs/companions/runtime.md`, kernel prose, kernel schema, case-instance schema, and typed Rust model. §6 remains the design index, not the normative source.

### 5.1 Shipped inventory (Formspec repo)

| Area | Landed |
|------|--------|
| Core spec | §3.5.1 / §3.5.4; predicate + object **`$.field`**; `duration` vs `timeDiff`. |
| `fel-functions.schema.json` | Full builtin catalog aligned with Rust; `timeDiff` two-arg signed seconds; `locale` category. |
| Rust / Python / engine | `fel-core`, tests, `BUILTIN_NAMES`, conformance `test_fel_functions_schema_names_are_builtin`, engine navigation tests. |
| WOS | `wos-lint` AG-012; `ai-integration.md` obligation example; `LINT-MATRIX.md` update. `wos-spec/TODO.md` collateral follow-up remains tracked separately. |

**Rebuild note:** `BUILTIN_NAMES` reads Rust at import time — run `maturin develop` / `make build` so Python `.so` matches `fel-core`.

### 5.2 Gap 2 & 3 — resolution summary (historical)

- **Gap 2:** WOS cited `every`/`some`/`duration` before Core listed them. **Path A (Core builtins)** was taken; Kernel S7.4–style citations are now accurate relative to Core S3.5.
- **Gap 3:** String predicates over records were incompatible with FEL. **Resolution:** expression predicates only; **`$.property`** on record elements; nested records follow normal postfix (Core §3.6). WOS **must not** use string-embedded FEL for quantifier predicates.

---

## 6. Gap 1 — Formspec coprocessor (full design)

### 6.1 Problem (why S15 exists)

Without a specified protocol, every deployment invents: **presentation**, **Response return path**, **Response→case mapping**, **validation gating**, **respondent evidence**. Two “conformant” WOS processors can disagree on submit behavior.

Five questions the protocol answers:

1. How does `createTask` + Formspec `contractRef` cause a form to be presented?
2. How does a completed Formspec **Response** return to the processor?
3. How does Response **`data`** map to **`caseFile`**?
4. When is validation run, and what happens on failure?
5. How is **Respondent Ledger** tied to provenance for rights/safety workflows?

**Formspec integration rules:** WOS MUST NOT alter Core processing semantics. WOS processors MUST use a **Formspec-conformant** processor for Definition evaluation and Response validation over **`data`**. **Core §1.4** defines what a conformant Formspec processor does; it does **not** impose that obligation on arbitrary hosts — here, WOS **chooses** that integration. Cite Core for validation, Response shape, Mapping — do not restate FEL or bind algorithms.

### 6.2 Executive decisions (design locks)

| Topic | Decision |
|-------|----------|
| **Validator** | Runtime §15.5 / §15.6 validates the **full** `response.schema.json` envelope (Core **§2.1.6**) + pin match (**VP-01**, **§6.4**) + Definition validation over **`data`** (Core **§2.4** Phase 3: Revalidate; **§5**–**§5.4**). Runtime §12.3 remains the `ContractValidator` data-bag seam; it is not the per-task Formspec completion gate. Wrapper type: **`ValidationOutcome`** (WOS-specific name; not Formspec **`ValidationResult`**). |
| **Pre-validation rejection** | Unauthorized submitters, unregistered agent submitters, and non-`completed` Responses reject with `taskResponseRejected` when policy allows. These rejections do not advance lifecycle, fire terminal events, record `taskResponseSubmitted` / `taskFailed`, or mutate case state. |
| **Terminal failure** | Validation failure, missing required ledger evidence, post-pass hook failure, or unskipped deliberate abandonment transitions **`claimed` → `failed`**, record `taskFailed` provenance, apply Governance S8 remediation, and fire **`failureEvent`** when configured. |
| **Mapping** | A WOS processor MUST have **`responseMappingRef`** before it automatically mutates case state from a Formspec Response. If absent, it may store response/provenance and emit completion, but it MUST NOT invent a host-defined Response-to-case projection. |
| **Prefill** | **`prefillMappingRef`** and **`responseMappingRef`** SHOULD use the same Mapping document with **`direction: "both"`** (Mapping **§3.1**, **§3.1.2**) when one document covers both directions and the host claims Mapping Bidirectional. Use two URIs for distinct one-way documents. |
| **Drafts / dismissal** | **`submitTaskResponse`** accepts only **`status: "completed"`**. Runtime §15.4 may expose **`persistTaskDraft`** for **`in-progress`**, **`amended`**, or **`stopped`** Responses; it records provenance but does not mutate case state or complete the task. `dismissTask` records `taskDismissed` and leaves the task resumable. |
| **Actor** | **`actorId` MUST match `assignedActor`** unless AccessControl / delegation allows otherwise. Agent submitters must be declared through `actorExtension` and recorded with agent provenance. Authorization or agent-registration failure rejects with `taskSubmitterUnauthorized` / `agentSubmitterUnauthorized`, records `taskResponseRejected` when policy allows, and does not advance lifecycle or terminal events. |
| **Amendments** | A completed task is not reopened. Amendment flows create a new task linked through Respondent Ledger / provenance references. |

*VE-05 (informative):* **Core VE-05** (**§5.5**) requires that **saving** a Response not be blocked solely by validation. Rejecting **`submitTaskResponse`** when `response.status` ≠ **`completed`** is a **WOS protocol** choice; it does not restate VE-05.

### 6.3 Runtime §5.5 vs coprocessor

- **§5.5 `contractHook`:** `ContractValidator.validate(contractRef, data)` on a **data bag**.
- **Coprocessor:** Runtime §15.5 validation inside **`submitTaskResponse`** for a **full Response**.
- A workflow MAY use **both**, in Kernel-declared order. **Per-task gate** is **`submitTaskResponse`**. The completion pipeline in §6.6 extends the **single completion bundle**: Formspec first, Mapping proposal next, then Governance S5 hooks before commit unless explicitly sequenced otherwise.

**Non-redundant `contractHook` (SHOULD):** When a task is Formspec-bound and Runtime §15.5 validation has already run (envelope, pin, Definition over **`data`**), **`contractHook`** SHOULD validate **disjoint** concerns only (e.g. case-level rules not in the Formspec contract). Workflows SHOULD NOT apply a second pass that repeats the same Formspec Definition validation on the same payload — that risks duplicate work, divergent error shapes, and conflicting failure handling.

### 6.4 Task creation and `FormspecTaskContext`

On `createTask` with `binding: "formspec"`:

1. Resolve Formspec Definition; record **`definitionUrl`** = Definition **`url`** and **`definitionVersion`** pinned (WOS Kernel §9.6 for task record; Formspec **VP-01** / **§6.4** for pin semantics).
2. Task lifecycle per Governance S10.1 (`created` → … → `claimed`).
3. Build context; call **`TaskPresenter.presentTask(context)`**.

**`FormspecTaskContext` (canonical table)**

| Property | Type | Req | Description |
|----------|------|-----|-------------|
| `taskId` | string | R | Processor id; stable for idempotency. |
| `instanceId` | URI | R | WOS instance id. |
| `contractRef` | string | R | Kernel contract map key (may ≠ Formspec `definitionUrl`). |
| `definitionUrl` | URI | R | Definition **`url`**; MUST match `response.definitionUrl`. |
| `definitionVersion` | string | R | Pinned version; MUST match `response.definitionVersion`. |
| `binding` | `"formspec"` | R | Discriminator. |
| `assignedActor` | string | R | From `assignTo`. |
| `prefillData` | object | O | Path → value. |
| `prefillMappingRef` | URI | O | Mapping doc; prefer **`direction: "both"`** when applicable. |
| `responseMappingRef` | URI | O | Forward map Response → case; SHOULD also live on Kernel **`ContractReference`**. |
| `deadline` | date-time | O | SLA / `taskTimeout`. |
| `impactLevel` | string | O | Drives ledger rules (**§6.9**). |
| `extensions` | object | O | Keys `x-*` only. |

### 6.5 Host interface — `TaskPresenter` (Runtime §12.9)

| Operation | Input | Req | Description |
|-----------|-------|-----|-------------|
| `presentTask` | `context` | R | Host renders Definition; MUST NOT mutate case state on presentation alone. |
| `dismissTask` | `taskId`, `reason` | O | Host closed UI without valid completion (informative). |

**Normative callback:** When the actor reaches **`status: "completed"`**, the host MUST call **`processor.submitTaskResponse(...)`** with the **full Response** document.

*Informative:* An implementation MAY expose `onTaskCompleted` / `onTaskAbandoned` style callbacks internally; **behaviorally** completion is **`submitTaskResponse`** with **`completed`**; abandonment may use Formspec **`stopped`** per Response lifecycle (host policy).

### 6.6 `submitTaskResponse` and validation algorithm

**Input:** `taskId`, `response` (full document), `actorId`, `timestamp`, optional `idempotencyToken` (Runtime **§4.3** Exactly-Once Semantics).

**Steps:**

1. Idempotency: check a durable replay store before `activeTasks`, using a replay key scoped to `taskId`, `actorId`, and `idempotencyToken`. Duplicate key → same outcome; no duplicate authorization, validation, mapping, provenance, task completion, or event emission. The replay key covers rejected, failed, and completed outcomes, cannot be reused by a different actor, and outlives removal from `activeTasks` for the host retry window.
2. Resolve the ActiveTask by `taskId`.
3. Authorize `actorId` vs `assignedActor` / delegation. If authorization or agent-registration checks fail, reject with `taskSubmitterUnauthorized` / `agentSubmitterUnauthorized`, record `taskResponseRejected` when policy allows, and do not advance lifecycle, emit terminal events, record `taskResponseSubmitted` / `taskFailed`, or mutate case state.
4. If `response.status` ≠ **`completed`**, reject with structured error (e.g. `taskResponseStatusNotCompleted`), record `taskResponseRejected` when policy allows, and do not advance lifecycle, emit terminal events, record `taskResponseSubmitted` / `taskFailed`, or mutate case state — **WOS protocol**; Core **§2.1.6** defines **`status`** and `completed` vs error-severity results (see **§6.2** note on VE-05).
5. Record `taskResponseSubmitted` provenance for the new completed submission attempt.
6. Validate the full Response envelope, pin, and Definition semantics using Runtime §15.5; record `contractValidation` with the outcome.
7. Unless `envelopeValid` ∧ `pinMatch` ∧ `definitionValid`: **`claimed` → `failed`**, `taskFailed` provenance, Governance S8 remediation, no mapping, no case mutation, and **`failureEvent`** when configured.
8. If Respondent Ledger evidence is required and missing: reject with `ledgerEvidenceMissing`, **`claimed` → `failed`**, `taskFailed` provenance, Governance S8 remediation, no mapping, no case mutation, and **`failureEvent`** when configured.
9. Resolve **`responseMappingRef`**. If absent, store the accepted Response reference and skip automatic case mutation. If present, compute the proposed case mutation without committing it and record `dataMapping` provenance.
10. Run optional **`contractHook`** / Governance S5 checks on the completion bundle; record `contractValidation` for each post-pass outcome. Hooks must not repeat Formspec Definition validation.
11. If a post-pass hook fails: **`claimed` → `failed`**, `taskFailed` provenance, Governance S8 remediation, no case mutation, and **`failureEvent`** when configured.
12. Atomically commit case mutation, task completion, **`completionEvent`** when configured, and `taskCompleted` provenance. Terminal task history remains in provenance.

**`ValidationOutcome` fields:** `envelopeValid`, `pinMatch`, `definitionValid`, `errors`, optional `validationResults` (Formspec-shaped).

**Processor unavailable:** host retries with same idempotency token; processor dedupes.

### 6.7 Mapping and Kernel extensions

**`responseMappingRef`** on `ContractReference` (example):

```json
{
  "contracts": {
    "intakeApplication": {
      "binding": "formspec",
      "ref": "urn:formspec:agency.gov:intake:2.0.0",
      "responseMappingRef": "urn:formspec:agency.gov:intake-to-case:1.0.0"
    }
  }
}
```

**Kernel / action extensions:** `responseMappingRef`, `prefillMappingRef`, **`completionEvent`**, and **`failureEvent`** on `createTask` are landed in `wos-kernel.schema.json`.

**Mapping execution:** Formspec Mapping Document, **`forward`** (Response → case), field-rule priority (**Mapping §3.4**), pipeline per Mapping spec **§8**; **`setData`** (Kernel S5.4), **`dataMapping`** provenance.

### 6.8 Lifecycle diagram

```
createTask (Formspec contract)
  → FormspecTaskContext
  → TaskPresenter.presentTask
  → actor work (optional Respondent Ledger)
  → Response status completed
  → submitTaskResponse
  → validate full Response envelope + pin + Definition data
  → FAIL → claimed → failed + taskFailed provenance
  → PASS → mapping proposal → optional post-pass hooks → atomic completion + provenance
```

### 6.9 Respondent Ledger and provenance

Rights/safety **`impactLevel`:** processor MUST require ledger / **`submit`** evidence before accepting completion; provenance links **`respondentLedgerRef`**. Operational/informational: optional.

**Informative provenance shape** (illustrative):

```json
{
  "id": "prov-00123",
  "action": "taskCompleted",
  "taskId": "task-abc",
  "responseRef": {
    "responseId": "resp-456",
    "definitionUrl": "urn:formspec:agency.gov:intake:2.0.0",
    "definitionVersion": "2.0.0"
  },
  "respondentLedgerRef": {
    "ledgerId": "ledger-789",
    "href": "https://agency.gov/audit/respondent-ledgers/ledger-789"
  },
  "mappingRef": "urn:formspec:agency.gov:intake-to-case:1.0.0",
  "caseStateMutations": [
    { "path": "caseFile.applicantName", "value": "Ada Lovelace" }
  ]
}
```

**Ledger vs notice (bias #1):** ledger evidence MUST NOT be conflated with adverse-decision **notice** delivery records.

### 6.10 Closed decisions (coprocessor product)

**Consolidated backlog** (§6.10 items, Phase 1 assumptions, publication/schema decisions, ledger gaps, protocol edge cases): [`thoughts/plans/2026-04-11-phase11-coprocessor-open-backlog.md`](../plans/2026-04-11-phase11-coprocessor-open-backlog.md).

1. **Prefill:** prefer one bidirectional Mapping document when supported; use two URIs for distinct one-way transforms.
2. **In-progress via processor:** use optional **`persistTaskDraft`**; do not overload **`submitTaskResponse`**.
3. **Multi-form tasks:** model as multiple tasks or one composite Formspec Definition; no multi-contract task for v1.
4. **Agent submitters:** allow only declared agent actors through `actorExtension`, delegation, and provenance.
5. **`amended` Response:** create a new amendment task; do not reopen terminal completed tasks.
6. **Observability:** rejected pre-validation submissions record `taskResponseRejected` when policy allows without terminal lifecycle effects; success records receipt, validation, mapping when present, and `taskCompleted`; failures record `taskFailed` and emit `failureEvent` when configured; deliberate not-applicable abandonment records `taskSkipped`.
7. **Publication:** treat **P11-BL-050** as satisfied for this handoff; keep the five rules as publication discipline, not additional normative prose.

---

## 7. Publication checklist (land in `wos-spec/` + Formspec)

- [x] **`wos-spec/specs/companions/runtime.md`:** §15 Formspec Coprocessor; §15.5 / §15.6 full Response validation; §12.9 **TaskPresenter**; Abstract/Scope mention Formspec tasks. §12.3 intentionally remains the `ContractValidator` data-bag seam.
- [x] **`wos-kernel.schema.json` + Kernel spec:** `responseMappingRef`, `prefillMappingRef`, `completionEvent`, `failureEvent`; **`contractRef` on `createTask`** prose (bias #4).
- [x] **`wos-case-instance.schema.json`:** required **`activeTasks`** array plus **`ActiveTask`**.
- [x] **`$defs`:** `ActiveTask`, `FormspecTaskContext`, `ValidationOutcome` for tooling.
- [x] **P11-BL-050 publication-rule checklist captured in this handoff:** additive only; cite never restate; delegate processing; canonical terminology; Formspec-as-validator. No standalone review artifact is linked from this document.

**Dependencies (normative elsewhere):** Formspec Core §1.4 (conformant processor), Response **§2.1.6**, **VP-01** / **§6.4**, **§2.4** (revalidation), **§5**–**§5.4**, **§5.5** / VE-05; Mapping **§3.4**, **§8**; Respondent Ledger add-on; WOS Governance S5, S8, S10; Runtime **§4.3**, **§5.5**, **§8**, **§12**.

---

## 8. Spec / implementation synthesis (short)

- **FEL builtins and schema catalog:** aligned; contract test schema ⊆ `BUILTIN_NAMES`.
- **`timeDiff` vs `duration`:** documented; schema matches Core.
- **Response coprocessor:** landed in WOS Runtime §15 with full Response + pin validation; the P11-BL-050 publication-rule checklist is recorded in §7.
- **Mapping `forward` | `reverse` | `both`:** unchanged; bias #6 explicit.

---

## 9. References

- WOS Kernel, Lifecycle Detail, Runtime Companion, Governance, AI Integration, Advanced Governance (sections cited throughout).
- Formspec Core §1.4, §2.1.6, §2.4, §3, §5–§5.5, §6.4; Mapping spec (**§3.4**, **§8**); Changelog S4; Respondent Ledger add-on.
- Schemas: `response.schema.json`, `validationResult.schema.json`, `mapping.schema.json`, `fel-functions.schema.json`.
- ADR-0057 (WOS core vs implementation boundary); **ADR-0060** (constraint `$` vs predicate `$`).

---

## 10. Subagent / tooling note

Cursor **Task** may not register `spec-expert` / `formspec-scout` as built-in `subagent_type` values; use **explore** or **generalPurpose** tasks with agent prompts pasted, or invoke the **formspec-specs** skill for normative lookups.
