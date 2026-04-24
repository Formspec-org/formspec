# Formspec — Consolidated TODO

**Validated 2026-04-22.** Items #29, #30, #31, #32 all landed in the 2026-04-19 batch. All 29 previously-draft lint rules now graduated (37 total tested, 0 draft). Cross-repo WOS-T4 / Trellis signature closeout is now tracked canonically here at the stack level; submodule TODOs remain the local execution notes. Formspec's signed-response / `authoredSignatures` slice landed 2026-04-22. Trellis `SignatureAffirmation` append/export/verify/tamper vectors and Core extension prose landed 2026-04-22 (`trellis/` submodule).

## Open

Scoring `[Imp / Cx / Debt]` per [`.claude/user_profile.md`](.claude/user_profile.md) economic model; number in parentheses is `Imp × Debt`. Dev/time free; architecture debt expensive. Cx is scheduling-only, never priority.

### Stack-wide

Items that cross more than one spec boundary. Home for work whose owner is the monorepo parent, not a single submodule. Stack-scoped ADRs land at [`thoughts/adr/`](thoughts/adr/).

**Load-bearing — block real delivery:**

- **WOS-T4 cross-stack proof + signature-attestation / certificate-of-completion closeout** `[8 / 6 / 6]` (**48**) — canonical parent-owned tracker for the remaining signature-workflow work spanning Formspec, WOS, Trellis, and Studio. This is the stack-level coordination item for the `Signature attestation shape` contract named in [STACK.md](STACK.md), so the four repos reference one owner here instead of duplicating the same closeout work in parallel. WOS-side Signature Profile semantics, runtime emission, lint, and conformance landed 2026-04-22; Trellis byte proof for append + export + offline verify landed the same day (see Trellis slice below). **Still open:** one shared cross-repo fixture bundle wired end-to-end, Studio authoring/validation UX, and Trellis-owned human certificate-of-completion composition beyond the machine-verifiable export catalog. This item subsumes [wos-spec/T4-TODO.md](wos-spec/T4-TODO.md) T4-9 through T4-12, [wos-spec/TODO.md](wos-spec/TODO.md) Do next #1 "Next T4 slice", and [trellis/TODO.md](trellis/TODO.md) Stream 1.
  Completion slices:
  Formspec: landed 2026-04-22 — canonical `authoredSignatures` response field set, signed-response fixture, server revalidation preservation, WOS-facing mapping example, and explicit "drawn image alone is not legal intent" statement.
  Trellis: landed 2026-04-22 — `append/019-wos-signature-affirmation` (ADR-0061 idempotency tuple + `custodyHook`); `export/006-signature-affirmations-inline` with `062-signature-affirmations.cbor` and manifest extension `trellis.export.signature-affirmations.v1`; negative `verify/014-export-006-signature-row-mismatch` and `tamper/014-signature-catalog-digest-mismatch`; `trellis-verify` catalog↔chain cross-check; normative registration in `trellis/specs/trellis-core.md` §6.7 / §18 / §19. **Remaining:** certificate-of-completion *presentation* contract and optional alignment of vector seeds to the parent Formspec signed-response fixture URL byte-for-byte.
  Studio: authoring + validation UX for Signature Profile and linked Formspec signature fields, plus fixture-backed sequential and parallel tests.
  Verification: one shared cross-repo fixture bundle proving canonical response → WOS semantic evidence → Trellis custody/export artifacts (Trellis side has a standalone proof chain today; bundle wiring still open).
  **Gate:** none — cross-repo execution.

**ADRs proposed — awaiting acceptance:**

- **ADR 0066 — amendment and supersession** `[7 / 6 / 5]` (**35**) — [`thoughts/adr/0066-stack-amendment-and-supersession.md`](thoughts/adr/0066-stack-amendment-and-supersession.md). Four modes (correction / amendment / supersession / rescission); per-layer event shapes; `AuthorizationAttestation` record; `supersession-graph.json` bundle manifest. **Gate: owner probe.**
- **ADR 0067 — statutory clocks** `[7 / 5 / 5]` (**35**) — [`thoughts/adr/0067-stack-statutory-clocks.md`](thoughts/adr/0067-stack-statutory-clocks.md). Four clock kinds (AppealClock / ProcessingSLA / GrantExpiry / StatuteClock); `ClockStarted` / `ClockResolved` event-pair; `open-clocks.json` bundle manifest; pause-as-resolution composition. **Gate: owner probe.**
- **ADR 0068 — tenant and scope composition** `[8 / 4 / 6]` (**48**) — [`thoughts/adr/0068-stack-tenant-and-scope-composition.md`](thoughts/adr/0068-stack-tenant-and-scope-composition.md). Hierarchical composition; tenant is outermost; case scope bundle is `(Tenant, DefinitionId, KernelId, LedgerId)`; actors span tenants, authorization per-tenant. Public-SaaS wedge prerequisite. **Gate: owner probe.**
- **ADR 0069 — time semantics** `[7 / 2 / 6]` (**42**) — [`thoughts/adr/0069-stack-time-semantics.md`](thoughts/adr/0069-stack-time-semantics.md). Six pins: RFC3339 UTC on wire; millisecond-or-better precision; chain-order ↔ timestamp-order; UTC-SLS leap-smear; optional clock-source attestation; explicit FEL timezone. **Gate: owner probe.**
- **ADR 0070 — cross-layer failure and compensation** `[7 / 5 / 6]` (**42**) — [`thoughts/adr/0070-stack-failure-and-compensation.md`](thoughts/adr/0070-stack-failure-and-compensation.md). Trellis append is the commit point; Formspec failures pre-commit; WOS rejections post-commit on the rejection itself; bounded retry with idempotency; `stalled` kernel state; no runtime saga (compensation routes through ADR 0066); `CommitAttemptFailure` Facts-tier record. **Gate: owner probe.**
- **ADR 0071 — cross-layer migration and versioning** `[7 / 4 / 5]` (**35**) — [`thoughts/adr/0071-stack-cross-layer-migration-and-versioning.md`](thoughts/adr/0071-stack-cross-layer-migration-and-versioning.md). Pin-at-case-open across six dimensions; verification is version-aware; phase-cut verifier compatibility; mid-flight migration opt-in and authorized via `MigrationPinChanged`; breaking semantics route through ADR 0066 supersession. **Gate: owner probe.**
**ADRs accepted — implementation underway:**

- **ADR 0073 — case initiation and intake handoff** `[8 / 4 / 6]` (**48**) — [`thoughts/adr/0073-stack-case-initiation-and-intake-handoff.md`](thoughts/adr/0073-stack-case-initiation-and-intake-handoff.md). Accepted 2026-04-23. Landed: Formspec `IntakeHandoff` schema/spec/lint/types/Python validation and both example modes; WOS typed handoff parser plus runtime intake-acceptance seam/policy/provenance; WOS Runtime Companion normative `acceptIntakeHandoff` algorithm; WOS kernel provenance prose/schema for `caseCreated` and `intakeAccepted|Rejected|Deferred`; Trellis append/export/verify/tamper vectors for workflow-initiated attach and public-intake create; and stack docs that distinguish `submission`, `intake record`, and `governed case`. Still open is one parent-owned shared fixture bundle that exposes the exact canonical response / handoff artifacts from the top-level repo instead of making readers discover them indirectly through submodule vectors and generators. Done means a cold reader can trace the same handoff through Formspec, WOS, and Trellis without relying on prose-only composition claims.
- **ADR 0072 — evidence integrity and attachment binding** `[7 / 4 / 5]` (**35**) — [`thoughts/adr/0072-stack-evidence-integrity-and-attachment-binding.md`](thoughts/adr/0072-stack-evidence-integrity-and-attachment-binding.md). Accepted 2026-04-22. Formspec Respondent Ledger origin shape, Trellis export-side contract, and `append/018-attachment-bound` event-side vector are landed. Remaining work is Trellis export/verify/tamper coverage for `061-attachments.cbor` and `trellis.export.attachments.v1`.
- **Identity attestation bundle shape** `[5 / 3 / 4]` (**20**) — provider-neutral identity-proofing attestation shape shared across WOS and Trellis, lifted from the now-live `SignatureAffirmation.identityBinding` evidence shape so it can travel outside the signature workflow. Tracks [trellis/TODO.md](trellis/TODO.md) Stream 2 and [wos-spec/TODO.md](wos-spec/TODO.md) "Identity attestation shape — generalize beyond signatures". **Gate: signature-workflow evidence shape proven sufficient by the cross-stack WOS-T4 closeout above.**

**Sustaining — hygiene, not delivery:**

- **Shared cross-seam fixture suite** `[8 / 5 / 5]` (**40**) — end-to-end fixtures exercising the five canonical seams (canonical response, governance coprocessor, event hash chain, checkpoint seal, custody hook) plus case-initiation handoff, evidence, signature, amendment, clock, and migration composition. This is the full-stack analogue of Trellis G-5 (stranger byte-match on one layer); without it the stack's "portable case record verifiable offline" pitch depends on prose-only composition across three submodules. The WOS-T4 cross-stack signature fixture should be the first real slice, not a parallel one-off corpus; ADR 0073 adds the required workflow-initiated attach and public-intake create fixture pair, each traced through Trellis export/verify. STACK.md flags as open gap: "composition correctness is asserted by prose." When the suite lands, full-stack claims stop depending on prose. Score upgraded 2026-04-23 after vision-model / user-story review confirmed this is the load-bearing cross-repo proof, not a hygiene item. **Gate: none — design + scaffold.**
- **Security disclosure policy** `[6 / 2 / 4]` (**24**) — Trellis reference implementation has landed; disclosure policy is now load-bearing per updated STACK.md. Draft + publish before final ratification. **Gate: none.**
- **Stack-level ADR cross-check lint** `[5 / 3 / 3]` (**15**) — mechanical lint that an ADR touching a contract seam references its counterpart ADR(s) in other projects. STACK.md flags: "a mechanical cross-check remains open work." **Gate: none — script.**
- **ADR 0073 terminology normalization** `[3 / 1 / 2]` (**6**) — remove stale `CaseInitiationRequest` dual naming now that `IntakeHandoff` is the accepted contract name, starting with [`thoughts/adr/0059-unified-ledger-as-canonical-event-store.md`](thoughts/adr/0059-unified-ledger-as-canonical-event-store.md). This is cheap but worth doing because dual names blur whether the seam artifact is a Formspec handoff, a WOS intake record, or a governed case. Done means stack ADRs and long-lived docs use `IntakeHandoff` consistently unless they are explicitly discussing a superseded term. **Gate: none — doc cleanup.**

**Trigger-gated:**

- **Stack-wide TypeID utility crate** `[4 / 3 / 3]` (**12**) — `{tenant}_{type}_{uuidv7_base32}` primitive. WOS adopted in [ADR-0061](wos-spec/thoughts/adr/0061-custody-hook-trellis-wire-format.md). Extract to a layer-0 utility (working name `formspec-typeid`, Rust + Python) when a second spec adopts (candidates: Formspec Response IDs, Trellis bundle artifacts, respondent-ledger event ids). **Gate: second adopter.**
- **Reference deployment topology spec** `[5 / 5 / 2]` (**10**) — STACK.md 4-process diagram → deployable reference (container composition, storage defaults, secrets handling, anchor-adapter defaults). **Gate: SBA engagement shape or public-SaaS launch requirement.**

### Formspec-side cross-layer

Work in the Formspec spec and runtime itself that other layers depend on. Lives in `specs/` and `schemas/`, not in stack ADRs.

- **`ResponseCorrection` event in Respondent Ledger §6** `[6 / 3 / 4]` (**24**) — references prior `ResponseSubmitted.canonical_event_hash`; narrows to a declared subset of fields. ADR 0066 D-1 Formspec-side. **Gate: ADR 0066 accepted.**
- **Offline authoring profile in Respondent Ledger companion** `[6 / 5 / 4]` (**24**) — Formspec browser runtime permits authoring while offline, but no current spec owns local-pending-state, authored-time preservation under delayed submission, or chain construction when events buffer offline and flush in bulk. [STACK.md](STACK.md) §"Timeline of one case" cites autosaves and "material changes" without naming where the semantic obligations live. Respondent Ledger companion must declare the profile so Trellis's `priorEventHash: [Hash]` reservation (Trellis ADR 0001) has a producer-side contract to validate against. Subsumes three migration SHOULDs dropped alongside the profile (archived ULCOMP-R-210..212): (a) offline coordination scope reduction, (b) offline capability reservation, (c) draft/canonical separation — these are offline-authoring semantics, not version-migration, and do NOT fall inside stack ADR 0071. Gap source: [`trellis/specs/archive/cross-reference-map-coverage-analysis.md`](trellis/specs/archive/cross-reference-map-coverage-analysis.md) §4.4 (archived ULCOMP-R-011..028 + ULCOMP-R-210..212 unowned after the 8→2 Trellis consolidation). **Gate: none — Respondent Ledger companion addendum.**

## Track / Monitor

### 14. `materializePagedLayout` — by design

- **Source**: editor/layout split review
- **File**: `packages/formspec-studio/src/workspaces/layout/LayoutCanvas.tsx:361-380`
- **Status**: Guarded by `useRef<boolean>` flag — no-op after first call. Negligible overhead.

### 19. Component tree reconciles on every dispatch

- **Source**: editor/layout split review
- **File**: `packages/formspec-core/src/raw-project.ts:350-373`
- **Action**: Monitor. Resolution path documented: add dirty flag. Not yet implemented.

### LayoutContainer dual-droppable

- **Source**: layout DnD review (2026-04-07)
- **File**: `packages/formspec-studio/src/workspaces/layout/LayoutContainer.tsx:194-209`
- **Status**: `useSortable` + `useDroppable(container-drop)` on same element. No code change until a mis-hit is reproduced.

## Resolved

- **Respondent Ledger §6.2 MUST promotion closed 2026-04-22** — `eventHash` / `priorEventHash` are now mandatory when a Respondent Ledger event is wrapped by a Trellis envelope; `priorEventHash = null` is reserved for the first wrapped event.
- **ADR 0072 Formspec-side implementation closed 2026-04-22** — `attachment.added` / `attachment.replaced` now carry `EvidenceAttachmentBinding`; `attachment.removed` references `priorAttachmentBindingHash` without minting a new binding; schema conditionals and a concrete attachment-binding fixture landed.

<details>
<summary>Resolved 2026-04-19 batch (click to expand)</summary>

- **#30** — Changelog snake→camel boundary hardened. `generate_changelog` Python binding now accepts `wire_style="snake" | "camel"`; `change_to_object` in `crates/formspec-core/src/json_artifacts.rs` skips None for optional string fields so camel output matches `changelog.schema.json` directly. `_changelog_snake_to_camel` helper + 52 LOC of private allowlist deleted from `validate.py`. 8 new tests (5 Python, 3 Rust) pin the contract.
- **#31** — Release-pipeline scripts now have 22 tests across `scripts/tests/` (8 filter + 10 placement + 4 CLI subprocess). Scripts refactored to export pure `filterForTier` / `restoreFromScratch` / `checkPlacement` functions with CLI guards. CLI behavior preserved byte-for-byte.
- **#32** — Registry assertion at `tests/unit/test_lint_rule_registry.py` extracted into `_check_diagnostics_against_registry` that iterates all matching diagnostics instead of picking `matching[0]`. 5 new unit tests pin divergent-emission detection with per-emission locator.
- **#29 fully closed** — all 29 previously-draft lint rules graduated to `tested` with triggering fixtures and `with_metadata`-wrapped emission sites. Six sub-batches over the 2026-04-19 session:
  1. Structural (5): E200, E201, E301, E302, E710.
  2. FEL parse failure (1): E400.
  3. Theme value + paired-artifact (7): W700, W701, W708, W705, W706, W707, W711.
  4. Component (7): E800, E801, E802, E803, E806, E807, W801.
  5. Document type + extension lifecycle (3): E100, E601, E602.
  6. Final six decision-blocked graduations: W702/W703 via platform-token catalog extension (`font.weight.*`, `font.lineHeight.*` added to canonical `schemas/token-registry.json` and synced to the lint-crate + layout-package copies via `scripts/generate-theme-from-registry.mjs`); W709 via title+fix correction (per-token semantic now matches the Rust emission); W803 via title correction ("Multiple editable inputs bind to the same field"); W804 via title correction + README fix (Python never emitted it — the "Summary/DataTable" reference was stale doc); E804 via new `variant` prop on TextInput (`plain` default + three formatted variants: `richtext`, `markdown`, `latex`). Schema, spec §5.6, and Rust check (`matches!(variant, "richtext" | "markdown" | "latex")` at `pass_component.rs:298`) all aligned; three fixtures cover each formatted variant.
- **Registry bug fixes landed alongside:**
  - E806 title: "Duplicate bind in component tree" → "Custom component instance missing required param" (copy-paste fossil from W804).
  - W801 title: "Input component missing required bind" → "Layout/container component should not declare a bind" (same fossil class).
  - W709 suggestedFix: removed misleading "remove it from the registry" clause.
- **Harness extensions:** `_registryDocuments` opt-in added to `tests/unit/test_lint_rule_registry.py` for E601/E602; obsolete `draft_codes_return_none` and `with_metadata_passes_draft_codes_through` Rust unit tests removed (no drafts remain; invariant noted in-source).
- **Schema additions:** `variant: "plain" | "richtext" | "markdown" | "latex"` on TextInput in both `schemas/component.schema.json` and `crates/formspec-lint/schemas/component.schema.json`. Spec §5.6 documents serialization semantics for each variant (richtext: runtime-defined; markdown: raw source, portable/diffable; latex: raw source, authoritative for math, degrades to source when no renderer available).
- **Baselines:** 300 Rust lint tests green, 13/13 registry tests green, 1986 Python tests green. 7 commits across the session: `238c3ec3` (#32), `92daf57c` (#31), `add10712` (#30), `e24dd9b6` / `6dcf9caa` / `3ee172e3` / `c1934ab4` (#29 sub-batches 1-6), `3a7c273d` (LaTeX variant extension).

</details>

<details>
<summary>Resolved 2026-04-17 parallel-craftsman batch (click to expand)</summary>

- **#22** — FEL trace bridge through WASM → Python → TS → MCP. 5 commits (`e72f9843`, `9a46698c`, `b890ec5c`, `edbe2ca3`, `058e385d`). New MCP tool `formspec_fel_trace` returns `TraceStep[]` byte-identical to Rust.
- **#23** — `benchmarks/run_mcp_loop.py`. Commit `a4b7dd1c`. Verified end-to-end: converged to `score=1.0 / validates=true` in one round on the invoice task.
- **#24** — Tier-split release pipeline with scripted partitioning + per-tier sequential CI. Commits `78f8fc7b`, `95912f6e`, `364d3a96`. Four-tier dry-run matches COMPAT.md membership.
- **#25** — CI gate verified (test already in `python-tests` job); 8 on-disk fixtures + generic registry-driven assertion (commit `42004918`). Replaces 3 hand-crafted per-rule tests.
- **#26** — 29 draft rules carry verified `specRef` + `suggestedFix` (commit `003cd229`). State intentionally stays `draft`; graduation tracked in item #29 above.
- **#27** — Changelog E100 fix: `$formspecChangelog` envelope marker in generator + snake→camel translation at lint boundary + 4 round-trip conformance tests + benchmark widening (commits `2e110a54`, `78f82b1b`, `81df0d6d`, `67685ecf`). `grant-report` benchmark validates clean on base + long + short.
- **#28** — ADR-0064 landed in earlier session (`2fe42175` + `7ec2093e`); submodule pointer already current.

</details>

<details>
<summary>Resolved items from editor/layout split review (click to expand)</summary>

### Studio-core extraction review (batch)

- ~~Non-spec dataTypes in TYPE_MAP~~ — replaced with spec-normative types
- ~~`(project as any).core.dispatch()` x3~~ — added typed methods to Project
- ~~Missing `text` (Long Text) entry in FIELD_TYPE_CATALOG~~ — added
- ~~`item.choices` non-spec fallback~~ — removed, uses `options` only
- ~~Cross-package `default-theme.json` import~~ — added sub-path export
- ~~Unnecessary `@formspec-org/layout` dependency~~ — imports from `@formspec-org/types`
- ~~Incomplete re-export wrapper (`field-helpers.ts`)~~ — added missing exports
- ~~14 direct imports into `formspec-studio-core/src/`~~ — redirected
- ~~Duplicate test files~~ — deleted, canonical copies in studio-core

### Individual items

- **1.** ~~Screener `required` literal-only~~ — evaluates FEL via `evalFEL`
- **2.** ~~PascalCase widgetHints~~ — corrected to camelCase
- **3.** ~~JSON adapter `pretty` default~~ — changed to spec default `false`
- **4.** ~~Screener route heuristic fallback~~ — heuristic documented with trade-off comment
- **5.** ~~`lib/` re-export wrappers~~ — eliminated
- **6.** ~~`src/chat/` v1 dead code~~ — deleted
- **7.** ~~`PropertiesPanel.tsx` dead prototype~~ — deleted
- **8.** ~~`Spacer` invalid widgetHint~~ — moved to layout
- **9.** ~~ITEM_TYPE_WIDGETS missing `Tabs`~~ — added
- **10.** ~~Row summaries secondary bind properties~~ — `nonRelevantBehavior` pill added (keep/empty)
- **11.** ~~Missing CSV `encoding` option~~ — added
- **12.** ~~`isStudioGeneratedComponentDoc` comment~~ — JSDoc added
- **13.** ~~Story fixtures PascalCase~~ — corrected
- **15.** ~~`@faker-js/faker` prod dep~~ — removed
- **16.** ~~`COMPONENT_TO_HINT` Collapsible→accordion~~ — removed
- **17.** ~~Test file naming ambiguity~~ — renamed
- **18.** ~~Orphaned E2E spec~~ — moved
- **20.** ~~`SubmitButton` spec prose~~ — S5.19 added
- **21.** ~~`as any` casts in `project.ts`~~ — all 33 casts eliminated

</details>

<details>
<summary>Resolved items from chaos-test + DnD review + studio plans (click to expand)</summary>

- ~~ARCH-3: `analyze_fel_with_field_types` end-to-end~~ — full chain wired
- ~~Sigil hint ($name vs @name)~~ — `expression-index.ts:129` emits `FEL_SIGIL_HINT`
- ~~BUG-5: Shape per-row evaluation~~ — `shapes.rs:117-227` evaluates per-instance
- ~~UX-5: Theme token validation/listing~~ — `theme.ts:64`/`:73`
- ~~CONF-3: Variables in bind expressions~~ — `parseFEL` includes variables
- ~~addPage standalone-only refactor~~ — code matches plan
- ~~BUG-1: `parentPath` doubles path~~ — fixed in `_resolvePath`
- ~~BUG-2: Date comparison with `today()`~~ — coerces dates
- ~~BUG-4: Conditional required on calculated fields~~ — re-evaluates after calculate
- ~~BUG-6: Required fires on repeat template at 0 instances~~ — clears children
- ~~BUG-7: `remove_rule` ambiguous~~ — `removeValidation` normalizes target
- ~~BUG-8: `sample_data` ignores scenario~~ — `generateSampleData(overrides?)` added
- ~~BUG-9: Cross-document audit leaf key~~ — removed
- ~~BUG-10: Content items not findable by `placeOnPage`~~ — `_nodeRefForItem()` added
- ~~BUG-12: Save omits `status`~~ — includes `status: 'draft'`
- ~~BUG-13: Unknown `Checkbox` component~~ — mapped to `Toggle`
- ~~BUG-14: Unevaluated `widgetHint` on component nodes~~ — allowlist strips it
- ~~BUG-16: Repeat component unevaluated props~~ — allowlist strips them
- ~~UX-1 through UX-10~~ — all resolved (see git log)
- ~~CONF-1: Three parent-context mechanisms~~ — precedence notes in tool descriptions
- ~~CONF-2 / BUG-3: Money diagnostic gap~~ — `moneyAmount()` suggestions added
- ~~FIX 8: FEL rewrite for repeat wildcard shapes~~ — `rewriteFELReferences`/`rewriteMessageTemplate`
- ~~Sortable-only E2E test gap~~ — skip reasons documented
- ~~Layout DnD Findings 1, 3, 5~~ — all resolved

</details>
