# ADR Follow-Up Actions

Companion to [`thoughts/README.md`](../README.md) audit (2026-04-29). Open items only.

---

## 1. Dead-code cleanup (ADR 0055)

- `packages/formspec-studio/src/state/workspaces/editor/properties/EditorPropertiesPanel.tsx` — dead in production paths; only test imports
- `packages/formspec-studio/src/state/workspaces/logic/LogicTab.tsx` — zero active render imports
- `packages/formspec-studio/src/state/workspaces/data/DataTab.tsx` — zero active render imports
- `site/index.html` (3009 lines) — superseded by Astro site (`site/src/pages/index.astro`)

---

## 2. WOS stack-closure cluster (0066–0071)

**Resolved assessment:** [`stack-closure-cluster-assessment.md`](stack-closure-cluster-assessment.md). Owner decisions recorded 2026-04-29. Sequence: 0069 → 0070 → 0068 → 0071 → 0067 → 0066.

Execution homes: `TODO-STACK.md`, `PLANNING.md`, `wos-spec/TODO.md` (ADR 0066/0067), `wos-spec/crates/wos-server/TODO.md` (WS-072/073/076), `trellis/TODO.md` (items 9, 10, 17–20).

### 2a. 0069 — Time Semantics (first) — **Trellis first slice done**

- **Done:** Trellis temporal-order verifier check (`timestamp_order_violation` tamper_kind), `tamper/041-timestamp-backwards` fixture, `TR-CORE-092` matrix row, §19.1 enum registration, unit tests for backwards-detection and equal-timestamp pass-through. Three `trellis/TODO.md` item-20 checkboxes closed.
- **Remaining:** CBOR wire migration `uint` seconds → `uint64` nanoseconds (D-2.1, `trellis/TODO.md` item 20 first checkbox); WOS `ClockSkewObserved` trigger once substrate timestamps plumbed through drain context; FEL `today()`/`now()` hard-fail without tz context; leap-second parse rejection
- **Owner pins:** reject `23:59:60` at parse; FEL `today()`/`now()` hard-fail without tz context; chain order = timestamp order
- **Proof gates:** PLN-0073, PLN-0114, PLN-0115, PLN-0117, PLN-0131, Trellis item 20
- **Blocks:** 0067 (precision + clock-source rules)

### 2b. 0070 — Failure And Compensation

- **Next slice:** Emit `AuthorizationRejected` before returning unauthorized from transition path (~15 lines in `runtime.rs`)
- **Then:** Custody append retry loop + `CommitAttemptFailure` on exhaustion (~40 lines in `custody.rs`)
- **Owner pins:** retry exhaustion → explicit operator recovery via `stalled`, not automatic; runtime state is orchestration, not evidentiary truth
- **Proof gates:** PLN-0035, PLN-0042, PLN-0047, Trellis item 19, WOS runtime emission
- **Blocks:** 0066 (amendment-authority denials)

### 2c. 0068 — Tenant And Scope

- **Next slice:** Update canonical tenant-truth source, then wire runtime/storage/verifier checks
- **Owner pins:** tenant required at Trellis envelope/profile level (not optional-with-MUST-populate); regenerate pre-release fixtures if needed
- **Proof gates:** PLN-0004, PLN-0005, PLN-0011–0013, PLN-0015, PLN-0001–0007, Trellis item 17
- **Blocks:** 0066 (cross-tenant supersession)

### 2d. 0071 — Migration And Versioning

- **Next slice:** Decide authoritative wire home for `CaseOpenPin`, then add pin-set / pin-mutation-rejected / valid-migration vectors
- **Owner pins:** authoritative pin on first anchored case-open event; other surfaces are projections
- **Proof gates:** PLN-0019, PLN-0095–0098, PLN-0125, Trellis item 18
- **Blocks:** 0066 (migration-coupled supersession)

### 2e. 0067 — Statutory Clocks

- **Next slice:** One `ClockStarted`/`ClockResolved` round trip after 0069 lands. Do not start with pause/resume arithmetic
- **Owner pins:** expired unresolved clocks advisory in base profile; stricter profiles may escalate; `ProcessingSLA` absorbs older task-SLA surface
- **Proof gates:** PLN-0150, PLN-0153, PLN-0166–0168, PLN-0170, Trellis item 10, WOS ADR 0067 checklist
- **Blocks:** 0066 (open-clock cancellation)

### 2f. 0066 — Amendment And Supersession (last)

- **Next slice:** Same-chain correction or rescission first; cross-chain `supersession-graph` after 0068 + 0071
- **Owner pins:** first proof is same-chain; no mutation-based amendment; authorization via `AuthorizationAttestation`
- **Proof gates:** PLN-0104, PLN-0106, WOS ADR 0066 checklist, Trellis item 9, Formspec `ResponseCorrection`
- **Blocks:** Full stack-closure claim

---

## 3. Per-ADR follow-ups

### 0029 — Schema Parity Phase 1 (~80%)

- Add `dataType: "uri"` to `projectWebsite` in `examples/grant-application/definition.json`
- Add `timing: "demand"` to at least one shape
- Add shape `message` with `{{expression}}` interpolation
- Verify per-enrichment E2E test coverage

### 0030 — Schema Parity Phase 2 (7/8 items)

- **Item E (Theme Pages & Regions):** add `pages` + `regions` to `theme.json` with 12-column grid, per-page layout, responsive overrides

### 0031 — Schema Parity Phase 3 (~70%)

- Create `examples/grant-application/registry.json` (5 categories, 4 lifecycle statuses)
- Exercise `retired` lifecycle status
- Add `source` instance with `static: true`
- Resolve `Grid.columns` as CSS string format

### 0039 — Seamless Page Management (~75%)

- Implement `pages.autoGenerate` handler (schema at `core-commands.schema.json:1064`)
- Add Response Inspector to Form Health
- Add Simulation section to Form Health
- Migrate `EditorPropertiesPanel` sections into inline expandable `ItemRow`
- Update ADR for component-tree-native pivot

### 0040 — MCP Tool Consolidation (~60%)

- Re-evaluate: 46 tools vs 28-target. Post-ADR additions (`formspec_widget`, `_audit`, `_theme`, `_component`, `_locale`, `_ontology`, `_reference`, `_behavior_expanded`, `_composition`, `_response`, `_mapping`, `_migration`, `_changelog`, `_lifecycle`, 5× `_changeset_*`) reintroduced token overhead
- Verify `outputSchema` wired to MCP protocol
- Update ADR status for actual tool count

### 0042 — Launch Blog Posts (~80%)

- Write Post 5: "Government-Grade Forms Without a Vendor Contract" (deferred pending deployment reference)
- Set up cross-posting pipeline

### 0048 — i18n as Locale Artifact (~80%)

- Implement `formatNumber()` FEL function (spec §5.3)
- Implement `formatDate()` FEL function (spec §5.4)
- Implement locale lint rules: L101, L201, L301, L401
- Complete conformance Tier 2

### 0053 — WebMCP Native Assist Protocol (~75%)

- Implement additional shim transports: PostMessage, CustomEvent, MCPWebSocket
- Add `data-formspec-*` declarative DOM annotations
- Wire `requestUserInteraction()` to WebMCP native API

### 0054 — Privacy-Preserving Ledger Chain (~40%)

- Build client-side local ledger (Layer 1) in `packages/formspec-engine/`
- Implement `Ed25519FileKeySigner` (WS-043) replacing `NoopSigner`
- Define privacy-tier runtime enforcement
- zkSNARKs, MPC, HE: Phase 2+

### 0055 — Studio Semantic Workspace Consolidation (~70%)

- Build Response Inspector in Form Health
- Build Simulation section in Form Health
- Migrate `EditorPropertiesPanel` → inline expandable `ItemRow`
- Implement Blueprint auto-switch (Build → Manage on section click)
- Remove dead code: `EditorPropertiesPanel.tsx`, `LogicTab.tsx`, `DataTab.tsx`
- Update ADR for tab lineup: Editor, Layout, Evidence, Mapping, Preview

### 0059 — Unified Ledger (~50%)

- Expand governance event taxonomy (3 → ~25 types)
- Build CQRS materialized-view workers
- Wire `wos-server-eventstore-postgres` adapter (PLN-0332)
- Implement identity layer: `trellis-interop-did` + `trellis-interop-vc`
- Build external anchoring adapters (Rekor/Trillian/immudb)

### 0062 — Post-Split Follow-Ups (~70%)

- Collapse batch API surface (4 methods → unified; structurally resolved via `CommandPipeline`)
- Complete `RawProject` decomposition (682 lines, state getters + query wrappers inline)

### 0063 — Release Trains by Tier (~60%)

- Implement per-stream git tags (`kernel-v…`, `foundation-v…`, etc.)
- Create per-tier CHANGELOG files
- Change `updateInternalDependencies` from `"patch"`
- Update ADR "Current State" section (still says `fixed: [], linked: []`)

### 0075 — Rejection Register (~40%)

- Add ADR 0075 citations to `wos-spec/README.md`, gap-analysis doc, counter-proposal-disposition
- Implement CI lint rule (PLN-0264)
- Define amendment vs supersession policy (PLN-0274)

### 0076 — Product-Tier Consolidation (~85%)

- **WS-100:** consolidate Studio TS-type files (22 files → merged model), migrate fixture loading from legacy dirs
- Absorb standalone tooling schemas into `wos-tooling.schema.json`
- Rewrite `RELEASE-STREAMS.md` / `COMPATIBILITY-MATRIX.md`

### 0078 — foreach Topology (~15%)

- Add `StateKind::Foreach` to Rust enum
- Add foreach fields to `State` struct
- Add `if type=="foreach"` conditional `allOf` to schema
- Write Kernel §4.3 prose (PLN-0243)
- Implement lint rules L-foreach-001..004
- Define provenance iteration records
- Write conformance fixtures (PLN-0252)
- Build runtime foreach iteration logic

### 0079 — Formspec Native IntakeHandoff Emission (not started)

- Add `targetWorkflow` field to `definition.schema.json`
- Build emission pipeline in `formspec-engine` / Python
- Implement cross-spec lint rules: `FORMSPEC-WOS-XREF-001`, `WOS-INTAKE-XREF-001`, `FORMSPEC-WOS-VERSION-001`, `FORMSPEC-WOS-MODE-001`
- Write conformance fixtures + migration note

### 0080 — Governed Output-Commit Pipeline (~20%)

- Build unified `commit_external_output()` processor
- Implement `signalTimeout` MUST enforcement
- Add reserved record kinds (`capabilityQuarantined`, `capabilityOutputInvalidated`, foreach iteration)
- Wire surface attachments for 4/6 work types
- Implement write-scope lint rules `WOS-BIND-SCOPE-001..006`
- Implement `WOS-MUT-SOURCE-001`, `WOS-VER-LEVEL-002`
- Build quarantine disposition processor
- Write conformance fixtures

### 0081 — Content-Addressed Artifact Identity (not started)

- Define three-segment `*Ref` schema syntax
- Extract `wos-canonical` crate from `snapshot.rs`
- Add `definitionContentHash` to provenance schemas
- Build reference parser in `wos-formspec-binding`
- Implement lint `WOS-CONTENT-HASH-001`
- Write conformance fixtures
- Register `definition-hash` Trellis event type

---

## 4. Blocked ADRs (design work needed before implementation)

| ADR | Blocker |
|-----|---------|
| 0051 (PDF) | Superseded spec (`rust-layout-planner-and-pdf.md`) not implemented; three Rust crates don't exist |
| 0052 (Remove Theme Pages) | Paired with 0039; schema removal breaks non-Studio consumers. Decide: deprecation path or Studio-only |
| 0056 (Click-to-Sign) | Needs Accepted status before implementation |
| 0074 (Field-Level Transparency) | Depends on `specs/privacy/privacy-profile.md` (doesn't exist). PLANNING.md P0/P1 gated |
| 0079 (IntakeHandoff Emission) | Depends on 0081 (not started) for content-addressed identity |
| 0081 (Content-Addressed Identity) | Schema-breaking change; all PLN rows Open |

---

*Audited 2026-04-29. Sections 1 & 2 (status reconciliation + archival) completed same day.*
