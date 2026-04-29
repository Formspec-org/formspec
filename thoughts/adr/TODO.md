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

**Resolved assessment:** [`stack-closure-cluster-assessment.md`](stack-closure-cluster-assessment.md) (wos-scout + trellis-scout, reconciled 2026-04-29).

Resolved sequence: 0069 → 0070 → 0068 → 0071 → 0067 → 0066. Owner decisions recorded 2026-04-29 answer the tenant-wire, `CaseOpenPin`, retry-exhaustion, expired-clock severity, 0066 first-proof, and time-strictness questions. Treat each ADR as a center commitment with proof gates: 0069 pins time, 0070 pins commit/failure, 0068 pins scope, 0071 pins version semantics, 0067 pins deadline evidence, and 0066 integrates the revisit/supersession story.

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
