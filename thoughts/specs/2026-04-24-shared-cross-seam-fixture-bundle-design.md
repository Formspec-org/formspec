# Shared cross-seam fixture bundle — design

**Date:** 2026-04-24
**Status:** Design; awaiting scaffold landing.
**Owner:** Formspec parent monorepo (cross-submodule coordination).
**Unblocks:** Parent [`TODO.md`](../../TODO.md) "Shared cross-seam fixture suite" item at `[8/5/5]` (40); Trellis TODO item #13 "WOS-T4 residue — shared cross-repo fixture bundle re-seeding"; Trellis TODO item #14 "ADR 0073 handoff residue — shared fixture alignment"; WOS TODO "Next T4 slice" shared-bundle reference.

## Decision

Parent monorepo hosts a new `fixtures/stack-integration/` tree at the repo root. Each bundle inside it is a directory containing one declarative scenario that composes through all three submodules — Formspec canonical response, WOS governance events, Trellis export bundle — with a pinned expected verification report the stack-level runner checks byte-for-byte. Submodules consume the bundle's `_common/` seed artifacts instead of maintaining parallel fixtures for the same scenario.

This is the **full-stack analogue of Trellis G-5**: one independent byte-match proof per scenario that the three specs compose as declared. Without it, STACK.md's "portable case record verifiable offline" claim depends on prose-only composition across three repos.

The rejected alternative — let each submodule carry its own fixtures and call composition "verified by prose" — is the current state and the gap this design closes. The second rejected alternative — promote the bundle to a first-class standalone repo — is declined because the three submodules need to evolve in lockstep with the bundle; a separate repo would re-introduce the coordination cost the bundle is meant to reduce.

## Context

### The prose-only-composition gap

As of 2026-04-24:

- **Formspec** ships canonical response semantics + signed-response fixture + `authoredSignatures` field set. Its own conformance suite validates Formspec behavior.
- **WOS** ships Signature Profile, ADR 0073 intake-handoff, and runtime emission. Its own conformance suite (`cargo nextest run -p wos-conformance`) validates WOS behavior.
- **Trellis** ships append/019 (SignatureAffirmation), append/020-022 (intake handoffs), export/006 + catalog `062-signature-affirmations.cbor`, export/007-008 + catalog `063-intake-handoffs.cbor`, and 63 byte-exact vectors byte-matched by Rust + Python stranger. Its conformance suite validates Trellis byte-level behavior.

All three submodules verify their respective conformance independently. **Nothing verifies that they compose.** The claim "canonical response → WOS governance → Trellis custody hook → offline verify" is asserted by prose in STACK.md and by the submodule TODOs that say "Formspec signed-response → WOS SignatureAffirmation → Trellis `custodyHook`." No artifact proves the composition holds.

A cold reader evaluating the stack today must:

- Read Formspec fixture X, trust its `canonical_response_hash` value.
- Switch to WOS, find a fixture (T4 or SIG-* fixtures) that uses that same hash. Not necessarily pinned to the same scenario.
- Switch to Trellis, find an `append/019`-family vector that binds WOS's event. Fixtures were generated independently so byte-alignment is approximate.

Per STACK.md § Conformance ownership: "A **shared stack-level** suite — cross-seam fixtures that exercise canonical-response, governance-coprocessor, event-chain, checkpoint-seal, custody-hook, evidence, signature, amendment, clock, and migration composition in one pinned artifact — remains **required open work**."

### Why now

The three submodule conformance layers are stable. Trellis G-5 closed (stranger byte-match at the integrity layer). WOS T4 landed SignatureAffirmation emission + ADR 0073 handoff. Formspec shipped the `authoredSignatures` field set + signed-response fixture + IntakeHandoff schema. The bundle can start landing real cross-seam proofs instead of waiting on further submodule work.

Without it, all full-stack adopter claims (SBA PoC, public-SaaS wedge, DocuSign-replacement positioning) depend on prose-only composition — exactly the class of claim STACK.md commits to proving in published semantics + vectors + verifier behavior.

## Bundle layout

```
fixtures/stack-integration/
  README.md                             # what the suite is, how to run, what counts as passing
  runner/                               # shared runner code (Rust + Python reference)
    Cargo.toml                          # `stack-integration-verify` binary
    src/
      main.rs                           # CLI entry; walks bundles/ and reports
      formspec_step.rs                  # feed canonical response through Formspec
      wos_step.rs                       # WOS acceptance step (workflow envelope / runtime); check provenance emission
      trellis_step.rs                   # verify Trellis export bundle
      crossref.rs                       # check cross-layer hash references resolve
      report.rs                         # pin format for expected-verification-report.toml
    trellis-py/                         # Python stranger counterpart (future; not Phase-1 blocking)

  _common/                              # shared seed artifacts; submodule fixtures reference these
    README.md
    canonical-response-001.json         # seed response for "signature-complete-workflow"
    canonical-response-002.json         # seed response for "public-intake-create"
    intake-handoff-workflow-attach-001.json
    intake-handoff-public-create-001.json
    signed-response-001.json            # reference; echoes the existing Formspec signed-response fixture

  bundles/
    001-signature-complete-workflow/
      README.md                         # what the scenario covers
      manifest.toml                     # declarative inputs + expected report
      formspec-response.json            # symlink-by-value reference to _common/canonical-response-001.json
      wos-provenance-events.json        # expected WOS provenance records in sequence order
      trellis-export.zip                # full Trellis export bundle (SignatureAffirmation + COC slice)
      expected-verification-report.toml # the full cross-layer verifier output to byte-match

    002-public-intake-create/
      ...                               # ADR 0073 public-create path

    003-workflow-initiated-attach/
      ...                               # ADR 0073 workflow-attach path

    004-crossref-adversary-tampered-export/
      ...                               # Trellis-side drift; expect crossref_resolved = false
    # Future bundles (beyond Phase-1 crossref slice):
    #   005-amendment-and-supersession/    # per ADR 0066
    #   006-statutory-clock-fires/         # per ADR 0067
    #   007-tenant-scope-composition/      # per ADR 0068
```

### Bundle manifest format

Each bundle's `manifest.toml` declares the inputs and expected outputs:

```toml
id          = "stack-integration/001-signature-complete-workflow"
description = """Full-stack proof that a signed Formspec response, routed \
through WOS Signature Profile workflow, emitting SignatureAffirmation via \
custodyHook into Trellis, produces a chain-verifiable export with a \
human-readable certificate-of-completion bound to the canonical response."""

[inputs]
formspec_response    = "formspec-response.json"
wos_provenance       = "wos-provenance-events.json"
trellis_export       = "trellis-export.zip"

[expected_report]
formspec_verified     = true      # Formspec server-side revalidation accepts the response
wos_workflow_accepts  = true      # WOS accepts the provenance sequence (against `$wosWorkflow` author-time envelope)
trellis_verified      = true      # Trellis verifier reports structure + integrity + readability
crossref_resolved     = true      # canonical_response_hash, SignatureAffirmation.responseRef, Trellis event chain all agree
signer_count          = 1
workflow_status       = "completed"

[expected_report.cross_references]
# Declarative cross-layer hash-alignment table — see "Cross-reference path grammar" below.

[[expected_report.cross_references.row]]
from = "formspec.signed_response.canonical_response_hash"
to   = "wos.provenance.SignatureAffirmation.responseRef"
[[expected_report.cross_references.row]]
from = "wos.provenance.SignatureAffirmation.canonical_event_hash"
to   = "trellis.event.019.canonical_event_hash"
[[expected_report.cross_references.row]]
from = "trellis.export.manifest.certificate_of_completion.response_ref"
to   = "formspec.signed_response.canonical_response_hash"

[stack_versions]
# Pins each submodule commit that produced this bundle. Runner checks
# current submodule HEADs match (warns on drift; does not block).
formspec  = "<sha-at-bundle-landing>"
wos       = "<sha-at-bundle-landing>"
trellis   = "<sha-at-bundle-landing>"
```

### Cross-reference path grammar (normative for the runner)

Each `from` / `to` string is a **dotted logical path** resolved by the stack runner — not arbitrary prose and not filesystem paths.

1. **Syntax:** `layer(.segment)+` where `layer` is one of `formspec`, `wos`, `trellis` (extend via registry if new subsystems join). Each `segment` matches `[A-Za-z0-9_]+`; hashes/refs use the **final segment** name (e.g. `canonical_response_hash`).
2. **Resolution source:** For layer `formspec`, values MUST be read from the **Formspec step output object** produced from `inputs.formspec_response` in the same run — never short-circuit by re-reading `_common/` unless the manifest declares `inputs.formspec_response = "_common/..."` and the runner hashes that file as the Formspec input. Same rule for `wos` / `trellis`: resolve from the **emitted** WOS step output and the **opened** Trellis export ZIP / verifier report for this bundle, not from a stale sibling file.
3. **Equality rule:** For a row with `from = A`, `to = B`, the runner extracts **typed byte strings** (or UTF-8 strings where explicitly specified) at both paths and requires **exact byte equality** after any declared decoding (hex → raw, JSON field → digest). If either path is missing, `crossref_resolved = false`.
4. **Anti-tautology:** Two different rows MUST NOT resolve to the **same physical field** in a single artifact unless `from` and `to` are identical strings (identity row). The runner MUST fail closed if two rows both read from `_common/canonical-response-001.json` → `canonical_response_hash` without traversing distinct producer outputs — that pattern can fake `crossref_resolved = true` while skipping WOS/Trellis.

The `expected_report` section is hand-authored from the running submodule conformance suites at bundle-landing time. It is NOT regenerated on each run (that would defeat its purpose as a pin).

### Runner contract

`cargo run -p stack-integration-verify -- --bundle bundles/001-signature-complete-workflow/`:

1. **Formspec layer.** Feed `formspec-response.json` through the Formspec reference validator. Compare result to `expected_report.formspec_verified`.
2. **WOS layer.** Feed the canonical response through `wos-formspec-binding::interpret` + `wos-runtime::accept_intake_handoff` (or the signing-workflow equivalent). Compare emitted provenance sequence to `wos-provenance-events.json` byte-for-byte. Compare the WOS acceptance outcome to `expected_report.wos_workflow_accepts`.
3. **Trellis layer.** Open `trellis-export.zip`, run `trellis-verify` against it, compare `VerificationReport` to `expected_report.trellis_verified`.
4. **Cross-reference resolution.** For each row in `expected_report.cross_references.row`, resolve both endpoints from their source submodule's output and confirm byte-equality. Any mismatch flips `crossref_resolved = false`.
5. **Emit the full report.** Compare to `expected-verification-report.toml` byte-for-byte. Exit 0 if match, 1 if mismatch.

**Passing criterion:** all three submodule verifiers accept + all cross-layer references resolve + the assembled report byte-matches the pinned expected report.

## Phase-1 bundle set

Four bundles ship in the Phase-1 slice (happy paths **plus** one adversary crossref):

1. **`001-signature-complete-workflow`** — the WOS-T4 canonical path. Formspec response with `authoredSignatures`; WOS Signature Profile completes; Trellis `append/019` + `export/006` + `065-certificates-of-completion.cbor` (when ADR 0007 execution lands).
2. **`002-public-intake-create`** — the ADR 0073 public-create path. Formspec `IntakeHandoff` with no prior case; WOS receives handoff + creates new case; Trellis `append/021` + `append/022` + `export/007`.
3. **`003-workflow-initiated-attach`** — the ADR 0073 workflow-attach path. WOS has a pre-existing case; Formspec handoff attaches; Trellis `append/020` + `export/008`.
4. **`004-crossref-adversary-tampered-export`** — intentional Trellis-side mutation (e.g. wrong `response_ref` or swapped `canonical_event_hash`) so `expected_report.crossref_resolved = false` while Formspec + WOS layers still verify. Proves the runner's discriminator is real, not happy-path-only.

Ship 1–4 together for Phase-1 closure of the stack-integration claim. Additional bundles (amendment/supersession per ADR 0066, statutory clocks per ADR 0067, tenant/scope per ADR 0068) land when the respective stack ADRs execute.

## Dependency ordering for implementation

1. **Scaffold landing** — create `fixtures/stack-integration/` tree + runner scaffold + `README.md`. No bundles yet. Lands in isolation.
2. **Runner skeleton** — `stack-integration-verify` binary compiles and runs against zero bundles (baseline: no-op success).
3. **Formspec/WOS/Trellis reference-interface exposure** — ensure each submodule's conformance-runner internals are callable from the parent runner. Likely small API additions; may require submodule commits.
4. **Bundle 001 scaffolding** — land `_common/canonical-response-001.json` (seed from existing Formspec signed-response fixture); build `001/`'s Trellis export from existing Trellis vectors + the COC slice (requires ADR 0007 execution to be partially landed); assemble WOS provenance-events from existing WOS T4 fixtures. Hand-author `expected-verification-report.toml`.
5. **Bundle 001 passing** — runner accepts bundle 001; both Rust and eventual Python-stranger implementations agree.
6. **Bundles 002 + 003** — repeat for the two ADR 0073 paths.
7. **Bundle 004 (adversary)** — land `004-crossref-adversary-tampered-export` with `crossref_resolved = false` in the manifest / expected report; prove the runner fails closed on Trellis-side drift.
8. **Submodule fixture reconciliation** — re-seed submodule fixtures to consume from `_common/` rather than maintaining parallel inputs. This is the "residue" work tracked in Trellis TODO items #13 and #14.

Steps 1–2 are ~1 session of scaffold work. Steps 3–5 are ~2–3 sessions to get the first bundle green end-to-end. Steps 6–8 are incremental.

## Out of scope

- **Phase-2+ bundle semantics** — Phase-3 case-ledger composition bundles, Phase-4 federation witness bundles. Deferred until those phases open.
- **Non-normative runner ports** — a TypeScript runner for browser-side verification is possible but not Phase-1 blocking.
- **Continuous-integration hookup** — the runner lands first; wiring to CI (parent + submodule) is a follow-on.
- **Bundle-level signing** — the bundles themselves are test fixtures, not signed artifacts. No need for a Trellis-style byte-exact cryptographic binding on the bundle itself.

## Adversary model

What this design catches:

- **Prose-composition divergence.** "WOS SignatureAffirmation references the canonical-response-hash emitted by Formspec" is a prose claim today; the bundle cross-reference rows turn it into a byte-level check. Divergence (e.g., WOS references a different hash than Formspec emits) surfaces as `crossref_resolved = false`.
- **Submodule-version drift.** If a submodule evolves and breaks its contribution to a scenario, the bundle's runner fails. Caught at parent-repo test time.
- **Composition regression.** A change in one submodule that breaks composition (e.g., WOS changes its `SignatureAffirmation` field shape) breaks the bundle's expected report.

What this design does NOT catch:

- **Scenarios not covered by a bundle.** Like any fixture-based suite, the bundle is only as good as its scenarios. Phase-1 covers three; the important thing is each scenario's check is a real byte-match, not which three are chosen.
- **Deliberate adversary routing** — the bundle proves that the happy-path composition works; it does not prove the system is adversary-proof. That's the stack ADR + adversary-model-per-layer work.
- **Cross-tenant / multi-operator composition** — deferred until ADR 0068 (tenant/scope composition) lands and the bundle set adds a tenant-scoped scenario.

## Alternatives considered

### Standalone repo for the bundle suite (rejected)

Host `fixtures/stack-integration/` in its own GitHub repo. Declined: the bundle needs to evolve in lockstep with the three submodules (when WOS adds a new provenance-record type, the bundle needs to add coverage; when Trellis re-shapes a CDDL, the bundle's expected report changes). A separate repo reintroduces the coordination cost the bundle is meant to eliminate. Hosting inside the parent monorepo where all three submodules compose is the right DI tier.

### Absorb into one submodule's conformance suite (rejected)

Put the bundles inside Trellis (the most-conformance-forward submodule). Declined: the bundle exercises Formspec and WOS layers that Trellis doesn't own. Hosting it in one submodule creates ownership-confusion and submodule-API-leakage (Trellis's test harness would need to know about Formspec's response-validator surface). Parent is the right owner.

### Prose-only, no runner (rejected, current state)

Keep STACK.md's composition claims as prose; don't build a runner. Declined: this is the gap the item is meant to close. The whole stack-level proof story collapses to "trust us" without byte-level evidence.

## Passing criterion for the design itself

This design is considered "landed" when:

1. Scaffold ships (runner compiles, walks an empty bundle set, exits 0).
2. Bundle `001-signature-complete-workflow` ships and the runner produces a byte-matching `expected-verification-report.toml`.
3. Both submodule-level changes to expose reference-interfaces (step 3 in the sequencing above) land.
4. The parent TODO item's score drops from `[8/5/5]` (40) to closed.

Bundles 002 and 003 land in follow-on sessions; the design stays passed-criterion from bundle 001 forward.

## Follow-ons triggered

- **CI wiring.** Parent CI runs `cargo run -p stack-integration-verify -- --all-bundles` on every submodule-bump PR.
- **Bundle-version manifest.** The `stack_versions` section in each bundle's manifest gets compared against current submodule HEADs; drift surfaces as a warning in the runner.
- **Submodule fixture re-seeding.** Trellis TODO items #13 + #14 (the "residue" work) close when Trellis vector generators start reading from `_common/` rather than locally-generated seeds.

## Cross-references

- **STACK.md** § Conformance ownership (the gap) + § Proof packages (the engineering-proof package this suite populates).
- **Trellis TODO** items #13 (WOS-T4 residue), #14 (ADR 0073 handoff residue) — both close when bundles 001–003 land and submodule fixtures re-seed.
- **Parent TODO** "Shared cross-seam fixture suite" at `[8/5/5]` (40) — this design's home.
- **ADR 0007** (Certificate-of-completion composition) — the COC slice inside bundle 001 lands when ADR 0007 execution is at step 3 (first positive vector).
- **ADR 0073** (case initiation + intake handoff) — bundles 002 + 003 prove its two paths.
- **WOS ADR 0062** (Signature Profile workflow semantics) — bundle 001 proves its cross-stack emission.

---

*End of design. Scaffold lands next; bundle 001 follows when ADR 0007 execution reaches step 3.*
