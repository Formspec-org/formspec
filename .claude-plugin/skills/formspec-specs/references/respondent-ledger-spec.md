# Respondent Ledger Specification Reference Map

> specs/audit/respondent-ledger-spec.md -- 969 lines, ~40K -- Add-On: Optional respondent-facing audit change tracking ledger

## Overview

The Respondent Ledger Specification defines an optional, append-only audit trail that records the material history of a respondent's form-filling journey -- drafts, saves, submissions, amendments, and abandonment. It layers on top of Formspec core without altering the canonical Response contract: the Response remains the current-state snapshot, while the ledger provides explanatory history. The spec covers four canonical object types (RespondentLedger, RespondentLedgerEvent, ChangeSetEntry, LedgerCheckpoint), an event taxonomy, materiality rules, identity attestation, privacy-tiered disclosure, integrity checkpointing, and deployment profiles ranging from simple local ledgers to high-assurance identity-bound configurations.

## Section Map

### Purpose and Layering (Lines 1-73)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 1 | Purpose | Explains that this add-on records material respondent-side history (draft saves, reopenings, amendments, abandonments) without changing the core Response contract. Lists the five core audit questions the ledger answers: what changed between saves, what changed after reopening, what was user-entered vs prepopulated, what validation findings existed at save/submit, and whether history is verifiable. | respondent-facing audit, material history, draft/submit/amend/abandon, verification | Understanding what the ledger is for and what questions it answers |
| 2 | Relationship to Formspec core | Establishes the three-layer model (Definition, Response, Respondent Ledger) and constrains the add-on to be purely additive. The Response stays canonical; ledger replay is never required to interpret a Response. Conformance is optional -- processors can be fully Formspec-compliant without implementing this. | layering model, canonical Response, additive semantics, conformance boundary | Determining whether the ledger alters core semantics (it does not), or how to link a Response to its ledger |
| 2.1 | Layering model | Defines three distinct layers: Definition (structural/behavioral), Response (current answer state pinned to a definition version), and Respondent Ledger (append-only history explaining how the Response reached its current state). | Definition, Response, Respondent Ledger, append-only history | Understanding the conceptual separation between response state and audit history |
| 2.2 | What remains canonical | States four MUST/MUST NOT rules: pinned Response stays canonical, ledger replay never required, core semantics not redefined, ledger MAY support audit/dispute/amendment/forensic use. | canonical submission payload, ledger replay prohibition | Confirming that the ledger is supplementary, not a replacement for the Response |
| 2.3 | Optionality and conformance boundary | A processor claiming conformance MUST produce/preserve ledgers per spec, keep semantics additive, SHOULD expose a discovery mechanism, MAY embed a pointer in Response.extensions. Includes recommended extension pointer shape (`x-respondentLedger`). | conformance, optionality, discovery mechanism, `x-respondentLedger` extension, `ledgerId`, `specVersion`, `href` | Deciding whether to implement, or how to link a Response to its ledger via extensions |

### Design Goals (Lines 76-106)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 3.1 | Goals | Lists 12 design goals: optional, append-only, material, path-native, portable, identity-portable, tier-aware disclosure, identity-decoupled, privacy-bounded, human-legible first, integrity-ready. Each briefly explained. | append-only, material changes, path-native, portable, identity-portable, tier-aware disclosure, identity-decoupled, privacy-bounded, integrity-ready | Understanding the design philosophy or evaluating whether the spec fits a use case |
| 3.2 | Non-goals | Explicitly excludes: keystroke capture, focus/blur telemetry, storage engine requirements, cryptographic algorithm mandates, studio-author tracking, reviewer workflow history, mandated UI. | non-goals, explicit exclusions, keystroke capture, telemetry, storage engine | Confirming that the spec intentionally does not cover a particular concern |

### Core Model (Lines 108-128)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 4.1 | Top-level document | A ledger document represents the material respondent-side history for one logical intake record. Each ledger MUST correspond to exactly one current `responseId` and MAY cover multiple session segments including amendment cycles. | ledger document, one-to-one responseId, session segments, amendment cycles | Understanding the cardinality between ledgers and responses |
| 4.2 | Canonical objects | Names the four primary object types: RespondentLedger, RespondentLedgerEvent, ChangeSetEntry, LedgerCheckpoint. These names are canonical even if implementations use different physical storage. | RespondentLedger, RespondentLedgerEvent, ChangeSetEntry, LedgerCheckpoint | Identifying the core data model objects |

### RespondentLedger Object (Lines 131-196)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 5.1 | Required fields | Lists 9 required fields: `ledgerId`, `$formspecRespondentLedger`, `responseId`, `definitionUrl`, `definitionVersion`, `status`, `createdAt`, `lastEventAt`, `eventCount`. | required fields, `ledgerId`, `$formspecRespondentLedger`, `responseId`, `definitionUrl`, `definitionVersion`, `status`, `createdAt`, `lastEventAt`, `eventCount` | Building or validating a ledger document's top-level structure |
| 5.2 | Recommended fields | Lists 8 recommended fields: `organizationId`, `environment`, `currentResponseHash`, `currentResponseAuthored`, `headEventId`, `sessionRefs`, `checkpointRefs`, `extensions`. | recommended fields, `organizationId`, `currentResponseHash`, `headEventId`, `sessionRefs`, `checkpointRefs` | Deciding what optional metadata to include in a ledger document |
| 5.3 | Field semantics | Defines the meaning of each top-level field. `$formspecRespondentLedger` is the spec version string. `status` aligns to the latest response lifecycle state. `currentResponseHash` is an optional digest of the current canonical response snapshot. | field semantics, spec version string, response lifecycle alignment, response digest | Understanding what each top-level field means and how it relates to the Response |
| 5.4 | Example | Full JSON example of a RespondentLedger with spec version "0.1", status "in-progress", 4 events, and a storage extension. | example, JSON shape | Seeing a complete ledger document in practice |

### RespondentLedgerEvent Object (Lines 199-499)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 6.1 | Required fields | Lists 10 required fields per event: `eventId`, `sequence`, `eventType`, `occurredAt`, `recordedAt`, `responseId`, `definitionUrl`, `definitionVersion`, `actor`, `source`. | required event fields, `eventId`, `sequence`, `eventType`, `occurredAt`, `recordedAt`, `actor`, `source` | Building or validating individual event objects |
| 6.2 | Conditional fields | `changes` MUST be present for material state deltas. `validationSnapshot` SHOULD be present at save/submit/completion/amendment/stop. `identityAttestation` SHOULD be present for identity events. `priorEventHash`/`eventHash` SHOULD be present when integrity chaining is enabled. `sessionRef` and `amendmentRef` SHOULD be present when applicable. | conditional fields, changes, validationSnapshot, identityAttestation, priorEventHash, eventHash, sessionRef, amendmentRef | Determining which optional fields are expected for a given event type |
| 6.3 | Field semantics | Defines the meaning of each event field. `sequence` is monotonic within the ledger. `occurredAt` is action time vs `recordedAt` as persist time. `changes` is an ordered set of atomic changes. `privacyTier` is optional disclosure tier on the actor or identity attestation. | field semantics, monotonic sequence, occurredAt vs recordedAt, ordered change set, privacyTier | Understanding the distinction between action time and recording time, or what privacy tier means |
| 6.4 | Actor object | The `actor` MUST include `kind`. Supported kinds: `respondent`, `delegate`, `system`, `support-agent`, `unknown`. Recommended fields include `id`, `display`, `assuranceLevel`, `did`, `identityProviderRef`, `subjectRef`. | actor, actor.kind, respondent, delegate, system, support-agent, DID, assuranceLevel, identityProviderRef | Constructing actor objects or understanding who initiated an event |
| 6.5 | Source object | The `source` MUST identify the capture channel. Supported kinds: `web`, `mobile`, `api`, `import`, `system-job`, `unknown`. Sensitive network metadata SHOULD be stored as references/derivatives, not raw values. | source, source.kind, web, mobile, api, import, system-job, channelId, deviceId, ipAddressRef | Constructing source objects or understanding which channel produced an event |
| 6.6 | Identity attestation object | Provider-neutral record of identity, proof-of-personhood, delegated-access, or verifiable-credential evidence. 12 recommended fields covering provider, adapter, subjectRef, DID, verificationMethod, credentialType, credentialRef, personhoodCheck, subjectBinding, assuranceLevel, privacyTier, selectiveDisclosureProfile, evidenceRef. Implementations SHOULD normalize provider-specific payloads into this common shape via adapter boundaries. | identityAttestation, provider-neutral, proof-of-personhood, DID, verifiable-credential, adapter boundary, subjectRef, credentialType, personhoodCheck, assuranceLevel, privacyTier, selectiveDisclosureProfile, ID.me | Recording identity proofing events, integrating third-party identity providers, understanding the provider-neutral attestation model |
| 6.6A | Identity and implementation decoupling | Three separable concerns: (1) response state and audit continuity, (2) subject continuity via pseudonymous subjectRef, (3) identity proofing. A conforming implementation can keep ledger anonymous/pseudonymous by default while attaching identity proofs later. | identity decoupling, three concerns, subjectRef, pseudonymous default, deferred identity proofing, on-chain anchoring | Designing storage that keeps response/audit anonymous while supporting optional identity binding |
| 6.7 | Tiered privacy inspiration | Identity assurance and identity disclosure are distinct concerns. Four tiers: anonymous, pseudonymous, identified, fully attributable. Privacy should be modeled as a tier on attestations and export policy, not a separate ledger format. | tiered privacy, anonymous, pseudonymous, identified, fully attributable, selective disclosure, export policy | Designing privacy controls or understanding how one ledger format serves multiple disclosure levels |

### ChangeSetEntry Object (Lines 339-447)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 7.1 | Purpose | The atomic unit of respondent-visible change. Designed to be stable for machine analysis, understandable for timelines, and compact (avoiding full response copies on every save). | ChangeSetEntry, atomic change, machine-stable, timeline-readable, compact | Understanding what a change entry represents |
| 7.2 | Required fields | Three required fields: `op`, `path`, `valueClass`. | required: op, path, valueClass | Building or validating individual change entries |
| 7.3 | Recommended fields | Ten recommended fields: `itemKey`, `before`, `after`, `beforeHash`, `afterHash`, `displayBefore`, `displayAfter`, `reasonCode`, `dataPointer`. | recommended: itemKey, before, after, beforeHash, afterHash, displayBefore, displayAfter, reasonCode, dataPointer | Deciding what optional detail to include in change entries |
| 7.4 | Supported operations | Seven allowed `op` values: `set`, `unset`, `add`, `remove`, `replace`, `reorder`, `status-transition`. Each defined with interpretation: set (assign/overwrite), unset (clear value, retain path), add (new entry/branch), remove (delete entry/branch), replace (substitute with replacement semantics), reorder (reorder without value mutation), status-transition (lifecycle state change). | op values, set, unset, add, remove, replace, reorder, status-transition | Choosing the correct operation for a change entry |
| 7.5 | Value classes | Seven allowed `valueClass` values: `user-input`, `prepopulated`, `calculated`, `imported`, `attachment`, `system-derived`, `migration-derived`. | valueClass, user-input, prepopulated, calculated, imported, attachment, system-derived, migration-derived | Classifying the origin of a changed value |
| 7.6 | Path requirements | `path` MUST use the same logical response path model as the implementation. `itemKey` SHOULD be recorded when the node maps to a stable definition item key. Repeated structures SHOULD use stable row discriminators, MAY include JSON Pointer `dataPointer`, and SHOULD NOT rely on array index alone when stable IDs exist. | path, response path model, itemKey, stable row discriminator, dataPointer, JSON Pointer, array index | Constructing paths for change entries, especially for repeated/array structures |
| 7.7 | Sensitive values and minimization | `before`/`after` MAY be omitted for policy reasons. If omitted, SHOULD record `beforeHash`, `afterHash`, `displayBefore`, `displayAfter`, `semanticDelta`, or `redactionPolicy` as proof of change without full content retention. | sensitive values, minimization, beforeHash, afterHash, displayBefore, displayAfter, semanticDelta, redactionPolicy | Handling PII or sensitive field values in audit entries |
| 7.8 | Example | JSON example of a `replace` operation on `household.members[1].monthlyIncome` with `valueClass: user-input`, before/after values, and `reasonCode: user-edit`. | example, replace operation | Seeing a complete change entry in practice |

### Event Taxonomy (Lines 450-510)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 8.1 | Required event types | 13 event types that a conforming implementation MUST support when the corresponding lifecycle moments occur: `session.started`, `draft.saved`, `draft.resumed`, `response.completed`, `response.amendment-opened`, `response.amended`, `response.stopped`, `attachment.added`, `attachment.replaced`, `attachment.removed`, `prepopulation.applied`, `system.merge-resolved`, `validation.snapshot-recorded`. | required event types, session.started, draft.saved, draft.resumed, response.completed, response.amendment-opened, response.amended, response.stopped, attachment.added/replaced/removed, prepopulation.applied, system.merge-resolved, validation.snapshot-recorded | Determining which events an implementation must support |
| 8.2 | Optional event types | 8 additional event types an implementation MAY support: `calculation.material-change`, `nonrelevant.pruned`, `autosave.coalesced`, `device-linked`, `identity-verified`, `attestation.captured`, `response.submit-attempted`, `response.migrated`. | optional event types, calculation.material-change, nonrelevant.pruned, autosave.coalesced, identity-verified, attestation.captured, response.submit-attempted, response.migrated | Deciding which optional events to implement |
| 8.3 | Event type guidance | Behavioral description for each event type. Key distinctions: `draft.saved` covers explicit saves AND coalesced autosaves; `response.submit-attempted` fires whether or not the attempt succeeds; `identity-verified` covers identity providers, DID verifiers, and proof-of-personhood flows; `attestation.captured` covers credentials, delegation, and personhood proofs durably bound into history. | event semantics, draft.saved includes autosave, submit-attempted fires on failure, identity-verified, attestation.captured | Understanding the precise semantics of a particular event type |
| 8.4 | Explicit exclusions | Does NOT require events for individual keystrokes, focus/blur, page navigation, every calculation reevaluation, or rendering lifecycle. | exclusions, not required, keystrokes, focus/blur, page navigation | Confirming that fine-grained UI events are intentionally excluded |

### Materiality Rules (Lines 512-542)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 9.1 | General rule | The ledger is for material respondent history. Processors MUST NOT emit separate durable events for every ephemeral UI action. | materiality, ephemeral UI actions prohibited | Understanding the core filtering principle for what goes into the ledger |
| 9.2 | Material changes | Seven criteria for materiality: changes persisted response state, changes lifecycle state, adds/removes/replaces attachment, changes respondent-visible calculated outcome in response, changes validation findings at save/submit boundary, changes retained values due to non-relevance/migration/merge, or changes an attestation/DID/assurance fact relied on for completion. | material change criteria, persisted state, lifecycle state, attachment, calculated outcome, validation findings, non-relevance, attestation | Deciding whether a particular change should be recorded as a ledger event |
| 9.3 | Autosave coalescing | Implementations MAY coalesce frequent autosaves. If coalescing: MUST preserve final persisted state, SHOULD preserve stable change ordering, SHOULD indicate coalescing policy. | autosave coalescing, final state preservation, change ordering | Implementing autosave behavior while keeping the ledger manageable |

### Interaction with Formspec Response Semantics (Lines 545-603)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 10.1 | Response pinning | Every event MUST record exact `definitionUrl` and `definitionVersion`. Processors MUST NOT silently reinterpret historical events against a later definition version. | response pinning, definition version, no silent reinterpretation | Ensuring events correctly record which definition version governed the response |
| 10.2 | Response status transitions | Ledger MUST align to core Response.status states: `in-progress`, `completed`, `amended`, `stopped`. Status changes SHOULD include a ChangeSetEntry with `op = status-transition`. | status transitions, in-progress, completed, amended, stopped, op=status-transition | Recording lifecycle state changes in the ledger |
| 10.3 | Validation snapshots | Events at save/submit/completion/amendment/stop boundaries SHOULD contain a validation snapshot with: `valid`, `counts.error/warning/info`, `generatedAt`, and `resultRefs` or summarized findings. The ledger MUST NOT change underlying Formspec validation meaning. | validation snapshots, valid, counts, generatedAt, resultRefs, capture not alternative validation | Including validation state in events |
| 10.4 | Non-relevant fields | When non-relevance causes value removal/nulling/retention, implementations SHOULD record a material event if persisted response shape or retained values change. Recommended types: `nonrelevant.pruned` or `draft.saved` with `reasonCode = nonrelevant-prune`. | non-relevant fields, nonrelevant.pruned, reasonCode=nonrelevant-prune | Handling non-relevance-driven data changes in the ledger |
| 10.5 | Calculated values | Calculated values SHOULD NOT produce ledger noise for every reevaluation. Record only when: value is in persisted response, new value differs materially from prior persisted value, and change matters to review/downstream/audit. | calculated values, ledger noise avoidance, materiality filter for calculations | Deciding when to record calculated value changes (rarely) |
| 10.6 | Prepopulation | Record `prepopulation.applied` with `valueClass = prepopulated` or `imported` for hydrated data. If prepopulated values are later edited, use `valueClass = user-input` and `reasonCode = user-edit-over-prepopulation`. | prepopulation, prepopulated, imported, user-edit-over-prepopulation | Recording prepopulated data and tracking when respondents override it |

### Amendments, Migration, and Version Evolution (Lines 606-633)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 11.1 | Amendment cycles | When a completed response is reopened: record `response.amendment-opened`, status moves to `amended` or implementation-specific state, tag subsequent events with `amendmentRef`, record `response.amended` on durable completion. | amendment cycle, response.amendment-opened, amendmentRef, response.amended | Implementing the reopening and amendment flow |
| 11.2 | Migration across definition versions | Original event history MUST remain interpretable against original pinned versions. Migrating processor MUST preserve prior events with original version tuple, SHOULD record `response.migrated` with provenance (`fromDefinitionVersion`, `toDefinitionVersion`, migration map ID), SHOULD mark migration changes with `valueClass = migration-derived`. | migration, version evolution, response.migrated, fromDefinitionVersion, toDefinitionVersion, migration-derived | Handling definition version upgrades while preserving historical event integrity |
| 11.3 | Interaction with changelog semantics | When migration depends on a structural changelog or field map, the processor SHOULD retain a reference to the changelog/migration artifact used. This spec does not define the migration format itself. | changelog reference, migration artifact, not defining migration format | Linking ledger migration events to changelog documents |

### Storage and Retention Model (Lines 636-674)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 12.1 | Storage separation | Implementations SHOULD store the ledger separately from the canonical response snapshot. Four reasons: simple retrieval, independent retention/privacy controls, easier append-only guarantees, integrity sealing without mutating response body. | storage separation, independent retention, append-only enforcement | Deciding where to store ledger data relative to the Response |
| 12.2 | Append-only requirement | Events MUST be append-only in logical semantics. MAY compact/archive/move physically, but MUST NOT rewrite event meaning. Suppression of sensitive content MUST preserve clear evidence of redaction or policy-based minimization. | append-only, physical compaction allowed, semantic immutability, redaction evidence | Understanding what "append-only" means in practice (logical, not necessarily physical) |
| 12.3 | Retention and redaction | Five retention classes: full raw values, hashed prior values, human-readable summaries, integrity-only stubs, legally preserved immutable copies. When redacting, SHOULD preserve: fact of change, path/identity, timestamp, actor/source category, policy basis. | retention classes, redaction, hashed values, summaries, integrity stubs, preserved metadata | Implementing data minimization or retention policies |

### Integrity Checkpoints (Lines 677-713)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 13.1 | Purpose | A LedgerCheckpoint provides optional tamper-evident sealing for a contiguous range of ledger events. | LedgerCheckpoint, tamper-evident sealing, contiguous range | Understanding what checkpoints are for |
| 13.2 | Minimum fields | Six minimum fields: `checkpointId`, `ledgerId`, `fromSequence`, `toSequence`, `batchHash`, `signedAt`. | checkpointId, ledgerId, fromSequence, toSequence, batchHash, signedAt | Building or validating checkpoint objects |
| 13.3 | Recommended fields | Five optional fields: `previousCheckpointHash`, `signature`, `keyId`, `anchorRef`, `algorithm`. | previousCheckpointHash, signature, keyId, anchorRef, algorithm | Extending checkpoints with signatures and external anchoring |
| 13.4 | Integrity behavior | When integrity chaining is enabled: events SHOULD carry `priorEventHash`/`eventHash`, checkpoints SHOULD seal contiguous ranges, checkpoint anchoring MAY reference external audit ledger/transparency log/notarization. No specific signature suite mandated. | integrity chaining, priorEventHash, eventHash, external anchor, transparency log, algorithm-agnostic | Implementing cryptographic integrity chaining or external anchoring |

### Recommended JSON Shape (Lines 716-867)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 14 | Recommended JSON shape | Non-exhaustive example showing a complete ledger document with 6 events covering session start, prepopulation, draft save with validation snapshot, attachment upload, submit attempt, and successful completion with status transition. Demonstrates the full event lifecycle with actor/source objects, change entries, and validation snapshots. | full example, 6-event lifecycle, JSON wire format, session-to-completion flow | Seeing a complete end-to-end ledger document, or using as a reference for serialization |

### Implementation Guidance (Lines 871-900)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 15.1 | Timeline UX | Implementations exposing ledger to respondents/support SHOULD render a timeline that groups atomic changes into save/submit/amendment moments, labels prepopulation distinctly, distinguishes attachments, and shows validation state at boundaries. | timeline UX, grouped changes, prepopulation labels, attachment distinction | Designing a respondent-facing or support-facing audit timeline |
| 15.2 | Diff generation | To generate changesets efficiently, compare the last durable response snapshot to the new one and emit only material deltas. | diff generation, snapshot comparison, material deltas | Implementing the change detection algorithm |
| 15.3 | Support and dispute workflows | Implementations SHOULD answer at least six audit questions from the ledger: when draft was created, when resumed, which fields changed and in what direction, whether submission was amended, what validation state existed, and whether attachment inventory changed. | support workflows, dispute handling, six audit questions | Validating that an implementation meets minimum audit query capability |
| 15.4 | Interoperability recommendation | Keep implementation-specific metadata in namespaced `extensions` fields and preserve unknown extension content on round-trip. | interoperability, namespaced extensions, round-trip preservation | Exchanging ledgers between systems |

### Deployment Profiles (Lines 903-940)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 15A.1 | Profile A -- local/server ledger only | For respondent history, supportability, and ordinary draft/resume/submit. No external anchoring, no identity proofing beyond local auth, value minimization for sensitive priors. | Profile A, local ledger, no anchoring, no identity proofing, value minimization | Choosing the simplest deployment profile |
| 15A.2 | Profile B -- pseudonymous integrity-anchored ledger | For continuity and tamper-evidence without requiring legal identity. Stable `subjectRef`, signed checkpoints, platform-ledger anchoring, off-chain response with anchored commitments, identity proofing optional. | Profile B, pseudonymous, integrity-anchored, subjectRef, signed checkpoints, off-chain response | Deploying with tamper-evidence but without mandatory identity disclosure |
| 15A.3 | Profile C -- identity-bound high-assurance ledger | For eligibility, regulated workflows, delegated signing, legal attestations. `identity-verified`/`attestation.captured` events, `privacyTier`/`assuranceLevel`/`selectiveDisclosureProfile` governed, identity evidence externalized behind protected references, stronger checkpoint/export/proof controls. Processors SHOULD NOT force Profile C into Profile A/B deployments. | Profile C, high-assurance, identity-bound, regulated workflows, delegated signing, over-collection warning | Deploying in regulated or identity-sensitive environments |

### Conformance Summary (Lines 942-957)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 16 | Conformance summary | 11 normative rules (7 MUST, 4 SHOULD) that a conforming processor must satisfy. Covers: Response stays canonical, append-only, version pinning, required event types, ChangeSetEntry structure, no keystroke telemetry, no core semantic alteration, validation snapshots, identity attestation, privacy-bounded retention, optional integrity chaining. | conformance checklist, 7 MUSTs, 4 SHOULDs | Auditing an implementation for conformance, or building a conformance test suite |

### Open Follow-On Work (Lines 960-969)

| Section | Heading | Description | Key Concepts | Consult When |
|---------|---------|-------------|--------------|--------------|
| 17 | Open follow-on work | Lists four deferred deliverables: example mappings from existing audit tables, conformance fixtures, canonicalization guidance for hash/signature generation, and disclosure-profile registries. Notes that companion JSON Schemas are provided at `schemas/respondent-ledger.schema.json` and `schemas/respondent-ledger-event.schema.json`. | open work, conformance fixtures, canonicalization, disclosure-profile registries, companion schemas | Understanding what is intentionally left for future work |

## Cross-References

- **Formspec Core `Response`**: The ledger is layered on top of the core Response contract (S2, S2.2, S10). `Response.status` states (`in-progress`, `completed`, `amended`, `stopped`) must be aligned (S10.2). `Response.authored` timestamp may be tracked as `currentResponseAuthored` (S5.2, S5.3).
- **Formspec Core response pinning**: Every event MUST record the exact `(definitionUrl, definitionVersion)` tuple from the pinned Response (S10.1).
- **Formspec Core item keys**: `ChangeSetEntry.itemKey` maps to stable definition item keys (S7.3, S7.6).
- **Formspec Core response paths**: `ChangeSetEntry.path` uses the same logical response path model as Formspec response addressing (S7.6).
- **Formspec Core validation / ValidationReport**: Validation snapshots capture point-in-time validation state (S10.3). The ledger MUST NOT alter underlying Formspec validation semantics.
- **Formspec Core non-relevant behavior**: Non-relevance-driven value changes should be recorded as material events (S10.4).
- **Formspec Core calculated values / FEL**: Calculated value changes follow materiality filtering rules (S10.5).
- **Formspec Core migrations / S6.7**: Migration events reference `fromDefinitionVersion` and `toDefinitionVersion` (S11.2). The spec does not define migration format itself (S11.3).
- **Formspec Changelog Specification**: When migration depends on a structural changelog, the processor SHOULD retain a reference to the changelog artifact (S11.3).
- **`Response.extensions`**: The recommended discovery pointer uses `x-respondentLedger` in Response extensions (S2.3).
- **`schemas/respondent-ledger.schema.json`**: Companion JSON Schema for the top-level ledger document (S17).
- **`schemas/respondent-ledger-event.schema.json`**: Companion JSON Schema for standalone event objects (S17).
- **RFC 2119 / RFC 8174**: Normative language interpretation (header).
- **DID (Decentralized Identifiers)**: Referenced in actor object (`actor.did`), identity attestation (`did`, `verificationMethod`), and identity decoupling (S6.6, S6.6A).
- **OpenID Connect**: Referenced as one of the identity assertion types that should be normalized into the canonical attestation shape (S6.6).
- **ID.me**: Referenced as an example third-party identity provider that should be integrated through an adapter boundary (S6.6).

## Event Type Quick Reference

| Event Type | Required? | Category | When It Fires |
|---|---|---|---|
| `session.started` | MUST | Session | First usable interaction in a respondent session |
| `draft.saved` | MUST | Draft | Explicit save or materialized coalesced autosave |
| `draft.resumed` | MUST | Draft | Resume of existing draft after inactivity or across devices |
| `response.completed` | MUST | Lifecycle | Successful transition to `Response.status = completed` |
| `response.amendment-opened` | MUST | Amendment | Previously completed response reopened for editing |
| `response.amended` | MUST | Amendment | Durable completion of an amendment cycle |
| `response.stopped` | MUST | Lifecycle | Response marked abandoned or intentionally stopped |
| `attachment.added` | MUST | Attachment | New attachment uploaded |
| `attachment.replaced` | MUST | Attachment | Existing attachment replaced |
| `attachment.removed` | MUST | Attachment | Existing attachment removed |
| `prepopulation.applied` | MUST | Data | External or parent-response data hydrated into the response |
| `system.merge-resolved` | MUST | System | Platform resolved concurrent changes, conflicts, or resume merges |
| `validation.snapshot-recorded` | MUST | Validation | Explicit audit capture of validation state independent of save/submit |
| `response.submit-attempted` | MAY | Lifecycle | Attempted completion, whether or not it succeeds |
| `response.migrated` | MAY | Migration | Response transformed to a new definition version |
| `calculation.material-change` | MAY | Data | Calculated value changed materially in persisted response |
| `nonrelevant.pruned` | MAY | Data | Non-relevance caused value removal/nulling/retention |
| `autosave.coalesced` | MAY | Draft | Frequent autosaves coalesced into a durable event |
| `device-linked` | MAY | Session | Device linked to respondent session |
| `identity-verified` | MAY | Identity | Identity provider or proof-of-personhood flow updated assurance state |
| `attestation.captured` | MAY | Identity | Credential, delegation, or personhood proof durably bound |

## Operation and Value Class Enums

**`op` values (ChangeSetEntry.op):**

| Op | Meaning |
|---|---|
| `set` | Assign or overwrite a scalar/object value at an existing path |
| `unset` | Clear a value while retaining the path's structural meaning |
| `add` | Introduce a new array entry, attachment, or object branch |
| `remove` | Remove an array entry, attachment, or object branch |
| `replace` | Substitute one value/document for another where replacement semantics matter |
| `reorder` | Reorder repeated elements without semantic value mutation |
| `status-transition` | Record a change to lifecycle state |

**`valueClass` values (ChangeSetEntry.valueClass):**

| Value Class | Meaning |
|---|---|
| `user-input` | Respondent-entered data |
| `prepopulated` | Hydrated from parent response or external source |
| `calculated` | Computed by FEL or engine calculation |
| `imported` | Loaded from an external record/import |
| `attachment` | File or document attachment |
| `system-derived` | Generated by the platform/system |
| `migration-derived` | Produced by definition version migration |

## Critical Behavioral Rules

1. **Response stays canonical**: The pinned Formspec Response is always the source of truth for current answer state. The ledger is explanatory history, never a replacement. A processor MUST NOT require ledger replay to interpret a valid Response (S2.2).

2. **Append-only means semantic immutability**: Events MUST be append-only in logical semantics. Physical compaction and archiving are allowed, but event meaning MUST NOT be rewritten. Sensitive content suppression MUST preserve clear redaction evidence (S12.2).

3. **Every event is version-pinned**: Every ledger event MUST record the exact `definitionUrl` and `definitionVersion` that governed the response at event time. Historical events MUST NOT be silently reinterpreted against a later definition version (S10.1).

4. **Materiality is the gatekeeper**: Processors MUST NOT emit separate durable events for every ephemeral UI action. Seven specific criteria define what counts as material (S9.2). Calculated values specifically require a triple test: in persisted response, materially different, and meaningful to review/audit (S10.5).

5. **Autosave coalescing is allowed but must preserve final state**: Implementations MAY coalesce frequent autosaves into fewer durable events, but MUST preserve the final persisted state and SHOULD preserve stable change ordering (S9.3).

6. **ChangeSetEntry requires exactly three fields**: `op`, `path`, and `valueClass` are the only required fields. Everything else (`itemKey`, `before`, `after`, hashes, display values) is recommended but optional. This allows privacy-bounded implementations to prove a change happened without retaining sensitive values (S7.2, S7.7).

7. **Stable row discriminators over array indices**: For repeated structures, implementations SHOULD use stable row discriminators and SHOULD NOT rely on array index alone when a stable repeated-row identifier exists (S7.6). This prevents fragile change tracking when rows are reordered or deleted.

8. **Migration must preserve historical integrity**: When a response is migrated to a new definition version, prior events and their original pinned version tuples MUST be preserved. Migration-generated changes SHOULD use `valueClass = migration-derived` (S11.2).

9. **Identity attestation is provider-neutral**: Implementations SHOULD normalize provider-specific payloads (ID.me, OpenID Connect, DID, etc.) into the canonical `identityAttestation` shape through adapter boundaries, not write provider-native fields directly into events (S6.6).

10. **Three separable identity concerns**: Response state/audit, subject continuity, and identity proofing are distinct. A conforming implementation CAN keep the ledger anonymous/pseudonymous by default and attach identity proofs later (S6.6A).

11. **Profile C requirements must not be forced into Profile A/B**: Processors SHOULD NOT force high-assurance identity requirements into local or pseudonymous deployments, because over-collecting identity data makes low-friction respondent history harder to adopt (S15A.3).

12. **Validation snapshots capture, never redefine**: The ledger is a capture mechanism for validation state, not an alternative validator. It MUST NOT change the underlying meaning of Formspec validation results (S10.3).

13. **Prepopulation tracking preserves value class lineage**: Prepopulated values use `valueClass = prepopulated` or `imported`. When a respondent later edits a prepopulated value, the change uses `valueClass = user-input` with `reasonCode = user-edit-over-prepopulation`, preserving the audit trail of data origin (S10.6).

14. **One ledger per response**: Each ledger document MUST correspond to exactly one current `responseId`. A ledger MAY cover multiple session segments and amendment cycles, but the one-to-one relationship with a response is invariant (S4.1).
