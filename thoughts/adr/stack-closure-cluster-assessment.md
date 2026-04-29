# WOS Stack-Closure Cluster (0066-0071) — Resolution

Consolidated from wos-scout + trellis-scout investigations, then reconciled against `VISION.md`, `STACK.md`, `PLANNING.md`, `wos-spec/TODO.md`, `trellis/TODO.md`, and `thoughts/README.md` on 2026-04-29.

---

## Disposition

The cluster is architecturally required. It closes the open-contract set that lets the stack claim one portable, offline-verifiable case record: amendments, statutory clocks, tenant/scope, time, failure, and migration pins.

Do not treat "all six ADRs are Proposed" as a single governance blocker. Treat each ADR as a center commitment with concrete proof gates. Ratification should move in dependency order, not as one ceremonial batch.

**Owner decisions recorded 2026-04-29:**

- 0068: stack case-ledger artifacts require tenant at the Trellis envelope/profile level, even if pre-release fixtures regenerate.
- 0071: authoritative `CaseOpenPin` lives on the first anchored case-open event; other surfaces are projections.
- 0070: custody append retry exhaustion defaults to explicit operator recovery via `stalled`, not automatic semantic recovery.
- 0067: expired unresolved clocks are advisory in the base profile; stricter profiles may escalate.
- 0066: first proof is same-chain correction/rescission; cross-chain supersession graph follows after 0068 and 0071.
- 0069: reject `23:59:60` at parse time; FEL `today()` / `now()` hard-fail without explicit timezone context.

**Resolved sequence:** 0069 -> 0070 -> 0068 -> 0071 -> 0067 -> 0066.

**Why this order:** 0069 gives the timestamp substrate. 0070 fixes the commit/failure boundary. 0068 fixes scope. 0071 pins version semantics at case open. 0067 depends on 0069's time contract. 0066 depends on all of the above because supersession crosses scope, pins, clocks, and rejection authority.

---

## Current State

The first implementation layer exists: WOS `ProvenanceKind` variants, constructors, schemas in most paths, and conformance tests have landed for the cluster. Runtime trigger sites, Trellis verifier obligations, and lint rules are still open.

The scout snapshot overstates uniformity. `thoughts/README.md` still records schema gaps for 0066, while 0068 and 0070 already have more runtime state than the snapshot says. Use this memo as the resolution layer; use each execution checklist for live file-level truth.

Execution homes:

- Parent stack rollups: `TODO-STACK.md` and `PLANNING.md`.
- WOS center checklists: `wos-spec/TODO.md` ADR 0066 / 0067 sections.
- WOS reference-server prove-outs: `wos-spec/crates/wos-server/TODO.md` WS-072 / WS-073 / WS-076.
- Trellis verifier/export/vector work: `trellis/TODO.md` items 9, 10, 17, 18, 19, and 20.

---

## Resolution By ADR

### 0069 — Time Semantics

**Decision:** Ratify first, with one hard pin: chain order and timestamp order must agree for stack case ledgers. Trellis can implement the verifier check before WOS emits `ClockSkewObserved`; the check has no WOS runtime dependency.

**Closed center shape:**

- RFC3339 UTC for JSON-facing wires.
- Non-decreasing timestamps along the hash-chain order.
- Temporal-order violation gets its own verifier failure taxonomy, distinct from hash/signature failure.
- `23:59:60` is rejected at parse time.
- FEL `today()` / `now()` hard-fail without explicit timezone context.

**Open proof gates:** PLN-0073, PLN-0114, PLN-0115, PLN-0117, PLN-0131, and Trellis item 20. PLN-0115 and PLN-0117 now have owner answers; remaining work is ADR/source update plus parser/FEL fixtures.

**Next executable slice:** Trellis `tamper/0NN-timestamp-backwards`, then WOS `ClockSkewObserved` trigger once substrate timestamps are plumbed through the drain context.

### 0070 — Failure And Compensation

**Decision:** Ratify after confirming the Trellis local append receipt is the only stack commit point. WOS durable runtime state is orchestration state; it must not become evidentiary truth.

**Closed center shape:**

- Pre-commit Formspec validation failures do not anchor rejected response bytes.
- Governance denials anchor as Facts-tier `AuthorizationRejected`.
- Custody append failures produce bounded retry, then `stalled` operator state plus `CommitAttemptFailure` evidence.
- Retry exhaustion defaults to explicit operator recovery via `stalled`; automatic semantic recovery is not the base behavior.
- Runtime saga rollback does not govern the audit record; post-commit reversal routes through ADR 0066 vocabulary.

**Open proof gates:** PLN-0035, PLN-0042, PLN-0047, Trellis item 19, and WOS runtime emission. PLN-0042 now has an owner answer; remaining work is ADR/source update plus runtime recovery fixtures.

**Next executable slice:** Emit `AuthorizationRejected` before returning unauthorized from the transition path. This is the smallest user-visible proof that rejected governance acts enter the record without applying rejected effects.

### 0068 — Tenant And Scope Composition

**Decision:** Ratify the tenant/scope contract before any SaaS or multi-tenant product claim. Tenant is the outer boundary for stack case-ledger artifacts.

**Closed center shape:**

- Tenant IDs use the RFC 1035 DNS-label-compatible grammar already recorded in ADR 0068.
- Case identity is the scope bundle `(Tenant, DefinitionId, KernelId, LedgerId)`.
- Version pins are not identity; ADR 0071 owns pins.
- Cross-tenant actor authority is per-tenant authorization over a stable identity, not authority inheritance.

**Wire-format resolution:** Do not use "optional but MUST populate" as a hidden second contract. For stack case-ledger artifacts, tenant is required at the Trellis envelope/profile level. Regenerate pre-release fixtures if needed; do not preserve a weaker tenantless stack path for compatibility theater.

**Open proof gates:** PLN-0004, PLN-0005, PLN-0011, PLN-0012, PLN-0013, PLN-0015, PLN-0001..0007, and Trellis item 17. PLN-0002 now has an owner answer on required tenant presence; remaining work is source/schema/verifier execution.

**Next executable slice:** Update the canonical source of tenant truth first, then wire runtime/storage/verifier checks. Do not implement UI- or adapter-level tenant filters before the center rule is testable.

### 0071 — Cross-Layer Migration And Versioning

**Decision:** Ratify after the `CaseOpenPin` wire home is explicit. The design direction is right: immutable case identity plus mutable, governed version pins.

**Closed center shape:**

- Pin at case open across Formspec definition version, WOS `$wosWorkflowVersion`, Trellis envelope version, and Trellis conformance class.
- The authoritative pin lives on the first anchored case-open event; other surfaces are projections.
- Historical semantics must travel with export bundles or be otherwise offline-available; registry lookup alone cannot support the "offline-verifiable forever" claim.
- `MigrationPinChanged` is the only intra-chain pin mutation path.
- Breaking semantic evolution routes through ADR 0066 supersession.

**Open proof gates:** PLN-0019, PLN-0095, PLN-0096, PLN-0097, PLN-0098, PLN-0125, and Trellis item 18. PLN-0019 now has an owner answer; remaining work is ADR/source update plus pin fixtures.

**Next executable slice:** Decide the authoritative wire home for `CaseOpenPin`; then add pin-set, pin-mutation-rejected, and valid-migration vectors.

### 0067 — Statutory Clocks

**Decision:** Ratify after 0069's timestamp contract is accepted. Clocks are not timers. They are event-pair evidence with deadline semantics.

**Closed center shape:**

- Four clock kinds: `AppealClock`, `ProcessingSLA`, `GrantExpiry`, `StatuteClock`.
- `ClockStarted` materializes the computed deadline once.
- `ClockResolved` records satisfaction, elapse, pause, or cancellation.
- Expired unresolved clocks are verifier-visible. Baseline severity is advisory; stricter profiles may escalate.
- `ProcessingSLA` absorbs the older task-SLA surface where the SLA is rights- or record-relevant.

**Open proof gates:** PLN-0150, PLN-0153, PLN-0166, PLN-0167, PLN-0168, PLN-0170, Trellis item 10, and WOS ADR 0067 checklist. PLN-0170 now has an owner answer; remaining work is ADR/source update plus advisory/escalation fixtures.

**Next executable slice:** Implement one `ClockStarted` / `ClockResolved` round trip after 0069 lands. Do not start with pause/resume arithmetic; that is the hard verifier case, not the first proof of the contract.

### 0066 — Amendment And Supersession

**Decision:** Ratify last. It is the integrator ADR. Implementing it before scope, time, failure, pins, and clocks are pinned creates a second semantic migration later.

**Closed center shape:**

- Five revisit modes: correction, amendment, supersession, rescission, reinstatement.
- Prior records remain preserved. No mutation-based amendment.
- Same-chain correction/amendment/rescission/reinstatement differ from cross-chain supersession.
- Authorization is explicit via `AuthorizationAttestation`.
- Supersession graph verification is a bundle-level cross-chain concern.

**Open proof gates:** PLN-0104, PLN-0106, WOS ADR 0066 checklist, Trellis item 9, Formspec `ResponseCorrection`, and the shared amendment/supersession fixture.

**Next executable slice:** Start with same-chain correction or rescission. Add cross-chain `supersession-graph` after 0068 and 0071 are live.

---

## Shared Implementation Decisions

**Emission pattern is settled.** The WOS runtime should follow the existing drain pattern: construct record, append to provenance, stamp. The open work is trigger placement and policy input, not a new provenance pipeline.

**Verifier diagnostics need structure.** 0067 and 0070 introduce advisory diagnostics. `warnings: Vec<String>` is too weak once reports distinguish expired clocks, stalled commit attempts, and temporal-order failures. Add typed diagnostic kinds before piling more string warnings into Trellis reports.

**Trellis section 19 grows in two ways.** 0068, 0069, and 0071 are step-4 invariant checks. 0066, 0067, and 0070 add step-6 style case-ledger/export checks.

**Runtime companion hooks are not enough.** `CompanionPolicy` is a useful trigger home, but each ADR needs at least one real runtime path and one conformance fixture. A hook with no trigger is not implementation.

**Shared fixture suite is the closure proof.** Per `TODO-STACK.md`, the stack does not get the portable-case-record claim from isolated unit tests. Each accepted ADR needs at least one shared fixture bundle once WOS and Trellis execution land.

---

## Final Sequence

| Order | ADR | First proof | Blocks |
|---:|---|---|---|
| 1 | 0069 | Trellis backwards-timestamp tamper vector | 0067 precision and clock-source rules |
| 2 | 0070 | `AuthorizationRejected` runtime emission | 0066 amendment-authority denials |
| 3 | 0068 | Tenant mismatch verifier refusal | 0066 cross-tenant supersession |
| 4 | 0071 | Case-open pin + pin-mutation rejection | 0066 migration-coupled supersession |
| 5 | 0067 | Clock start/resolution bundle | 0066 open-clock cancellation |
| 6 | 0066 | Same-chain correction/rescission, then supersession graph | Full stack-closure claim |

This memo resolves the assessment. The remaining work is not another scout pass; it is ADR hardening plus implementation in the order above.
