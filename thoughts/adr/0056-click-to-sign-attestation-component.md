# ADR 0056: Click-to-Sign Attestation Component

**Status:** Proposed
**Date:** 2026-04-01

## Context

Government forms, grant applications, and compliance filings routinely require electronic signatures in the form of "click to sign" — a deliberate affirmation that the respondent certifies the accuracy of their submission. This is distinct from the existing `Signature` component (Section 6.8), which captures a *drawn* freehand signature as an `attachment` image.

Formspec today supports a manual certification pattern using existing primitives:

```json
{
  "component": "Toggle",
  "bind": "certify",
  "onLabel": "I certify this information is correct"
},
{
  "component": "ConditionalGroup",
  "when": "$certify = true",
  "children": [
    { "component": "Signature", "bind": "approverSignature" }
  ]
}
```

This works but has limitations:

1. **No structured attestation semantics.** The certification is a plain boolean. There is no standard way to capture *who* signed, *when* they signed, or *what statement* they affirmed — metadata that matters for audit, compliance, and the respondent ledger.
2. **No spec-level vocabulary.** Form authors must manually compose the Toggle + ConditionalGroup + Signature pattern. Every author reinvents it differently, and processors cannot recognize the pattern or apply attestation-specific behavior (e.g., locking fields after signing, emitting `attestation.captured` ledger events).
3. **Drawn signature is overkill for many use cases.** Many electronic signature requirements (ESIGN Act, UETA, EU eIDAS simple signatures) accept click-to-sign without a drawn image. Requiring a canvas pad when a checkbox-and-timestamp suffices is friction without legal value.

The respondent ledger schema already defines `attestation.captured` as an event type, and the identity-verified event supports DID and credential references — so the *audit* infrastructure is ready. What's missing is a *component* that produces the right data shape and signals the right lifecycle events.

## Decision

Add **`ClickToSign`** as a Progressive input component (Component Spec Section 6, number 34) that binds to a **group** containing structured attestation fields.

### Why a group-bound component, not a new dataType

The attestation data — accepted (boolean), signedBy (string), signedAt (dateTime), statement (string) — maps entirely to existing core dataTypes. Introducing a new `attestation` dataType would:

- Require core spec changes (Tier 1) for a capability that is purely presentational in nature.
- Add a new value shape that FEL, validation, and mapping would all need special-casing for.
- Violate the principle that dataTypes describe *what data looks like*, not *how it was collected*.

A group-bound component keeps click-to-sign entirely in Tier 3. Each child field is a normal item with a normal dataType. FEL expressions like `$certification.accepted = true` work out of the box. Mapping rules can target `certification.signedAt` directly. Validation shapes can constrain individual fields. No special-casing anywhere in the engine.

### Component Definition

| Property | Value |
|----------|-------|
| **Category** | Input |
| **Level** | Progressive |
| **Accepts children** | No |
| **Bind** | Required (must reference a group key) |
| **Compatible dataTypes** | N/A (binds to group, not a single dataType) |
| **Fallback** | Stack containing Toggle + Text (see below) |

#### Props

| Prop | Type | Default | Token-able | Description |
|------|------|---------|------------|-------------|
| `statement` | string | `"I certify that the information provided is true and accurate."` | No | The attestation text displayed to the respondent. |
| `requireTypedName` | boolean | `false` | No | Whether the respondent must type their name to confirm identity. |
| `revocable` | boolean | `true` | No | Whether the attestation can be un-signed after signing. |
| `timestampFormat` | string | `"dateTime"` | No | Display format for the signing timestamp. |

#### Group Structure

When bound to group key `certification`, the component expects (and scaffolds, if using studio authoring) these child items:

| Item Key | dataType | Purpose |
|----------|----------|---------|
| `certification.accepted` | `boolean` | Whether the respondent has affirmed the statement. |
| `certification.signedBy` | `string` | Name or identity of the signer. |
| `certification.signedAt` | `dateTime` | Timestamp of the signing action. |
| `certification.statement` | `string` | The attestation text at the time of signing (frozen copy). |

All four fields are normal definition items. `signedAt` and `statement` are set automatically by the component when `accepted` transitions to `true`. `signedBy` is populated from host identity context if available, or typed by the respondent if `requireTypedName` is `true`.

#### Rendering Requirements

- MUST display the `statement` text prominently.
- MUST render a clear affirmation control (checkbox, button, or equivalent).
- When the respondent affirms, MUST set `accepted` to `true`, `signedAt` to the current timestamp, and `statement` to the current attestation text.
- If `requireTypedName` is `true`, MUST display a text input for the respondent's name and MUST NOT set `accepted` to `true` until a non-empty name is provided.
- If `revocable` is `false`, MUST disable the affirmation control after signing (one-way latch).
- When `revocable` is `true` and the respondent un-signs, MUST clear `signedAt` and `statement` and set `accepted` to `false`.
- MUST propagate `required`, `readOnly`, and `relevant` state to the group.
- MUST display validation errors.
- SHOULD emit an `attestation.captured` respondent ledger event on signing.

#### Fallback Behavior

Core processors MUST replace `ClickToSign` with a **Stack** containing:

1. A **Text** node displaying the `statement` prop.
2. A **Toggle** bound to `<groupKey>.accepted` with `onLabel` set to the statement text.
3. If `requireTypedName` is `true`, a **TextInput** bound to `<groupKey>.signedBy`.

This fallback is fully functional — it captures the boolean certification and optional name. It loses automatic timestamping and statement freezing, which are Progressive enhancements.

### Example

Definition items:

```json
{
  "items": [
    {
      "key": "certification",
      "type": "group",
      "items": [
        { "key": "accepted", "dataType": "boolean" },
        { "key": "signedBy", "dataType": "string" },
        { "key": "signedAt", "dataType": "dateTime" },
        { "key": "statement", "dataType": "string" }
      ]
    }
  ]
}
```

Component tree node:

```json
{
  "component": "ClickToSign",
  "bind": "certification",
  "statement": "I certify that the information provided in this grant application is true, complete, and accurate to the best of my knowledge.",
  "requireTypedName": true,
  "revocable": false
}
```

### Interaction with Existing Features

| Feature | Interaction |
|---------|-------------|
| **FEL** | `$certification.accepted`, `$certification.signedAt`, etc. work as normal group field references. |
| **Validation (binds)** | `required` on the group makes the entire attestation mandatory. `constraint` on individual child items works normally. |
| **Validation (shapes)** | Shape rules can target `certification.accepted` or any child field. |
| **Mapping** | Mapping rules target child fields directly: `certification.signedAt` → XML element, etc. |
| **Respondent Ledger** | Signing SHOULD emit `attestation.captured` with the `subjectRef` and `signedAt` in the event payload. |
| **Signature (drawn)** | Orthogonal. A form can use both: ClickToSign for the certification affirmation, Signature for a drawn image. The comprehensive example pattern (Toggle + ConditionalGroup + Signature) could be replaced by ClickToSign + Signature if both are desired. |

## Alternatives Considered

### A. New `attestation` core dataType

Introduce `attestation` alongside `string`, `boolean`, etc. The value shape would be `{ accepted, signedBy, signedAt, statement }`.

**Rejected** because dataTypes describe data shapes, not interaction patterns. An attestation is a *group of fields with a specific UX* — the data itself is just booleans, strings, and timestamps. Adding a core dataType would require changes to FEL (how do you reference `$field.accepted` on a non-group?), validation, mapping, and every processor — all for semantics that a group already provides.

### B. Extension property on Toggle

Add `x-attestation: true` to an existing Toggle component, with the Toggle itself handling the timestamp/name capture.

**Rejected** because it overloads Toggle with behavior that changes its data shape (Toggle writes a boolean; an attestation writes four fields). It also puts the burden on every Toggle implementation to check for extension properties, and the extension mechanism is meant for vendor-specific additions, not core capabilities.

### C. Keep it as a composition pattern (no spec change)

Document the Toggle + ConditionalGroup + Signature pattern as a "recipe" and let authors compose it manually.

**Rejected** because processors cannot recognize the pattern programmatically, there's no standard for the field names or data shape, and the audit infrastructure (`attestation.captured`) has no standard trigger. A named component with defined semantics is worth the small spec surface area increase.

## Consequences

- Component spec grows by one Progressive component (34 total built-in).
- `component.schema.json` gains a `ClickToSign` entry with its props.
- The fallback table in Section 9 gains one row.
- The dataType compatibility matrix in Appendix C is unaffected (ClickToSign binds to a group, not a dataType).
- No core spec changes. No new dataTypes. No FEL changes. No mapping changes.
- Studio authoring palette gains a "Click to Sign" entry that scaffolds the group + four child items automatically.
- The comprehensive example (Appendix A) could be updated to show ClickToSign alongside or instead of the current Toggle + Signature pattern.
