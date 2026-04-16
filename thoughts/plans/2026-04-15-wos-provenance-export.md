# WOS Provenance Export — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement provenance export from the WOS reference implementation to three industry-standard formats: W3C PROV-O (JSON-LD), IEEE 1849 XES (XML), and OCEL 2.0 (JSON). The spec is fully normative in the Semantic Profile (§§5–6). The internal provenance types are stable. This plan closes the gap between internal provenance and external tooling interop.

**Architecture:** New crate `wos-export` in `wos-spec/crates/wos-export/`. Three modules: `prov_o`, `xes`, `ocel`. The crate takes a `ProvenanceLog` (from `wos-core`) and a `SemanticProfile` export configuration struct and produces serialized output. No changes to the kernel evaluation path — export is a read-only pass over the append-only log. One prerequisite: add `timestamp` to `ProvenanceRecord` in `wos-core` (currently absent; required by all three export formats).

**Tech Stack:** Rust, `serde_json` (PROV-O JSON-LD + OCEL), `quick-xml` (XES), `wos-core` dependency. No new external ontology tooling.

**Spec anchor:** `wos-spec/specs/profiles/semantic.md` §5 (PROV-O) and §6 (XES/OCEL). Schema: `wos-spec/schemas/profiles/wos-semantic-profile.schema.json` — `provMapping` and `processMining` properties.

---

## Prerequisites

### Task 0: Add `timestamp` to `ProvenanceRecord`

**Files:**
- Modify: `wos-spec/crates/wos-core/src/provenance.rs`

**Why:** PROV-O requires `prov:atTime` (§5.3), XES requires `time:timestamp` (§6.3), OCEL requires event timestamp (§6.4). Currently `ProvenanceRecord` has no timestamp field.

**Design:** Add `pub timestamp: String` (ISO 8601, required) to `ProvenanceRecord`. Update all constructor helpers to accept a `timestamp: &str` parameter. This is a breaking change to constructors — update all call sites in `wos-runtime` and `wos-conformance`.

- [ ] **Step 0.1:** Add `pub timestamp: String` field to `ProvenanceRecord` struct (after `record_kind`, before `actor_id`). Mark with `#[serde(rename = "timestamp")]`.

- [ ] **Step 0.2:** Update all `ProvenanceRecord::*` constructor functions to accept `timestamp: &str` and set `Self { ..., timestamp: timestamp.to_string(), ... }`.

- [ ] **Step 0.3:** Grep for all call sites in `wos-runtime` and `wos-conformance`. Update each to pass a timestamp. For runtime call sites, pass `chrono::Utc::now().to_rfc3339()`. For conformance fixtures, pass a fixed deterministic string (e.g., `"2026-01-01T00:00:00Z"`) so fixture snapshots are stable.

- [ ] **Step 0.4:** Run `cargo test -p wos-core -p wos-runtime -p wos-conformance`. All tests must pass.

- [ ] **Step 0.5:** Commit.
  ```
  git add wos-spec/crates/wos-core/src/provenance.rs wos-spec/crates/wos-runtime/src/ wos-spec/crates/wos-conformance/
  git commit -m "feat(wos-core): add timestamp field to ProvenanceRecord (export prerequisite)"
  ```

---

## Task 1: Create `wos-export` crate scaffold

**Files:**
- Create: `wos-spec/crates/wos-export/Cargo.toml`
- Create: `wos-spec/crates/wos-export/src/lib.rs`
- Modify: `wos-spec/Cargo.toml` (workspace members)

- [ ] **Step 1.1:** Create `wos-spec/crates/wos-export/Cargo.toml`:

  ```toml
  [package]
  name = "wos-export"
  version = "0.1.0"
  edition = "2024"
  description = "Provenance export to PROV-O, XES, and OCEL 2.0 (WOS Semantic Profile §§5–6)"
  license = "AGPL-3.0"

  [dependencies]
  serde = { version = "1", features = ["derive"] }
  serde_json = "1"
  quick-xml = { version = "0.36", features = ["serialize"] }
  wos-core = { path = "../wos-core" }
  ```

- [ ] **Step 1.2:** Create `wos-spec/crates/wos-export/src/lib.rs` with module declarations:

  ```rust
  //! Provenance export to PROV-O JSON-LD, IEEE 1849 XES, and OCEL 2.0.
  //!
  //! Implements the WOS Semantic Profile §5 (PROV-O) and §6 (XES/OCEL).
  //! Takes a [`wos_core::provenance::ProvenanceLog`] and export configuration
  //! and produces serialized output in the requested format.

  pub mod ocel;
  pub mod prov_o;
  pub mod xes;

  /// Export configuration derived from a Semantic Profile Document.
  #[derive(Debug, Clone)]
  pub struct ExportConfig {
      /// Base namespace for minting provenance IRIs (PROV-O §5.2).
      pub provenance_namespace: String,
      /// Instance ID used as the XES case identifier / OCEL case reference.
      pub instance_id: String,
  }
  ```

- [ ] **Step 1.3:** Add `wos-export` to the workspace `members` array in `wos-spec/Cargo.toml`.

- [ ] **Step 1.4:** Run `cargo check -p wos-export`. Must compile (empty modules are fine at this stage).

- [ ] **Step 1.5:** Commit.
  ```
  git add wos-spec/crates/wos-export/ wos-spec/Cargo.toml
  git commit -m "feat(wos-export): scaffold crate with module structure"
  ```

---

## Task 2: PROV-O JSON-LD export (`prov_o` module)

**Files:**
- Create: `wos-spec/crates/wos-export/src/prov_o.rs`

**Spec anchor:** Semantic Profile §5.3 (Facts tier mapping), §5.4 (bundle mapping), §5.5 (actor type mapping), §5.6 (conformance requirements).

The output is a JSON-LD document with `@context` embedding PROV-O and WOS namespaces, and a `@graph` array of Activity/Entity/Agent nodes.

- [ ] **Step 2.1:** Define the output types in `prov_o.rs`:

  ```rust
  use serde::Serialize;
  use wos_core::provenance::{ProvenanceLog, ProvenanceRecord};
  use crate::ExportConfig;

  /// PROV-O JSON-LD document (S5.6).
  #[derive(Debug, Serialize)]
  pub struct ProvODocument {
      #[serde(rename = "@context")]
      pub context: serde_json::Value,
      #[serde(rename = "@graph")]
      pub graph: Vec<serde_json::Value>,
  }
  ```

- [ ] **Step 2.2:** Implement `pub fn export(log: &ProvenanceLog, config: &ExportConfig) -> ProvODocument`. The function:

  1. Constructs the standard `@context` with `prov`, `xsd`, and `wos` namespace prefixes.
  2. For each `ProvenanceRecord` in the log (§5.3 mapping):
     - Emits a `prov:Activity` node with `@id` = `{namespace}{record.id or index}`, `prov:atTime`, `wos:actionType` = `record.record_kind` (camelCase), `prov:wasAssociatedWith` referencing the agent node.
     - Emits a `prov:Agent` node for `record.actor_id` (deduplicating across records). Actor type maps per §5.5: `human` → `["prov:Person", "wos:HumanAgent"]`, `system` → `["prov:SoftwareAgent", "wos:SystemAgent"]`, `agent` → `["prov:SoftwareAgent", "wos:AIAgent"]`. When `actor_id` is absent, omit the agent link.
  3. Returns `ProvODocument { context, graph }`.

- [ ] **Step 2.3:** Add unit test in the same file:

  ```rust
  #[cfg(test)]
  mod tests {
      use super::*;
      use wos_core::provenance::{ProvenanceLog, ProvenanceRecord};

      #[test]
      fn exports_state_transition_as_prov_activity() {
          let mut log = ProvenanceLog::default();
          log.push(ProvenanceRecord::state_transition(
              "Draft", "Submitted", "submit", Some("user-1"), "2026-01-01T00:00:00Z"
          ));
          let config = ExportConfig {
              provenance_namespace: "https://example.org/prov/".into(),
              instance_id: "inst-001".into(),
          };
          let doc = export(&log, &config);
          let graph = &doc.graph;
          assert_eq!(graph.len(), 2); // activity + agent
          let activity = &graph[0];
          assert_eq!(activity["@type"], "prov:Activity");
          assert_eq!(activity["wos:actionType"], "stateTransition");
      }
  }
  ```

- [ ] **Step 2.4:** Run `cargo test -p wos-export`. Must pass.

- [ ] **Step 2.5:** Commit.
  ```
  git commit -am "feat(wos-export): PROV-O JSON-LD export (Semantic Profile §5)"
  ```

---

## Task 3: XES XML export (`xes` module)

**Files:**
- Create: `wos-spec/crates/wos-export/src/xes.rs`

**Spec anchor:** Semantic Profile §6.3. Output: valid IEEE 1849-2016 XES XML with Concept, Time, Lifecycle, Organizational, and ID extensions declared.

- [ ] **Step 3.1:** Implement `pub fn export(log: &ProvenanceLog, config: &ExportConfig) -> String`. The function uses `quick-xml` to emit:

  - `<log>` root with XES namespace and standard extension declarations.
  - One `<trace>` containing one `<string key="concept:name" value="{instance_id}"/>`.
  - One `<event>` per `ProvenanceRecord` with:
    - `<string key="concept:name" value="{record_kind camelCase}"/>`
    - `<date key="time:timestamp" value="{record.timestamp}"/>`
    - `<string key="org:resource" value="{actor_id or 'system'}"/>`
    - `<string key="identity:id" value="{index}"/>`
    - `<string key="wos:lifecycleState" value="{from_state or ''}"/>` (custom WOS attribute — do NOT use `lifecycle:transition`; see §6.3 note)

- [ ] **Step 3.2:** Add unit test verifying the output parses as valid XML and contains the expected `<event>` count.

- [ ] **Step 3.3:** Run `cargo test -p wos-export`. Must pass.

- [ ] **Step 3.4:** Commit.
  ```
  git commit -am "feat(wos-export): XES XML export (Semantic Profile §6.3)"
  ```

---

## Task 4: OCEL 2.0 JSON export (`ocel` module)

**Files:**
- Create: `wos-spec/crates/wos-export/src/ocel.rs`

**Spec anchor:** Semantic Profile §6.4. Output: valid OCEL 2.0 JSON with `objectTypes`, `eventTypes`, `objects`, `events` top-level keys.

- [ ] **Step 4.1:** Implement `pub fn export(log: &ProvenanceLog, config: &ExportConfig) -> serde_json::Value`. The function:

  - Declares one object type `"wf-instance"` with attribute `"instanceId"`.
  - Creates one object with `id = config.instance_id`, type `"wf-instance"`.
  - For each `ProvenanceRecord`: emits one event with `id`, `type` = `record_kind`, `time`, `attributes`, and `relationships` linking to the workflow instance object.
  - Events that mutate multiple case file items MUST produce one event with multiple E2O links (§6.4 requirement) — for this implementation, each event links to the instance object only (case file item tracking is a future extension).

- [ ] **Step 4.2:** Add unit test verifying the output is valid JSON with `objectTypes`, `eventTypes`, `objects`, `events` keys, and that event count equals record count.

- [ ] **Step 4.3:** Run `cargo test -p wos-export`. Must pass.

- [ ] **Step 4.4:** Commit.
  ```
  git commit -am "feat(wos-export): OCEL 2.0 JSON export (Semantic Profile §6.4)"
  ```

---

## Task 5: Conformance fixtures

**Files:**
- Create: `wos-spec/crates/wos-conformance/tests/fixtures/sp-export-prov-o.json`
- Create: `wos-spec/crates/wos-conformance/tests/fixtures/sp-export-xes.json`
- Create: `wos-spec/crates/wos-conformance/tests/fixtures/sp-export-ocel.json`
- Modify: `wos-spec/crates/wos-conformance/tests/` (add export test runner)

Each fixture drives a minimal 3-event workflow (Draft → Submitted → Approved) and asserts properties of the exported output (graph node count, event count, required field presence). Fixtures test the export path end-to-end: run the evaluator, collect the provenance log, call `wos_export::prov_o::export` / `xes::export` / `ocel::export`, assert structural properties.

- [ ] **Step 5.1:** Author `sp-export-prov-o.json`. The fixture asserts: `prov_o_graph_node_count >= 4` (2 transitions × 1 activity + 1 agent each minimum), all Activity nodes have `wos:actionType`, `prov:atTime`, `@id`.

- [ ] **Step 5.2:** Author `sp-export-xes.json`. Asserts: output is valid XES XML, `<trace>` count == 1, `<event>` count == provenance record count, every event has `concept:name` and `time:timestamp`.

- [ ] **Step 5.3:** Author `sp-export-ocel.json`. Asserts: output has `objectTypes`, `eventTypes`, `objects`, `events` keys; event count == provenance record count; every event has a relationship to the instance object.

- [ ] **Step 5.4:** Add a `tests/export_conformance.rs` test file that loads each fixture and runs the full export pipeline. Use the existing fixture harness pattern from `tests/provenance_tests.rs`.

- [ ] **Step 5.5:** Run `cargo test -p wos-conformance`. All three new tests must pass.

- [ ] **Step 5.6:** Commit.
  ```
  git add wos-spec/crates/wos-conformance/tests/fixtures/sp-export-*.json wos-spec/crates/wos-conformance/tests/export_conformance.rs
  git commit -m "test(wos-conformance): PROV-O, XES, OCEL export conformance fixtures (SP-EXPORT-001–003)"
  ```

---

## Task 6: Update `WOS-IMPLEMENTATION-STATUS.md`

- [ ] **Step 6.1:** In the Phase 2 Advanced Provenance table, change the `Provenance Export Formats` row from `[ ]` to `[x]` and update the description.

- [ ] **Step 6.2:** In Appendix A, update the `PROV-O / OCEL / XES export` row from `🟡 (internal)` to `✅`.

- [ ] **Step 6.3:** Commit.
  ```
  git add wos-spec/WOS-IMPLEMENTATION-STATUS.md
  git commit -m "docs(wos-status): mark provenance export complete"
  ```

---

## Self-Review

**Spec coverage:**
- PROV-O mapping (§5.3–5.6) — Task 2
- XES mapping (§6.3) — Task 3
- OCEL mapping (§6.4) — Task 4
- Export scope (§6.5: Facts tier only by default) — Task 4 design note
- PII access control (§9.3) — noted in crate `lib.rs` doc comment; enforcement is a host concern
- Timestamp prerequisite — Task 0
- Conformance fixtures — Task 5
- Status docs — Task 6

**Known limitations (out of scope for this plan):**
- Higher-tier bundles (`prov:Bundle` for Reasoning/Counterfactual/Narrative, §5.4) — not emitted; the crate documents this as a future extension
- OCEL case file item object tracking — events link to instance only; per-item E2O links require case file schema introspection (future)
- SHACL validation of PROV-O output — out of scope; would require an RDF library dependency

**Plan complete.**
