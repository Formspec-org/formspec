# ADR 0073: Stack Contract - Case Initiation and Intake Handoff

**Status:** Accepted
**Date:** 2026-04-23
**Scope:** Cross-layer - Formspec + WOS + Trellis
**Related:** [STACK.md Open Contracts](../../STACK.md#open-contracts); [platform decision register](../specs/2026-04-22-platform-decisioning-forks-and-options.md); [ADR 0068 (tenant and scope composition)](./0068-stack-tenant-and-scope-composition.md); [ADR 0070 (failure and compensation)](./0070-stack-failure-and-compensation.md); [ADR 0072 (evidence integrity and attachment binding)](./0072-stack-evidence-integrity-and-attachment-binding.md); [DocuSign PowerForms](https://www.docusign.com/products/electronic-signature/features/powerforms/); [DocuSign Web Forms](https://www.docusign.com/products/web-forms); [DocuSign eSignature envelope API](https://docusign.github.io/docusign-esign-python-client/docusign_esign/apis/envelopes_api.html); [parent TODO](../../TODO.md) stack-wide section

## Context

The stack needs to support two normal ways a governed case begins.

- **Workflow-initiated intake.** An agency, caseworker, workflow definition, or integration already knows the person or matter. WOS opens a case shell first, then Formspec collects or validates the needed response against that case.
- **Public-intake-initiated case.** A form is open to the public. The submitter arrives without an existing case id, completes intake, and the platform acknowledges the raw submission as an intake record. WOS accepts the intake handoff before it creates the governed case.

Both are real product shapes. A system that only permits workflow-first cases cannot model public-facing application forms. A system that lets intake emit the governed case event creates a rival source of case truth.

The comparable document-signing pattern is a central transaction container with multiple initiation routes. DocuSign's public PowerForms and Web Forms let recipients start or fill a form-driven process; the eSignature API still centers the agreement transaction around an envelope. The stack should follow the same architecture pattern: initiation route varies, but the governed case container has one owner.

Listed in [STACK.md Open Contracts](../../STACK.md#open-contracts) as an integration primitive. This ADR closes the ownership decision and leaves Trellis vector/profile details as follow-on implementation work.

## Decision

Seven pins.

### D-1. WOS owns governed case identity and `case.created`

WOS is the only layer that emits the governed case boundary event. The event name may be refined by WOS spec work, but the ownership is closed: Formspec MUST NOT emit `case.created` or an equivalent governed-case event.

Rationale: a case is a governance object, not a form session. It carries workflow, authority, deadlines, actor permissions, provenance, and eventual appeal/amendment semantics. Those belong to WOS.

### D-2. Formspec owns intake session and response truth

Formspec owns:

- raw submission capture;
- intake session identity;
- definition-pinned canonical response;
- validation report;
- respondent-ledger intake evidence;
- attachments or evidence bindings collected at intake;
- any public-form state needed before WOS accepts the handoff.

Formspec may say "this intake is ready to start a case." It does not decide that a governed case exists.

### D-3. The cross-layer seam is an `IntakeHandoff`

The seam between Formspec and WOS is a named handoff artifact. Working name: `IntakeHandoff`. Alternate working name: `CaseInitiationRequest`.

The handoff is not an adapter convention. It is a center-declared stack contract with schema, fixtures, and verifier-visible references. It is the WOS-facing acknowledgment artifact for the intake record; raw submission remains Formspec-side. It carries the response and evidence pointers WOS needs to either attach intake to an existing case or create a new governed case.

### D-4. Both initiation modes are first-class

The handoff MUST support at least two modes.

| Mode | Sequence | Required invariant |
|---|---|---|
| `workflowInitiated` | WOS creates a case shell, issues or requests Formspec intake, receives the completed handoff, and attaches it to the existing case. | `caseRef` is already known when intake starts or before handoff acceptance. |
| `publicIntake` | Formspec opens a public intake session, validates the response, emits an intake handoff, WOS accepts it as intake provenance, and then emits `case.created`. | No governed case exists until WOS accepts the handoff. |

The product may label the second route "the applicant started a case." The audit semantics remain: the applicant started an intake session; WOS accepted the handoff and then created the governed case.

### Clarification — handoff `caseRef` string vs canonical WOS case id

Formspec Core §2.1.6.1 and `schemas/intake-handoff.schema.json` now state this
explicitly: for `workflowInitiated`, the handoff carries the **`caseRef` string**
used for evidence and for binding-side attach checks. WOS (or another host) MAY
mint or resolve canonical governed-case identifiers for durable state and
provenance, but MUST NOT treat adapter finalization as if the handoff had been
rewritten to that canonical id when the emitted document still carries the
original `caseRef`. For `publicIntake`, governed case identity after acceptance
is host-owned outside the handoff. This aligns WOS runtime and Formspec-binding
behavior with the center-vs-adapter seam named in D-3.

### D-5. The minimum handoff fields are stable enough to vector

The first stack fixture SHOULD use this shape unless implementation discovers a better name during schema work:

```json
{
  "$formspecIntakeHandoff": "1.0",
  "handoffId": "ih_...",
  "initiationMode": "workflowInitiated | publicIntake",
  "caseRef": "case_... or null",
  "definitionRef": {
    "url": "https://example.gov/forms/intake",
    "version": "1.0.0"
  },
  "responseRef": "response_...",
  "responseHash": "sha256:...",
  "validationReportRef": "validation-report_...",
  "intakeSessionId": "session_...",
  "actorRef": "actor_... or null",
  "subjectRef": "subject_... or null",
  "ledgerHeadRef": "trellis-or-respondent-ledger-head",
  "occurredAt": "RFC3339 timestamp"
}
```

Implementation note: the accepted Formspec schema uses the concrete marker
`$formspecIntakeHandoff: "1.0"` and an object-valued `definitionRef` with
`url` and `version` fields so the response pin is machine-validatable without
string parsing.

Field names are now normative in `schemas/intake-handoff.schema.json`. The
invariant remains: the handoff must pin definition, response, validation,
intake session, optional actor/subject identity, and ledger continuity strongly
enough that WOS cannot create a case over ambiguous intake data.

### D-6. Trellis anchors handoff evidence, not case semantics

Trellis records and verifies the handoff evidence, response hash, WOS case-created provenance, custody append, and export bundle rows. Trellis does not decide whether a case exists, whether an intake should be accepted, or which workflow state should follow.

### D-7. Handoff acceptance is governance-shaped

WOS intake acceptance may resolve to `intakeAccepted`, `intakeRejected`, or `intakeDeferred`. Rejection or deferral reasons can include invalid response hash, stale definition, missing required identity, duplicate idempotency key, unauthorized public intake route, or tenant/scope mismatch.

Rejected or deferred intake does not create a governed case. If the outcome itself is policy-relevant, WOS may emit a governance rejection record under the failure/compensation rules in [ADR 0070](./0070-stack-failure-and-compensation.md).

## Consequences

**Positive.**

- One layer owns `case.created`; no rival case truth.
- Public forms and invite/caseworker-started flows are both native.
- Product language can stay natural while audit semantics stay precise.
- WOS can enforce tenant, scope, identity, deadline, and policy gates before case creation.
- Trellis can verify the handoff path without becoming a workflow engine.

**Negative.**

- WOS must support a pre-intake or pending case shell for workflow-initiated flows.
- Formspec must define a handoff artifact rather than treating submission as the whole story.
- Public intake requires an explicit WOS acceptance path and failure vocabulary.
- Shared fixtures must cover both initiation modes.

**Neutral.**

- UI copy may vary by product. "Start application," "open case," "submit intake," and "request review" are product language; the center semantics are the handoff and WOS case creation event.
- The handoff can be transported by HTTP, queue, durable activity, or local function call. Transport is adapter territory.

## Implementation plan

**Formspec.**

- Define the intake handoff artifact or response metadata extension in schemas/spec prose.
- Ensure canonical response hash and validation report references are available to the handoff.
- Public intake runtime emits a handoff request, not a case event.
- Add conformance fixtures for successful public intake and failed WOS acceptance.

**WOS.**

- Define the case-created provenance/event shape and the intakeAccepted, intakeRejected, or intakeDeferred record shape.
- Add runtime acceptance logic for `workflowInitiated` and `publicIntake` handoffs.
- Support pending case shells where a workflow starts before response collection.
- Add lint/conformance for tenant/scope mismatch, duplicate handoff id, stale definition, and invalid response hash.

**Trellis.**

- Export and verifier surfaces include handoff evidence, response hash, WOS acceptance/case-created provenance, and custody receipts.
- Add at least one vector proving public intake handoff plus WOS-created case can be verified offline.
- Add a negative vector where handoff response hash mismatches the response payload.

**Stack-level.**

- Add a shared fixture pair: one `workflowInitiated`, one `publicIntake`.
- Wire the fixture pair through canonical response, WOS acceptance, custody hook, Trellis append/export, and offline verification.
- Update public examples so product wording does not imply Formspec owns governed case creation.

## Implementation status

**Landed 2026-04-23.**

- Formspec schema/spec contract: `schemas/intake-handoff.schema.json`,
  generated LLM artifact, schema conformance tests, Rust document detection,
  Rust/Python lint dispatch, Python validator discovery, TypeScript generated
  type, and example handoff fixtures for both modes.
- WOS reference behavior: `wos-runtime` intake-handoff acceptance path,
  `accept_intake_handoff(...)` durability/idempotency, canonical
  `intakeAccepted|Rejected|Deferred` provenance emission, `caseCreated`
  versus `instanceCreated` separation, and case-attach/create application;
  `wos-formspec-binding` typed `parse_intake_handoff` contract and
  mode-to-case-intent classification with rejection of invalid mode/caseRef
  combinations.

**Still open.**

- Trellis append/export/verify vectors that carry the handoff evidence, WOS
  `caseCreated` record, and negative response-hash mismatch case.
- Shared stack-level fixture bundle that runs the two handoff examples through
  Formspec response evidence, WOS acceptance, Trellis custody, export, and
  offline verification.

## Open questions

1. **Anonymous public intake.** Default: allowed to create a pending case when the workflow permits anonymous or later-bound identity. Alternative: block until identity proofing. Recommendation: profile-driven; WOS policy decides, not Formspec.
2. **Mode vocabulary.** Default: start with `workflowInitiated` and `publicIntake`. Add `importedIntake` or `embeddedIntake` only when a fixture requires it.

## Alternatives considered

**Formspec emits `case.created`.** Rejected. It creates rival case truth and makes a governed case look like an intake artifact.

**WOS always creates a case before any form starts.** Rejected. Public application forms, public signing links, and open intake flows become awkward or impossible.

**Formspec always starts the case and WOS binds it later.** Rejected. The case is the governance container; binding it after the fact weakens deadlines, identity policy, tenant scope, and appeal semantics.

**Adapter-only handoff convention.** Rejected. Without a center-declared handoff, deployments will invent incompatible meanings for "submission starts a case," and portable verification will have no stable artifact to inspect.
