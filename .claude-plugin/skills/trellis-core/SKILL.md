---
name: trellis-core
version: 1.0.0
description: This skill should be used when the user asks about "Trellis", "the ledger envelope", "case ledger", "agency log", "Trellis Core", "trellis-core.md", "operational companion", "byte protocol", "dCBOR encoding", "COSE_Sign1", "Ed25519", "checkpoint", "Merkle chain", "eventHash", "priorEventHash", "LedgerCheckpoint", "custodyHook", "export bundle", "ZIP layout", "verification independence", "append idempotency", "signing-key registry", "HPKE Base-mode", "key-bag wrap", "crypto erasure", "key-class taxonomy", "Trellis ADR", "Trellis Phase 1 invariants", "stranger test", "fixture vectors", "TR-CORE-*", "TR-OP-*", "Profile A/B/C custody", "Posture-transition", "metadata budget", "delegated-compute honesty", "snapshot-from-day-one", "projection runtime discipline", or any question requiring knowledge of the Trellis cryptographic integrity substrate (the Phase 1 byte protocol and Phase 2+ operator obligations beneath Formspec intake and WOS governance). Also triggers on implementation questions involving canonical encoding, signature suites, chain construction, checkpoint format, export ZIP layout, verification algorithm, custody models, derived-artifact discipline, sidecar shapes, or where Rust byte authority (ADR 0004) collides with spec prose.

---

# Trellis Specification Navigator (trellis-core)

Navigate the Trellis cryptographic integrity substrate spec suite under `trellis/` — two normative documents (~4.2K lines), a non-normative decision gate, a 547-line traceability matrix, a 97-line upstream-rehoming map (`trellis/specs/cross-reference-map.md`), and the `trellis/REFERENCE.md` heading inventory (non-normative). Provides structured section maps, cross-spec seam tables, and decision trees so the LLM resolves Trellis questions without loading the full ~5K lines of normative + traceability prose into context.

## Metadata

- **Version:** 1.0.0
- **Status:** Trellis 1.0.0 ratified; envelope frozen as a coherent-snapshot tag, not a freeze (see `trellis/CLAUDE.md` "Nothing is released")
- **Scope:** Phase 1 byte protocol (envelope, dCBOR canonical encoding, Ed25519/COSE_Sign1, SHA-256 hash construction with domain-separation tags, HPKE Base-mode payload wrap, append idempotency, ZIP export, verification algorithm) + Phase 2+ operator obligations (custody models, projection discipline, metadata-budget honesty, delegated-compute, sidecars)
- **Authority order:** Rust is the byte authority (ADR 0004); CDDL in `trellis-core.md` §28 is structural authority; behavioral semantics live in normative prose; Python `trellis-py/` is the cross-check.

## Findings since last sync

High-signal drift noted while reconciling crate reference maps with normative prose (implementation honesty, not spec rewrites):

1. **`LedgerStore` vs Core §17 (idempotency) — RESOLVED Wave 24.** The trait
   surface stays narrow (`append_event(StoredEvent) -> Result<(), Error>`)
   but `StoredEvent` now carries the parsed `idempotency_key` via
   `with_idempotency_key`; both adapters (`trellis-store-memory` and
   `trellis-store-postgres`) read the threaded key and enforce the §17.3
   unique-`(scope, key)` invariant — the Postgres side via partial unique
   index `trellis_events_scope_idempotency_uidx`, the memory side via an
   in-process collision check across committed + buffered events. The
   verifier (`trellis-verify::verify_event_set_with_classes`) holds the
   offline (Core §16) detection path with a per-event-set
   `idempotency_index` BTreeMap. Idempotency travels in the data, not on
   the trait API; that is now a conscious design choice rather than a
   gap. Cross-check: `trellis-py` mirrors the same shape (`EventDetails`
   carries `idempotency_key`; `_verify_event_set` builds the same index).
2. **`trellis-verify` → `trellis-cddl` dev-dependency — RESOLVED Wave 22+.**
   The dep IS used: `trellis-verify/src/lib.rs:6090` consumes
   `parse_ed25519_cose_key` from a test module. Keep as dev-dep; do not
   drop. (The "ahead of wiring" framing in earlier syncs predated the
   wave-22 export-bundle test additions.)

---

## What Trellis is, in one frame

Trellis is the cryptographic integrity substrate **beneath** Formspec (intake) and WOS (governance). It is not a workflow engine and not a forms engine — it specifies the envelope, chain, checkpoint, and export-bundle format by which a Formspec response and its downstream WOS governance events become a single append-only, signed, offline-verifiable record.

It concretely answers two already-written deferrals:
1. Formspec Respondent Ledger §13 `LedgerCheckpoint` seam.
2. WOS Kernel `custodyHook` (§10.5).

What survives when the system, the vendor, and the years go away is the Trellis export. The acceptance bar is the **stranger test**: a verifier holding only the export ZIP and the published verification algorithm can confirm the record without contacting the issuer.

---

## Document Architecture

```text
┌─────────────────────────────────────────────────────────┐
│ Normative — Phase 1 byte protocol                       │
│   trellis-core.md (2324 lines)                          │
│     Envelope, encoding, signature, chain, checkpoint,    │
│     export, verification. CDDL appendix §28.             │
├─────────────────────────────────────────────────────────┤
│ Normative — Phase 2+ operator obligations               │
│   trellis-operational-companion.md (1832 lines)         │
│     Custody, projections, metadata budget, delegated-    │
│     compute, sidecars, lifecycle, witnessing seams.      │
├─────────────────────────────────────────────────────────┤
│ Non-normative — decision gate                           │
│   trellis-agreement.md (157 lines)                      │
│     Scope, primitives, 15 Phase-1 invariants, seams,     │
│     delivery shape, success criterion.                   │
├─────────────────────────────────────────────────────────┤
│ Traceability — prose wins on conflict                   │
│   trellis-requirements-matrix.md (547 lines)            │
│     79 TR-CORE + 49 TR-OP rows, ULCR/ULCOMP-R provenance,│
│     gap log.                                             │
├─────────────────────────────────────────────────────────┤
│ Upstream-rehoming map                                   │
│   cross-reference-map.md (97 lines)                     │
│     Concepts owned by Formspec Respondent Ledger or WOS. │
├─────────────────────────────────────────────────────────┤
│ Heading inventory (non-normative)                       │
│   trellis/REFERENCE.md (221 lines)                      │
│     H1/H2 outlines for every active doc.                 │
└─────────────────────────────────────────────────────────┘
```

**Authority ladder.** When two sources disagree:

1. Rust crates (`trellis/crates/trellis-{core,cddl,cose,verify,types,export,...}`) — byte authority (ADR 0004).
2. CDDL in `trellis-core.md` §28 — structural authority.
3. Normative prose in `trellis-core.md` and `trellis-operational-companion.md` — behavioral authority.
4. `trellis-requirements-matrix.md` — traceability only; prose wins on conflict.
5. Python `trellis-py/` — cross-check.
6. `specs/archive/` and `thoughts/archive/` — non-normative, do **not** cite.

---

## Quick Decision Tree — Where to Look

| Topic | Read This | Where |
|-------|-----------|-------|
| Envelope shape, dCBOR canonical encoding, signed-bytes | `trellis-core.md` | §5 Canonical Encoding, §6 Event Format |
| Signature suite, COSE_Sign1, Ed25519, suite_id registry | `trellis-core.md` | §7 Signature Profile, §8 Signing-Key Registry |
| Hash construction, domain-separation tags | `trellis-core.md` | §9 Hash Construction |
| Chain build (`eventHash`, `priorEventHash`) | `trellis-core.md` | §10 Chain Construction |
| Checkpoint format (`tree_size`, `tree_head_hash`, `suite_id`, `timestamp`, `anchor_ref?`) | `trellis-core.md` | §11 Checkpoint Format |
| Header policy, what is signed, what is not | `trellis-core.md` | §12 Header Policy |
| Reserved commitment slots (Phase 2+) | `trellis-core.md` | §13 Commitment Slots Reserved |
| Registry snapshot binding | `trellis-core.md` | §14 Registry Snapshot Binding |
| Snapshot/watermark discipline | `trellis-core.md` | §15 Snapshot and Watermark Discipline |
| Verification independence contract | `trellis-core.md` | §16 (load-bearing — verifiers free of mutable deps) |
| Append idempotency contract | `trellis-core.md` | §17 |
| Export ZIP layout (deterministic, STORED only, sorted) | `trellis-core.md` | §18 Export Package Layout |
| Verification algorithm | `trellis-core.md` | §19 |
| Trust posture honesty / "difficult and obvious" | `trellis-core.md` | §20 |
| Posture / Custody / Conformance-class vocabulary | `trellis-core.md` | §21 |
| Composition with Respondent Ledger | `trellis-core.md` | §22 |
| Composition with WOS `custodyHook` | `trellis-core.md` | §23 |
| Agency Log (Phase 3 superset preview) | `trellis-core.md` | §24 |
| Security & privacy considerations (envelope) | `trellis-core.md` | §25 |
| IANA considerations | `trellis-core.md` | §26 |
| Test vector requirements | `trellis-core.md` | §27 |
| Full CDDL (structural authority) | `trellis-core.md` | §28 Appendix A |
| Example events and exports | `trellis-core.md` | §29 Appendix B |
| Traceability anchors (TR-CORE rows) | `trellis-core.md` | §30 |
| Access taxonomy | `trellis-operational-companion.md` | §8 |
| Custody models (Profile A/B/C) | `trellis-operational-companion.md` | §9 |
| Posture-transition auditability | `trellis-operational-companion.md` | §10 |
| Posture-declaration honesty | `trellis-operational-companion.md` | §11 |
| Metadata-budget discipline | `trellis-operational-companion.md` | §12 |
| Selective-disclosure discipline | `trellis-operational-companion.md` | §13 |
| Derived-artifact discipline | `trellis-operational-companion.md` | §14 |
| Projection runtime rules | `trellis-operational-companion.md` | §15 |
| Snapshot-from-day-one | `trellis-operational-companion.md` | §16 |
| Staff-view integrity | `trellis-operational-companion.md` | §17 |
| Append idempotency (operational) | `trellis-operational-companion.md` | §18 |
| Delegated-compute honesty | `trellis-operational-companion.md` | §19 |
| Lifecycle and erasure | `trellis-operational-companion.md` | §20 |
| Rejection taxonomy | `trellis-operational-companion.md` | §21 |
| Versioning and algorithm agility | `trellis-operational-companion.md` | §22 |
| Respondent History sidecar | `trellis-operational-companion.md` | §23 |
| Workflow Governance sidecar | `trellis-operational-companion.md` | §24 |
| Grants / revocations as canonical facts | `trellis-operational-companion.md` | §25 |
| Monitoring / witnessing seams (Phase 4 preview) | `trellis-operational-companion.md` | §26 |
| Operational conformance tests | `trellis-operational-companion.md` | §27 |
| Declaration document templates (custody, posture, budget) | `trellis-operational-companion.md` | Appendix A |
| Sidecar example shapes | `trellis-operational-companion.md` | Appendix B |
| Phase-1 sign-off scope and 15 invariants | `trellis-agreement.md` | §5 |
| Trace a `TR-CORE-*` or `TR-OP-*` row | `trellis-requirements-matrix.md` | full doc |
| Concept rehomed from Respondent Ledger or WOS | `cross-reference-map.md` | full doc |

---

## Cross-Stack Seams (load-bearing)

These are the integration points where Trellis binds to upstream-owned specs. Treat them as the contract surface — changes here ripple into Formspec and WOS.

| Seam | Defined In | Consumed By | Semantics |
|---|---|---|---|
| `eventHash` / `priorEventHash` | Formspec Respondent Ledger §6.2 | Trellis chain (`trellis-core.md` §10) | Per-event content-addressed hash linking to predecessor; basis for chain integrity. |
| `LedgerCheckpoint` | Formspec Respondent Ledger §13 | Trellis checkpoint (`trellis-core.md` §11) | Periodic `(tree_size, tree_head_hash, suite_id, timestamp, anchor_ref?)` signed by the issuer; allows Merkle proofs over a stable head. |
| `custodyHook` | WOS Kernel §10.5 | Trellis custody discipline (`trellis-operational-companion.md` §9) | Per-class custody model declaration; Profile A/B/C posture × identity × integrity-anchoring. |
| Track E §21 case-ledger / agency-log extension | Trellis (proposed) | Formspec Respondent Ledger spec extension | Adds normative case-ledger and agency-log objects that wrap multiple respondent ledgers. |
| `EventStore` port | WOS Server (`wos-spec/crates/wos-server/`) | `trellis-store-postgres` + projections schema | wos-server's canonical events table is `trellis-store-postgres`; Phase-1 envelope invariants are the byte commitments it depends on. |
| Per-class DEK key-bag wrapping | ADR-0074 (formspec-native field-level transparency) | Trellis envelope discipline (HPKE Base-mode) | Field-level DEKs wrapped to per-class key bags; inherits envelope discipline. |

Naming: "case ledger" (Core §1.2) is the canonical scope name. "Respondent Ledger" / "Subject Ledger" naming is **retired downstream when WOS-bound**.

---

## Critical Behavioral Rules

1. **Verification independence (Core §16) is non-negotiable.** Verifiers MUST NOT depend on derived artifacts, workflow runtime, or mutable databases. `trellis-verify` MUST stay free of non-essential dependencies.
2. **Rust wins byte disagreements (ADR 0004).** When Rust crates and prose disagree on bytes, Rust is canonical and prose updates. Python `trellis-py/` is the cross-check oracle (G-5).
3. **Maximalist envelope, restrictive Phase-1 runtime.** Wire shape reserves capacity now; Phase-1 enforces scope via lint + runtime constraints, never by omitting capacity. Adding a field at v2 is a wire break; reserving a slot at v1 is free.
4. **No stubs.** `unimplemented!()` / `todo!()` / `NotImplementedError` are forbidden unless an architectural decision is unresolved — in which case STOP and surface it.
5. **Domain-separation tags are mandatory.** Every hash invocation uses an explicit DST per Core §9. A bare SHA-256 is a bug.
6. **dCBOR with deterministic ordering only.** RFC 8949 §4.2.2; no JCS, no canonical-JSON. Stable map-key ordering is part of the wire shape.
7. **Append is idempotent (Core §17 + Op §18).** Replaying a known event MUST NOT mutate the chain or produce a divergent head. Idempotency is enforced by content-addressing on `eventHash`.
8. **Export ZIP is deterministic.** STORED compression only (`-0`), strip extra attributes (`-X`), files prefixed with `000-/010-/...` so lexicographic order = required processing order. A non-deterministic ZIP is a verification failure.
9. **Stranger test is the acceptance bar (Agreement §10).** A verifier holding only the export ZIP and the published verification algorithm MUST be able to confirm the record without contacting the issuer.
10. **Sidecars MUST NOT change envelope semantics.** Respondent History, Workflow Governance, Disclosure Manifest, Delegated-Compute Grant, Projection Watermark — all are additive (Op §23-25, Appendix B).
11. **`specs/archive/` is non-normative.** Do not cite. The previous 8-spec family was superseded by the two-spec model (Core + Operational Companion).
12. **Profile A/B/C custody (Op §9) is the custody primitive.** Profile A = self-issued; Profile B = third-party-witnessed; Profile C = anchored to a transparency log. Posture transitions are auditable per §10 and honest per §11.
13. **Metadata budget is enforced (Op §12).** Header fields, sizes, and counts have declared budgets. Budget overruns are rejection cases (Op §21).
14. **Delegated compute is declared, not silent (Op §19).** Any computation outsourced beyond the issuer's trust boundary requires a Delegated-Compute Grant (Appendix A.6). Silent delegation is a posture-honesty violation.
15. **Phase-1 invariants are non-negotiable (Agreement §5).** All 15 invariants use RFC 2119 MUST/MUST NOT. Phase 2+ may extend but MUST be a strict superset (anchored to invariants #10 and #12).

---

## Structural Authority — CDDL and Rust Crates

Trellis has **no separate `.schema.json` files**. Structural truth lives in two places: CDDL and Rust crates. Both are co-authoritative with normative prose; when they disagree, follow the authority ladder above (Rust > CDDL > prose).

### CDDL (Concise Data Definition Language)

- **Source:** `trellis-core.md` §28 Appendix A (full CDDL grammar for envelope, event, checkpoint, export bundle).
- **Ratified by:** `trellis/crates/trellis-cddl` — Rust crate that implements the operational CDDL subset for the append scaffold (grammar text remains in §28).
- **Use when:** asking "what fields does an envelope have", "what are the keys of a checkpoint", "what's the wire shape of …".

### Rust Crates (byte authority per ADR 0004)

For byte-level questions, prefer reading the Rust source over reasoning from prose. Per-crate reference maps live under `references/crates/` and are populated by the `formspec-specs:update-trellis-nav` slash command. Each map captures public types, traits, functions, byte-level constants, derives, cross-crate deps, and the doc-comment spec anchors cited inside the source.

| Crate | Role | Reference map |
|---|---|---|
| `trellis-core` | Append/verify state machine, `LedgerStore` trait, append scaffold | `references/crates/trellis-core.md` |
| `trellis-types` | Public type surface — `StoredEvent`, `AppendHead`, `AppendArtifacts`; domain-separation tags (`EVENT_DOMAIN`, `AUTHOR_EVENT_DOMAIN`, `CONTENT_DOMAIN`); CBOR encoders | `references/crates/trellis-types.md` |
| `trellis-cddl` | Operational CDDL subset for append scaffold; authored→canonical event parsing; hash preimage (full grammar text in Core §28) | `references/crates/trellis-cddl.md` |
| `trellis-cose` | COSE_Sign1 signing, Ed25519 over `alg = -8`, `suite_id` registry, `kid` derivation, protected-header byte layout | `references/crates/trellis-cose.md` |
| `trellis-verify` | Verification algorithm — minimal-dep, stranger-test target; `verify_export_zip`, `verify_tampered_ledger`, `VerificationReport` | `references/crates/trellis-verify.md` |
| `trellis-export` | Deterministic ZIP layout (STORED only, fixed time/date, sorted, stripped extras) | `references/crates/trellis-export.md` |
| `trellis-store-memory` | In-process `LedgerStore` adapter; conformance-test backing | `references/crates/trellis-store-memory.md` |
| `trellis-store-postgres` | Postgres canonical events table; wos-server's `EventStore` composes this | `references/crates/trellis-store-postgres.md` |
| `trellis-conformance` | Full-corpus vector replay (G-4 oracle); fixture ↔ implementation cross-check | `references/crates/trellis-conformance.md` |
| `trellis-cli` | Operator CLI for append/verify/export | `references/crates/trellis-cli.md` |

Each reference map contains: module structure, public type table (with derives), public function signatures, all public constants with values (byte semantics live here), trait implementations, cross-crate dependencies, doc-comment-pinned spec anchors with `file:line`, byte-level notes, test-surface pointers, and "when to drop into the source" guidance.

### Crate-vs-prose disagreement protocol

If a crate reference map and a spec reference map disagree on a wire-shape detail:

1. **Rust wins on bytes** (ADR 0004). The crate is canonical.
2. **Surface the disagreement** rather than silently picking one — note it as a finding, not a resolution.
3. **Update the prose**, not the crate, when the prose lags. The matrix (`trellis-requirements-matrix.md`) and fixture vectors travel with the change.
4. **Cross-check Python** (`trellis/trellis-py/`) — if Rust and Python agree, the prose is the lagging artifact; if they diverge, the prose may be the bug oracle.

---

## ADRs (Active)

Active architectural decisions live in `trellis/thoughts/adr/`. Cite them when reasoning about why a wire choice was made.

| ADR | Subject |
|---|---|
| 0001-0004 | Phase 1 MVP principles, format choices (dCBOR, COSE_Sign1, SHA-256 with DSTs, deterministic ZIP) |
| 0005 | Crypto-erasure evidence (how key destruction renders a ciphertext provably unreadable) |
| 0006 | Key-class taxonomy (signing keys, payload-wrap keys, witness keys) |
| 0007 | Certificate-of-completion composition |
| 0008 | Interop sidecar discipline |

---

## Reference Maps (LLM quick-links)

Both spec and crate reference files are populated by `formspec-specs:update-trellis-nav` — run it when a spec or a crate moves.

**Inventory:** **15** files total — **5** specification maps in `references/*.md` (paths below) and **10** crate maps in `references/crates/*.md` (also summarized in the **Structural Authority — CDDL and Rust Crates** crate table).

### Specification section maps

For section-by-section navigation of each canonical document:

- `references/trellis-core.md` — Phase 1 byte protocol (2324 lines mapped)
- `references/trellis-operational-companion.md` — Phase 2+ operator obligations (1832 lines mapped)
- `references/trellis-agreement.md` — Decision gate, 15 Phase-1 invariants (157 lines mapped)
- `references/trellis-requirements-matrix.md` — TR-CORE / TR-OP traceability (547 lines mapped)
- `references/cross-reference-map.md` — Upstream-rehoming map (97 lines mapped)

Each spec reference contains: complete section map (heading → behavioral description → key concepts → when to consult), cross-references to upstream specs (Formspec Respondent Ledger, WOS Kernel), and critical behavioral rules specific to that document.

### Crate API reference maps

For Rust source navigation under `trellis/crates/`:

- `references/crates/trellis-core.md` — Append/verify state machine, `LedgerStore` trait
- `references/crates/trellis-types.md` — Public type surface, domain-separation tags, CBOR encoders
- `references/crates/trellis-cddl.md` — Operational CDDL subset, parsing, hash preimage construction
- `references/crates/trellis-cose.md` — COSE_Sign1, Ed25519, suite registry, `kid` derivation
- `references/crates/trellis-verify.md` — Verification algorithm, minimal-dep stranger-test target
- `references/crates/trellis-export.md` — Deterministic ZIP layout
- `references/crates/trellis-store-memory.md` — In-process store adapter
- `references/crates/trellis-store-postgres.md` — Postgres canonical events table
- `references/crates/trellis-conformance.md` — Full-corpus vector replay (G-4 oracle)
- `references/crates/trellis-cli.md` — Operator CLI

Each crate reference contains: module structure, public type table (with derives), public function signatures, **all public constants with values** (byte semantics), trait implementations, cross-crate dependencies, doc-comment spec anchors with `file:line`, byte-level notes, test-surface pointers, and "when to drop into the source" guidance.

---

## Navigation Strategy

1. **Identify the question type.** Byte-level (envelope/encoding/signature/chain) → `trellis-core.md`. Operator-level (custody/projection/sidecar) → `trellis-operational-companion.md`. Scope/sign-off → `trellis-agreement.md`. Traceability → `trellis-requirements-matrix.md`. Naming/rehoming → `cross-reference-map.md`.
2. **Use the decision tree above** for the specific topic.
3. **Load the reference map first** (`references/{name}.md`) — never read the full canonical spec for orientation.
4. **Read targeted sections only** when precise normative language is needed. Use the section anchors from the reference map and read ~80 lines from the offset.
5. **For byte questions, load the crate reference map first** (`references/crates/{crate}.md`), then drop into `trellis/crates/{crate}/src/` only if the map flags "When to Read the Source". Rust wins per ADR 0004.
6. **For CDDL questions**, read `trellis-core.md` §28 or `references/crates/trellis-cddl.md`. The Rust crate's grammar is the ratified mirror.
7. **Cross-reference Trellis ↔ Formspec Respondent Ledger ↔ WOS** when seams are involved (see Cross-Stack Seams table above).
8. **Never cite `specs/archive/` or `thoughts/archive/`** as normative.

---

## Cross-Spec Lookup Paths

Common questions span Trellis + upstream specs. These are the most frequent paths:

- **Chain integrity**: Formspec Respondent Ledger §6.2 (`eventHash`/`priorEventHash`) → `trellis-core.md` §10 (Chain Construction) → `trellis-types::Event`
- **Checkpoint flow**: Formspec Respondent Ledger §13 (`LedgerCheckpoint` seam) → `trellis-core.md` §11 (Checkpoint Format) → `trellis-cose::Sign1`
- **Custody declaration**: WOS Kernel §10.5 (`custodyHook`) → `trellis-operational-companion.md` §9 (Custody Models) → §10 (Posture-Transition) → §11 (Posture-Declaration Honesty)
- **Verification end-to-end**: `trellis-core.md` §19 (Verification Algorithm) → §16 (Independence Contract) → `trellis-verify` crate → stranger-test fixture under `trellis/fixtures/vectors/`
- **Export bundle**: `trellis-core.md` §18 (ZIP layout) → `trellis-export` crate → `trellis-core.md` §29 Appendix B (example exports)
- **Projection discipline**: `trellis-operational-companion.md` §14 (Derived-artifact discipline) → §15 (Projection runtime rules) → §16 (Snapshot-from-day-one) → wos-server's projections schema
- **Sidecars**: `trellis-operational-companion.md` §23-25 → Appendix B example shapes → upstream Formspec Respondent History / WOS governance bindings
- **Phase-1 sign-off**: `trellis-agreement.md` §5 (15 invariants) → `trellis-core.md` §30 (Traceability Anchors) → `trellis-requirements-matrix.md` (TR-CORE rows) → `fixtures/vectors/` byte-exact tests
- **Algorithm agility**: `trellis-operational-companion.md` §22 → `trellis-core.md` §8 (Signing-Key Registry, `suite_id` codepoints reserved for ML-DSA / SLH-DSA / hybrid) → ADR 0006 (key-class taxonomy)
- **Crypto erasure**: ADR 0005 → `trellis-operational-companion.md` §20 (Lifecycle and Erasure) → `trellis-core.md` §25 (Security and Privacy)

---

## Working Norms (from `trellis/CLAUDE.md`)

- **Phase-check first.** Decisions split on Phase 1 (SBA PoC, single-agency intake) vs Phase 2+. Phase-2+ work defers; Phase-4 work version-bumps the envelope.
- **Architectural-debt check.** Would keeping the current shape make a future change more expensive than changing now? If yes, change it. Nothing is released; only real adopters close the revision window.
- **Byte-authority check.** Byte-level question? Rust is the oracle (ADR 0004).
- **Reservation discipline.** New envelope field / hash slot / extension hook? YES at envelope layer if Phase-1 runtime restriction stays clean; runtime NO until the phase opens.
- **Spec + matrix + fixture in the same commit.** Every normative MUST has a `TR-CORE-*` / `TR-OP-*` row and (where testable) a byte-exact fixture in `trellis/fixtures/vectors/`.
- **Submodule boundary.** `trellis/` is a git submodule of `formspec/`. Commits here are separate; bump the parent submodule pointer when landing meaningful work.
