# Thoughts — Design Artifacts Index

All internal planning, research, decisions, and reviews live here. `docs/` is for user-facing content only.

**Layout:** **Active** work (open proposals, drafts, and in-flight specs) stays in `thoughts/adr/`, `thoughts/plans/`, and `thoughts/specs/`. **Superseded** and **implemented / closed** ADRs, execution plans, and delivered design specs live under **`thoughts/archive/`** — see [`archive/README.md`](archive/README.md).

### Verification

- After adding or moving markdown under `thoughts/`, run **`npm run docs:filemap`** so `filemap.json` stays accurate.
- **`npm run docs:check`** includes **`scripts/check-thoughts-relocated-paths.mjs`**, which fails if tracked sources cite legacy paths under **`thoughts/adr`**, **`thoughts/plans`**, **`thoughts/specs`**, **`thoughts/reviews`**, or **`thoughts/studio`** for files that exist only under **`thoughts/archive/`** (with exceptions when the same path still exists at top level, e.g. `thoughts/reviews/README.md`).

---

## Directory Structure

| Directory | Purpose | Naming Convention |
|-----------|---------|-------------------|
| `adr/` | **Active** ADRs — Proposed, in-progress, or Accepted but not yet landed as described | `NNNN-short-name.md` |
| `plans/` | **Active** implementation plans (open or draft) | `YYYY-MM-DD-short-name.md` |
| `specs/` | **Active** design specs / PRDs (future or partial) | `YYYY-MM-DD-short-name.md` |
| `archive/` | Closed ADRs, plans, specs, **archived** reviews & Studio history | `adr/`, `plans/`, `specs/`, `reviews/`, `studio/` |
| `reviews/` | **Active** reference reviews + planning (`README.md` indexes the split) | `YYYY-MM-DD-short-name.md` |
| `research/` | External spec analysis, competitive research | Free-form |
| `studio/` | **Active** Studio canon + prior art cited from specs (`README.md` indexes the split) | Dated `.md`, `vendor/`, new `visual-reviews/` |
| `examples/` | Reference example implementation plans | Free-form |

---

## Active ADRs (open / in-flight)

Next free id: **0081**. Disambiguate-by-slug required for the following id collisions on disk:

- `0061` — primary ADR + Sidecar (`-tasks.md`); both active and intentional.
- `0047` / `0048` / `0053` — historical cross-active/archive overlap; link by slug.

| ADR | File | Status (from doc) | Notes |
|-----|------|-------------------|-------|
| 0014 | [llm-spec-generation-plan](adr/0014-llm-spec-generation-plan.md) | Proposed | Schema-centric spec workflow |
| 0029 | [schema-parity-phase1](adr/0029-schema-parity-phase1-enrich-existing.md) | Proposed | Grant-app / schema enrichment |
| 0030 | [schema-parity-phase2](adr/0030-schema-parity-phase2-new-artifacts.md) | Proposed | New artifacts + mapping depth |
| 0031 | [schema-parity-phase3](adr/0031-schema-parity-phase3-new-subsystems.md) | Proposed | Screener, registry, scoped vars |
| 0036 | [extract-studio-core](adr/0036-extract-formspec-studio-core-package.md) | Proposed | Package exists; reconcile status |
| 0037 | [move-python-to-packages](adr/0037-move-python-into-packages-formspec-core.md) | Accepted | Migration not finished as written |
| 0039 | [seamless-page-management](adr/0039-seamless-page-management.md) | Proposed | Studio page authoring |
| 0040 | [mcp-tool-consolidation](adr/0040-mcp-tool-consolidation.md) | Proposed | MCP tool surface |
| 0041 | [marketing-site-rebuild](adr/0041-marketing-site-rebuild.md) | Proposed | Marketing site |
| 0042 | [launch-blog-posts](adr/0042-launch-blog-posts.md) | Proposed | Launch content |
| 0048 | [i18n-as-locale-artifact](adr/0048-i18n-as-locale-artifact.md) | Proposed | Locale sidecar model |
| 0051 | [pdf-acroform-generation](adr/0051-pdf-acroform-generation.md) | Proposed | PDF via layout seam |
| 0052 | [remove-theme-page-layout](adr/0052-remove-theme-page-layout.md) | Proposed | Deprecate theme `pages` |
| 0053 | [webmcp-native-assist-protocol](adr/0053-webmcp-native-assist-protocol.md) | Proposed | Assist + WebMCP |
| 0054 | [privacy-preserving-ledger-chain](adr/0054-privacy-preserving-client-server-ledger-chain.md) | Proposed | Ledger + crypto |
| 0055 | [studio-semantic-workspace-consolidation](adr/0055-studio-semantic-workspace-consolidation.md) | Proposed | Editor-centric semantic UX |
| 0056 | [click-to-sign-attestation](adr/0056-click-to-sign-attestation-component.md) | Proposed | Click-to-sign component |
| 0059 | [unified-ledger-canonical-event-store](adr/0059-unified-ledger-as-canonical-event-store.md) | Narrative locked 2026-04-22 | Phase 3+ target; program summary [wos-spec/thoughts/plans/0059-unified-ledger-as-canonical-event-store.md](../wos-spec/thoughts/plans/0059-unified-ledger-as-canonical-event-store.md) |
| 0061 | [current-state-authoring-runtime](adr/0061-current-state-authoring-runtime.md) | Proposed | Tighten `formspec-studio-core` around a headless authoring runtime |
| 0061-sidecar | [current-state-authoring-runtime-tasks](adr/0061-current-state-authoring-runtime-tasks.md) | Proposed | Implementation task list for ADR 0061 |
| 0062 | [post-split-follow-ups](adr/0062-post-split-follow-ups.md) | Proposed | Unresolved items from ADR 0001 |
| 0063 | [release-trains-by-tier](adr/0063-release-trains-by-tier.md) | Proposed | Release-train cadence by velocity tier |
| 0064 | [wos-granularity-and-ai-native-positioning](adr/0064-wos-granularity-and-ai-native-positioning.md) | Proposed | WOS granularity / AI-native positioning |
| 0065 | [wos-authoring-stack-mirrors-formspec](adr/0065-wos-authoring-stack-mirrors-formspec.md) | Proposed | WOS authoring stack mirrors Formspec |
| 0066 | [stack-amendment-and-supersession](adr/0066-stack-amendment-and-supersession.md) | Proposed | Cross-layer correction / amendment / supersession / rescission |
| 0067 | [stack-statutory-clocks](adr/0067-stack-statutory-clocks.md) | Proposed | Cross-layer clock event semantics |
| 0068 | [stack-tenant-and-scope-composition](adr/0068-stack-tenant-and-scope-composition.md) | Proposed | Tenant, definition, kernel, and ledger scope bundle |
| 0069 | [stack-time-semantics](adr/0069-stack-time-semantics.md) | Proposed | UTC wire time, ordering, leap-smear, FEL timezone |
| 0070 | [stack-failure-and-compensation](adr/0070-stack-failure-and-compensation.md) | Proposed | Trellis append as commit point; ledger-visible failure |
| 0071 | [stack-cross-layer-migration-and-versioning](adr/0071-stack-cross-layer-migration-and-versioning.md) | Proposed | Version pins and verifier bundle semantics |
| 0072 | [stack-evidence-integrity-and-attachment-binding](adr/0072-stack-evidence-integrity-and-attachment-binding.md) | Accepted | Attachment binding across intake, custody, export, verify |
| 0073 | [stack-case-initiation-and-intake-handoff](adr/0073-stack-case-initiation-and-intake-handoff.md) | Accepted | WOS-owned case creation; Formspec intake handoff routes |
| 0074 | [formspec-native-field-level-transparency](adr/0074-formspec-native-field-level-transparency.md) | Proposed | Class-Aware Response and Bucketed Encryption (Core); authoritative for `accessControl` / bucketed Response / Privacy Profile |
| 0075 | [rejection-register](adr/0075-rejection-register.md) | Proposed | WOS rejection register (workflow-consolidation cluster) |
| 0076 | [product-tier-consolidation](adr/0076-product-tier-consolidation.md) | Proposed | Product-tier workflow schema consolidation (workflow-consolidation cluster) |
| 0077 | [canonical-kernel-extension-seams](adr/0077-canonical-kernel-extension-seams.md) | Proposed | Canonical kernel extension seams (workflow-consolidation cluster) |
| 0078 | [foreach-topology](adr/0078-foreach-topology.md) | Proposed | WOS kernel `foreach` topology (workflow-consolidation cluster) |
| 0079 | [formspec-native-intake-handoff-emission](adr/0079-formspec-native-intake-handoff-emission.md) | Proposed | Formspec native IntakeHandoff emission for WOS targets (workflow-consolidation cluster) |
| 0080 | [governed-output-commit-pipeline](adr/0080-governed-output-commit-pipeline.md) | Proposed | Governed output-commit pipeline (workflow-consolidation cluster) |

**Implemented / accepted / historical ADRs:** [`archive/adr/`](archive/adr/) (tier plans, WASM split, WOS boundary, grant design, etc.).

---

## Active plans

| File | Summary |
|------|---------|
| [self-contained-grant-app](plans/2026-02-27-self-contained-grant-app.md) | Vite example under `examples/grant-application` (not done) |
| [ralph-loop-execution](plans/2026-02-28-ralph-loop-execution.md) | Parity / iteration harness (Proposed) |
| [editor-canvas-audit](plans/2026-03-13-editor-canvas-audit.md) | Editor canvas audit |
| [u1-u4-mcp-ux-fixes](plans/2026-03-16-u1-u4-mcp-ux-fixes.md) | MCP UX fixes |
| [cloudflare-form-deploy](plans/2026-03-17-cloudflare-form-deploy.md) | Deploy scaffold |
| [pages-behavioral-api](plans/2026-03-17-pages-behavioral-api.md) | Pages behavioral API (Draft) |
| [features-page-copy-revision](plans/2026-03-18-features-page-copy-revision.md) | Marketing copy |
| [locale-engine-integration](plans/2026-03-20-locale-engine-integration.md) | Locale + FieldVM (Proposed) |
| [formspec-frame-implementation](plans/2026-03-23-formspec-frame-implementation.md) | Frame package (Draft) |
| [rust-layout-finish](plans/2026-03-24-rust-layout-finish.md) | Rust layout / PDF crates |
| [unified-authoring-finish](plans/2026-03-24-unified-authoring-finish.md) | Unified authoring convergence |
| [uswds-adapter-tech-debt](plans/2026-03-29-uswds-adapter-tech-debt.md) | USWDS adapter cleanup |
| [layout-workspace-completion](plans/2026-04-01-layout-workspace-completion.md) | Layout workspace follow-ups |
| [phase11-coprocessor-fel](plans/2026-04-11-phase11-coprocessor-fel.md) | Phase 11 FEL / coprocessor execution |
| [phase11-coprocessor-open-backlog](plans/2026-04-11-phase11-coprocessor-open-backlog.md) | Phase 11 closure / collateral |
| [trellis-trim-and-dedup](plans/2026-04-15-trellis-trim-and-dedup.md) | Trellis crate trim + deduplication |
| [changelog-generation-fails-doctype-detection](plans/2026-04-17-changelog-generation-fails-doctype-detection.md) | Changelog generator doctype-detection bug fix |

**Completed plans:** [`archive/plans/`](archive/plans/).

---

## Active specs

| File | Summary |
|------|---------|
| [formspec-chat-design](specs/2026-03-14-formspec-chat-design.md) | Conversational builder PRD |
| [project-ts-split](specs/2026-03-15-project-ts-split.md) | Split monolithic `project.ts` |
| [pages-layout phase 2–3 + parent](specs/2026-03-18-pages-layout-phase2-overview.md) | Pages / layout builder phases |
| [pages-tab-layout-builder](specs/2026-03-18-pages-tab-layout-builder.md) | Parent design for pages builder |
| [pages-layout-phase3-focus](specs/2026-03-18-pages-layout-phase3-focus.md) | Focus mode grid |
| [presentation-locale-fieldvm](specs/2026-03-21-presentation-locale-and-fieldvm-design.md) | Locale + FieldVM |
| [rust-layout-planner-pdf](specs/2026-03-24-rust-layout-planner-and-pdf.md) | Rust planner / PDF future |
| [unified-authoring-architecture](specs/2026-03-24-unified-authoring-architecture.md) | Unified authoring v6 |
| [formspec-swift-design](specs/2026-03-25-formspec-swift-design.md) | Swift renderer design |
| [page-mode-presentation-design](specs/2026-03-25-page-mode-as-presentation-design.md) | `pageMode` presentation |
| [assist-chat](specs/2026-03-26-assist-chat.md) | Filling-layer chat (future package) |
| [formy-extension](specs/2026-03-26-formy-extension.md) | Browser extension |
| [locale-translation-management](specs/2026-03-26-locale-translation-management.md) | Translation UX |
| [references-ontology-authoring-ux](specs/2026-03-26-references-ontology-authoring-ux.md) | References / ontology UX |
| [assist-remediation](specs/2026-03-27-assist-remediation.md) | Assist review remediation |
| [editor-layout-split-design](specs/2026-03-27-editor-layout-split-design.md) | Editor vs layout split |
| [definition-advisories](specs/2026-03-31-definition-advisories.md) | Definition advisories / Form Health |
| [formspec-brand-guidelines](specs/2026-04-06-formspec-brand-guidelines.md) | Brand voice / visual |
| [phase4-follow-up-design-decisions](specs/2026-04-07-phase4-follow-up-design-decisions.md) | Repeat-target FEL / tree paths |
| [formspec-wos-phase11-integration-master](../wos-spec/thoughts/specs/2026-04-11-formspec-wos-phase11-integration-master.md) | **WOS ↔ Formspec Phase 11 index** *(in `wos-spec/` submodule)* |
| [platform-decisioning-forks-and-options](specs/2026-04-22-platform-decisioning-forks-and-options.md) | **Platform decision register** — end-state commitments, leans, forks, kill criteria (cited by CLAUDE.md Operating Context) |
| [shared-cross-seam-fixture-bundle-design](specs/2026-04-24-shared-cross-seam-fixture-bundle-design.md) | Shared cross-seam fixture bundle design |

**Delivered / merged design specs (historical):** [`archive/specs/`](archive/specs/) (MCP, core split, assist interop, layout workspace DnD, Astro site, etc.).

---

## Reviews

See [`reviews/README.md`](reviews/README.md) — what stayed at top level vs [`archive/reviews/`](archive/reviews/).

---

## Research

See [research/README.md](research/README.md) — external spec analysis (XForms, FHIR, SHACL), competitive proposals (Claude/GPT/Gemini), and the [foundational architecture thesis](research/solutions-architecture-proposal.md).

---

## Studio

See [studio/README.md](studio/README.md) — active canon and prior art; archived sprints and visual-review bundles under [`archive/studio/`](archive/studio/).

---

## Examples

Reference example implementation plans (formerly `refrence/`):

- [grant-report-plan](examples/2026-03-04-grant-report-plan.md) — Tribal Grant Annual Report
- [invoice-plan](examples/2026-03-04-invoice-plan.md) — Invoice with Line Items
- [clinical-intake-plan](examples/2026-03-04-clinical-intake-plan.md) — Clinical Intake Survey
