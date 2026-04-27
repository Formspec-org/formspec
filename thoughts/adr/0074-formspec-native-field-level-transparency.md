# ADR-0074: Class-Aware Response and Bucketed Encryption (Core)

**Status:** Proposed
**Date:** 2026-04-25 (rewritten)
**Author:** Mike (TealWolf Consulting LLC)
**Applies to:** Core spec, Definition schema, Response schema, FEL processing model, Validation Report schema, Mapping spec, conformance fixtures
**Companion artifacts:**
- Access-Class Registry companion (new) — `specs/registry/access-class-registry.md`
- Privacy Profile sidecar (new) — `specs/privacy/privacy-profile.md`
- Respondent Ledger spec edits (existing) — `specs/audit/respondent-ledger-spec.md`
- BBS+ selective disclosure (follow-on) — ADR-0080

**Spec impact:** Major version bump. No backwards-compat carve-outs (no production deployments to preserve).
**Related:**
[ADR-0059 unified ledger as canonical event store](./0059-unified-ledger-as-canonical-event-store.md),
[ADR-0072 stack evidence integrity and attachment binding](./0072-stack-evidence-integrity-and-attachment-binding.md),
[ADR-0073 stack case initiation and intake handoff](./0073-stack-case-initiation-and-intake-handoff.md)

---

## Context

Formspec defines what fields are. Today it defines them by `type`, `concept` (ontology binding), `validation`, `accessibility`, `locale`, and a handful of other field-level attributes. **It does not define their access classification.** Whether a given field is PII, financial, medical, or routine procedural metadata is left to downstream consumers (WOS authorization rules, deployment-specific RBAC, vendor-specific PII scanners, manual review).

This is the source of three separable problems:

1. **PII inventory is conventional, not structural.** A reviewer asking "show me every field across our forms that contains medical data" can't answer the question by reading definitions. They have to read code, ask form authors, or run vendor-specific PII detectors that miss whatever the regex didn't catch.
2. **The encryption boundary arrives too late.** When the Respondent Ledger or a Subject Ledger ingests a Response, it has to classify the fields itself or treat the whole payload as a single sensitivity class. The browser had the cleartext at submission time; the server received cleartext; only after server-side classification does the encryption boundary close. Plaintext spent time in the wrong places because Formspec didn't carry the metadata to gate it earlier.
3. **The same field gets reclassified everywhere.** WOS event-types, Trellis envelopes, BI exports, and FOIA disclosure flows each invent their own classification. Drift is structural — there's no canonical source for "this field is `medical` data."

Formspec is the source of truth for what fields are. Classification is part of what they are. Native support is the right architectural cut.

This ADR scopes the **Core** machinery only. The class taxonomy itself (what tokens are valid, what they mean, namespace registries for `wos.*` / `hipaa.*` / `ferpa.*`) is registry-tier infrastructure, defined in a companion document. Per-deployment audience policy (who reads `medical`, lawful-basis declarations, deployment overrides) is a sidecar, defined separately.

---

## Decision

Five decisions:

1. **Add `accessControl` as a normative Core item property** on `field` and `group` items. Single shape; schema-optional with `class` defaulting to `unclassified` when absent. Lint enforces explicit declaration under Profile-loaded conformance.
2. **Replace flat Response with a bucketed wire shape** plus a `keyBag` of per-class wrapped DEKs. The flat shape remains valid for processors that load no Privacy Profile. Bucketed envelopes pin both the Definition version and the Privacy Profile version.
3. **Bucket assignment runs at definition load**, before Phase 1 (Rebuild). Phases 2–3 are class-aware under partial-key possession. A new **Phase 5 (Emission)** after Phase 4 produces the bucketed wire payload.
4. **Cross-class FEL is a definition error at Core**, unconditionally when no Profile is loaded. Privacy Profile lint MAY relax this only when the two classes' audience arrays are *literally equal* (set equality) in the loaded Profile, declared via `flClassCompatibility`.
5. **Defer class taxonomy and audience policy** to two companion documents (registry companion + sidecar). Core treats `class` values as opaque tokens.

This is a **major Formspec version bump**. The flat Response shape remains a valid fallback for no-Profile deployments; the bucketed shape is the new norm for Profile-loaded deployments. There are no production deployments to migrate.

---

## Specifics

### 1. Item schema addition

`accessControl` is a normative item property on `field` and `group` items. It is not an extension; it lives in the Item schema next to `accessibility`, `semanticType`, and `concept`.

```json
{
  "id": "diagnosis",
  "type": "longText",
  "concept": "http://hl7.org/fhir/Condition.code",
  "accessControl": {
    "class": "medical",
    "audience": ["medical_caseworker", "supervisor"],
    "lawfulBasis": "hipaa.treatment.18"
  }
}
```

- `class` (string, optional) — opaque class token. Resolution against the taxonomy lives in the Access-Class Registry companion. When `accessControl` is absent or `class` is omitted, the item resolves to `unclassified` (§2, §12).
- `audience` (array of strings, optional) — explicit audience override. When absent, the loaded Privacy Profile's class→audience mapping applies.
- `lawfulBasis` (string, optional) — declared legal/policy basis. Free-form token resolved against deployment policy.
- `cardinalityRationale` (string, optional, **group items only**) — required by lint rule `procedural-cardinality-over-sensitive-children` when a group's class is `procedural` (or a less-sensitive class than its children). Captures the author's rationale for treating cardinality as non-sensitive (§5, §13). Free-text, captured for review.

**Schema requirement vs. lint requirement.** `accessControl` is schema-optional on every Item. A Definition with no `accessControl` declarations parses cleanly and conforms under no-Profile loading (§2). Under Profile-loaded conformance, the Access-Class Registry's lint rule `every-field-classified` errors on items where `accessControl` is absent or `class` is omitted, and lint rule `every-group-must-declare-class` errors on groups without explicit `class`. **An item with explicit `accessControl: { class: "unclassified" }` does NOT fire `every-field-classified`** — explicit `unclassified` is a deliberate authorial choice (procedural metadata with genuinely no sensitivity), distinct from "I forgot to classify." This distinction lets incremental adoption proceed without lint-spam: authors mark intentionally-unclassified fields explicitly, leaving lint errors only on the items that need real classification work. The schema accommodates pre-2.0 Definitions by default; the lint regime makes classification mandatory when a deployment opts into the Profile.

`display` items have no Instance representation and MUST NOT carry `accessControl`.

`group` items SHOULD declare `accessControl.class` to govern their **structural envelope** (the array of indices for repeats). When omitted, the group's class is `unclassified`. Lint enforces explicit declaration under Profile-loaded conformance. The group's class need not match its children's classes. See §5.

There is no shorthand form. The original `accessClass: "medical"` shorthand is dropped — `accessControl.class` is the only shape.

### 2. Class-string opacity and conformance without Profile

Core treats every `class` value as an opaque token. Core does not validate that a class name appears in any taxonomy; that validation is a lint-time concern owned by the Access-Class Registry companion. Core's processing model reacts to the *presence* of a class token, not its semantics.

**Conformance without Privacy Profile.** A processor MAY conform to Core without loading any Privacy Profile. In that mode:

- Every item resolves to class `unclassified`.
- Response wire shape is the flat shape.
- ValidationReports are always full (never partial).
- Cross-class FEL never triggers (only one class exists).
- Behavior is identical to pre-version-bump Formspec.

Profile loading is purely additive. A Definition that declares `accessControl.class: "medical"` on items but is loaded into a Profile-less processor still works — the processor reads it as an opaque token, treats it the same as `unclassified` for routing purposes, and emits the flat shape. Class metadata is preserved in the Definition; the runtime simply lacks the policy to act on it.

### 3. Class resolution

Class resolution at definition load:

1. Explicit `accessControl.class` on the item → canonical.
2. Otherwise → `unclassified`.

**Concept-implied class is lint input only.** The Access-Class Registry companion MAY declare `impliedAccessClass` for a registered concept (e.g., `http://hl7.org/fhir/Condition.code` → `medical`). The runtime never consults this. Lint rule `access-class-concept-consistency` MUST fire at **error severity** when explicit and implied classes disagree across PII-adjacent boundaries (medical vs. financial, sensitive_history vs. demographic). It MAY fire at warning severity for non-sensitive disagreements. The lint forces the author to make any override explicit.

This preserves Ontology §8.1 (ontology metadata MUST NOT affect behavioral semantics): the Ontology Document is never consulted at runtime; concept-implied class lives in the Access-Class Registry, not in Ontology.

### 4. Bucketed Response wire shape

The wire shape is `oneOf`:

- **Flat shape** (`$formspecResponse: "1.0"`) — current shape, retained for no-Profile conformance.
- **Bucketed shape** (`$formspecResponse: "2.0"`) — class-bucketed.

```json
{
  "$formspecResponse": "2.0",
  "responseId": "resp-...",
  "definitionUrl": "...",
  "definitionVersion": "...",
  "profileUrl": "https://forms.example.gov/profiles/hipaa-2026.json",
  "profileVersion": "1.4.0",
  "buckets": {
    "procedural":     "<aes-256-gcm-ciphertext>",
    "pii_identifier": "<aes-256-gcm-ciphertext>",
    "financial":      "<aes-256-gcm-ciphertext>",
    "medical":        "<aes-256-gcm-ciphertext>"
  },
  "keyBag": {
    "procedural": [
      { "kid": "supervisor-key-1", "wrapped_dek": "..." },
      { "kid": "caseworker-key-1", "wrapped_dek": "..." }
    ],
    "financial": [
      { "kid": "supervisor-key-1", "wrapped_dek": "..." },
      { "kid": "fin-caseworker-key-1", "wrapped_dek": "..." }
    ],
    "medical": [
      { "kid": "supervisor-key-1", "wrapped_dek": "..." },
      { "kid": "med-caseworker-key-1", "wrapped_dek": "..." }
    ]
  }
}
```

**Envelope fields are unencrypted by design.** `responseId`, `definitionUrl`, `definitionVersion`, `profileUrl`, `profileVersion`, `$formspecResponse`, `buckets` (the map keys, not values), and `keyBag` are plaintext at the wire level. Implementations MUST NOT encrypt envelope identifiers; doing so breaks correlation, routing, and ledger anchoring.

**Profile version pinning.** `profileUrl` and `profileVersion` identify the Privacy Profile loaded at emission time. Both MUST be present on bucketed Responses (`$formspecResponse: "2.0"`). They are absent on flat Responses. The keyBag's `kid` values reflect the Profile's audience map at emission; pinning lets a consumer detect Profile drift. A consumer attempting to interpret a Response under a different Profile version MUST reject the Response on AAD authentication failure (below).

**AAD discipline.** Each bucket ciphertext binds Associated Authenticated Data over the six-tuple `(responseId, classId, definitionUrl, definitionVersion, profileUrl, profileVersion)`. AAD authentication MUST fail when any of these six fields differs between emission and decryption. Profile-version inclusion is critical: without it, a bucket emitted under Profile v1 (audience = [caseworker, supervisor]) decrypted under Profile v2 (audience = [supervisor]) would silently misinterpret who's authorized. With AAD-pinned `profileVersion`, the cross-version decrypt fails authentication, surfacing the drift rather than masking it.

**The byte-exact AAD canonicalization is specified in `specs/core/response-spec.md`** (Implementation Notes §2). The canonicalization MUST pin: encoding (e.g., dCBOR), domain separator string, field ordering, and absent-field handling. This ADR specifies the *contract* (these six fields are bound); the spec edit specifies the *byte form*. Two implementations that disagree on canonicalization will produce non-interoperable ciphertexts; this is a load-bearing detail for the spec, not for the ADR.

**Profile-version resolution.** Implementations MUST resolve a loaded Profile by `(profileUrl, profileVersion)` and load the matching version from a deployment-managed registry. AAD authentication failure on decryption indicates a `kid` mismatch or Profile version mismatch; consumers MUST NOT attempt cross-version interpretation. Profile evolution is an operational concern: a Profile bump (even patch-level) creates a new `profileVersion` and historical Responses remain readable only by holders of keys for the version under which they were emitted.

**Algorithm pinning.** Core specifies AES-256-GCM for bucket ciphertext. Wrapped-DEK algorithms (HPKE / X25519 / RSA-OAEP) are deployment-pinned in the Privacy Profile, the same way ADR-0059 leaves wrapping algorithm choice to the deployment. Implementations MUST NOT diverge from the Profile's declared wrapping algorithm per-Response.

**Per-bucket structure.** Each bucket's plaintext is a JSON object containing the fields assigned to that class, keyed by Formspec response path. Field paths within a bucket follow standard Formspec path conventions; group structure is replicated per §5.

A separately-citable wire-format reference appears in `specs/core/response-spec.md` so downstream consumers (Trellis, WOS, FOIA tooling) can cite the wire format without inheriting the Privacy Profile mechanism.

### 5. Repeat groups across classes

A repeat group's **structural envelope** (the array of indices and any group-level metadata) is classified at the group's own `accessControl.class`. The group's children carry their own per-field classes; their values land in their respective buckets keyed by group index.

Example: `household[*]` declared `accessControl.class: "procedural"` with children `name` (`pii_identifier`) and `income` (`financial`).

```json
// procedural bucket (cardinality envelope)
{ "household": [ {"groupIndex": 0}, {"groupIndex": 1} ] }

// pii_identifier bucket
{ "household": [ {"name": "Ada"}, {"name": "Charles"} ] }

// financial bucket
{ "household": [ {"income": 47500}, {"income": 62000} ] }
```

A reader holding only the `pii_identifier` DEK sees names indexed `[0]` and `[1]`; they know two household entries exist (cardinality is procedural, observable to anyone with case-list access) but cannot read incomes.

**When cardinality itself is sensitive**, the author classifies the group at a non-procedural class. Asylum context: `household` declared `pii_identifier`. Medical context: `diagnoses` declared `medical` (the *count* of diagnoses is itself sensitive).

**Nested repeat lint rule.** A repeat group MUST NOT be declared at a less-sensitive class than any nested repeat group it contains, unless the author explicitly suppresses the lint with `cardinalityRationale`. Lint rule `nested-group-class-monotonicity` errors when, for example, a `procedural` `households[*]` contains a `medical` `diagnoses[*]`. The reason: a key holder for the inner class (`medical`) needs the outer class's bucket (`procedural`) to reconstruct full path context (which household each diagnosis belongs to). Without this rule, nested cross-bucket path resolution becomes implicit and breaks the "key holders for class X can interpret class X's data" property. Authors who genuinely need the asymmetry declare `cardinalityRationale` on the outer group with a brief explanation; the structural list of overrides is greppable for review.

**Class sensitivity ordering.** Core treats class tokens as opaque (§2), so "less-sensitive" cannot live in Core. **Sensitivity ordering is defined by the loaded Privacy Profile via the audience-subset relation:** class A is *more sensitive than* class B iff `audience(A) ⊊ audience(B)` (A's audience is a strict subset of B's). Equal audiences are equally sensitive (no ordering). Disjoint audiences are incomparable (no ordering — the lint rule does not fire). The lint rule `nested-group-class-monotonicity` is therefore a **Profile-loaded conformance rule**; under no-Profile conformance every class is `unclassified` and the rule is vacuous. The Privacy Profile sidecar specifies the ordering algorithm.

Lint rule `procedural-cardinality-over-sensitive-children` also fires when a group is `procedural` but its non-nested-repeat children include non-procedural fields. Same override mechanism: explicit `cardinalityRationale` suppresses, audit trail captured.

### 6. Processing model

Bucket assignment runs at **definition load**, before Phase 1. It produces a stable `path → class` index for the lifetime of the (Definition, Profile) pair. The index is recomputed only on Definition or Profile reload. It is consulted by Phases 2–4 and the Emission phase; never mutated.

**Phase 1 (Rebuild)** — unchanged in scope. Structural mutations to repeats and dependency-graph reconstruction. The class index is consulted; group cardinality envelopes are reflected in the per-class projection at Emission, not in Rebuild.

**Phase 2 (Recalculate)** — under partial-key possession, the evaluator's `EvalContext.availableClasses` is `Some(set)`. FEL references to fields whose class is not in the set produce **opaque values**. Opaque values resolve per the table below. When `availableClasses` is `None` (full-key, single-evaluator, Profile-less), behavior is unchanged.

**Phase 3 (Revalidate)** — under partial-key possession, emits a **partial ValidationReport** (§9). Bind constraints over opaque fields follow the MIP-context table; Shape rules over opaque fields produce findings under `unprocessedClasses` rather than normal error/pass.

**Phase 4 (Notify)** — unchanged.

**Phase 5 (Emission, new).** Every server-bound payload (final submit, draft save, autosave) is projected from the flat Instance into per-class plaintext objects, encrypted per bucket, DEKs wrapped to recipient public keys. The processor MUST NOT distinguish "draft" from "submission" for this invariant. Phase 5 has no FEL evaluation, no signal updates, and no Instance mutation; it is a pure projection-and-encrypt step. See §8.

#### MIP-context table for opaque references

| Context | Opaque reference resolves to | Spec basis |
|---|---|---|
| `relevant` | `true` (field stays visible) | Core §3.8.1 |
| `required` | `false` (not required) | Core §3.8.1 |
| `readonly` | `false` (not readonly) | Core §3.8.1 |
| `constraint` | `true` (passes) | Core §3.8.1 |
| `calculate` | `null` (propagates) | Core §3.8.1 / §3.8.2 |
| Shape `activeWhen` | `false` (shape inactive) | Extended by this ADR (Core §3.8.1 covers MIPs only) |
| `if(cond, …, …)` condition | **evaluation error** | Core §3.8.1 |
| Ternary `?:` condition | **evaluation error** (type error) | Core §3.3 / §3.10.2 |
| `and` / `or` operand | **evaluation error** (type error) | Core §3.3 |
| `not` / `!` operand | **evaluation error** (type error) | Core §3.3 |
| Equality `=` / `!=` operand | defined: `null = null` → `true`; `null = <non-null>` → `false` | Core §3.3 |
| `coalesce(…)` operand | skipped (per `coalesce` semantics) | Core §3.8.2 |
| `??` left operand | falls through to right | Core §3.8.2 |
| Explicit `boolean(…)` cast over opaque | `false` | Core §3.8.2 |
| Aggregate over opaque elements (`sum`, `count`, `avg`, `min`, `max`) | rejected statically (§7) | — |
| Path traversal through opaque field | `null` (propagates) | Core §3.8.3 |

**Information-leak note for equality.** `null = null` returning `true` and `null = <non-null>` returning `false` means equality tests can be used to distinguish "field is decryptable and equal to X" from "field is opaque to me." Authors writing `constraint` expressions over equality MUST treat `=` against potentially-opaque fields as security-relevant; cross-class FEL rejection (§7) catches the common case statically.

**Rationale for the constraint row.** Under §3.8.1 a null constraint passes. A partial-key validator therefore cannot detect violations in opaque classes — the violation is the responsibility of a key-holder who can see the value. The partial ValidationReport contract (§9) names this explicitly via `unprocessedClasses`.

### 7. Cross-class FEL: definition error at Core

A FEL expression that statically references fields from two or more classes is a definition error at definition load. This applies to **every FEL context**: `relevant`, `required`, `readonly`, `constraint`, `calculate`, Shape `activeWhen`, Shape rule predicates, and any other FEL position the spec defines.

**Rationale.** Aggregate functions (`sum`, `count`, `avg`, `min`, `max`) skip nulls per Core §3.8.2. A partial-key evaluator over an array containing some opaque elements produces a numerically wrong result, not a null. `sum([opaque, opaque, opaque])` returns `0`, not null. This is silent miscomputation with security consequences. A lint warning is insufficient; the authoring tool must hard-stop.

**Core check.** The FEL static analyzer (existing `fel-core::Dependencies`) extracts referenced field paths from each expression. The definition-load check resolves each path against the class index and collects the set of referenced classes. If the set has cardinality > 1, the definition is rejected.

**Path segments crossing class boundaries count as multi-class references.** Aggregates traversing a repeat group bind the group's class as well as the descendant field's class: `sum($household[*].income)` references both `household`'s class (e.g., `procedural`) and `income`'s class (`financial`). Both classes count toward the cross-class set. Wildcard expressions are not exempt from the rule.

**Implementation requirement.** The class index MUST expose per-segment class resolution for any path with structural intermediates: a `classes_along_path(path) -> Vec<ClassId>` operation that yields the class of every group segment plus the leaf class. A naive leaf-only lookup against the full path string (`"household[*].income"`) misses `household`'s class and is non-conformant.

**Profile-driven relaxation.** When a Privacy Profile is loaded at definition load, the Profile MAY declare `flClassCompatibility: [classA, classB]` to relax the rejection for that pair. **The relaxation predicate is literal set equality of the two classes' audience arrays** in the loaded Profile. Subset, intersection, or "shares at least one member" do NOT satisfy the predicate; only `audience(classA) === audience(classB)` (set equality) does.

**Enforcement is at both lint time AND processor load time.** The Profile lint MUST verify the audience-equality condition when accepting an `flClassCompatibility` declaration in a Profile document. Independently, **a conformant processor loading a Privacy Profile MUST verify the audience-equality predicate at load time and MUST reject the Profile as a load-time error if any declaration fails the predicate.** Lint-only enforcement is insufficient — a runtime processor that loads a Profile without an authoring-tool lint step would otherwise silently accept malformed declarations. The processor-level check is normative.

**Profile-less behavior.** When no Privacy Profile is loaded, the cross-class check operates against an empty `flClassCompatibility` set — i.e., **unconditional rejection**. A Profile-less processor never encounters cross-class FEL in practice because every field resolves to `unclassified` (§2), so the cardinality of referenced classes is at most 1; the rejection is vacuous. If a deployment moves from Profile-less to Profile-loaded, definitions that were silently fine under Profile-less may begin to reject — this is the desired behavior, not a regression.

This keeps Core's FEL behavior deterministic across all loading conditions. The relaxation is a Profile-time concern requiring explicit author intent; Core's own check is unconditional.

### 8. Encryption at the emission boundary

The flat Instance is the canonical engine state during fill. Per-class plaintext objects are computed at Emission time by projection — not maintained as engine state.

Conformant processors:

- MUST NOT route value updates through class-specific plaintext stores during Phases 1–4. The engine maintains one Instance, one signal graph, one validation graph.
- MUST compute the per-class projection at Emission time from the flat Instance.
- MUST encrypt every server-bound payload (submit, draft save, autosave). The spec does not distinguish "draft" from "submission" for the encryption invariant.
- MUST NOT include cryptographic state in the engine itself. Encryption, DEK generation, and key wrapping are host-side concerns invoked at the Emission boundary.

The phrase "encryption at the keystroke" is a user-facing claim about the network: cleartext never leaves the browser unencrypted. The implementation seam is at Emission, which is the *only* place per-class projection happens. AI-generated implementations that wire per-class signals into FormEngine state are non-conformant.

**Local persistence.** Browser localStorage / IndexedDB drafts MAY be plaintext when never synced to a server. When sync is in scope (autosave to server, cross-device draft resume), the **synced payload MUST be bucketed** (Phase 5). The local store remains plaintext during in-flight autosave so a failed server write does not leave the user with an unrecoverable encrypted local draft. Implementations MUST NOT pre-encrypt the local store in anticipation of sync; encryption is a Phase 5 concern, scoped to the payload that crosses out of the browser process. A failed server write keeps the plaintext local store usable; a successful server write does not require the local store to be re-encrypted (the server now holds the bucketed copy).

### 9. Partial ValidationReport contract

When the validator's `availableClasses` is constrained, ValidationReports are explicitly partial:

- `partial` (boolean) — REQUIRED. `true` for partial reports.
- `availableClasses` (array of strings) — REQUIRED on partial reports.
- `unprocessedClasses` (array of strings) — REQUIRED on partial reports.
- `valid` — on **full** reports (`partial: false`), boolean per the existing Core contract. On **partial** reports (`partial: true`), `valid` MUST be `null`. The schema enforces this with a conditional: `partial === true` implies `valid === null`. A partial report cannot make a whole-form validity claim, and the schema-level enforcement prevents a consumer from naively deriving `valid: true` by unioning partials.
- `counts.{error,warning,info}` — over decrypted classes only.
- `findings[]` — entries only for paths in decrypted classes.

**Per-evaluator artifacts.** Partial reports are per-evaluator. The spec does **not** define a merge semantics. A consumer needing the full report MUST hold all keys and re-evaluate. Implementations MUST NOT union partial reports across evaluators as if the union were authoritative — relevance and required state can differ depending on what an evaluator can see. The schema-level `valid: null` requirement prevents the most dangerous merge failure (a synthesized `valid: true` claim from disjoint partials) without specifying a normative merge.

**Consumer rule.** A consumer MUST treat absent findings under `unprocessedClasses` as "unknown," not "valid." UI affordances SHOULD surface `unprocessedClasses` as "validation status unknown." A user reviewing a case who cannot decrypt the `medical` bucket sees the field's locale label (Locale Documents are always plaintext) but no validation findings for it; UI implementations SHOULD indicate the unknown status. (The presentation contract for "validation status unknown" lives in the Theme/Component spec follow-on per §13; the data contract — `unprocessedClasses` populated, `valid: null`, `findings[]` truncated to processed paths — is normative here.)

### 10. Mapping spec interaction

Mapping documents preserve class. A Field Rule whose source path resolves to class A and whose target path resolves to class B (where A ≠ B) MUST declare `reclassification`:

```json
{
  "sourcePath": "applicant.income",
  "targetPath": "summary.amount",
  "transform": "preserve",
  "reclassification": {
    "targetClass": "procedural",
    "rationale": "Eligibility summary; financial detail stays in source.",
    "reviewer": "data-governance@example.gov"
  }
}
```

`reclassification` is added as a normative optional property on Field Rule in `mapping.schema.json`:

- `targetClass` (string, required) — MUST match the target field's `accessControl.class`.
- `rationale` (string, required) — free-text rationale captured for review.
- `reviewer` (string, optional) — reviewer/approver identifier.

Without `reclassification`, the mapping document is rejected at **mapping-document load time** by the Mapping document validator (`formspec validate <mapping.json>`). This is not a lint warning, and not a runtime-only concern; the validator refuses to load a class-crossing mapping that lacks `reclassification`, the same way it would refuse a structurally invalid Field Rule. Runtime mapping execution requires a valid mapping document; the runtime mapper does not re-check class stability because the validator has already enforced it. The Mapping spec adds the class-stability rule and the reclassification semantics in `specs/mapping/mapping-spec.md`.

### 11. nonRelevantBehavior interaction

`nonRelevantBehavior` semantics (`keep`, `remove`, `empty`) apply per-field as defined in Core §5.6. Bucket emission follows the resolved Instance value:

- `remove` → field absent from its class's bucket plaintext.
- `keep` → field's last-known value present in its class's bucket plaintext.
- `empty` → field present with empty value in its class's bucket plaintext.

This composes cleanly: bucket emission projects whatever the Instance contains after non-relevance resolution.

#### 11.1 Projection algorithm — interaction matrix

The projection step at Phase 5 (Emission) walks the resolved Instance and the class index and produces per-class plaintext objects. The algorithm sketch, normative for `specs/core/response-spec.md`:

```
for each path P in the resolved Instance:
    let item = definition.items[P]
    if item.type == "display": skip (no Instance representation)
    let class = classIndex[P]   // resolved at definition load
    if item is non-relevant under nonRelevantBehavior == "remove": skip
    let bucket = buckets[class] ?? new {}
    bucket[P] = instance[P]    // includes "keep" last-value or "empty" value

for each group G in the resolved Instance with non-zero cardinality:
    let groupClass = classIndex[G]
    let envelope = buckets[groupClass] ?? new {}
    envelope[G] = [{ groupIndex: 0 }, { groupIndex: 1 }, ...]  // up to G's resolved cardinality
```

The full interaction matrix (group class × child class × non-relevance × display) MUST be specified with worked examples in `specs/core/response-spec.md`. The cases requiring explicit treatment:

- **Heterogeneous group children** (covered by §5's `household[*]` example).
- **Nested repeat groups** (covered by §5's `nested-group-class-monotonicity` lint rule). The byte-exact envelope shape for nested cardinality (whether `envelope[G]` keys use full resolved paths or nested arrays mirroring the Instance) is specified in `specs/core/response-spec.md` worked example.
- **`nonRelevantBehavior: keep` for a field whose containing group is in a different class** — the field's value lands in the *field's* class bucket; the group envelope is unaffected by the field's value-keeping behavior.
- **`nonRelevantBehavior: remove` for a field whose containing group is in a different class** — the field is absent from the field's class bucket; the group envelope still records the row's `groupIndex` because the row exists structurally even if its content is removed.
- **Non-relevant group itself** — when a group's own `relevant` evaluates to false, behavior follows the group's `nonRelevantBehavior`: `remove` omits both the group envelope and all child values from every bucket; `keep` emits the group envelope with kept cardinality and children's kept values; `empty` emits the group envelope with zero rows. Children inherit the group's non-relevance per Core's `relevant = own_relevant && parent_relevant` rule, so the child-NRB rules above apply on top.
- **`display` items inside a classified group** — display items contribute nothing to any bucket plaintext; they exist only at presentation time.
- **Empty buckets** — if a class has no fields with values after non-relevance resolution, the bucket is omitted from `buckets` entirely (not emitted as an empty ciphertext). The keyBag entry for that class is also omitted. **Audience for an absent bucket is Profile-static, not Response-derived:** the Privacy Profile defines audiences for every class; an absent bucket on a particular Response means that class had no values in this Response, *not* that the audience changed. Consumers MUST consult the Profile (resolved via `profileUrl`/`profileVersion`) for audience semantics, not the keyBag's presence/absence per Response.

### 12. `unclassified` runtime behavior

When no class is declared and no concept-implied class applies, the item's class is `unclassified`. Behavior differs by Response shape:

**Profile-less / flat Response (`$formspecResponse: "1.0"`).** No buckets exist. All values land in the flat `data` object. `unclassified` is a notional class with no operational consequence — there is no encryption, no key bag, no audience. Lint rules `every-field-classified` and `every-group-must-declare-class` do not fire (the deployment opted out of the Profile regime). Behavior is identical to pre-version-bump Formspec.

**Profile-loaded / bucketed Response (`$formspecResponse: "2.0"`).** An `unclassified` bucket exists; its default audience is empty. Without explicit deployment configuration, the bucket is unreadable by any party — effectively dead weight. Lint rule `every-field-classified` errors at production tier; lint rule `every-group-must-declare-class` errors on groups missing explicit `class`. Implementations MAY configure a deployment-default audience for `unclassified` in the Privacy Profile (e.g., "treat as procedural for this deployment"); when configured, the `unclassified` bucket inherits that audience. This is a deployment policy decision captured in the Profile, not a Core concern.

Authors who legitimately want to ship a partially-classified Definition during incremental adoption add `unclassified` items deliberately, accept the lint errors, and rely on the Profile's `unclassified`-default audience to keep the data flowing. This is the migration path between the no-Profile and full-Profile postures.

### 13. Theme / Component spec interaction

Components MAY render per-class affordances (lock icons, audience disclosures, "validation status unknown" indicators per §9). These are optional UX hints, not normative semantics. The Theme spec gains a `access.*` token category in a follow-on edit; token names are normative when that edit lands, visual treatment is implementation-defined. Out of scope for this ADR.

---

## Companion artifacts

| Document | Role | Status |
|---|---|---|
| **ADR-0074 (this)** | Core machinery — `accessControl` property, bucketed Response wire shape, processing model, FEL rules, partial ValidationReport contract | Proposed |
| **Access-Class Registry companion** (`specs/registry/access-class-registry.md`) | Class taxonomy (`procedural`, `pii_identifier`, `financial`, `medical`, `demographic`, `sensitive_history`, `attachment`, `staff_internal`, `respondent_self`, `unclassified`), namespace registry (`wos.*`, `hipaa.*`, `ferpa.*`, `itar.*`), concept-implied-class lint registry, lint rule definitions (`every-field-classified`, `access-class-concept-consistency`, `pii-fields-must-be-classified`, `audience-must-be-registered`, `attachment-fields-have-attachment-class`) | **Required infrastructure** — parallel to `extension-registry.md`, not a sidecar |
| **Privacy Profile sidecar** (`specs/privacy/privacy-profile.md`) | Per-deployment audience lists, lawful-basis declarations, class overrides with rationale, `flClassCompatibility` declarations, **class sensitivity ordering (audience-subset relation)** consumed by lint rules `nested-group-class-monotonicity` and `procedural-cardinality-over-sensitive-children` | Optional sidecar — parallel to Locale, content-only, MUST NOT alter Core machinery |
| **Bucketed Response Wire Format** (section in `specs/core/response-spec.md`) | Independently-citable wire-shape reference for downstream consumers (Trellis, WOS, FOIA) | Required, lives alongside Core |

The taxonomy is registry-tier infrastructure, **not optional metadata**. The Privacy Profile is genuinely optional and policy-only. This split avoids the §8.1 footgun of putting behaviorally-consequential content in an optional sidecar.

A follow-on **ADR-0080** addresses BBS+ selective disclosure for FOIA / cross-agency export / respondent self-attestation — a presentation-layer concern complementary to bucket encryption (which is an at-rest/in-transit confidentiality concern). Buckets and BBS+ compose; they are not alternatives.

---

## Consequences

### Positive

1. **Encryption at the source.** The respondent's browser knows what's sensitive before transmission. The server never holds plaintext for classes it isn't authorized for. Sovereignty story is structural, not procedural.
2. **PII inventory becomes structural.** "Show me every `medical`-class field across our forms" is a static analysis question. Lint, audit, and review pipelines can answer it without runtime telemetry.
3. **Cross-spec consistency.** One classification flows from Definition → Response → ledger event → governance event → export. WOS and Trellis inherit the classification rather than re-deriving it.
4. **Profile-less conformance preserved.** Intake-only deployments without a Privacy Profile still conform; they emit flat Responses, behave identically to pre-version-bump Formspec. Profile loading is purely additive.
5. **Clean engine architecture.** Flat Instance during fill, projection at Emission, no crypto in the engine or Rust crates. Reactivity unaffected.
6. **Cross-class FEL silent miscomputation eliminated.** Static rejection at definition load prevents partial-key aggregates from producing numerically wrong totals.
7. **Composes with existing field-level metadata patterns.** `accessibility`, `locale`, `concept`, `validation` already exist as field-level attributes. `accessControl` slots in cleanly.

### Negative

1. **Major Formspec version bump.** Definition schema, Response schema, FEL semantics under encryption, lint rules, conformance fixtures all change. AI-tractable; no production migration cost.
2. **Form authors learn the taxonomy.** Authoring becomes more deliberate. Lint rules + concept-implied-class hints reduce burden, but the cognitive load is real. Mitigated by Studio authoring UI.
3. **Wire-shape complexity.** Bucketed responses are larger than flat ones (one ciphertext + one key bag entry per class instead of one flat object). For a typical form with 5–6 active classes, ~5–6× the encryption metadata. Acceptable; bounded.
4. **Cross-class FEL unavailable by default.** Authors who legitimately need cross-class expressions must configure a Privacy Profile `flClassCompatibility` declaration.
5. **Studio rendering complexity.** Per-class progressive disclosure UI; differential rendering when the user can decrypt some classes but not others; "validation status unknown" affordances. Real Studio work.
6. **Mapping authoring friction.** `reclassification` requires explicit rationale + reviewer signoff. Real but desirable governance overhead.
7. **Per-class DEK overhead.** For a form with 8 active classes × N recipients per class, the key bag has 8N entries. Bounded but real.

### Neutral

- **No precedent for "field-level access metadata" in W3C/JSON-Schema standards.** The closest analogs are sensitivity-labeling extensions in HL7 FHIR (`security-label`), DCAT distribution access policies, and some XACML-flavored proposals. None is a JSON-Schema-native design. The registry-companion + sidecar split gives forward compatibility with whatever standardizes later.

---

## Alternatives Considered

### Alternative 1: Classification at the ledger layer (Subject Ledger spec defines per-event-type)

Each ledger event-type CDDL specifies which fields belong to which class. The form definition stays unchanged.

**Rejected because:** classification arrives after the data has crossed the network. Browser has no way to encrypt at submission time. The "server never holds plaintext" property fails. Form authors don't think in ledger event-types; the natural place to classify is at field definition.

### Alternative 2: Classification in WOS spec only

WOS owns the classes; Formspec stays unaware. WOS-bound deployments classify; intake-only deployments don't.

**Rejected because:** intake-only Formspec deployments lose the encryption capability. The "Formspec is the source of truth for what fields are" principle breaks. Cross-spec coupling backwards (Formspec depends on WOS).

### Alternative 3: Vendor / deployment-specific PII metadata

Deployments define their own classification convention. No spec change.

**Rejected because:** drift is structural. Two Formspec deployments cannot interop on classification. Cross-tenant case sharing breaks.

### Alternative 4: Concept ontology as the only classification

Skip `accessControl`; require every field to bind a concept; derive class entirely from the ontology.

**Rejected because:** ontology binding is currently optional. Forcing it would over-scope the concept feature. Some fields (`procedural` lifecycle metadata, internal IDs) don't have natural ontology bindings.

### Alternative 5: Per-field DEKs (one DEK per item, not per class)

**Rejected because:** key bag explodes. A 50-field form × 5 recipients = 250 wrapped DEKs per response. Class-grouping bounds it to ~10 × N. Per-field can be added later as a refinement; the architecture admits it.

### Alternative 6: Bake the class taxonomy into Core

Add the full taxonomy (`procedural`, `pii_identifier`, `financial`, `medical`, …) directly to Core spec text and `definition.schema.json` enum.

**Rejected because:** taxonomy varies by deployment context. HIPAA-covered entities need `hipaa.phi.*` subclasses; FERPA-bound deployments need `ferpa.*`; ITAR-controlled environments need `itar.*`. Baking taxonomy into Core forces every deployment to inherit the union. Registry-companion approach lets taxonomy evolve independently of Core, with Core treating class names as opaque tokens.

### Alternative 7: Classification in the Ontology spec

`impliedAccessClass` becomes a normative property of Ontology concept bindings; Ontology becomes load-bearing for runtime classification.

**Rejected because:** Ontology §8.1 forbids ontology metadata from affecting behavioral semantics. The invariant is load-bearing, not stylistic — it preserves graceful degradation (a Core-only processor MAY ignore Ontology Documents) and prevents handing runtime security control to whoever authors the ontology. Making Ontology mandatory for any encryption-using deployment would defeat the sidecar model. Concept-implied class lives in the Access-Class Registry companion (lint input only), not in Ontology.

---

## Implementation Notes

### Spec edits (this ADR's scope)

1. `specs/core/spec.md` — add §X "Class-Aware Processing" defining `accessControl`, bucket-assignment-at-definition-load, processing-model phase deltas (Phase 1 unchanged; Phases 2–3 class-aware; new Phase 5 Emission), MIP-context table for opaque references, cross-class FEL definition error. Phase 5 is normatively numbered to align with the existing four-phase scheme. Add a normative sentence extending §3.8.1 to Shape `activeWhen`: "When `activeWhen` evaluates to `null` (including due to opaque references under partial-key possession), the Shape MUST be treated as inactive."
2. `specs/core/response-spec.md` — add "Bucketed Response Wire Format" section, including a normative projection-algorithm sketch covering the (group class × child class × `nonRelevantBehavior` mode × `display` items) interaction matrix with at least one nested-repeat worked example. AAD discipline inherits ADR-0059 envelope, with `profileVersion` included in canonical AAD.
3. `schemas/definition.schema.json` — add `accessControl` property to item schema (peer of `accessibility`, `semanticType`, `concept`). All sub-fields optional including `class` (defaults to `unclassified`). On group items, `accessControl.cardinalityRationale: string` is allowed and consumed by the cardinality lint rules.
4. `schemas/response.schema.json` — `oneOf` between flat shape (no Profile) and bucketed shape (Profile loaded). Bucketed shape requires `profileUrl`, `profileVersion`, `buckets`, `keyBag`. Flat shape forbids those four. `keyBag` schema treats `kid` as an opaque string (group-key vs. individual-key indirection is a deployment pattern, not a schema concern).
5. `schemas/intake-handoff.schema.json` — inherits Response shape via `$ref`; processing-host MUST hold procedural-class keys to interpret the handoff.
6. `schemas/validation-report.schema.json` — add `partial`, `availableClasses`, `unprocessedClasses` fields. Conditional schema constraint: `partial === true` implies `valid === null` (and vice versa: `partial === false` implies `valid: boolean`).
7. `schemas/mapping.schema.json` — add `reclassification` property to Field Rule. Mapping-document validator (`formspec validate`) rejects mappings whose source/target classes differ without `reclassification`.
8. `specs/mapping/mapping-spec.md` — class-stability rule enforced at mapping-document load time by the validator (not lint, not runtime); `reclassification` semantics.
9. `specs/audit/respondent-ledger-spec.md` — class-aware ChangeSetEntry redaction (5-line specialization of existing §7.7), gated on Privacy Profile loaded.
10. `specs/core/intake-handoff-spec.md` — receiving processor MUST hold procedural-class keys.

### Companion-document creation (separate spec authoring tasks)

11. `specs/registry/access-class-registry.md` — new companion (taxonomy + lint registry).
12. `specs/privacy/privacy-profile.md` — new sidecar (audience policy + class overrides + `flClassCompatibility`).

### Conformance fixtures

13. New conformance-suite kinds:
    - `BUCKETED_RESPONSE_ROUNDTRIP` — byte-exact fixtures for encrypt/decrypt round-trip.
    - `PARTIAL_VALIDATION_REPORT` — partial-key validator output shape.
    - `CROSS_CLASS_FEL_DEFINITION_ERROR` — definitions rejected at load.
    - `FLAT_RESPONSE_NO_PROFILE` — Profile-less conformance.
    - `REPEAT_GROUP_CARDINALITY_ENVELOPE` — group structural envelope across class boundaries.

### Reference-implementation changes

1. **`crates/formspec-eval/`** — `EvalContext.availableClasses: Option<HashSet<ClassId>>`; new Emission step at end of pipeline; class index attached to `ItemTree` after `rebuild_item_tree()`. **No crypto in this crate.** `ClassId` is defined as a newtype string in `crates/formspec-core` (or a small `formspec-class-types` crate if cross-crate use grows); Core treats class tokens as opaque strings, so `ClassId` is a transparent string newtype with no parsing or validation at the type level.
2. **`crates/fel-core/`** — no changes; `Dependencies.fields` already exposes the audience-set computation needed for cross-class FEL detection.
3. **`crates/formspec-core/`** — add `class_index.rs` (definition-load-time computation, ~100 lines); add audience-set lint in `fel_analysis.rs` (~150 lines); cross-class definition-error rejection at load.
4. **`packages/formspec-engine/`** — add new methods `getBucketedResponse(availableClasses?)`, `getPartialValidationReport(availableClasses?)`, `getInstanceSnapshot()`. Existing `getResponse()` and `getValidationReport()` unchanged for Profile-less paths. **No crypto in FormEngine.**
5. **Host-side emission wrapper** — new package `packages/formspec-bucketing/` at **dep-fence layer 2** (alongside `formspec-webcomponent` and `formspec-core`). Add `formspec-bucketing: 2` to `scripts/check-dep-fences.mjs` LAYERS map. Responsibilities: flat-Instance-to-buckets projection, DEK generation, AES-256-GCM encryption with the AAD construction specified in `specs/core/response-spec.md`, key wrapping per the loaded Privacy Profile's declared algorithm. **The only package allowed to import a crypto library** — consider adding a CRYPTO_OWNER fence rule analogous to the existing WASM_OWNER fence to keep crypto out of every other layer.
6. **`packages/formspec-studio-core/`** — `mapping-sample-data.ts` updated to use `getInstanceSnapshot()` instead of `getResponse().data`.
7. **`packages/formspec-studio/`** — class-assignment authoring UI; reclassification rationale UX for mappings; "validation status unknown" affordances per §9.
8. **Python `src/formspec/`** — mirror engine changes; emission-wrapper module on the Python side for server tooling and SBA-mode audited decryption.

### Cross-spec ratchets

1. **WOS spec extension** registers `wos.*` class namespace in the Access-Class Registry companion. Out of scope for this ADR; tracked separately.
2. **Subject Ledger spec** (per ADR-0059 evolution) consumes `accessControl.class` from inherited Response classification; does not redefine.
3. **Trellis envelope** key bag structure uses Formspec class names as `class_id` values; round-trip fixture proves byte equality.

---

## Open Questions

The leans below favor solutions that make compliance, audit, and privacy review **structural** (answerable from the artifact) rather than **conventional** (answerable only at runtime or through review process). This matches the spec's general posture: classification, validation, mapping, and ledger all already make compliance queryable from the artifact.

1. **`attachment` class with per-instance audience.** Each attached file has its own audience (one medical record vs. another). Three options: (a) single `attachment` class with per-instance audience overrides on the `EvidenceAttachmentBinding`; (b) per-attachment derived class via slot-pattern policy registered in the deployment Profile; (c) two-tier — parent class on the item (`medical`), regulatory subclass on the binding (`hipaa.psychotherapy_notes`, `ferpa.directory_info`). **Lean: (c), with bucket-placement guardrail.** Matches how regulators actually think (HIPAA distinguishes subtypes within `medical`; FERPA distinguishes subtypes within educational). The form definition stays portable; the regulatory subclass overlay is owned by the Privacy Profile, not authored per-form. Compliance teams configure regulatory subclass policies once at the Profile level. **Guardrail (normative even at lean stage): regulatory subclasses are downstream-routing and disclosure-policy metadata; they MUST NOT influence bucket placement. Bucket placement is governed by the parent class only. The `path → class` index sees only parent classes; the keyBag schema is unaffected by subclass.** This guardrail bounds the asymmetry between hierarchical-attachment and flat-field classification: subclass is annotation, not encryption routing.

2. **Performance cap on key-bag size.** Audiences with thousands of recipients (every caseworker in a state agency) create unbounded keyBags. Three options: (a) implementation-defined — `kid` is opaque; deployments use group-key indirection or per-individual wrapping at their discretion, documented in the Privacy Profile; (b) normative `keyGroup` schema mechanism — keyBag entries gain a `keyGroupId` field type alongside `kid`; (c) hard cap with KDS overflow — entries above the cap become `keyBagRef` pointers to an external key-distribution service. **Lean: (a).** The keyBag's `kid` is an opaque string identifier in the bucketed Response shape — whether it points to an individual key or a group key is up to the deployment KMS. Group-key indirection is the right pattern for government-scale staff turnover, but it is a **deployment-level concern documented in the Privacy Profile sidecar**, not a Core schema mechanism. Promoting it to a normative `keyGroup` field would (i) bake half-specified group-rotation semantics into Core (the hard problem is revocation, which neither (b) nor (c) address), (ii) expand the trust model (group-key service becomes a third party in every decryption path) without a corresponding edit to ADR-0059, (iii) duplicate machinery the existing schema already supports via opaque `kid`. The Privacy Profile sidecar documents group-key indirection as a recommended deployment pattern.

3. **Theme token normativity.** Should the Theme spec's `access.*` token category be normative? Three options: (a) names normative, visual treatment implementation-defined; (b) no normativity — fully implementation-defined; (c) names normative + recommended visual defaults shipped with the spec. **Lean: (a).** Token-name normativity gives form authors a contract — class affordances have somewhere to go regardless of the host theme — without forcing visual uniformity across deployments. (b) cedes the contract entirely; tenants integrating with existing design systems (USWDS, state design systems) can map token names once at integration time without losing the spec contract. (c) ships visual defaults that age badly — spec-shipped colors and icons become the de-facto Formspec look that nobody refreshes. Visual treatment is not a spec concern; semantic vocabulary is.

4. **Sensitive `procedural` cardinality lint.** When a group is declared `procedural` but has children in non-procedural classes, should lint warn, error, or default-promote? Three options: (a) warn; author confirms or reclassifies; (b) error by default; require explicit `cardinalityRationale` to override; (c) default-promote group's class to most-restrictive child; explicit `cardinalityClass` opts out downward. **Lean: (b).** In Formspec's operating context — AI-generated codebase, "nothing is released," privacy review happens pre-launch — the audit trail is decisive. (b) produces a structural list of every "we deliberately decided cardinality wasn't sensitive" decision, each with a written rationale, greppable from the codebase. The friction is bounded: only groups whose children span classes hit the rule, and the rationale is written once per such group. (a) ships silent leaks when warnings are dismissed (and in AI-generated code, there is no human-author judgment to trust). (c) violates the spec's explicit-over-implicit pattern by silently promoting class declarations that the author wrote — the cardinality bucket ends up at a class the author didn't declare, and the runtime UX no longer matches the author's mental model. **Schema home for the override: `accessControl.cardinalityRationale: string` on group items**, defined in §1. The lint rules `procedural-cardinality-over-sensitive-children` and `nested-group-class-monotonicity` (§5) consume it.

---

## References

- ADR-0059 (Unified Ledger as Canonical Event Store) — encrypt-then-hash, key-bag mechanics, AAD discipline, per-recipient wrapping
- ADR-0072 (Stack Evidence Integrity and Attachment Binding) — `EvidenceAttachmentBinding`, `attachment_sha256` plaintext-byte identity tradeoff
- ADR-0073 (Stack Case Initiation and Intake Handoff) — `IntakeHandoff` carries bucketed Response into WOS
- ADR-0080 (Selective Disclosure via BBS+) — follow-on, FOIA / cross-agency export / respondent self-attestation
- Trellis Phase-1 envelope invariants (`trellis/specs/trellis-core.md` §6) — hash over ciphertext, key-bag immutability, redaction-aware commitment slots
- Formspec Core spec — existing field-level metadata patterns (`accessibility`, `locale`, `concept`, `validation`); §2.4 processing model phases; §3.8 null propagation rules
- Formspec Ontology spec — §8.1 metadata-only invariant (preserved by registry-companion split)
- Formspec Mapping spec — class-stability discipline under composition
- W3C Verifiable Credentials Data Model 2.0 — selective disclosure framing for ADR-0080
- HL7 FHIR `security-label` — closest existing standard for field-level sensitivity labeling; informative reference, not the schema model adopted
