# Thoughts — Design Artifacts Index

All internal planning, research, decisions, and reviews live here. `docs/` is for user-facing content only.

**Reorganized:** 2026-03-16 (from scattered `docs/plans/`, `docs/superpowers/`, `thoughts/adr/` flat dump)

---

## Directory Structure

| Directory | Purpose | Naming Convention |
|-----------|---------|-------------------|
| `adr/` | Architecture Decision Records — decisions with Status | `NNNN-short-name.md` |
| `plans/` | Implementation & execution plans | `YYYY-MM-DD-short-name.md` |
| `specs/` | Design specifications & PRDs | `YYYY-MM-DD-short-name.md` |
| `reviews/` | Code reviews, audits, post-mortems | `YYYY-MM-DD-short-name.md` |
| `research/` | External spec analysis, competitive research | Free-form |
| `studio/` | Formspec Studio subdomain (plans, bugs, designs) | Free-form |
| `examples/` | Reference example implementation plans | Free-form |

---

## ADRs (Architecture Decision Records)

Next available number: **0045**

| ADR | File | Status | Notes |
|-----|------|--------|-------|
| 0001 | [linter-policy-and-modes](adr/0001-linter-policy-and-modes.md) | Accepted | Active; fully implemented |
| 0002 | [presentation-layer-approach-a](adr/0002-presentation-layer-approach-a.md) | Superseded | Adopted as Tier 1 in spec §4.2.5 |
| 0003 | [presentation-layer-approach-b](adr/0003-presentation-layer-approach-b.md) | Superseded | Adopted as `theme-spec.md` |
| 0004 | [presentation-layer-approach-c](adr/0004-presentation-layer-approach-c.md) | Superseded | Adopted as `component-spec.md` |
| 0005 | [tier1-presentation-hints-plan](adr/0005-tier1-presentation-hints-plan.md) | Implemented | All 22 tasks complete |
| 0006 | [tier1-revised-plan](adr/0006-tier1-revised-plan.md) | Implemented | 111 tests passing |
| 0007 | [tier2-theme-revised-plan](adr/0007-tier2-theme-revised-plan.md) | Implemented | 201 tests; cascade gap closed by ADR-0019 |
| 0008 | [tier2-theme-implementation-plan](adr/0008-tier2-theme-implementation-plan.md) | Implemented | Flat tokens, 3-level cascade |
| 0009 | [tier3-component-plan](adr/0009-tier3-component-plan.md) | Implemented | Test gap: 111 of ~450 planned |
| 0010 | [tier3-component-revised-plan](adr/0010-tier3-component-revised-plan.md) | Implemented | `accessibility` spec-schema drift |
| 0011 | [hardening-plan](adr/0011-hardening-plan.md) | Partial | innerHTML wipe remains |
| 0012 | [schema-review](adr/0012-schema-review.md) | Implemented | Fully complete |
| 0013 | [audit-spec-vs-schema](adr/0013-audit-spec-vs-schema.md) | Implemented | 200 FULL, 9 PARTIAL, 3 MISSING |
| 0014 | [llm-spec-generation-plan](adr/0014-llm-spec-generation-plan.md) | Implemented | CI enforcement not wired |
| 0015 | [e2e-testing-plan](adr/0015-e2e-testing-plan.md) | Implemented | 3 missing FEL functions |
| 0016 | [feature-completeness-remediation](adr/0016-feature-completeness-remediation.md) | In Progress | 12-phase vertical remediation |
| 0017 | [playwright-e2e-reorg](adr/0017-playwright-e2e-reorganization-and-deduplication.md) | Implemented | Intent-based folder split |
| 0018 | [python-unit-test-reorg](adr/0018-python-unit-test-reorganization-and-ownership.md) | Implemented | 1,882 tests migrated |
| 0019 | [theme-cascade-default-theme](adr/0019-theme-cascade-default-theme.md) | Implemented | 5-level cascade + ARIA fixes |
| 0020 | [css-integration](adr/0020-css-integration-and-design-system-interop.md) | Implemented | `cssClass` + `stylesheets` |
| 0021 | [holistic-kitchen-sink-e2e](adr/0021-holistic-kitchen-sink-e2e-conformance-plan.md) | Implemented | Parity moved to shared suite |
| 0022 | [component-playground-strategy](adr/0022-component-playground-strategy.md) | Superseded | Implemented then removed |
| 0023 | [e2e-real-world-examples](adr/0023-e2e-tests-use-real-world-example-apps.md) | Accepted | E2E uses grant-app example |
| 0025 | [grant-application-design](adr/0025-grant-application-example-design.md) | Implemented | Reference design document |
| 0029 | [schema-parity-phase1](adr/0029-schema-parity-phase1-enrich-existing.md) | Proposed | Enrich existing (~60 gaps) |
| 0030 | [schema-parity-phase2](adr/0030-schema-parity-phase2-new-artifacts.md) | Proposed | New artifacts + mapping depth |
| 0031 | [schema-parity-phase3](adr/0031-schema-parity-phase3-new-subsystems.md) | Proposed | Screener, registry, scoped vars |
| 0033 | [core-semantics-matrix](adr/0033-core-semantics-conformance-matrix.md) | Historical | Conformance matrix |
| 0035 | [test-suite-reorg](adr/0035-test-suite-reorganization-and-unification.md) | Accepted | Unify test suites |
| 0036 | [extract-studio-core](adr/0036-extract-formspec-studio-core-package.md) | Proposed | Extract `formspec-studio-core` |
| 0037 | [move-python-to-packages](adr/0037-move-python-into-packages-formspec-core.md) | Accepted | Move `src/formspec/` → packages |
| 0039 | [seamless-page-management](adr/0039-seamless-page-management.md) | Proposed | Studio sole document author |
| 0040 | [mcp-tool-consolidation](adr/0040-mcp-tool-consolidation.md) | Proposed | MCP conversational workflow |
| 0041 | [marketing-site-rebuild](adr/0041-marketing-site-rebuild.md) | Proposed | Single-file site rebuild |
| 0042 | [launch-blog-posts](adr/0042-launch-blog-posts.md) | Proposed | Content for launch |
| 0043 | [archive-form-builder](adr/0043-archive-form-builder.md) | Approved | Remove form-builder |
| 0044 | [inspector-ux-redesign](adr/0044-inspector-ux-redesign.md) | Implemented | Zero-jargon progressive disclosure |

### Gaps in numbering

Numbers 0024, 0026, 0027, 0028, 0032, 0034, 0038 were execution plans, not decisions — moved to `plans/`.

---

## Plans

| File | Date | Summary |
|------|------|---------|
| [grant-application-example](plans/2026-02-25-grant-application-example.md) | 2026-02-25 | Grant app vertical slice (ex-ADR 0024) |
| [grant-application-amendment](plans/2026-02-25-grant-application-amendment.md) | 2026-02-25 | Missing feature coverage (ex-ADR 0026) |
| [self-contained-grant-app](plans/2026-02-27-self-contained-grant-app.md) | 2026-02-27 | Vite self-contained app (ex-ADR 0027) |
| [ralph-loop-execution](plans/2026-02-28-ralph-loop-execution.md) | 2026-02-28 | 3 phases x 15 iterations (ex-ADR 0032) |
| [definition-evaluator](plans/2026-03-05-definition-evaluator.md) | 2026-03-05 | Server-side evaluator (ex-ADR 0028) |
| [webcomponent-reorg-design](plans/2026-03-04-webcomponent-reorg-design.md) | 2026-03-04 | Extract god class, domain groups |
| [webcomponent-reorg-plan](plans/2026-03-04-webcomponent-reorg-plan.md) | 2026-03-04 | Delete dead theme-resolver, reorg |
| [unified-tree-editor-design](plans/2026-03-04-unified-component-tree-editor-design.md) | 2026-03-04 | Interleave layout + definition items |
| [unified-tree-editor](plans/2026-03-04-unified-component-tree-editor.md) | 2026-03-04 | Implementation plan for tree editor |
| [native-shared-parity-suite](plans/2026-03-10-native-shared-parity-suite.md) | 2026-03-10 | Retire legacy matrix (ex-ADR 0038) |
| [studio-review-fixes](plans/2026-03-12-studio-review-fixes.md) | 2026-03-12 | Fix renderer/studio-core bugs |
| [e2e-dispatch-cleanup](plans/2026-03-13-e2e-dispatch-cleanup.md) | 2026-03-13 | Replace Playwright dispatch() backdoors |
| [studio-root-domino-recovery](plans/2026-03-13-studio-root-domino-recovery.md) | 2026-03-13 | Fix root dominoes, not symptoms |
| [seamless-page-management](plans/2026-03-14-seamless-page-management.md) | 2026-03-14 | Rewrite page management |
| [seamless-page-mgmt-prompt](plans/2026-03-14-seamless-page-mgmt-prompt.md) | 2026-03-14 | Implementation prompt for ADR-0039 |
| [mcp-spec-rev8-fixes](plans/2026-03-15-mcp-spec-rev8-fixes.md) | 2026-03-15 | Fix MCP spec rev 7 → 8 |
| [studio-core-helpers](plans/2026-03-15-studio-core-helpers.md) | 2026-03-15 | 40+ authoring helpers for Project |
| [studio-core-helpers-schema-addendum](plans/2026-03-15-studio-core-helpers-schema-addendum.md) | 2026-03-15 | Schema cross-ref inconsistencies |
| [core-studio-split](plans/2026-03-15-formspec-core-studio-split.md) | 2026-03-15 | Split into core + studio-core |
| [core-runtime-redesign](plans/2026-03-15-formspec-core-runtime-redesign.md) | 2026-03-15 | Decompose RawProject |
| [rust-backend-transition](plans/2026-03-17-rust-backend-transition.md) | 2026-03-17 | Rust backend adoption plan |
| [rust-merge-reconciliation](plans/2026-03-18-rust-merge-reconciliation.md) | 2026-03-18 | Reconcile merged Rust rewrite work |
| [rust-decommission-tasks](plans/2026-03-20-rust-decommission-tasks.md) | 2026-03-20 | Task backlog for TS/Python runtime decommission |

---

## Specs (Design Specifications)

| File | Date | Summary |
|------|------|---------|
| [studio-core-helpers](specs/2026-03-14-formspec-studio-core-helpers.md) | 2026-03-14 | 51+ authoring methods, HelperResult contract |
| [formspec-mcp](specs/2026-03-14-formspec-mcp.md) | 2026-03-14 | MCP server thin tool layer |
| [formspec-chat-design](specs/2026-03-14-formspec-chat-design.md) | 2026-03-14 | Conversational form builder PRD |
| [core-runtime-redesign](specs/2026-03-15-formspec-core-runtime-redesign.md) | 2026-03-15 | One dispatch pipeline, no global state |
| [core-studio-split-design](specs/2026-03-15-formspec-core-studio-split-design.md) | 2026-03-15 | IProjectCore boundary design |
| [project-ts-split](specs/2026-03-15-project-ts-split.md) | 2026-03-15 | Split 2500-line project.ts |

---

## Reviews

| File | Date | Summary |
|------|------|---------|
| [review-since-e81e62a](reviews/2026-04-04-review-since-e81e62a.md) | 2026-04-04 | MCP + Studio patch review; 2 blockers, 5 warnings |
| [reference-examples-smoke-test](reviews/2026-03-09-reference-examples-smoke-test.md) | 2026-03-09 | Smoke test issues (ex-ADR 0034) |
| [studio-fixes-post-review](reviews/2026-03-13-studio-fixes-post-review.md) | 2026-03-13 | Post-review cleanup |
| [helpers-review](reviews/2026-03-14-formspec-studio-core-helpers-review.md) | 2026-03-14 | C1-C5 critical issues |
| [helpers-review-v2](reviews/2026-03-14-formspec-studio-core-helpers-review-v2.md) | 2026-03-14 | 4 implementation blockers |
| [feature-implementation-matrix](reviews/2026-02-24-feature-implementation-matrix.md) | 2026-02-24 | 200 FULL, 9 PARTIAL, 3 MISSING |
| [schema-coverage-audit](reviews/2026-02-28-schema-coverage-audit.md) | 2026-02-28 | Grant app vs schemas |

---

## Research

See [research/README.md](research/README.md) — external spec analysis (XForms, FHIR, SHACL), competitive proposals (Claude/GPT/Gemini), and the [foundational architecture thesis](research/solutions-architecture-proposal.md).

---

## Studio

See [studio/README.md](studio/README.md) — 24 artifacts covering Studio v1/v2 product requirements, design specs, visual bugs, testing strategies, implementation plans, and code reviews.

---

## Examples

Reference example implementation plans (formerly `refrence/`):
- [grant-report-plan](examples/2026-03-04-grant-report-plan.md) — Tribal Grant Annual Report
- [invoice-plan](examples/2026-03-04-invoice-plan.md) — Invoice with Line Items
- [clinical-intake-plan](examples/2026-03-04-clinical-intake-plan.md) — Clinical Intake Survey
