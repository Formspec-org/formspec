# Respondent Ledger Schema Reference Map

> schemas/respondent-ledger.schema.json -- 205 lines -- Append-only respondent-side audit ledger layered on top of a canonical Formspec Response.

## Overview

The Respondent Ledger schema defines an optional add-on document that tracks material history for a Formspec Response without changing core Response semantics. It records drafts, resumes, attachments, submissions, amendments, stops, migrations, and validation snapshots as an append-only event stream. The ledger references a Response by `responseId` and pins a Definition by the `(definitionUrl, definitionVersion)` tuple. It may optionally embed the event stream and integrity checkpoints inline, or reference them externally. The schema enforces `additionalProperties: false` at every level.

## Top-Level Structure

| Property | Type | Required | Description |
|---|---|---|---|
| `$formspecRespondentLedger` | `string` (const: `"0.1"`) | Yes | Respondent Ledger add-on specification version. MUST be `"0.1"`. |
| `ledgerId` | `string` (minLength: 1) | Yes | Stable identifier for this ledger document. |
| `responseId` | `string` (minLength: 1) | Yes | Identifier of the current canonical Formspec Response described by this ledger. |
| `definitionUrl` | `string` (format: `uri`) | Yes | Canonical URL of the pinned Definition currently associated with the response. |
| `definitionVersion` | `string` (minLength: 1) | Yes | Exact pinned Definition version currently associated with the response. |
| `status` | `string` (enum) | Yes | Current lifecycle status of the response/ledger pair. |
| `createdAt` | `string` (format: `date-time`) | Yes | Timestamp of the first recorded event in the ledger. |
| `lastEventAt` | `string` (format: `date-time`) | Yes | Timestamp of the most recent recorded event in the ledger. |
| `eventCount` | `integer` (minimum: 0) | Yes | Total number of retained events in the ledger. |
| `organizationId` | `string` | No | Organization or tenant identifier when the implementation is multi-tenant. |
| `environment` | `string` | No | Environment label such as production, staging, or sandbox. |
| `currentResponseHash` | `HashString` | No | Algorithm-prefixed digest of the current Response. |
| `currentResponseAuthored` | `string` (format: `date-time`) | No | Most recent Response.authored timestamp known to the ledger. |
| `headEventId` | `string` | No | Identifier of the newest retained event in the ledger. |
| `identityRefs` | `array` of `string` (minLength: 1, uniqueItems) | No | Identifiers for identity, DID, or proof-of-personhood attestations materially associated with this ledger. |
| `currentIdentityAttestation` | `IdentityAttestation` | No | Current identity attestation. References `respondent-ledger-event.schema.json#/$defs/IdentityAttestation`. |
| `sessionRefs` | `array` of `string` (minLength: 1, uniqueItems) | No | Identifiers for known session segments that contributed events to this ledger. |
| `checkpointRefs` | `array` of `string` (minLength: 1, uniqueItems) | No | Identifiers for checkpoints covering contiguous ranges of ledger events. |
| `events` | `array` of `RespondentLedgerEvent` | No | Optional embedded event stream retained with the ledger document. Items reference `respondent-ledger-event.schema.json`. |
| `checkpoints` | `array` of `LedgerCheckpoint` | No | Optional embedded integrity checkpoints for contiguous event ranges. |
| `extensions` | `Extensions` | No | Implementation-specific extension data. Keys MUST start with `x-`. |

## Key Type Definitions ($defs)

| Definition | Description | Key Properties | Used By |
|---|---|---|---|
| **LedgerCheckpoint** | Integrity checkpoint sealing a contiguous range of ledger events | `checkpointId`, `ledgerId`, `fromSequence`, `toSequence`, `batchHash`, `signedAt` (all required); `previousCheckpointHash`, `signature`, `keyId`, `anchorRef`, `algorithm`, `extensions` (optional) | `checkpoints` array items |
| **HashString** | Algorithm-prefixed digest or integrity token (e.g. `sha256:...`) | Pattern-validated string | `currentResponseHash`, `LedgerCheckpoint.batchHash`, `LedgerCheckpoint.previousCheckpointHash` |
| **Extensions** | Implementation-specific extension data with `x-` prefixed keys | Open object with `propertyNames.pattern: "^x-"` | Top-level `extensions`, `LedgerCheckpoint.extensions` |

### LedgerCheckpoint Object Detail

| Property | Type | Required | Description |
|---|---|---|---|
| `checkpointId` | `string` (minLength: 1) | Yes | Stable identifier for the checkpoint object. |
| `ledgerId` | `string` (minLength: 1) | Yes | Identifier of the ledger sealed by this checkpoint. |
| `fromSequence` | `integer` (minimum: 1) | Yes | First event sequence included in the sealed contiguous range. |
| `toSequence` | `integer` (minimum: 1) | Yes | Last event sequence included in the sealed contiguous range. |
| `batchHash` | `HashString` | Yes | Algorithm-prefixed digest of the sealed event batch. |
| `signedAt` | `string` (format: `date-time`) | Yes | Timestamp when the checkpoint was signed or otherwise sealed. |
| `previousCheckpointHash` | `HashString` | No | Hash of the previous checkpoint, forming a hash chain. |
| `signature` | `string` | No | Opaque signature or detached proof blob for the checkpoint. |
| `keyId` | `string` | No | Identifier of the signing key used for this checkpoint. |
| `anchorRef` | `string` | No | External anchor reference, such as an organizational audit ledger record or transparency log entry. |
| `algorithm` | `string` | No | Signature or hashing algorithm identifier used to produce the checkpoint material. |
| `extensions` | `Extensions` | No | Implementation-specific extension data. Keys MUST start with `x-`. |

## Required Fields

- `$formspecRespondentLedger`
- `ledgerId`
- `responseId`
- `definitionUrl`
- `definitionVersion`
- `status`
- `createdAt`
- `lastEventAt`
- `eventCount`

Within `LedgerCheckpoint`: `checkpointId`, `ledgerId`, `fromSequence`, `toSequence`, `batchHash`, `signedAt`.

## Enumerations

| Property | Allowed Values |
|---|---|
| `status` | `in-progress`, `completed`, `amended`, `stopped` |

## Cross-References

| Property | $ref Target |
|---|---|
| `currentIdentityAttestation` | `respondent-ledger-event.schema.json#/$defs/IdentityAttestation` |
| `events[*]` | `respondent-ledger-event.schema.json` (Respondent Ledger Event) |
| `currentResponseHash` | `#/$defs/HashString` (local) |
| `checkpoints[*]` | `#/$defs/LedgerCheckpoint` (local) |

## Extension Points

- Top-level `extensions` object: open `additionalProperties` with `propertyNames.pattern: "^x-"`.
- `LedgerCheckpoint.extensions`: same pattern.

## Validation Constraints

- `additionalProperties: false` at top level and on `LedgerCheckpoint`.
- `$formspecRespondentLedger` enforces `const: "0.1"` -- only the literal string `"0.1"` is valid.
- `ledgerId`, `responseId`, `definitionVersion` enforce `minLength: 1`.
- `definitionUrl` enforces `format: uri`.
- `createdAt`, `lastEventAt`, `currentResponseAuthored`, `LedgerCheckpoint.signedAt` enforce `format: date-time`.
- `eventCount` enforces `minimum: 0` and `type: integer`.
- `LedgerCheckpoint.fromSequence` and `toSequence` enforce `minimum: 1` and `type: integer`.
- `LedgerCheckpoint.checkpointId` and `ledgerId` enforce `minLength: 1`.
- `HashString` enforces `pattern: "^[A-Za-z0-9._:+-]+:.+$"` -- algorithm prefix, colon, then digest.
- `identityRefs`, `sessionRefs`, `checkpointRefs` enforce `uniqueItems: true` and items with `minLength: 1`.
- `Extensions` enforces `propertyNames.pattern: "^x-"` and `additionalProperties: true`.

---

# Respondent Ledger Event Schema Reference Map

> schemas/respondent-ledger-event.schema.json -- 377 lines -- A single append-only respondent-side audit event for the Respondent Ledger add-on.

## Overview

The Respondent Ledger Event schema defines the structure of individual events in the respondent-side audit ledger. Each event records a material milestone -- draft saves, session starts, submissions, amendments, attachment operations, prepopulation, validation snapshots, calculation changes, identity verification, and more -- without redefining the Formspec Response as an event stream. Events carry a monotonic sequence number, actor and source attribution, an optional changeset of atomic material changes, optional validation snapshots, optional identity attestations, and hash chaining for integrity verification. The schema enforces `additionalProperties: false` at every level.

## Top-Level Structure

| Property | Type | Required | Description |
|---|---|---|---|
| `eventId` | `string` (minLength: 1) | Yes | Unique identifier for this event within the ledger. |
| `sequence` | `integer` (minimum: 1) | Yes | Monotonic sequence number within the ledger. |
| `eventType` | `EventType` (enum) | Yes | Canonical event classification. |
| `occurredAt` | `string` (format: `date-time`) | Yes | When the underlying material action occurred. |
| `recordedAt` | `string` (format: `date-time`) | Yes | When the processor durably recorded the event. |
| `responseId` | `string` (minLength: 1) | Yes | Identifier of the Formspec Response this event belongs to. |
| `definitionUrl` | `string` (format: `uri`) | Yes | Canonical URL of the pinned Definition in force for this event. |
| `definitionVersion` | `string` (minLength: 1) | Yes | Exact pinned Definition version in force for this event. |
| `actor` | `Actor` | Yes | Who initiated or is attributed with the event. |
| `source` | `Source` | Yes | Capture channel or subsystem that produced the event. |
| `changes` | `array` of `ChangeSetEntry` (minItems: 1) | No | Ordered set of atomic material changes associated with this event. |
| `validationSnapshot` | `ValidationSnapshot` | No | Point-in-time summary of validation findings at the event boundary. |
| `identityAttestation` | `IdentityAttestation` | No | Identity or proof-of-personhood attestation captured with this event. |
| `sessionRef` | `string` (minLength: 1) | No | Implementation-specific identifier for the respondent session segment associated with the event. |
| `amendmentRef` | `string` (minLength: 1) | No | Identifier for the amendment cycle this event belongs to, when applicable. |
| `priorEventHash` | `HashString` | No | Hash of the immediately preceding event in the ledger, forming a hash chain. |
| `eventHash` | `HashString` | No | Hash of this event for integrity verification. |
| `extensions` | `Extensions` | No | Implementation-specific extension data. Keys MUST start with `x-`. |

## Key Type Definitions ($defs)

| Definition | Description | Key Properties | Used By |
|---|---|---|---|
| **EventType** | Canonical event classification enum (21 values) | Enum string | Top-level `eventType` |
| **Actor** | Who initiated or is attributed with the event | `kind` (required); `id`, `display`, `assuranceLevel`, `privacyTier`, `did`, `identityProviderRef`, `subjectRef`, `extensions` (optional) | Top-level `actor` |
| **Source** | Capture channel or subsystem that produced the event | `kind` (required); `channelId`, `deviceId`, `ipAddressRef`, `userAgentRef`, `extensions` (optional) | Top-level `source` |
| **ChangeSetEntry** | A single atomic material change in the response | `op`, `path`, `valueClass` (all required); `itemKey`, `before`, `after`, `beforeHash`, `afterHash`, `displayBefore`, `displayAfter`, `reasonCode`, `dataPointer`, `extensions` (optional) | `changes` array items |
| **IdentityAttestation** | Identity verification or proof-of-personhood attestation | `provider`, `credentialType` (required); `adapter`, `subjectRef`, `did`, `verificationMethod`, `credentialRef`, `personhoodCheck`, `subjectBinding`, `assuranceLevel`, `privacyTier`, `selectiveDisclosureProfile`, `evidenceRef`, `extensions` (optional) | Top-level `identityAttestation`, also referenced by the Ledger schema's `currentIdentityAttestation` |
| **ValidationSnapshot** | Point-in-time validation summary at event boundary | `errors`, `warnings`, `infos` (all required integers); `results` (optional array), `extensions` (optional) | Top-level `validationSnapshot` |
| **PrivacyTier** | Disclosure tier describing identity linkability | Enum string | `Actor.privacyTier`, `IdentityAttestation.privacyTier` |
| **DidString** | Decentralized identifier in DID syntax | Pattern-validated string | `Actor.did`, `IdentityAttestation.did` |
| **HashString** | Algorithm-prefixed digest or integrity token | Pattern-validated string | `priorEventHash`, `eventHash`, `ChangeSetEntry.beforeHash`, `ChangeSetEntry.afterHash` |
| **Extensions** | Implementation-specific extension data with `x-` prefixed keys | Open object | Top-level, `Actor`, `Source`, `ChangeSetEntry`, `IdentityAttestation`, `ValidationSnapshot` |

### Actor Object Detail

| Property | Type | Required | Description |
|---|---|---|---|
| `kind` | `string` (enum) | Yes | Who initiated or is attributed with the event. |
| `id` | `string` | No | Stable actor identifier when available. |
| `display` | `string` | No | Human-readable actor label for timeline and support views. |
| `assuranceLevel` | `string` | No | Authentication or identity assurance tier associated with the actor for this event. |
| `privacyTier` | `PrivacyTier` (enum) | No | Disclosure tier describing how linkable or revealed the subject identity is. |
| `did` | `DidString` | No | Decentralized identifier string in DID syntax. |
| `identityProviderRef` | `string` | No | Reference to the normalized identity provider, verifier, or adapter used for this actor context. |
| `subjectRef` | `string` | No | Stable pseudonymous subject or continuity identifier used by the ledger independent of any specific identity provider. |
| `extensions` | `Extensions` | No | Implementation-specific extension data. Keys MUST start with `x-`. |

### Source Object Detail

| Property | Type | Required | Description |
|---|---|---|---|
| `kind` | `string` (enum) | Yes | Capture channel or subsystem that produced the event. |
| `channelId` | `string` | No | Implementation-specific channel identifier. |
| `deviceId` | `string` | No | Stable or session-local device identifier when tracked. |
| `ipAddressRef` | `string` | No | Protected derivative or reference for network address metadata. |
| `userAgentRef` | `string` | No | Protected derivative or reference for user-agent metadata. |
| `extensions` | `Extensions` | No | Implementation-specific extension data. Keys MUST start with `x-`. |

### ChangeSetEntry Object Detail

| Property | Type | Required | Description |
|---|---|---|---|
| `op` | `string` (enum) | Yes | Atomic operation represented by this material change entry. |
| `path` | `string` (minLength: 1) | Yes | Logical Formspec response path identifying the changed node. |
| `valueClass` | `string` (enum) | Yes | Origin class of the changed value. |
| `itemKey` | `string` | No | Stable Formspec item key when the path maps directly to one. |
| `before` | any | No | Prior value when retained under the implementation's privacy policy. |
| `after` | any | No | Resulting value when retained under the implementation's privacy policy. |
| `beforeHash` | `HashString` | No | Algorithm-prefixed hash of the prior value. |
| `afterHash` | `HashString` | No | Algorithm-prefixed hash of the resulting value. |
| `displayBefore` | `string` | No | Human-readable prior value summary safe for timeline display. |
| `displayAfter` | `string` | No | Human-readable resulting value summary safe for timeline display. |
| `reasonCode` | `string` | No | Machine-readable explanation for why the change happened. |
| `dataPointer` | `string` | No | Optional JSON Pointer or equivalent row discriminator for precise targeting in repeated structures. |
| `extensions` | `Extensions` | No | Implementation-specific extension data. Keys MUST start with `x-`. |

### IdentityAttestation Object Detail

| Property | Type | Required | Description |
|---|---|---|---|
| `provider` | `string` | Yes | Provider or issuer identifier (e.g., idme, login.gov, internal proofing service, DID issuer). |
| `credentialType` | `string` (enum) | Yes | High-level credential or attestation category captured by the event. |
| `adapter` | `string` | No | Implementation adapter/interface identifier used to normalize a provider-specific identity flow. |
| `subjectRef` | `string` | No | Stable pseudonymous subject or continuity identifier bound to this attestation. |
| `did` | `DidString` | No | Decentralized identifier string in DID syntax. |
| `verificationMethod` | `string` | No | DID URL, key identifier, or equivalent verification-method reference. |
| `credentialRef` | `string` | No | Reference to an encrypted token, credential, presentation, or provider-response envelope. |
| `personhoodCheck` | `string` (enum) | No | Outcome of proof-of-personhood, liveness, or uniqueness checks when applicable. |
| `subjectBinding` | `string` (enum) | No | Which party in the workflow the attestation is about. |
| `assuranceLevel` | `string` | No | Assurance tier or policy profile satisfied by the attestation. |
| `privacyTier` | `PrivacyTier` (enum) | No | Disclosure tier describing identity linkability. |
| `selectiveDisclosureProfile` | `string` | No | Named policy profile controlling what portions of the attestation may be revealed. |
| `evidenceRef` | `string` | No | Reference to encrypted reveal material, redacted export evidence, or provider-response evidence. |
| `extensions` | `Extensions` | No | Implementation-specific extension data. Keys MUST start with `x-`. |

### ValidationSnapshot Object Detail

| Property | Type | Required | Description |
|---|---|---|---|
| `errors` | `integer` (minimum: 0) | Yes | Count of error-severity validation findings at the event boundary. |
| `warnings` | `integer` (minimum: 0) | Yes | Count of warning-severity validation findings at the event boundary. |
| `infos` | `integer` (minimum: 0) | Yes | Count of info-severity validation findings at the event boundary. |
| `results` | `array` of `ValidationResult` | No | Optional detailed ValidationResult snapshot captured alongside the summary counts. |
| `extensions` | `Extensions` | No | Implementation-specific extension data. Keys MUST start with `x-`. |

## Required Fields

- `eventId`
- `sequence`
- `eventType`
- `occurredAt`
- `recordedAt`
- `responseId`
- `definitionUrl`
- `definitionVersion`
- `actor`
- `source`

Within `Actor`: `kind`.
Within `Source`: `kind`.
Within `ChangeSetEntry`: `op`, `path`, `valueClass`.
Within `IdentityAttestation`: `provider`, `credentialType`.
Within `ValidationSnapshot`: `errors`, `warnings`, `infos`.

## Enumerations

| Property | Allowed Values |
|---|---|
| `eventType` (EventType) | `session.started`, `draft.saved`, `draft.resumed`, `response.completed`, `response.amendment-opened`, `response.amended`, `response.stopped`, `attachment.added`, `attachment.replaced`, `attachment.removed`, `prepopulation.applied`, `system.merge-resolved`, `validation.snapshot-recorded`, `calculation.material-change`, `nonrelevant.pruned`, `autosave.coalesced`, `device-linked`, `identity-verified`, `attestation.captured`, `response.submit-attempted`, `response.migrated` |
| `Actor.kind` | `respondent`, `delegate`, `system`, `support-agent`, `unknown` |
| `Source.kind` | `web`, `mobile`, `api`, `import`, `system-job`, `unknown` |
| `ChangeSetEntry.op` | `set`, `unset`, `add`, `remove`, `replace`, `reorder`, `status-transition` |
| `ChangeSetEntry.valueClass` | `user-input`, `prepopulated`, `calculated`, `imported`, `attachment`, `system-derived`, `migration-derived` |
| `IdentityAttestation.credentialType` | `oidc-token`, `verifiable-credential`, `proof-of-personhood`, `delegation-assertion`, `provider-assertion`, `other` |
| `IdentityAttestation.personhoodCheck` | `passed`, `failed`, `inconclusive`, `not-performed` |
| `IdentityAttestation.subjectBinding` | `respondent`, `subject`, `delegate`, `other`, `unknown` |
| `PrivacyTier` | `anonymous`, `pseudonymous`, `identified`, `public` |

## Cross-References

| Property | $ref Target |
|---|---|
| `validationSnapshot.results[*]` | `https://formspec.org/schemas/validationResult/1.0` (validationResult.schema.json) |
| `actor` | `#/$defs/Actor` (local) |
| `source` | `#/$defs/Source` (local) |
| `changes[*]` | `#/$defs/ChangeSetEntry` (local) |
| `identityAttestation` | `#/$defs/IdentityAttestation` (local) |
| `validationSnapshot` | `#/$defs/ValidationSnapshot` (local) |

The `IdentityAttestation` $def is also referenced externally by the Respondent Ledger schema at `respondent-ledger-event.schema.json#/$defs/IdentityAttestation`.

## Extension Points

- Top-level `extensions` object: open `additionalProperties` with `propertyNames.pattern: "^x-"`.
- `Actor.extensions`: same pattern.
- `Source.extensions`: same pattern.
- `ChangeSetEntry.extensions`: same pattern.
- `IdentityAttestation.extensions`: same pattern.
- `ValidationSnapshot.extensions`: same pattern.

Every major nested object carries its own `extensions` point, allowing implementation-specific data at any level of the event hierarchy.

## Validation Constraints

- `additionalProperties: false` at top level and on all $defs objects (`Actor`, `Source`, `ChangeSetEntry`, `IdentityAttestation`, `ValidationSnapshot`).
- `eventId`, `responseId`, `definitionVersion`, `sessionRef`, `amendmentRef` enforce `minLength: 1`.
- `ChangeSetEntry.path` enforces `minLength: 1`.
- `sequence` enforces `minimum: 1` and `type: integer`.
- `definitionUrl` enforces `format: uri`.
- `occurredAt` and `recordedAt` enforce `format: date-time`.
- `changes` enforces `minItems: 1` when present -- an empty changes array is not valid.
- `ValidationSnapshot.errors`, `warnings`, `infos` enforce `minimum: 0` and `type: integer`.
- `HashString` enforces `pattern: "^[A-Za-z0-9._:+-]+:.+$"` -- algorithm prefix, colon, then digest.
- `DidString` enforces `pattern: "^did:[A-Za-z0-9._:%-]+:.+$"` -- DID method syntax.
- `before` and `after` in `ChangeSetEntry` have no type constraint -- any JSON value is valid.
- `Extensions` enforces `propertyNames.pattern: "^x-"` and `additionalProperties: true`.
- The first 13 `EventType` values (`session.started` through `validation.snapshot-recorded`) are described as required event types; the remaining 8 are optional but standardized extension points.
