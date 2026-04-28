# Stack — Consolidated TODO

Stack-wide work that crosses more than one spec boundary. Home for items whose owner is the monorepo parent, not a single submodule. Stack-scoped ADRs land at [`thoughts/adr/`](thoughts/adr/).

Paired docs:

- **[`/TODO.md`](TODO.md)** — Formspec-specific tactical work (Formspec spec/runtime/Studio/conformance).
- **[`/PLANNING.md`](PLANNING.md)** — Atomic PLN-* rows for cross-ADR backlog (this file's rollups point into PLANNING.md for detailed row schemas).
- **[`wos-spec/TODO.md`](wos-spec/TODO.md)** — WOS-spec-internal backlog.
- **[`wos-spec/crates/wos-server/TODO.md`](wos-spec/crates/wos-server/TODO.md)** — wos-server crate execution.
- **[`trellis/TODO.md`](trellis/TODO.md)** — Trellis tactical work.
- **[`/VISION.md`](VISION.md)** — Stack-wide architectural vision; **[`/STACK.md`](STACK.md)** — public-facing.

Scoring `[Imp / Cx / Debt]` per [`.claude/user_profile.md`](.claude/user_profile.md) economic model; number in parentheses is `Importance × Debt`. Dev/time free; architecture debt expensive. Cx is scheduling-only, never priority.

Historical completion notes and resolved items moved to [`COMPLETED.md`](COMPLETED.md).

**Stack closure cluster (synthesis-merge 2026-04-27).** [`/VISION.md`](VISION.md) and [`/STACK.md`](STACK.md) absorbed the 2026-04-27 brainstorm synthesis (archived at [`thoughts/archive/specs/2026-04-27-architecture-synthesis-corrected.md`](thoughts/archive/specs/2026-04-27-architecture-synthesis-corrected.md)). [`/PLANNING.md`](PLANNING.md) **PLN-0379..0398** is the cluster's full row set: open-contract closure (PLN-0379..0385), engineering scaffolds (PLN-0386..0389), drift-prevention guards (PLN-0390..0391), profile-specific extensions and procurement triggers (PLN-0392..0398). This file (TODO-STACK.md) tracks only the cross-spec parent ADRs and rolled-up cross-stack proof; submodule-internal work lives in [`wos-spec/TODO.md`](wos-spec/TODO.md), [`wos-spec/T4-TODO.md`](wos-spec/T4-TODO.md), and [`trellis/TODO.md`](trellis/TODO.md). **Critical-path leverage:** PLN-0384 (WOS event-type taxonomy ratification) gates `wos.signing.*` / `wos.identity.*` / `wos.governance.access-*` namespace citations downstream; PLN-0379 (Trellis ADR 0010 user-content Attestation primitive) is independent parallel; PLN-0386 (formspec-server cluster scaffold) is independent parallel.

## Load-Bearing (Delivery Blockers)

- **WOS-T4 cross-stack proof + signature-attestation / certificate-of-completion closeout** `[8 / 6 / 6]` (**48**)
  - **Role:** Canonical parent-owned tracker for remaining workflow-tier signature work across Formspec, WOS, Trellis, and Studio.
  - **Scope (post-synthesis-merge 2026-04-27):** T4 stays the workflow-tier slice. Full DocuSign 100% parity per VISION §X is a parent stack closure cluster split: T4 (workflow) + PLN-0380 (signature.md §1.3 scope reopen + signing-intent URI registry + signer-authority claim shape) + PLN-0398 Trigger (administrative surface — templates, bulk-send, dashboards). T4 itself does not expand admin-surface; it closes when the workflow-tier slice is verified end-to-end.
  - **Landed:** WOS Signature Profile semantics/runtime/lint/conformance and Trellis append/export/offline-verify byte proof (2026-04-22). Certificate-of-completion **byte composition shape closed** by [Trellis ADR 0007](trellis/thoughts/adr/0007-certificate-of-completion-composition.md) (Accepted 2026-04-24 — `trellis.certificate-of-completion.v1`, export catalog row `065-certificates-of-completion.cbor`, verifier obligations).
  - **Still open:** shared cross-repo fixture bundle end-to-end, Studio authoring/validation UX, and Trellis renderer/template/UX (HTML-to-PDF reference; `trellis-interop-c2pa` adapter at `trellis/TODO.md` item #21 layers C2PA assertion onto presentation PDF — co-lands).
  - **Completion slices:**
    - **Formspec:** `authoredSignatures` response fields, signed-response fixture, server revalidation preservation, WOS-facing mapping example, and explicit legal-intent caveat for drawn images.
    - **Trellis:** `append/019-wos-signature-affirmation`; `export/006-signature-affirmations-inline` (`062-signature-affirmations.cbor`, `trellis.export.signature-affirmations.v1`); negative verify/tamper vectors; catalog↔chain cross-check; core spec registration.
    - **Studio:** Signature Profile + linked signature-field authoring/validation UX, with fixture-backed sequential and parallel tests.
    - **Verification:** one shared bundle proving canonical response → WOS semantic evidence → Trellis custody/export artifacts.
  - **Execution home:** this parent item subsumes WOS T4 residue and Trellis WOS-T4 residue tracking. Detail: [`wos-spec/T4-TODO.md`](wos-spec/T4-TODO.md).
  - **Gate:** none.

- **Shared cross-seam fixture suite** `[8 / 5 / 5]` (**40**)
  - **Role:** Full-stack proof bundle for canonical seams and composition claims.
  - **Why:** Without this, "portable case record verifiable offline" still depends on prose-only composition across submodules.
  - **Design landed:** [`thoughts/specs/2026-04-24-shared-cross-seam-fixture-bundle-design.md`](thoughts/specs/2026-04-24-shared-cross-seam-fixture-bundle-design.md) with `fixtures/stack-integration/`, manifest format, and runner contract.
  - **Initial bundles:** `001` WOS-T4 signature-complete, `002` ADR 0073 public-create, `003` ADR 0073 workflow-attach.
  - **Gate:** none; scaffold first, then bundle `001` when Trellis ADR 0007 execution reaches step 3.

## ADRs Proposed (Awaiting Acceptance)

- **ADR 0066 — amendment and supersession** `[7 / 6 / 5]` (**35**) — [`thoughts/adr/0066-stack-amendment-and-supersession.md`](thoughts/adr/0066-stack-amendment-and-supersession.md)
  - **Governance:** ratify ADR; resolve open questions (rescission-of-rescission, supersession graph shape, correction subset scope).
  - **Formspec:** Respondent Ledger `ResponseCorrection`, superseding-chain first event, reason/authorization fields, corrected-field subset schema, fixtures.
  - **WOS:** six provenance/record kinds, Facts vs Narrative tiering, governance policy fields, runtime/lint/fixtures, and `wos-export` mappings.
  - **Trellis:** `supersedes_chain_id` reservation + correction/amendment/rescission vectors (one chain); cross-chain supersession runtime + graph export/verifier (sequential follow-on ADR when cross-chain composition lands).
  - **Cross-repo:** shared fixture bundle `005-amendment-and-supersession`; align ADR 0072 binding composition once shapes land.
  - **Execution home:** [`wos-spec/TODO.md`](wos-spec/TODO.md#adr-0066-exec-checklist), [`trellis/TODO.md`](trellis/TODO.md) item `12`, [`wos-spec/crates/wos-server/TODO.md`](wos-spec/crates/wos-server/TODO.md) `WS-072`.
  - **Gate:** owner probe.

- **ADR 0067 — statutory clocks** `[7 / 5 / 5]` (**35**) — [`thoughts/adr/0067-stack-statutory-clocks.md`](thoughts/adr/0067-stack-statutory-clocks.md)
  - **Governance:** ratify ADR; resolve timestamp granularity, synthetic resolution policy, and multi-jurisdiction emit policy.
  - **WOS:** `clockStarted` / `clockResolved` + `Clock` schema, triggers, pause/resume composition, overlaps and calendar composition.
  - **Formspec:** Statute-trigger emit path via Respondent Ledger.
  - **Trellis:** `open-clocks.json`, advisory verifier for expired-unresolved clocks, pause-segment accumulation, append vectors `014`-`017`.
  - **Cross-repo:** shared fixture bundle `006-statutory-clock-fires`; optional ADR 0069 `clock_source`.
  - **Execution home:** [`wos-spec/TODO.md`](wos-spec/TODO.md#adr-0067-exec-checklist), [`trellis/TODO.md`](trellis/TODO.md) item `13`, [`wos-spec/crates/wos-server/TODO.md`](wos-spec/crates/wos-server/TODO.md) `WS-073`.
  - **Gate:** owner probe.

- **ADR 0068 — tenant and scope composition** `[8 / 4 / 6]` (**48**) — [`thoughts/adr/0068-stack-tenant-and-scope-composition.md`](thoughts/adr/0068-stack-tenant-and-scope-composition.md)
  - **Scope:** tenant-outermost hierarchy, case scope bundle `(Tenant, DefinitionId, KernelId, LedgerId)`, per-tenant authorization with cross-tenant actors.
  - **Why:** prerequisite for public-SaaS wedge.
  - **Gate:** owner probe.

- **ADR 0069 — time semantics** `[7 / 2 / 6]` (**42**) — [`thoughts/adr/0069-stack-time-semantics.md`](thoughts/adr/0069-stack-time-semantics.md)
  - **Pins:** RFC3339 UTC wire format, millisecond+ precision, chain-order/time-order rule, UTC-SLS leap smear, optional clock-source attestation, explicit FEL timezone.
  - **Gate:** owner probe.

- **ADR 0070 — cross-layer failure and compensation** `[7 / 5 / 6]` (**42**) — [`thoughts/adr/0070-stack-failure-and-compensation.md`](thoughts/adr/0070-stack-failure-and-compensation.md)
  - **Pins:** Trellis append as commit point, pre-commit Formspec failures, post-commit WOS rejections on rejection event, bounded retry + idempotency, `stalled` kernel state, no runtime saga, `CommitAttemptFailure` Facts record.
  - **Gate:** owner probe.

- **ADR 0071 — cross-layer migration and versioning** `[7 / 4 / 5]` (**35**) — [`thoughts/adr/0071-stack-cross-layer-migration-and-versioning.md`](thoughts/adr/0071-stack-cross-layer-migration-and-versioning.md)
  - **Pins:** pin-at-case-open across six dimensions, version-aware verification, phase-cut verifier compatibility, authorized mid-flight migration via `MigrationPinChanged`, breaking semantics through ADR 0066 supersession.
  - **Gate:** owner probe.

- **Stack ADR (TBD number) — identity attestation** `[7 / 4 / 5]` (**35**) — parent **PLN-0381**; supersedes existing PLN-0310 closed-by-supersession 2026-04-27.
  - **Scope:** `IdentityAttestation` shape; proposed `wos.identity.*` event taxonomy ratification (gates on PLN-0384); claim graph distinguishing authentication-method strength from signer-authority claim; composes with existing Respondent Ledger §6.6 per-event identity-attestation shape. Closes the third event-shape gap in STACK §Open contracts.
  - **Number:** pick next free in parent-repo `thoughts/adr/` (0079..0081 taken).
  - **Why:** synthesis-merge promoted from Trigger to P0 center commitment per VISION §V open-contracts list; cross-stack contract for IdP-adapter neutral attestation that lands as canonical event kind and travels in export bundle.
  - **Execution home:** [`wos-spec/TODO.md`](wos-spec/TODO.md) "Identity attestation shape — generalize beyond signatures"; [`trellis/TODO.md`](trellis/TODO.md) item `10`.
  - **Gate:** owner probe + PLN-0384 (event taxonomy ratification — namespace gate).

- **Stack ADR (TBD number) — external recipient lifecycle** `[7 / 5 / 5]` (**35**) — parent **PLN-0382**.
  - **Scope:** Privacy Profile registers external systems as per-class recipients; ledgered `wos.governance.access-granted` / `wos.governance.access-revoked` events; recipient-rotation rule (per-event scope: past events keep existing key_bag immutably; future events scoped to current recipients). Companion clarification: explicit matrix entry over Trellis Core §6.4 + §9.4 + §25.6 + §8.6 `LedgerServiceWrapEntry` re-wrap semantics. Connector workers run inside `ProcessingService` boundary; idempotency tuple `(caseId, recordId)` + dead-letter mandatory.
  - **Number:** pick next free in parent-repo `thoughts/adr/`.
  - **Execution home:** [`trellis/TODO.md`](trellis/TODO.md) item `39`; WOS event-type ratification at PLN-0384.
  - **Gate:** owner probe + PLN-0384.

- **Trellis ADR 0010 — user-content Attestation primitive** `[7 / 4 / 5]` (**35**) — parent **PLN-0379**; Trellis-internal numbering (0009 taken by HPKE crate selection per Wave 18).
  - **Scope:** envelope + verifier landed end-to-end per Trellis ADR 0001-0004 maximalist-envelope discipline. CDDL §28 entry; new §9.8 domain-separation tag; binding proof to host event (chain position); reference to IdentityAttestation; `signing_intent` as URI (Trellis owns bytes, WOS owns meaning per PLN-0380). Distinct from existing Companion App A.5 Attestation (custody/disclosure/erasure). Mirror ADR 0007 precedent: ~300 lines + 11 vectors + verifier-obligation update + G-5 stranger gate extension.
  - **Why:** byte-level primitive that carries WOS Signature Profile signing-intent URIs into the chain; composes with Trellis ADR 0007 certificate-of-completion for full DocuSign-100% parity per VISION §X.
  - **Execution home:** [`trellis/TODO.md`](trellis/TODO.md) item `36`.
  - **Gate:** none Trellis-internal; WOS-side composition is PLN-0380.

- **WOS Signature Profile §1.3 scope reopen + extensions** `[7 / 4 / 5]` (**35**) — parent **PLN-0380**; not a stack ADR but a stack-coordinated WOS spec extension because §1.3 currently carves out jurisdictional legal sufficiency claims and the lead wedge requires reopening.
  - **Scope:** (1) signing-intent URI registry (URI populates Formspec `authoredSignatures` field per Core S2.1.6 — does NOT replace it); (2) signer-authority claim shape (capacity-to-bind, distinct from §2.6 authentication-method); (3) reopen §1.3 scope for ESIGN/UETA/eIDAS posture mapping. Composes with PLN-0379 (Trellis ADR 0010) — WOS owns meaning, Trellis owns URI bytes.
  - **Why:** path back to original DocuSign-100% framing per VISION §X and PLN-0370 marketing-reframe lift criteria.
  - **Execution home:** [`wos-spec/TODO.md`](wos-spec/TODO.md) Do-next #1; [`wos-spec/T4-TODO.md`](wos-spec/T4-TODO.md).
  - **Gate:** owner probe + PLN-0379 (Trellis side) + PLN-0384 (taxonomy ratification of `wos.signing.*`).

## ADRs Accepted (Implementation Underway)

- **ADR 0076 — product-tier consolidation** `[8 / 5 / 7]` (**56**) — [`thoughts/adr/0076-product-tier-consolidation.md`](thoughts/adr/0076-product-tier-consolidation.md)
  - **Pins:** 27 → 6 schema family with one author-time core (`wos-workflow.schema.json`) + 7 optional embedded blocks (governance, agents, aiOversight, signature, custody, advanced, assurance) + 2 sidecars (`wos-delivery`, `wos-ontology-alignment`) + 2 runtime artifacts (`wos-case-instance`, `wos-provenance-log`) + 1 tooling (`wos-tooling`); single top-level marker `$wosWorkflow`; specs do not physically merge (filenames + §-numbering preserved).
  - **Landed 2026-04-28 — workspace fully green** (`cargo test --workspace --no-fail-fast --tests` reports **1244 passed / 0 failed**, canonical-seams clean on 73 files): all 12 architectural-plan steps + within-section expansion pass + un-migrated-tail disposition + citation sweep landed in-session. **kernel/spec.md grew 741 → 2196 lines** as the absorption target (16 top-level chapters: §1-§10 unchanged, new §11 Runtime Serialization, §12 Evaluation Modes, §13 Formspec Coprocessor, §14 Separation Principles ← was §12, §15 Contract Validation ← was §11, §16 Host Interfaces). **D-8 amendment 2026-04-28** (append-at-end §14/§15 instead of displacing §2/§6) preserved existing §2 Conformance Classes + §6 Impact Level Classification + 12+ external citations.
  - **Detail by axis:** governance spec absorption (`workflow-governance.md` 727→814; runtime §8.4/§8.5/§9 → §3.8/§11.4/§12.4) ✓ AI spec absorption (`ai-integration.md` 680→682; runtime §8.3 + integration §8.4 → §4.6) ✓ sidecar split (`wos-delivery.schema.json` 676 lines; `wos-ontology-alignment.schema.json` renamed from semantic-profile; `wos-custody-hook-encoding.schema.json` deleted) ✓ runtime artifact migration with $defs promotion ✓ tooling consolidation (`wos-tooling.schema.json` 2411 lines absorbing 5 sources via `$views`) ✓ **91 fixtures** rewritten to merged shapes ✓ `$wosKernel` → `$wosWorkflow` rename propagated across 105 Rust files ✓ `crates/wos-conformance/src/marker_shim.rs` deleted (no compat shim) ✓ **6 standalone Rust document types refactored to embedded-block content** per D-1 ✓ within-section expansion pass: lifecycle-detail §2-§6 + runtime §4/§5/§6/§7/§11/§14 + integration §3-§7/§9 absorbed into kernel §4.x/§5.5/§9.x with `<!-- absorbed-from -->` annotations ✓ disposition pass: runtime §8.2 → kernel §4.12, runtime §13 Security Model → `docs/security-model.md`, integration §10/§11 → `docs/adapters/integration-extensions.md` ✓ **kernel-spine SCHEMA-DOC-001 fill** (160 → 79 ratchet ceiling — 42 properties on State/Transition/Actor/Lifecycle/CaseFile/etc. filled with canonical descriptions drawn from kernel/spec.md prose) ✓ `EXCLUDED_SCHEMAS_CEILINGS` count-ratchet pattern with **2026-06-30 tripwire** ✓ 9 embedded-block roots + spine fields marked `x-lm.critical: true` ✓ `wos-tooling.schema.json` `^x-` `$comment` annotation matching family pattern ✓ **CONVENTIONS.md** scoped to layered-sieve specs (kernel/governance/ai/advanced); sidecars exempt when schema descriptions cover the rubric ✓ **`specs/sidecars/README.md`** index landed (~30-line replacement for the 800-line dual-sidecar prose docs that would have been needed) ✓ **`benefits-adjudication.bluf.md`** companion authored ("structural shape only" + wrong-by-omission warning + queues MV companion after absorption stabilizes) ✓ Q1 ceremony trim: workflow-governance §4.9 quorum collapsed from 3 MUSTs + 1 MUST NOT to 1 MUST + 1 MUST NOT (only collusion-resistance + audit-integrity claims kept); §12.4 timeoutAction MUST kept verbatim; §1.5/§1.6 ordering corrected ✓ 3 new lint rules registered + **lint logic implemented + 8 inline tests** + promoted to `Tested` graduation (`WOS-AGENT-XREF-001` flags id-less agents; `WOS-SIG-COVER-001` covers multi-signer `actors[]` + single `actor`; `WOS-VER-LEVEL-001` warns on fallbackChain without verificationLevel) ✓ I-001 reanchored to kernel §9.2 ✓ LINT-MATRIX.md regenerated 116→119 rules (T1 35→36, T2 72→74) ✓ `wos.dev` → `wos-spec.org` host unification ✓ Citation sweep on active code paths: `crates/wos-lint/src/rules/registry.rs`, `crates/wos-server/{README,PARITY}.md`, `wos-spec/README.md` (inventory table rewritten to post-ADR-0076 6-schema family; legacy table preserved in collapsible details).
  - **Three rounds of /semi-formal-code-review actioned** (wos-scout architectural F1/F2/F3; wos-expert spec-fidelity E1-E8 + D-8 amendment recommendation; wos-spec-author authoring-discipline F1-F7; wos-scout user-value Q1/Q2/Q3 triage). Rounds #4 + #5 (wos-expert + wos-spec-author full-pass review) currently in flight.
  - **Source files retained as redirect-stub homes** per user directive — only delete fully-migrated files; each carries "Fully migrated 2026-04-28 (ADR 0076 D-8)" banner with explicit landed/pending list. Each retains non-normative residue (§1 Intro + §2 Conformance preamble; lifecycle-detail §7 SCXML; integration §12 Examples; signature.md prose normative content; semantic.md ontology export — schema renamed but prose retained pending dual-rename).
  - **Still open:** Final source-file deletion (companion + profile docs after final disposition decision on whether informational §1/§2 preamble + non-absorption-listed content like SCXML interop justifies retention vs aggressive cleanup); Python `tests/schemas/conftest.py` `MARKER_TO_SCHEMA` rewrite (gated by file deletion); inner-block 79 SCHEMA-DOC-001 violations gated on PLN-0176..0207 (governance/agents/aiOversight/signature/custody/advanced/assurance inner block leaves whose canonical descriptions live in spec docs awaiting absorption — tracked in count-ratchet, not hallucinated); Reviews #4 + #5 findings to apply on completion.
  - **Execution home:** [`wos-spec/TODO.md`](wos-spec/TODO.md) audit log; this ADR is now substantively closed at the architectural and content-migration layers.
  - **Gate:** none on the architectural cut. Editorial finishing (final file deletion + Python conftest) requires a focused follow-up session.

- **ADR 0077 — canonical kernel extension seams** `[6 / 2 / 4]` (**24**) — [`thoughts/adr/0077-canonical-kernel-extension-seams.md`](thoughts/adr/0077-canonical-kernel-extension-seams.md)
  - **Pins:** Kernel §10 enumerates the canonical six seams (`actorExtension`, `contractHook`, `provenanceLayer`, `lifecycleHook`, `custodyHook`, `extensions` / `x-` keys). The five invented names (`attachmentExtension`, `caseFieldExtension`, `eventExtension`, `outcomeExtension`, `sidecarExtension`) had no §10 backing and are retired.
  - **Fully landed 2026-04-28:** D-5 follow-ups in `wos-spec/specs/kernel/spec.md:19` Abstract ("five" → "six" with the canonical six enumerated and ADR 0077 cited) and `wos-spec/schemas/kernel/wos-kernel.schema.json:5` description (same fix); `wos-spec/counter-proposal-disposition.md` row E9 rewritten to point at Kernel §10.6 `x-` extensions; "Seam vocabulary drift" section collapsed to a one-paragraph "resolved by ADR 0077" reference. **Executable invariant:** `wos-spec/scripts/check-canonical-seams.py` walks `specs/**/*.md` + `schemas/**/*.json` rejecting any reappearance of the five invented names; wired into `.github/workflows/schema-regression.yml` as a CI step. Currently clean on 72 files.
  - **Still open:** none. The ADR is fully implemented at the executable-invariant layer.
  - **Gate:** none.

- **ADR 0073 — case initiation and intake handoff** `[8 / 4 / 6]` (**48**) — [`thoughts/adr/0073-stack-case-initiation-and-intake-handoff.md`](thoughts/adr/0073-stack-case-initiation-and-intake-handoff.md)
  - **Landed:** Formspec `IntakeHandoff` schema/spec/lint/types/Python validation + both example modes; WOS typed parser + runtime acceptance seam/policy/provenance; Runtime Companion `acceptIntakeHandoff`; kernel provenance schema/prose; Trellis workflow-attach and public-intake vectors.
  - **Still open:** parent-owned shared fixture bundle exposing canonical response/handoff artifacts directly from top-level repo.
  - **Done means:** cold-reader traceability across Formspec → WOS → Trellis without prose-only composition claims.

- **ADR 0072 — evidence integrity and attachment binding** `[7 / 4 / 5]` (**35**) — [`thoughts/adr/0072-stack-evidence-integrity-and-attachment-binding.md`](thoughts/adr/0072-stack-evidence-integrity-and-attachment-binding.md)
  - **Landed:** Formspec origin shape, Trellis export contract, `append/018-attachment-bound`.
  - **Still open:** Trellis export/verify/tamper coverage for `061-attachments.cbor` and `trellis.export.attachments.v1`.

- **Identity attestation bundle shape** `[Closed]` — **superseded 2026-04-27** by stack ADR (TBD number) at parent **PLN-0381** above. Synthesis-merge promoted identity attestation from Trigger to P0 center commitment per VISION §V open-contracts list. Original `[5 / 3 / 4]` (20) score and "Gate: signature-workflow evidence shape proven sufficient by WOS-T4 closeout" no longer apply — center commitment proceeds independently. PLN-0310 closed-by-supersession in PLANNING.md; canonical work tracked at PLN-0381.

## Sustaining (Hygiene, Not Delivery)

- **WOS-spec workspace in parent CI** `[5 / 2 / 2]` (**10**)
  - Root workspace excludes `wos-spec/`, so top-level CI misses `wos-lint`, `wos-conformance`, `wos-runtime`, and `wos-server`.
  - Add dedicated job (or required check) that runs `cargo test --workspace` inside `wos-spec/`.
  - **Indexed backlog:** [`wos-spec/TODO.md`](wos-spec/TODO.md) ADR 0064 + architecture-review handoff.
  - **Gate:** none.

- **Security disclosure policy** `[6 / 2 / 4]` (**24**)
  - Trellis reference implementation is landed; disclosure policy is now load-bearing in `STACK.md`.
  - **Trellis-side scope contribution:** [`trellis/TODO.md`](trellis/TODO.md) item `35`.
  - **Gate:** none.

- **Trellis Wave 15-17 review follow-ups** `[5 / 2 / 3]` (**15**) — **CLOSED via Wave 18 (2026-04-27).** All three follow-ups landed: §A.5.2 renumber + R19 parity lint (items 29, 34); HPKE crate hardening with ADR 0009 promotion (item 31); store-postgres review follow-ups including the bonus IPv6-bracket parser bugfix (item 32); plus Wave 15 R15 temporal-in-force enforcement (item 30). Eight secondary review-finding cleanups remain queued in `trellis/TODO.md` (R19 BLOCKER widening, HPKE feature-gate dep-graph promotion, migration empty-`MIGRATIONS` defense, etc.) — Trellis-internal, no cross-stack coordination owed.

## Recently landed (Trellis, 2026-04-27)

- **Wave 16:** Rust HPKE wrap/unwrap byte-matching `append/004` (new `trellis-hpke` sibling crate, kept off the `trellis-verify` dep tree per Core §16); `trellis-store-postgres` production-hardened (TLS, transaction-composition surface, idempotency-key uniqueness, versioned migrations, parity tests + Postgres CI, `r2d2` connection pool). G-5 strengthens from "vectors match" to "both implementations independently derive the bytes."
- **Wave 17:** `KeyEntry` taxonomy per ADR 0006 fully closed — Core §8.7 + Rust + Python + lint + matrix rows TR-CORE-039/047/048/049 + vector corpus (`append/031..035` reservation classes + `tamper/023..025` class-dispatch negatives); typed `VerifyError.kind` plumbs `key_entry_attributes_shape_mismatch` to the `tamper_kind` enum; ADR 0005 `wrap`→`subject` reconciliation now executed on both runtimes. Plus HPKE duplicate-ephemeral lint R17 in `scripts/check-specs.py`.
- **Wave 18 (2026-04-27):** HPKE crate hardening + ADR 0009 promotion (`hpke-crate-selection` promoted from spike doc; all five crypto deps `=`-pinned; `test-vectors` Cargo feature gates carve-out path; `check-verifier-isolation.sh` CI assertion); §A.5.2 reason-code corpus reconciliation via path (a) renumber + R19 parity lint (`check_reason_code_corpus_parity`); R15 temporal-in-force enforcement extended to half-open in-force windows; `trellis-store-postgres` review follow-ups (`MemoryTransaction::commit → Result<(), Infallible>` for cross-store generics; four loopback-DSN edge-case tests including IPv6-URI bracketed-host extraction bugfix in `extract_dsn_host`; migration runner refuse-on-future-version guard). **ADR 0005 Stage 1 spec deltas** also landed (Companion §20.6 + OC-141..146; Core §6.7/§6.9/§19 step 6b/§19.1 enum; matrix TR-OP-105..109/113/114). **Trellis-internal numbering:** ADR 0009 now taken (HPKE crate selection); next free is 0010 — proposed for user-content Attestation primitive (PLN-0379).
- **Wave 19 (2026-04-27):** AEAD nonce determinism — Core §9.4 + §17 amendment (parent **PLN-0383**, signature-stack-relevant — silent retry-determinism class on signed events). Plus interop-sidecar reservation scaffold (precursor to Wave 20).
- **Wave 20 (2026-04-27):** ADR 0008 interop sidecar reservation — lock-off only (`scitt-receipt` / `vc-jose-cose-event` / `c2pa-manifest` / `did-key-view` adapter implementations are sequential follow-on ADRs tracked per parent **PLN-0313**); empty crates `trellis-interop-{scitt,vc,c2pa,did}` + cargo-deny config forbidding ecosystem libs from `trellis-core` / `trellis-verify` / `trellis-types` (ADR 0008 ISC-05 hygiene contract).
- **Wave 21 (closed 2026-04-28):** ADR 0005 Stages 2-5 fully landed in a 9-commit train (`c13282f` slot collision + R16 deprecated tombstone + conformance deprecated-vector skip; `1c09786` Rust verifier extension; `465dff1` Python parity; `cb85344` tamper vectors `append/017..019`; `95d5bd4` export bundle `export/009-erasure-evidence-inline` + 432-line generator; `b4c4abb` CLI `erase-key` initial stub; `75f750c` Companion §27.1 prose; `58dd8a4` matrix promotion TR-OP-105 + TR-OP-107 prose → `test-vector`; `1b00a9a` TODO + COMPLETED closeout). Slot collision resolved per lean (b) — `export/009-intake-handoffs-public-create-empty-outputs` renumbered to `export/013-...` (preserves Trellis item #4 cert-of-completion's reservation of `export/010` per ADR 0007 *Fixture plan*); R16 lifecycle marker is a deprecated tombstone manifest at slot 009 with `status = "deprecated"` + `deprecated_at = "2026-04-28"`. TR-OP-106/108/109/113 unchanged in this wave — their promotions gate on follow-on tamper vectors per ADR 0005 *Fixture plan*. **This closes parent PLN-0312 (foundational crypto execution bundle) entirely.** See [`trellis/COMPLETED.md`](trellis/COMPLETED.md) Wave 21 entry.
- **Architectural correction landed:** `trellis-store-postgres` owns the canonical-side schema; wos-server `EventStore` composes it + an in-database `projections` schema. Reconciliation of [`wos-spec/crates/wos-server/TODO.md`](wos-spec/crates/wos-server/TODO.md) **WS-020** + **WS-090** (currently a two-port `Storage` + `AuditSink` split that VISION.md §VIII rejects) is owed wos-server-side.

- **Stack-level ADR cross-check lint** — **RESCOPED 2026-04-28 (LARGER-THAN-CLAIMED).** Cross-stack-scout validation found no ADR carries a structured `Cross-references:` section the lint can grep — refs are inline narrative across `thoughts/adr/` (parent, 30+ files), `wos-spec/thoughts/adr/`, and `trellis/thoughts/adr/`. "Seam-touching" has no concrete definition. The lint itself is trivial; the work is the **convention** — adding a structured `## Cross-references` block (or YAML frontmatter) to the ADR template, which is a stack-wide convention change requiring owner sign-off, not single-session. Re-file as a two-step (template revision → lint) once the convention is decided.

- **ADR 0073 terminology normalization** — **CLOSED 2026-04-28** ([wos-spec/COMPLETED.md](wos-spec/COMPLETED.md) Session 16). Three files updated: `thoughts/adr/0059-unified-ledger-as-canonical-event-store.md:634` (parent), `thoughts/adr/0073-stack-case-initiation-and-intake-handoff.md:47`, `trellis/thoughts/formspec/adrs/0059-unified-ledger-as-canonical-event-store.md:635` (Trellis submodule). Each preserves "(formerly `CaseInitiationRequest`; renamed via ADR 0073)" so historical references resolve. Trellis-side change requires submodule commit + parent submodule-pointer bump on commit.

## Trigger-Gated

- **Stack-wide TypeID utility crate** `[4 / 3 / 3]` (**12**)
  - Primitive: `{tenant}_{type}_{uuidv7_base32}`.
  - WOS already adopted in ADR-0061; extract layer-0 `formspec-typeid` (Rust + Python) when a second spec adopts.
  - Candidate adopters: Formspec response IDs, Trellis bundle artifacts, respondent-ledger event IDs.
  - **Gate:** second adopter.

- **Reference deployment topology spec** `[5 / 5 / 2]` (**10**)
  - Turn `STACK.md` 4-process model into deployable reference: container composition, storage defaults, secrets handling, anchor-adapter defaults.
  - **Gate:** SBA engagement shape or public-SaaS launch requirement.
