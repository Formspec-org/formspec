---
title: Stack synthesis — integrity narrative, build map, and forks (2026-04-22)
description: >
  Stack synthesis: executive integrity story (STACK, phased Trellis, ADRs
  0054/0056/0059, adapter menu, trust language, compass), plus inventory, Imp×Debt
  ordering, forks, conflicts, gaps, ADR dependency grid, staleness index, sources,
  and reading order.
status: archived
date: 2026-04-22
audience:
  - Contributors crossing Formspec, WOS, and Trellis
  - The owner, for orientation after context compaction
  - AI agents needing one coherent story before architectural decisions
superseded_by: ../../specs/2026-04-22-platform-decisioning-forks-and-options.md
sources:
  - STACK.md
  - .claude/vision-model.md
  - .claude/user_profile.md
  - trellis/thoughts/product-vision.md
  - trellis/thoughts/specs/2026-04-20-trellis-phase-1-mvp-principles-and-format-adrs.md
  - trellis/thoughts/research/2026-04-10-unified-ledger-technology-survey.md
  - trellis/thoughts/research/ledger-risk-reduction.md
  - trellis/thoughts/reviews/2026-04-10-expert-panel-unified-ledger-review.md
  - trellis/thoughts/reviews/2026-04-11-crypto-expert-concrete-solutions.md
  - thoughts/adr/0054-privacy-preserving-client-server-ledger-chain.md
  - thoughts/adr/0056-click-to-sign-attestation-component.md
  - thoughts/adr/0059-unified-ledger-as-canonical-event-store.md
  - trellis/thoughts/formspec/adrs/0059-unified-ledger-as-canonical-event-store.md
  - wos-spec/thoughts/plans/0059-unified-ledger-as-canonical-event-store.md
  - wos-spec/research/compass_artifact_wf-91189436-c8d3-4e27-9159-57565301cb69_text_markdown.md
---

# Stack synthesis — integrity narrative, build map, and forks (2026-04-22)

> Archived 2026-04-22. Active leans, forks, kill criteria, and constraints now live in [`Platform decisioning — leans, forks, and constraints`](../../specs/2026-04-22-platform-decisioning-forks-and-options.md). This file remains a point-in-time synthesis snapshot with inventory, dependency-grid, and staleness-index material.

This document **does not** replace [`STACK.md`](../../../STACK.md), the [vision model](../../../.claude/vision-model.md), or any normative spec. It **synthesizes** research, ADRs, and repo posture so a reader can hold **one coherent story**: what is frozen, what is phased, what is adapter-tier, what remains open, **where the code is**, and **what to do next**.

**Precedence (per [user profile](../../../.claude/user_profile.md)):** direct owner signal beats everything here; normative specs beat this file; vision model and STACK beat ad-hoc research; survey notes, risk memos, and panel-style reviews are **Imp×Debt inputs only** until they land as spec prose, schemas, vectors, or ADRs.

It also answers: **where we are**, **where we should go** (Imp × Debt), **what forks need an owner call** — with inventory, conflicts, gaps, and an ADR dependency grid.

---

## 1. Executive synthesis

1. **Three specs stay the center** — Formspec (intake + respondent ledger semantics), WOS (governance + provenance *meaning*), Trellis (bytes that verify without the vendor). Composition happens at **named seams** ([`STACK.md`](../../../STACK.md) five contracts).

2. **Near-term integrity is export-first** — Portable, COSE-signed **export bundle** plus offline verifier is Phase 1’s wedge. Machine path composes intake evidence with WOS **`SignatureAffirmation`** → **`custodyHook`** → Trellis append/export. See [Trellis product vision](../../../trellis/thoughts/product-vision.md).

3. **ADR-0059 remains the Phase 3+ north star** — One logical case ledger; encrypt-then-hash; projections disposable; durable execution records **checkpoint linkage**, not a second truth. **Default physical posture:** **Postgres + `ct_merkle`** on one operational unit (expert panel); **immudb** only as a **bounded adapter spike** if inclusion semantics justify another SKU.

4. **Maximalist envelope, restrictive Phase 1 runtime** — Wire format reserves capacity; **lint** enforces Phase 1 scope. Rust is **byte authority**; Python stays a **CI cross-check**. **G-5** stranger second implementation is **closed** for Trellis bytes.

5. **0054 is the privacy chain architecture** — Client ledger → server authoritative ledger → platform audit → export/proof; decoupled planes; tiered profiles for zk/MPC/HE **where justified**.

6. **0056 is the intake-side attestation wedge** — `ClickToSign` (Progressive component) ties to `attestation.captured`; it does not replace WOS Signature Profile **workflow** semantics.

7. **Risk-reduction doc tightens adapter defaults** — CT-style inclusion thinking for **witness** layers; avoid parallel bespoke proof stacks; **SD-JWT** default for selective disclosure; **BBS+** optional; **HPKE**, **FROST**, **MLS** as narrow subsystems; authz via mature models (Zanzibar lineage / OpenFGA, Cedar, OPA) **derived** from ledger grants; **metadata minimization** as first-class privacy.

8. **Compass research informs WOS 1.0 depth** — Seven conceptual layers and governance gaps (decision provenance, temporal parameters, SLAs, XES-shaped export); **not normative** for the stack center — see §7.

---

## 2. Layered time model (how futures nest)

| Horizon | What it means |
|---------|----------------|
| **Now** | Attested exports; dual Rust/Python verification on Trellis vectors; WOS Signature Profile + `custodyHook` in reference form; G-5 complete. |
| **Next** | Human certificate-of-completion; Studio authoring/validation; **shared cross-repo fixtures**; stack ADRs **0066–0072** (amendment, clocks, tenant/time/failure/migration, evidence binding) as center work. |
| **Phase 2 (Trellis vocabulary)** | Runtime-time attestation on writes — Trellis as shared library; Formspec and WOS attach through existing seams. |
| **Phase 3 (product vision + 0059)** | Portable **case** ledger — sealed response heads + governance events; single append semantics in the **model** even if storage stays Postgres-shaped. |
| **Phase 4** | Federation + sovereign **witness** adapters (OpenTimestamps, Rekor, tile-based transparency logs such as Tessera ecosystem) for equivocation resistance — **not** a replacement row store for encrypted case payloads. |

---

## 3. Where we are — inventory

### 3.1 What's built

Older marketing/status prose can lag **[`trellis/ratification/`](../../../trellis/ratification/)** for Trellis truth. Arc: spec-first → **dual implementations + conformance**.

| Layer | Conformance surface | Status |
|-------|---------------------|--------|
| **Formspec engine** | `packages/formspec-engine/tests/`; kernel deployable | TS `FormEngine` + Rust/WASM/Python paths |
| **Formspec webcomponent** | `packages/formspec-webcomponent/tests/` | `<formspec-render>` working |
| **WOS** | `wos-lint` `ALL_LINT_RULES` (`wos-spec/crates/wos-lint/src/rules/registry.rs`); `wos-spec/fixtures/`; `SIG-*` in `wos-spec/crates/wos-conformance/tests/fixtures/` | 13 crates; T1–T3 complete per `wos-spec/COMPLETED.md`; T4 WOS-side done, **cross-repo** T4 glue still in flight |
| **Trellis** | `trellis/fixtures/vectors/`; G-5 stranger corpus | Phase 1 ratified posture; **45/45** stranger pass at last `trellis-py` BYTE-MATCH report — corpus has since gained more vector dirs |
| **E2E** | `tests/e2e/browser/**/*.spec.ts` + `packages/formspec-studio/tests/e2e/playwright/` + other package Playwright | Browser ↔ server paths exercised |

**Scale:** Rust dominates (Formspec engine + WOS + Trellis); Studio adds large TS surface. **Not a prototype.**

**Drift guard:** Inline LOC counts rot. **`ct_merkle`:** recommended Merkle posture; **not** yet listed in root or `wos-spec` workspace `Cargo.toml` (Trellis is not a Rust workspace root here).

### 3.2 Decided enough to build on

Canonical framing: **[`STACK.md`](../../../STACK.md)** and **[`.claude/vision-model.md`](../../../.claude/vision-model.md)**. Planning posture: **FEL-only**; **center vs adapter**; **Trellis ADRs 0001–0004** (maximalist envelope, Phase-1 lint, Rust byte authority, Python cross-check, **G-5 closed**); **WOS** five-kind events, tier-typed provenance, deontic/autonomy/confidence, **`DurableRuntime` + Restate**; **export-first**; **Postgres + `ct_merkle`**; **COSE** signing (`trellis-cose`, not JWS/HMAC checkpoints); **encrypt-then-hash**; **Signature Profile** — WOS emits `SignatureAffirmation`, Trellis anchors; DocuSign-class floor (~80% common case + ESIGN/UETA/eIDAS).

### 3.3 Recently landed (snapshot)

- **WOS-T1** `custodyHook` ([WOS ADR 0061 — custody hook wire](../../../wos-spec/thoughts/adr/0061-custody-hook-trellis-wire-format.md), TypeIDs).
- **WOS-T3** Restate selected.
- **WOS-T4** Signature Profile WOS-side: spec, schema, `SIG-*` lint + fixtures.
- **ProvenanceKind** tier-typing (#22a).
- **Formspec** signed-response fields + fixture + WOS-facing mapping.
- **Trellis** signature vectors (`append/019`, `export/006`, `verify/014`, `tamper/014`).

### 3.4 Aspirational

- **0066–0071** Proposed; **0072** Accepted (confirm Trellis fixtures in-repo).
- **0054 / 0056 / 0059** — prose north stars; limited code.
- **Pedersen** reserved; not wired.
- **Decision provenance**, **XES**, **certificate-of-completion**, **Studio T4-11** — not started.

---

## 4. Byte and format discipline (non-negotiables)

From [Phase-1 MVP principles](../../../trellis/thoughts/specs/2026-04-20-trellis-phase-1-mvp-principles-and-format-adrs.md):

- **ADR 0001** — `priorEventHash` list-shaped (DAG-capable); Phase 1 lint requires length 1.
- **ADR 0002** — `anchor_refs` list; at least one anchor in Phase 1.
- **ADR 0003** — Reserved federation fields; **MUST NOT** populate in Phase 1.
- **ADR 0004** — Rust canonical for ambiguous bytes; Python retained; disagreement drives **spec clarification**.

Big moves land as **profile + adapter + lint relaxation**, not undeclared envelope experiments. Extend **Rust vectors + Python CI** before relaxing lint; add model/chaos checks per [ledger risk reduction](../../../trellis/thoughts/research/ledger-risk-reduction.md) **after** bytes are pinned.

---

## 5. Storage, cryptography, and anchors (adapter menu)

From [technology survey](../../../trellis/thoughts/research/2026-04-10-unified-ledger-technology-survey.md) and [ledger risk reduction](../../../trellis/thoughts/research/ledger-risk-reduction.md), aligned with **user_profile** (Postgres default; one dependency beats a cluster; spike before SKU lock-in):

| Concern | Default posture | Escalate when |
|---------|-----------------|---------------|
| System of record | **Postgres + `ct_merkle`** | **immudb** / **rs_merkle** only after a spike shows Postgres cannot meet inclusion/audit constraints; adapter swap, not a second truth model. |
| Event signing | **COSE** — Trellis center (`trellis-cose`) | — |
| External anchor | Optional **OpenTimestamps** ± **Rekor** | Government or multi-party witness story. |
| Tile-based CT (e.g. Tessera / Static CT) | **Witness personality**, not primary PHI store | Federation witness tier — checkpoint roots, not full PHI logs. |
| Selective disclosure | **SD-JWT** default | Unlinkability justifies **BBS+** profile. |
| Threshold / group crypto | **FROST**, **MLS** | Narrow ceremonies; not every event write. |
| Key management / shredding | Cloud KMS or **Vault** pattern per tier | EDPB-aligned crypto-shredding narrative. |
| **Reject** | QLDB (discontinued); event store without cryptographic verify as tamper evidence | Survey dead ends. |

**Interop bias:** export/receipt packaging toward **SCITT**-shaped semantics where standards exist — **adapter tier** until explicitly adopted.

---

## 6. ADR threads — 0054, 0056, 0059

### 6.1 Privacy and client continuity (0054)

ADR-0054 frames the **four-layer chain** (client → server respondent ledger → platform audit → export/proof) and **decoupled planes** (response, audit, identity). Same stack [`STACK.md`](../../../STACK.md) presents as three specs — 0054 explains **why** encrypted local history, selective disclosure, and DID/VC adapters belong in the **product** without collapsing them into Trellis Phase 1 byte scope.

### 6.2 Intake attestation (0056)

ADR-0056 (`ClickToSign`) stays **Tier 3** — group of normal fields, optional `attestation.captured`; no new core `dataType`. **Feeds** signing/ledger without duplicating WOS Signature Profile **workflow** semantics.

### 6.3 Unified ledger (0059) — thesis vs sequencing

**Thesis:** one case-shaped append-only story; ciphertext hashed; projections rebuildable; durable execution records **checkpoint linkage**, not rival truth.

**Sequencing:** ship **export + verifier + custody** first; unify taxonomy and append API before swapping immutable stores; **do not** populate reserved federation slots early (ADR 0003).

Cross-link [WOS 0059 plan](../../../wos-spec/thoughts/plans/0059-unified-ledger-as-canonical-event-store.md) and [monorepo ADR 0059](../../../thoughts/adr/0059-unified-ledger-as-canonical-event-store.md). **Trellis mirror** [`trellis/thoughts/formspec/adrs/0059-unified-ledger-as-canonical-event-store.md`](../../../trellis/thoughts/formspec/adrs/0059-unified-ledger-as-canonical-event-store.md) may lag — **canonical narrative** for the parent repo is the monorepo ADR unless the submodule promotes parity.

---

## 7. Compass research and WOS depth

The [compass artifact](../../../wos-spec/research/compass_artifact_wf-91189436-c8d3-4e27-9159-57565301cb69_text_markdown.md) is **not normative** but informs WOS 1.0 depth:

- **Hybrid layered model** — statechart lifecycle + DMN-style decisions + human-task layer + case file + CloudEvents integration + PROV-shaped audit + abstract durable guarantees.
- **Traps to avoid** — BPMN gigantism, transport coupling (BPEL lesson), interchange without execution (XPDL lesson), flowchart-only rigidity for investigations.
- **JSON vs YAML** — stack center stays **JSON-native**; YAML as optional authoring skin only if machine interchange remains JSON with one canonical encoding story.

**Layers vs implementation today:**

| Compass layer | WOS crate / spec | Status |
|---------------|------------------|--------|
| **1. Lifecycle & Topology** | `wos-core` | Implemented |
| **2. Decision & Policy** | Governance L1 | Partial — decision tables exist; **temporal parameter versioning** does not |
| **3. Human Task & Work Management** | Governance L1 | Partial — simplified lifecycle; not all interaction patterns |
| **4. Case State & Evidence** | Kernel | Implemented |
| **5. Integration & Eventing** | Integration Profile | Specified; adapters partial |
| **6. Provenance & Audit** | `wos-core` + `wos-export` | Emission exists; **decision provenance record shape** is largest gap |
| **7. Durable Execution** | `wos-runtime` + `DurableRuntime` | Restate (T3); in-memory conformance |

**Named gaps:** decision provenance (rule version, inputs, override rationale, AI confidence); temporal parameter versioning; business-calendar SLAs (crate exists; deadline chains incomplete); XES emission; dynamic DCR-style adaptation for evolving investigations.

**Fork resolution (WOS depth):** ship **decision provenance** first; then the other four in crate-shaped homes — **PoC-only sequencing** (defer depth until SBA demands) remains valid if product pressure requires it.

---

## 8. Trust language (honesty as a spec)

- **“Sovereignty” / “no trust in the platform”** depend on adversary model and custody — if the platform can decrypt in ordinary operation, marketing must not claim literal end-to-end user sovereignty.
- **Metadata** (timing, sizes, event types) leaks behavior even when payloads encrypt — treat as **normative**, not cosmetic.
- **One proof story** where possible: avoid redundant parallel receipt + checkpoint + anchor unless each covers a distinct threat; transparency-log **semantics** often suffice at witness tier.

---

## 9. Where we should go — thesis, rank, build sequence

**Thesis:** stack claim is sound; **immediate work is integration glue** (shared fixtures, ADR acceptance, PoC path), not new center invention.

**Next moves:**

1. **One shared fixture bundle** — canonical response → `SignatureAffirmation` → Trellis export/verify across all five seams.
2. **Accept 0066 + 0067** first; **execute 0072**; accept **0068–0071** when ready.
3. **SBA PoC milestone B** — form → signature → export → verify; then **C** (governance slice).
4. **Pedersen** — zero-populated + gate now.
5. **`ct_merkle`** — wire Postgres / export paths (survey immudb default is historical).

**0059 Phase-3 case ledger** needs **0066 + 0067** (and realistically **0068–0070**) before implementation is safe.

**De-risking asset:** [crypto-expert solutions](../../../trellis/thoughts/reviews/2026-04-11-crypto-expert-concrete-solutions.md) (~2.1k lines Rust) is **orphaned** — integrate into tracked crates (§13).

**Expert panel:** FHE, MPC threshold signing, etc. stay **adapter-tier**, profile-gated.

### 9.1 Work rank (Imp × Debt)

| Rank | Work | Why |
|------|------|-----|
| 1 | **WOS-T4 cross-repo closeout** | Active last mile |
| 2 | **Accept 0066 + 0067** | Widest blocker |
| 3 | **Accept 0068–0071** | High debt |
| 4 | **Provenance emission completeness** | Unblocked by tier-typing |
| 5 | **SBA PoC milestone B** | First adopter proof |
| 6 | **Pedersen wire-up** | Cheap now |
| 7 | **0056 ClickToSign** | Feeds signing |
| 8 | **Decision provenance shape** | Wedge |

### 9.2 Build sequence

```text
T4 cross-repo closeout → accept 0066 + 0067 → provenance emission audit
  → wire ct_merkle → PoC B → accept 0068–0071
  → Pedersen + decision-provenance → fold crypto-expert Rust into crates
  → PoC C → anchor spike (OTS-first; witness per §5)
  → Studio UX (ongoing)
```

---

## 10. Forks (defensible divergences)

| Fork | Question | Lean | If unset |
|------|-----------|------|------------|
| **1** | What is “v1.0”? | **B** — per-layer tags; seams mature independently | A = stack gate; C = PoC tag = 1.0 |
| **2** | Wire `ct_merkle` when? | **A** now | B = spike first |
| **3** | PRK in 0059 vs crypto review | **A** — fix ADR text | B / C defer or corrigendum |
| **4** | WOS seven-layer depth | **A** with **B** first on decision provenance | C = PoC-driven only |
| **5** | Trellis envelope width | **A** — maximalist + Phase-1 lint | B/C = format-break risk |
| **6** | SBA PoC demo target | **B** then **C** | A = CLI-only |
| **7** | Python cross-check | **A** now; **B** per ADR-0004 revisit | C = property tests only |

### 10.1 PoC vs product tracks (C / D)

Milestones **B** and **C** prove the technical claim. [Product vision](../../../trellis/thoughts/product-vision.md) also defines **parallel product tracks**:

- **Track C** — FedRAMP Moderate (~12–18 mo via 3PAO), SOC 2 Type II, GSA Schedule, WCAG 2.1 AA + VPAT.
- **Track D** — reviewer dashboard, blob store + preview + virus scan, webhooks, notifications (WOS Notification Template sidecar).

**C/D** control how fast a proven PoC becomes **purchasable**; they do not replace B/C.

---

## 11. Conflicts and tensions

### 11.1 Resolved conflicts

| Topic | Stale read | Current read |
|-------|------------|--------------|
| Storage | Survey: immudb | **Postgres + `ct_merkle`** |
| Signing | 0059 “COSE or JWS” | **COSE** |
| PRK | 0059 “derive from TMK” | **Independent PRK**; fix ADR |
| Execution | Ledger risk: Temporal | **Restate** |
| 0059 mirror | Submodule “superseded” | **Intentional**; parent ADR canonical for planning |
| Compass YAML / FEEL / DMN | Research | **JSON-native + FEL** |

### 11.2 Tensions (design work)

| Id | Tension | Track |
|----|---------|--------|
| T1 | **0071** vs Formspec changelog auto-migration | Pin policy |
| T2 | **BBS+** on W3C draft | SD-JWT default; BBS+ optional |
| T3 | **Coprocessor spec** missing (0059 §4.2) | Formspec → WOS `case.created` |
| T4 | **0071** verifier semantics distribution | Verifier productization |
| T5 | **0070** `stalled` remediation | Before `DurableRuntime` prod |
| T6 | **0062** `RawProject` middleware | Before Studio ship |

**Staleness trap:** archives under `trellis/thoughts/archive/`, older unified-ledger docs, some `wos-spec/thoughts/plans` still cite **immudb**, **Temporal**, **JCS** — read next to [`trellis/ratification/`](../../../trellis/ratification/) and §13.4.

---

## 12. Gaps (short)

1. **Key-person risk** — STACK names it; needs mitigation path before 1.0 freeze.
2. **PoC → SaaS calendar** — explicit proof schedule.
3. **Studio T4-11** — signing authoring UX.
4. **Stack-level conformance fixture** — one artifact, five seams.
5. **“Free DocuSign”** — legal/product shape.
6. **Anchors (ε)** — **OTS-first**; Rekor/Tessera witness when procurement demands (§5).
7. **Orphaned crypto-expert Rust** — link to crates/TODOs.

---

## 13. Review snapshot (2026-04-22)

### 13.1 ADR cluster — status and dependencies

**Accepted:** **0064**, **0065**, **0072** (verify execution vs spec).

**Proposed:** **0066–0071**.

**Numbering collisions:** **`0061`** — WOS **custody hook → Trellis** ([`0061-custody-hook-trellis-wire-format.md`](../../../wos-spec/thoughts/adr/0061-custody-hook-trellis-wire-format.md); load-bearing for T1) vs Formspec **authoring runtime** (`thoughts/adr/0061-current-state-*`; table row below). **`0062`** — Formspec **post-split follow-ups** ([`0062-post-split-follow-ups.md`](../../../thoughts/adr/0062-post-split-follow-ups.md)) vs WOS **Signature Profile workflow** ([`0062-signature-profile-workflow-semantics.md`](../../../wos-spec/thoughts/adr/0062-signature-profile-workflow-semantics.md)).

| ADR | Title | Status | Cross-layer? | Blocks / blocked by |
|-----|-------|--------|----------------|---------------------|
| 0054 | Privacy ledger chain | Proposed | Yes | Extends 0003, 0007, 0009; feeds 0059, 0072 |
| 0056 | ClickToSign | Proposed | No | `attestation.captured` event type |
| 0059 | Unified ledger | Proposed (“Locked” narrative) | Yes | Feeds 0066–0072; PRK bug; coprocessor §4.2 |
| 0061 | Authoring runtime (Formspec) | Proposed | No | Stale studio-core refs |
| 0062 | Post-split follow-ups | Proposed | No | `RawProject` middleware paths |
| 0063 | Release trains | Proposed | All | Steps 2–4 not started |
| 0064 | WOS granularity | **Accepted** | WOS only | Defensive |
| 0065 | WOS authoring mirrors Formspec | **Accepted** | WOS | ~2 wk `wos-authoring` |
| 0066 | Amendment | Proposed | Yes | Phase 4 supersession; 3 Qs |
| 0067 | Statutory clocks | Proposed | Yes | Rigid materialization; 3 Qs |
| 0068 | Tenant/scope | Proposed | Yes | No ID format pinned |
| 0069 | Time semantics | Proposed | Yes | FEL `today()`/`now()` + TZ |
| 0070 | Failure/compensation | Proposed | Yes | Trellis append = commit; 3 Qs |
| 0071 | Migration/versioning | Proposed | Yes | Verifier semantics distribution (§11.2 T4) |
| 0072 | Evidence binding | **Accepted** | Yes | Dual-hash |

**Takeaway:** accept **0066 + 0067** first.

### 13.2 Cross-ADR themes (one line each)

1. **Trellis append** = commit authority (0059, 0070).
2. **Governance-as-compensation** — no runtime saga (0066, 0070).
3. **0071** — verifier carries semantic bundles.
4. **Layer ownership** coherent across 0066–0072.
5. **0067** — “materialized once”; validate vs procurement reality.

### 13.3 High-signal repo facts

Trellis **F6** + **O-3/O-4/O-5**; model-check `tr-core-*`. WOS **sidecar** gaps, **many** schema description gaps (confirm with `wos-lint` / schema pass — avoid hard counts in prose), **synth v0** (syntax-only), **typed event meta-vocab**, **provenance export** blocked on 0066, **facts-tier snapshot** awaiting ADR acceptance. Formspec **Phase 11 coprocessor** stalled on T3. **Chaos-test** / **Studio** P0–P6 mostly internal beyond **T4-11**.

### 13.4 Staleness inventory

| File | Stale | Current |
|------|-------|---------|
| [`trellis/thoughts/archive/drafts/unified_ledger_core.md`](../../../trellis/thoughts/archive/drafts/unified_ledger_core.md) | immudb | Postgres + `ct_merkle` |
| [`trellis/thoughts/archive/drafts/unified_ledger_companion.md`](../../../trellis/thoughts/archive/drafts/unified_ledger_companion.md) | Temporal / JCS | Restate / dCBOR |
| [`trellis/thoughts/archive/specs/2026-04-10-unified-ledger-concrete-proposal.md`](../../../trellis/thoughts/archive/specs/2026-04-10-unified-ledger-concrete-proposal.md) | 8-spec family | 2-doc Core + Extensions |
| [`trellis/thoughts/research/unified_implementation_proposal.md`](../../../trellis/thoughts/research/unified_implementation_proposal.md) | immudb + Trillian | Postgres + `ct_merkle`; Rekor optional |
| [`trellis/thoughts/specs/2026-04-18-trellis-g3-first-batch-brainstorm.md`](../../../trellis/thoughts/specs/2026-04-18-trellis-g3-first-batch-brainstorm.md) | G-5 open | G-5 closed |
| [`trellis/thoughts/handoff-prompt.md`](../../../trellis/thoughts/handoff-prompt.md) | Signature-zeroing | COSE_Sign1 ADR 0001 |
| [`thoughts/adr/0061-current-state-authoring-runtime.md`](../../../thoughts/adr/0061-current-state-authoring-runtime.md) | Pre-split package | `formspec-core` + `formspec-studio-core` |
| [`thoughts/adr/0061-current-state-authoring-runtime-tasks.md`](../../../thoughts/adr/0061-current-state-authoring-runtime-tasks.md) | Pre-split | Same |
| [`CLAUDE.md`](../../../CLAUDE.md), [`thoughts/README.md`](../../README.md) | “Next free id: **0061**” while **0061–0072** exist on disk | Refresh ADR index lines after each ADR batch |
| [`wos-spec/thoughts/archive/drafts/wos-core-v2.md`](../../../wos-spec/thoughts/archive/drafts/wos-core-v2.md) … [`v6`](../../../wos-spec/thoughts/archive/drafts/wos-core-v6.md); [`v7-kernel`](../../../wos-spec/thoughts/archive/drafts/wos-core-v7-kernel.md), [`v7-proposal`](../../../wos-spec/thoughts/archive/drafts/wos-core-v7-proposal.md) | Drafts | Historical; no single `wos-core-v7.md` |
| [`wos-spec/thoughts/plans/0059-unified-ledger-as-canonical-event-store.md`](../../../wos-spec/thoughts/plans/0059-unified-ledger-as-canonical-event-store.md) | immudb/Trillian | Postgres + `ct_merkle` |
| [`wos-spec/thoughts/reviews/2026-04-21-wos-t3-durable-runtime-temporal-restate-spike.md`](../../../wos-spec/thoughts/reviews/2026-04-21-wos-t3-durable-runtime-temporal-restate-spike.md) | Title Temporal-Restate | Restate |

---

## 14. Appendix — sources and reading order

### 14.1 Source catalog

| # | Document | Role | Staleness risk |
|---|----------|------|----------------|
| 1 | [`STACK.md`](../../../STACK.md) | Five seams, dependency inversion | Low |
| 2 | [`.claude/vision-model.md`](../../../.claude/vision-model.md) | Q1–Q4, per-spec commitments | Low |
| 3 | [`.claude/user_profile.md`](../../../.claude/user_profile.md) | Imp×Debt, workflow | Low |
| 4 | [`trellis/thoughts/product-vision.md`](../../../trellis/thoughts/product-vision.md) | Phased arc | **Mixed** — prefer `trellis/ratification/` |
| 5 | [Phase-1 format ADRs](../../../trellis/thoughts/specs/2026-04-20-trellis-phase-1-mvp-principles-and-format-adrs.md) | Envelope vs runtime | Low |
| 6 | [Technology survey](../../../trellis/thoughts/research/2026-04-10-unified-ledger-technology-survey.md) | Landscape | **High** — storage |
| 7 | [Ledger risk reduction](../../../trellis/thoughts/research/ledger-risk-reduction.md) | Framing | **High** — engine |
| 8 | Expert panel + crypto-expert | Convergence + Rust | Rust orphaned until crated |
| 9 | 0054 / 0056 / 0059 + WOS plan | North stars | **0059** high until edited |
| 10 | Compass artifact | Standards map | Low as **input** |
| 11 | 0066–0072 cluster | Cross-layer contracts | Verify **0072** execution |

### 14.2 Reading order (synthesis → truth)

1. [`STACK.md`](../../../STACK.md)
2. [`.claude/vision-model.md`](../../../.claude/vision-model.md)
3. [Trellis product vision](../../../trellis/thoughts/product-vision.md)
4. [Phase-1 MVP format ADRs](../../../trellis/thoughts/specs/2026-04-20-trellis-phase-1-mvp-principles-and-format-adrs.md)
5. [Technology survey](../../../trellis/thoughts/research/2026-04-10-unified-ledger-technology-survey.md) + [ledger risk reduction](../../../trellis/thoughts/research/ledger-risk-reduction.md)
6. ADRs [0054](../../../thoughts/adr/0054-privacy-preserving-client-server-ledger-chain.md), [0056](../../../thoughts/adr/0056-click-to-sign-attestation-component.md), [0059](../../../thoughts/adr/0059-unified-ledger-as-canonical-event-store.md)
7. [Compass workflow research](../../../wos-spec/research/compass_artifact_wf-91189436-c8d3-4e27-9159-57565301cb69_text_markdown.md)

**Maintain with:** vision-model, STACK, submodule ratification. Refresh **§13** after ADR moves; refresh **§3** if automated LOC/lint stats return.
