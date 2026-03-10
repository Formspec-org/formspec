# Definition Assembler — $ref Resolution

The assembler lives in `packages/formspec-engine/src/assembler.ts` and is exported as `assembleDefinition` (async) and `assembleDefinitionSync`. This doc captures what it does, what's missing, and concrete usage examples.

---

## What Exists Today

`assembleDefinition(definition, resolver)` walks the item tree, resolves `$ref` groups, and produces a self-contained definition.

### Implemented

- **Item key prefixing**: recursively renames imported item keys with `keyPrefix`
- **Bind `path` rewriting**: dot-path prefixed and scoped under the host group (e.g., `zip` -> `applicantAddress.app_zip`)
- **Shape `target` rewriting**: same treatment as bind paths
- **Fragment selection**: `#fragment` matches a top-level item key in the referenced definition (`referencedDef.items.find(i => i.key === fragment)`). Binds/shapes are filtered by checking whether the first segment of their path matches any key in the fragment's subtree (collected recursively via `collectAllKeys`) — so binds targeting deeply nested fields are included if their first path segment is a key anywhere in the fragment item tree.
- **Circular reference detection**: throws on re-entrant `$ref`
- **Key collision detection**: throws if prefixed keys collide with existing host keys
- **Shape ID collision avoidance**: auto-prefixes shape IDs with group key on conflict
- **Provenance tracking**: returns `assembledFrom` array with `{url, version, keyPrefix, fragment}`. Note: `assembledFrom` is referenced in spec prose (§6.6.2: "SHOULD carry") but is **not defined in `definition.schema.json`**. The assembled output may fail strict schema validation if the definition schema uses `additionalProperties: false`.
- **Async + sync variants**: `assembleDefinition` (async resolver) and `assembleDefinitionSync` (in-memory resolver)

### Not Implemented (spec-required)

The spec (§6.6.2 Assembly, rule 3) requires: "Binds, Shapes, and Variables from the referenced Definition MUST be imported into the host Definition. Their paths and scopes MUST be rewritten." The assembler is non-conformant in these areas:

- **Bind FEL expression rewriting**: `calculate`, `constraint`, `relevant`, `readonly`, `required`, and `default` (when FEL expression string, prefixed with `=`) inside imported binds are NOT rewritten. Path references like `$budget.lineItems[*].amount` remain unchanged after import.
- **Shape FEL rewriting**: Multiple FEL-bearing properties inside imported shapes are NOT rewritten:
  - `constraint`, `activeWhen` — standalone FEL expressions
  - `context` values — each value in the `context` object is a FEL expression (schema: `additionalProperties: { $ref: FELExpression }`)
  - `message` — MAY contain `{{expression}}` interpolation sequences where the embedded expressions are FEL (schema: "MAY contain {{expression}} interpolation sequences")
  - `and[]`, `or[]`, `not`, `xone[]` — entries can be **either shape IDs or inline FEL expressions**; inline FEL entries need path rewriting, while shape ID entries need ID-based updates (to match any auto-prefixed shape IDs from collision avoidance)
- **Variable import**: referenced definition's `variables` are not imported at all (spec MUST).
- **Variable collision detection**: not checked.
- **OptionSet / Instance import**: not addressed. Spec rule 3 explicitly requires only "Binds, Shapes, and Variables," and the schema's `keyPrefix` description mentions only "imported keys, Bind paths, Shape targets, and variable scopes." However, imported fields may reference `optionSet` names or `@instance()` data sources defined in the source definition, which would be unresolvable in the host. This is a **spec gap** — the assembler doc follows the spec, but practical usage will hit this.

### Test Coverage

Engine integration coverage now includes dedicated `$ref`/assembly tests, including `packages/formspec-engine/tests/kitchen-sink-runtime-rehomed.test.mjs` for screener+assembly behavior and the assembler-focused test suite under `packages/formspec-engine/tests/assembler-*.test.mjs`.

---

## Examples

### Example 1: Basic $ref — Reuse a Common Address Block

A "common-fields" definition in the library contains a reusable address group:

**Library definition** (`https://agency.gov/forms/common-fields|1.0.0`):
```json
{
  "$formspec": "1.0",
  "url": "https://agency.gov/forms/common-fields",
  "version": "1.0.0",
  "title": "Common Field Library",
  "status": "active",
  "items": [
    {
      "key": "address",
      "type": "group",
      "label": "Mailing Address",
      "children": [
        { "key": "street", "type": "field", "label": "Street", "dataType": "string" },
        { "key": "city", "type": "field", "label": "City", "dataType": "string" },
        { "key": "state", "type": "field", "label": "State", "dataType": "choice",
          "options": [{"value": "CA", "label": "California"}, {"value": "NY", "label": "New York"}] },
        { "key": "zip", "type": "field", "label": "ZIP Code", "dataType": "string" }
      ]
    },
    {
      "key": "contactInfo",
      "type": "group",
      "label": "Contact Information",
      "children": [
        { "key": "email", "type": "field", "label": "Email", "dataType": "string" },
        { "key": "phone", "type": "field", "label": "Phone", "dataType": "string" }
      ]
    }
  ],
  "binds": [
    { "path": "address.zip", "constraint": "matches($, '^\\d{5}(-\\d{4})?$')", "constraintMessage": "Enter a valid ZIP code" },
    { "path": "address.street", "required": "true" },
    { "path": "address.city", "required": "true" },
    { "path": "address.state", "required": "true" },
    { "path": "contactInfo.email", "constraint": "contains($, '@')", "constraintMessage": "Enter a valid email" }
  ],
  "shapes": [
    {
      "id": "contact-complete",
      "target": "contactInfo",
      "message": "Provide either email or phone.",
      "or": ["present($contactInfo.email)", "present($contactInfo.phone)"]
    }
  ]
}
```

**Authoring definition** (the form being built):
```json
{
  "$formspec": "1.0",
  "url": "https://agency.gov/forms/grant-application",
  "version": "2025.1.0",
  "title": "Grant Application",
  "status": "draft",
  "items": [
    { "key": "projectTitle", "type": "field", "label": "Project Title", "dataType": "string" },
    {
      "key": "applicantAddress",
      "type": "group",
      "label": "Applicant Address",
      "$ref": "https://agency.gov/forms/common-fields|1.0.0#address",
      "keyPrefix": "app_"
    },
    {
      "key": "fiscalAgentAddress",
      "type": "group",
      "label": "Fiscal Agent Address",
      "$ref": "https://agency.gov/forms/common-fields|1.0.0#address",
      "keyPrefix": "fiscal_"
    }
  ],
  "binds": [
    { "path": "projectTitle", "required": "true" }
  ]
}
```

**Resolved output** (what `assembleDefinitionSync()` returns today):
```json
{
  "$formspec": "1.0",
  "url": "https://agency.gov/forms/grant-application",
  "version": "2025.1.0",
  "title": "Grant Application",
  "status": "draft",
  "items": [
    { "key": "projectTitle", "type": "field", "label": "Project Title", "dataType": "string" },
    {
      "key": "applicantAddress",
      "type": "group",
      "label": "Applicant Address",
      "children": [
        { "key": "app_street", "type": "field", "label": "Street", "dataType": "string" },
        { "key": "app_city", "type": "field", "label": "City", "dataType": "string" },
        { "key": "app_state", "type": "field", "label": "State", "dataType": "choice",
          "options": [{"value": "CA", "label": "California"}, {"value": "NY", "label": "New York"}] },
        { "key": "app_zip", "type": "field", "label": "ZIP Code", "dataType": "string" }
      ]
    },
    {
      "key": "fiscalAgentAddress",
      "type": "group",
      "label": "Fiscal Agent Address",
      "children": [
        { "key": "fiscal_street", "type": "field", "label": "Street", "dataType": "string" },
        { "key": "fiscal_city", "type": "field", "label": "City", "dataType": "string" },
        { "key": "fiscal_state", "type": "field", "label": "State", "dataType": "choice",
          "options": [{"value": "CA", "label": "California"}, {"value": "NY", "label": "New York"}] },
        { "key": "fiscal_zip", "type": "field", "label": "ZIP Code", "dataType": "string" }
      ]
    }
  ],
  "binds": [
    { "path": "projectTitle", "required": "true" },
    { "path": "applicantAddress.app_zip", "constraint": "matches($, '^\\d{5}(-\\d{4})?$')", "constraintMessage": "Enter a valid ZIP code" },
    { "path": "applicantAddress.app_street", "required": "true" },
    { "path": "applicantAddress.app_city", "required": "true" },
    { "path": "applicantAddress.app_state", "required": "true" },
    { "path": "fiscalAgentAddress.fiscal_zip", "constraint": "matches($, '^\\d{5}(-\\d{4})?$')", "constraintMessage": "Enter a valid ZIP code" },
    { "path": "fiscalAgentAddress.fiscal_street", "required": "true" },
    { "path": "fiscalAgentAddress.fiscal_city", "required": "true" },
    { "path": "fiscalAgentAddress.fiscal_state", "required": "true" }
  ]
}
```

What happens today:
- `#address` fragment selects only the `address` group (not `contactInfo`)
- `keyPrefix` renames keys: `street` -> `app_street`, `city` -> `app_city`, etc.
- Bind `path` values are rewritten: `address.zip` -> `applicantAddress.app_zip`
- Same reference imported twice with different prefixes — no collisions
- Binds/shapes for `contactInfo` excluded by fragment filter
- `$ref` and `keyPrefix` stripped from resolved groups, replaced with `children`

What works correctly in this example: the `constraint: "matches($, '^\\d{5}(-\\d{4})?$')"` bind uses `$` (current-node), which needs no rewriting. Simple constraint/required binds that only reference `$` work fine without FEL rewriting.

---

### Example 2: Where FEL Rewriting Is Needed (Not Yet Working)

A budget template with cross-field FEL expressions:

**Library definition** (`https://agency.gov/forms/budget-template|2.0.0`):
```json
{
  "$formspec": "1.0",
  "url": "https://agency.gov/forms/budget-template",
  "version": "2.0.0",
  "title": "Budget Template",
  "status": "active",
  "items": [
    {
      "key": "budget",
      "type": "group",
      "label": "Budget",
      "children": [
        {
          "key": "lineItems",
          "type": "group",
          "label": "Line Items",
          "repeatable": true, "minRepeat": 1, "maxRepeat": 50,
          "children": [
            { "key": "description", "type": "field", "label": "Description", "dataType": "string" },
            { "key": "amount", "type": "field", "label": "Amount", "dataType": "money" }
          ]
        },
        { "key": "indirectRate", "type": "field", "label": "Indirect Rate (%)", "dataType": "decimal" },
        { "key": "totalDirect", "type": "field", "label": "Total Direct", "dataType": "money" },
        { "key": "totalIndirect", "type": "field", "label": "Total Indirect", "dataType": "money" },
        { "key": "grandTotal", "type": "field", "label": "Grand Total", "dataType": "money" }
      ]
    }
  ],
  "binds": [
    { "path": "budget.totalDirect", "calculate": "sum($budget.lineItems[*].amount)" },
    { "path": "budget.totalIndirect", "calculate": "$budget.totalDirect * ($budget.indirectRate / 100)" },
    { "path": "budget.grandTotal", "calculate": "$budget.totalDirect + $budget.totalIndirect" },
    { "path": "budget.indirectRate", "constraint": "$ >= 0 and $ <= 100", "constraintMessage": "Rate must be 0–100%", "default": "=if($budget.grandTotal > 0, 10, 0)" }
  ],
  "variables": [
    { "name": "budgetComplete", "expression": "present($budget.grandTotal) and $budget.grandTotal > 0" }
  ],
  "shapes": [
    {
      "id": "budget-has-items",
      "target": "budget.lineItems",
      "message": "Budget must have at least one line item with an amount.",
      "constraint": "count($budget.lineItems[*].amount) > 0"
    },
    {
      "id": "budget-total-reasonable",
      "target": "budget",
      "message": "Grand total ({{$budget.grandTotal}}) exceeds indirect cap.",
      "constraint": "$budget.grandTotal <= 1000000",
      "activeWhen": "present($budget.grandTotal)",
      "context": { "actualTotal": "$budget.grandTotal", "directPortion": "$budget.totalDirect" },
      "and": ["budget-has-items", "present($budget.indirectRate)"]
    }
  ]
}
```

**Authoring definition**:
```json
{
  "$formspec": "1.0",
  "url": "https://agency.gov/forms/research-proposal",
  "version": "1.0.0",
  "title": "Research Proposal",
  "status": "draft",
  "items": [
    { "key": "piName", "type": "field", "label": "Principal Investigator", "dataType": "string" },
    {
      "key": "projectBudget",
      "type": "group",
      "label": "Project Budget",
      "$ref": "https://agency.gov/forms/budget-template|2.0.0#budget",
      "keyPrefix": "proj_"
    }
  ]
}
```

**What the assembler produces today** (broken):
```json
{
  "binds": [
    { "path": "projectBudget.proj_totalDirect", "calculate": "sum($budget.lineItems[*].amount)" },
    { "path": "projectBudget.proj_totalIndirect", "calculate": "$budget.totalDirect * ($budget.indirectRate / 100)" },
    { "path": "projectBudget.proj_grandTotal", "calculate": "$budget.totalDirect + $budget.totalIndirect" },
    { "path": "projectBudget.proj_indirectRate", "constraint": "$ >= 0 and $ <= 100", "constraintMessage": "Rate must be 0–100%", "default": "=if($budget.grandTotal > 0, 10, 0)" }
  ],
  "shapes": [
    {
      "id": "budget-has-items",
      "target": "projectBudget.proj_lineItems",
      "message": "Budget must have at least one line item with an amount.",
      "constraint": "count($budget.lineItems[*].amount) > 0"
    },
    {
      "id": "budget-total-reasonable",
      "target": "projectBudget",
      "message": "Grand total ({{$budget.grandTotal}}) exceeds indirect cap.",
      "constraint": "$budget.grandTotal <= 1000000",
      "activeWhen": "present($budget.grandTotal)",
      "context": { "actualTotal": "$budget.grandTotal", "directPortion": "$budget.totalDirect" },
      "and": ["budget-has-items", "present($budget.indirectRate)"]
    }
  ]
}
```

The bind `path` and shape `target` are correct, but the FEL strings still reference the old keys. The engine will fail to resolve `$budget.lineItems[*].amount` because no item named `budget` exists in the resolved definition.

**What it should produce** (after FEL rewriting):
```json
{
  "binds": [
    { "path": "projectBudget.proj_totalDirect", "calculate": "sum($projectBudget.proj_lineItems[*].proj_amount)" },
    { "path": "projectBudget.proj_totalIndirect", "calculate": "$projectBudget.proj_totalDirect * ($projectBudget.proj_indirectRate / 100)" },
    { "path": "projectBudget.proj_grandTotal", "calculate": "$projectBudget.proj_totalDirect + $projectBudget.proj_totalIndirect" },
    { "path": "projectBudget.proj_indirectRate", "constraint": "$ >= 0 and $ <= 100", "constraintMessage": "Rate must be 0–100%", "default": "=if($projectBudget.proj_grandTotal > 0, 10, 0)" }
  ],
  "variables": [
    { "name": "budgetComplete", "expression": "present($projectBudget.proj_grandTotal) and $projectBudget.proj_grandTotal > 0" }
  ],
  "shapes": [
    {
      "id": "budget-has-items",
      "target": "projectBudget.proj_lineItems",
      "message": "Budget must have at least one line item with an amount.",
      "constraint": "count($projectBudget.proj_lineItems[*].proj_amount) > 0"
    },
    {
      "id": "budget-total-reasonable",
      "target": "projectBudget",
      "message": "Grand total ({{$projectBudget.proj_grandTotal}}) exceeds indirect cap.",
      "constraint": "$projectBudget.proj_grandTotal <= 1000000",
      "activeWhen": "present($projectBudget.proj_grandTotal)",
      "context": { "actualTotal": "$projectBudget.proj_grandTotal", "directPortion": "$projectBudget.proj_totalDirect" },
      "and": ["budget-has-items", "present($projectBudget.proj_indirectRate)"]
    }
  ]
}
```

FEL rewriting changes per expression:
| Property | Original | Rewritten | Why |
|---|---|---|---|
| bind `calculate` | `sum($budget.lineItems[*].amount)` | `sum($projectBudget.proj_lineItems[*].proj_amount)` | `budget` -> host group key; `lineItems`, `amount` -> prefixed |
| bind `calculate` | `$budget.totalDirect * ($budget.indirectRate / 100)` | `$projectBudget.proj_totalDirect * ($projectBudget.proj_indirectRate / 100)` | all segments within imported subtree rewritten |
| bind `constraint` | `$ >= 0 and $ <= 100` | unchanged | `$` is current-node, not a path reference |
| bind `default` | `=if($budget.grandTotal > 0, 10, 0)` | `=if($projectBudget.proj_grandTotal > 0, 10, 0)` | FEL expression after `=` prefix; path rewritten, `=` prefix preserved |
| shape `constraint` | `$budget.grandTotal <= 1000000` | `$projectBudget.proj_grandTotal <= 1000000` | standard path rewriting |
| shape `activeWhen` | `present($budget.grandTotal)` | `present($projectBudget.proj_grandTotal)` | standard path rewriting |
| shape `context` values | `"$budget.grandTotal"`, `"$budget.totalDirect"` | `"$projectBudget.proj_grandTotal"`, `"$projectBudget.proj_totalDirect"` | each context value is a FEL expression |
| shape `message` | `Grand total ({{$budget.grandTotal}}) exceeds...` | `Grand total ({{$projectBudget.proj_grandTotal}}) exceeds...` | FEL inside `{{...}}` rewritten; surrounding text intact |
| shape `and[0]` | `"budget-has-items"` | `"budget-has-items"` | shape ID reference — no collision, so unchanged |
| shape `and[1]` | `"present($budget.indirectRate)"` | `"present($projectBudget.proj_indirectRate)"` | inline FEL expression — standard path rewriting |

---

### Example 3: Error Cases

**Unresolved reference**:
```json
{ "key": "demographics", "type": "group", "$ref": "https://agency.gov/forms/common-fields|3.0.0", "label": "Demographics" }
```
Version `3.0.0` not in library -> resolver throws or returns undefined. The assembler does not catch this itself; the error depends on the resolver implementation. (The assembler only explicitly detects circular refs and fragment misses.)

**Key collision after prefix**:
```json
[
  { "key": "homeAddr", "type": "group", "$ref": "...#address", "keyPrefix": "addr_" },
  { "key": "workAddr", "type": "group", "$ref": "...#address", "keyPrefix": "addr_" }
]
```
Both import `street` as `addr_street` -> throws: `Key collision after assembly: "workAddr.addr_street" already exists in host definition`

**Circular reference**: Definition A refs B refs A -> throws: `Circular $ref detected: https://...`

**Invalid fragment**:
```json
{ "key": "info", "type": "group", "$ref": "https://agency.gov/forms/common-fields|1.0.0#nonexistent", "label": "Info" }
```
Throws: `Fragment key "nonexistent" not found in referenced definition https://agency.gov/forms/common-fields`

---

## Implementation Plan: TDD from the Inside Out

The missing work is a pure transformation: take a FEL string and a rewrite map, return a new string with paths updated. This is a textbook case for test-driven development — the inputs and outputs are strings, the rules are precise, and the edge cases are enumerable.

The plan follows the Fowler discipline: extract the smallest testable behavior, write a failing test, make it pass with the stupidest thing that works, then refactor once you see the shape of the code. Every test name is a specification sentence. No test is written until the previous one is green.

Tests live in `packages/formspec-engine/src/__tests__/assembler-rewrite.test.ts`. The unit under test starts as a single pure function and grows only when tests demand it.

### Design Insight: One Function, Two Maps

The entire FEL rewriting problem reduces to one pure function and two lookup structures:

```typescript
// The core rewrite function
rewriteFEL(expression: string, keyMap: RewriteMap): string

// keyMap is built once per $ref resolution from the imported fragment:
interface RewriteMap {
  fragmentRootKey: string;   // e.g. "budget"
  hostGroupKey: string;      // e.g. "projectBudget"
  importedKeys: Set<string>; // all keys in the fragment subtree
  keyPrefix: string;         // e.g. "proj_"
}
```

Every path segment that matches an `importedKeys` entry gets the prefix. The fragment root is replaced wholesale with the host group key. That's it — the rest is applying this to the right properties.

Shape ID rewriting is a separate, simpler transform — a string-to-string rename map built from the existing collision avoidance logic.

---

### Phase 1: `rewriteFEL` — the pure core

Extract one function. Test it in isolation. No assembler wiring yet.

Each test calls `rewriteFEL(expr, map)` directly and asserts the returned string. The map is hand-built in each test — no fixture definitions, no assembler, no engine.

#### Test list (write them in this order, one at a time)

**1.1 — Simplest possible rewrite: single-segment path**

```
rewriteFEL("$amount", { fragmentRootKey: "budget", hostGroupKey: "projectBudget",
  importedKeys: new Set(["budget", "amount"]), keyPrefix: "proj_" })
  → "$proj_amount"
```

This forces the function to exist, to parse a trivial expression, and to apply a prefix. The implementation can start as dumb string manipulation — don't reach for the parser yet. You'll know when you need it.

**1.2 — Dotted path with fragment root replacement**

```
"$budget.amount" → "$projectBudget.proj_amount"
```

The first segment matches `fragmentRootKey`, so it becomes `hostGroupKey`. Subsequent segments in `importedKeys` get prefixed. This is the most common real-world pattern. If your 1.1 implementation was string hacking, this test will likely break it — now you need actual path parsing.

**1.3 — Deep path with wildcards**

```
"$budget.lineItems[*].amount" → "$projectBudget.proj_lineItems[*].proj_amount"
```

Forces the parser to handle `[*]` without treating it as a segment boundary error.

**1.4 — `$` (bare current-node) is untouched**

```
"$ >= 0 and $ <= 100" → "$ >= 0 and $ <= 100"
```

This is the most important negative test. `$` alone is NOT a field reference — it's the current-node token. The function must distinguish `$` from `$fieldName`.

**1.5 — Path not in imported keys is untouched**

```
"$externalField + $budget.amount"
  → "$externalField + $projectBudget.proj_amount"
```

`externalField` is not in `importedKeys` and not the `fragmentRootKey`, so it's a cross-reference to the host definition and must be left alone. Only `budget.amount` gets rewritten.

**1.6 — Multiple references in one expression**

```
"$budget.totalDirect * ($budget.indirectRate / 100)"
  → "$projectBudget.proj_totalDirect * ($projectBudget.proj_indirectRate / 100)"
```

Forces correct handling of multiple replacements in one string. If you're doing right-to-left offset replacement, this is where you prove it works.

**1.7 — Context variables are untouched**

```
"@index > 0 and @count < 10 and @current.amount > 0"
  → unchanged (except @current.amount if "amount" is in importedKeys)
```

`@index`, `@count` pass through. `@current.amount` is interesting — the `amount` after `@current` IS a field in the current repeat instance. If `amount` is an imported key, the segment after `@current` should be prefixed: `@current.proj_amount`. Write the test, see what the spec demands, make a decision.

**1.8 — `@instance('name')` is untouched**

```
"@instance('priorYear').totalExpenditure" → unchanged
```

Instance references are not part of the imported item tree.

**1.9 — `#:varName` variable references are untouched**

```
"#:budgetComplete and $budget.grandTotal > 0"
  → "#:budgetComplete and $projectBudget.proj_grandTotal > 0"
```

Variable names are global identifiers, not paths. Only the `$budget.grandTotal` part is rewritten.

**1.10 — Indexed repeat references**

```
"$budget.lineItems[1].amount" → "$projectBudget.proj_lineItems[1].proj_amount"
```

Concrete indices (not just `[*]`) must also work.

**1.11 — Expression with no rewritable references**

```
"true" → "true"
"42" → "42"
"'hello'" → "'hello'"
```

Literal-only expressions pass through unchanged. This guards against the parser mangling non-path tokens.

**1.12 — `prev()`, `next()`, `parent()` string literal arguments are prefixed**

```
"prev('runningTotal')" → "prev('proj_runningTotal')"
"next('amount') + prev('amount')" → "next('proj_amount') + prev('proj_amount')"
"parent('projectName')" → "parent('proj_projectName')"
```

These three repeat navigation functions (per `fel-functions.schema.json`) take a **string literal** field name, not a `$`-prefixed path reference. The generic `$ident` path scanner won't see them — `'runningTotal'` is an opaque string token. But after assembly, the field key is renamed to `proj_runningTotal`, so the argument must be updated or the engine won't find the field at runtime.

The rewriter must special-case calls to `prev`, `next`, and `parent`: if the string literal argument matches a key in `importedKeys`, apply `keyPrefix`. If it doesn't match, leave it alone (it's referencing a field outside the import).

**1.13 — `prev()`, `next()`, `parent()` with non-imported field name are untouched**

```
"prev('externalField')" → "prev('externalField')"
```

`externalField` is not in `importedKeys`, so the argument passes through. This guards against over-rewriting.

**Refactor checkpoint.** After 1.13 is green, you have a solid `rewriteFEL`. Look at the implementation:
- Is the parse → collect positions → replace right-to-left pattern clean?
- Is `RewriteMap` the right shape, or does the function want something simpler?
- Are you reusing the existing FEL lexer/parser, or did you build a mini-parser? If mini, is it robust enough? If full, is it pulling too much weight?
- Is the `prev`/`next`/`parent` special-casing clean, or does it need a separate helper?

Clean it up. The next phases will call this function from many places — it needs to be trustworthy.

---

### Phase 2: Bind FEL integration

Now wire `rewriteFEL` into the assembler's bind import path. Each test calls `assembleDefinitionSync` with a minimal definition containing one `$ref` and checks the output bind's FEL string.

**2.1 — `calculate` expression is rewritten**

Library bind: `{ path: "budget.total", calculate: "sum($budget.lineItems[*].amount)" }`
Assert assembled bind: `{ path: "host.proj_total", calculate: "sum($host.proj_lineItems[*].proj_amount)" }`

**2.2 — `constraint` expression is rewritten**

Library bind with `constraint: "$budget.amount > 0"` → rewritten in output.

**2.3 — `relevant` expression is rewritten**

Library bind with `relevant: "$budget.showSection = true"` → rewritten.

**2.4 — `readonly` expression is rewritten**

Same pattern for `readonly`.

**2.5 — `required` expression is rewritten**

Same pattern for `required`.

**2.6 — `default` with `=` prefix: FEL is rewritten, prefix preserved**

Library bind: `{ path: "budget.rate", default: "=if($budget.grandTotal > 0, 10, 0)" }`
Assert: `{ path: "host.proj_rate", default: "=if($host.proj_grandTotal > 0, 10, 0)" }`

The `=` prefix is stripped before parsing, the FEL is rewritten, then `=` is re-prepended.

**2.7 — `default` with literal value is untouched**

Library bind: `{ path: "budget.rate", default: 0 }`
Assert: `{ path: "host.proj_rate", default: 0 }`

When `default` is not a string, or is a string without `=` prefix, leave it alone entirely.

**2.8 — `constraint` using only `$` (current-node) is untouched**

Library bind: `{ path: "budget.rate", constraint: "$ >= 0 and $ <= 100" }`
Assert: constraint string unchanged (only path is rewritten).

This is a regression guard for the Phase 1.4 behavior in the context of real assembly.

**Refactor checkpoint.** The assembler now has a loop over FEL-bearing bind properties. Extract a helper like `rewriteBindFEL(bind, map)` that handles all properties including the `default` prefix dance. The assembler's main path should read clearly: resolve items → rewrite paths → rewrite FEL → merge.

---

### Phase 3: Shape FEL integration

Shapes have more surface area than binds. Each sub-property type gets its own test.

**3.1 — Shape `constraint` is rewritten**

Library shape with `constraint: "$budget.grandTotal <= 1000000"` → rewritten.

**3.2 — Shape `activeWhen` is rewritten**

Library shape with `activeWhen: "present($budget.grandTotal)"` → rewritten.

**3.3 — Shape `context` values are rewritten**

Library shape with `context: { actualTotal: "$budget.grandTotal", directPortion: "$budget.totalDirect" }`
Assert: both values rewritten. Keys are untouched (they're arbitrary context field names, not paths).

**3.4 — Shape `message` with `{{expression}}` is rewritten**

```
message: "Total ({{$budget.grandTotal}}) exceeds cap."
  → "Total ({{$host.proj_grandTotal}}) exceeds cap."
```

Only FEL inside `{{...}}` delimiters is rewritten. The surrounding literal text stays put. Multiple `{{...}}` sequences in one message should each be rewritten independently.

**3.5 — Shape `message` without `{{...}}` is untouched**

```
message: "Budget must have at least one line item."
  → unchanged
```

Guard against the template parser mangling plain strings.

**3.6 — Composition `and[]` with inline FEL entries**

```
and: ["present($budget.email)", "present($budget.phone)"]
  → ["present($host.proj_email)", "present($host.proj_phone)"]
```

Both entries are FEL expressions (they contain `$`-prefixed references). Standard rewriting applies.

**3.7 — Composition `and[]` with shape ID entries — no collision**

```
and: ["budget-has-items", "budget-total-valid"]
  → ["budget-has-items", "budget-total-valid"]  (unchanged)
```

These are shape IDs, not FEL. When no collision avoidance prefixing occurred, they pass through.

**3.8 — Composition `and[]` with shape ID entries — after collision rename**

Setup: host definition already has a shape with id `"budget-has-items"`. Collision avoidance renames the imported shape to `"hostGroup_budget-has-items"`.

```
and: ["budget-has-items"]
  → ["hostGroup_budget-has-items"]
```

The composition reference must track the rename. This requires the assembler to pass a shape ID rename map alongside the FEL rewrite map.

**3.9 — Composition `and[]` with mixed entries**

```
and: ["budget-has-items", "present($budget.indirectRate)"]
  → ["budget-has-items", "present($host.proj_indirectRate)"]
```

First entry is a shape ID (no `$` references, matches a known shape ID), second is inline FEL. Each gets the right treatment.

**3.10 — `not` (single string) with inline FEL**

```
not: "present($budget.conflictField)"
  → "present($host.proj_conflictField)"
```

Same logic as array entries, but `not` is a single string, not an array.

**3.11 — `or[]` and `xone[]` follow same rules as `and[]`**

One quick test each to confirm the wiring. No new logic — the same rewrite function handles all composition arrays.

**Disambiguation heuristic** (implemented during this phase):

Build a `Set<string>` of imported shape IDs (both original and post-collision-rename). For each composition entry:
1. If the string is in the imported shape ID set → apply shape ID rename map
2. Otherwise → apply FEL rewriting

This is simpler and more reliable than trying to parse FEL speculatively. Shape IDs are known at assembly time. If a string matches a known shape ID, it's a reference. Everything else is FEL.

**Refactor checkpoint.** Extract `rewriteShapeFEL(shape, felMap, shapeIdRenameMap)`. The message template rewriting should be its own small function (`rewriteMessageTemplate`). The composition rewriter should be a single function that handles all four operators (`rewriteCompositionEntries`).

---

### Phase 4: Variable import

Variables are the last spec-required piece. They're structurally simpler than shapes but introduce a new import path (the assembler doesn't touch `variables` today at all).

**4.1 — Variables are imported into host**

Library has `variables: [{ name: "budgetComplete", expression: "...", scope: "#" }]`.
Assert: host definition's `variables` array contains the imported variable.

**4.2 — Variable `expression` is rewritten**

```
expression: "present($budget.grandTotal) and $budget.grandTotal > 0"
  → "present($host.proj_grandTotal) and $host.proj_grandTotal > 0"
```

Same `rewriteFEL` function. No new rewriting logic.

**4.3 — Variable `scope` referencing imported key is rewritten**

```
scope: "budget" → "hostGroup"  (if "budget" is the fragmentRootKey)
scope: "lineItems" → "proj_lineItems"  (if in importedKeys, prefixed)
```

Scope is a single item key, not a FEL expression. It maps through the same key rename table used for item keys.

**4.4 — Variable `scope: "#"` is untouched**

```
scope: "#" → "#"
```

Definition-wide scope has no item key to rewrite.

**4.5 — Variable name collision → error**

Host has `variables: [{ name: "budgetComplete", ... }]`. Import brings another `budgetComplete`. Assert: assembler throws with a clear message naming the collision.

Variable names are NOT prefixed with `keyPrefix` (spec and schema agree on this). Collision = hard error.

**4.6 — Fragment filter applies to variables**

Library has two variables: one scoped to `budget` (inside fragment), one scoped to `contactInfo` (outside fragment). When importing `#budget`, only the first variable is imported.

The filter: a variable is included if its `scope` is `"#"` (definition-wide) OR its `scope` matches a key in the imported fragment's subtree.

**Refactor checkpoint.** The assembler's main loop now handles items, binds, shapes, AND variables. Review the overall flow. Is the rewrite map constructed once and passed through cleanly? Is the shape ID rename map threaded correctly? Does the code read as a clear pipeline: resolve → prefix keys → build rewrite map → rewrite FEL in binds/shapes/variables → merge into host?

---

### Phase 5: Full integration smoke tests

These are higher-level tests using the Example 2 definition from this document. They prove the whole pipeline works end-to-end, but they are NOT where you first get things working — that happened in Phases 1–4.

**5.1 — Budget template import: full bind + shape + variable rewrite**

Use the exact library and authoring definitions from Example 2. Assert the assembled output matches the "What it should produce" JSON block in this document, including:
- All bind FEL strings rewritten
- `default` FEL preserved with `=` prefix
- Shape `message` template rewritten
- Shape `context` values rewritten
- Shape `and[]` mixed entries (shape ID + inline FEL) correctly handled
- Variable imported with rewritten expression and scope

**5.2 — Double import with different prefixes**

Import the same library definition twice (like Example 1's applicantAddress + fiscalAgentAddress). Assert no collisions and both sets of FEL expressions are independently correct.

**5.3 — Nested `$ref` with FEL (recursive resolution)**

Definition A imports B which imports C. C has FEL expressions. Assert FEL is rewritten at each level of resolution.

---

### Reference: Properties requiring FEL rewriting

For implementors scanning this doc — the complete list, derived from `definition.schema.json` and `fel-functions.schema.json`:

**Binds** — `calculate`, `constraint`, `relevant`, `readonly`, `required` (all `$ref: FELExpression`), `default` (when string starting with `=`)

**Shapes** — `constraint`, `activeWhen` (both `$ref: FELExpression`), `context` values (`additionalProperties: { $ref: FELExpression }`), `message` (FEL inside `{{...}}` interpolation), `and[]`/`or[]`/`xone[]` entries and `not` (when inline FEL, not shape ID)

**Variables** — `expression` (`$ref: FELExpression`), `scope` (item key, not FEL — uses key rename map, not `rewriteFEL`)

**Special-cased function arguments** — `prev('fieldName')`, `next('fieldName')`, `parent('fieldName')` take string literal field names (not `$`-prefixed paths). When the string matches an imported key, apply `keyPrefix`. These are the only FEL built-in functions whose string arguments encode field identity.

**Not rewritten** — `$` (current-node), `@index`/`@count`/`@current`, `@instance('name')`, `#:varName`, paths starting outside the imported fragment, literal text in `message` outside `{{...}}`, shape ID strings in composition operators (use rename map instead), string arguments to `prev`/`next`/`parent` that don't match imported keys

---

## API

```typescript
// Existing — no changes needed to the signature
export async function assembleDefinition(
    definition: FormspecDefinition,
    resolver: DefinitionResolver
): Promise<AssemblyResult>;

export function assembleDefinitionSync(
    definition: FormspecDefinition,
    resolver: (url: string, version?: string) => FormspecDefinition
): AssemblyResult;

export type DefinitionResolver =
    (url: string, version?: string) => FormspecDefinition | Promise<FormspecDefinition>;

export interface AssemblyResult {
    definition: FormspecDefinition;
    assembledFrom: AssemblyProvenance[];
}

export interface AssemblyProvenance {
    url: string;
    version: string;
    keyPrefix?: string;
    fragment?: string;
}
```

---

## Studio Integration (After FEL Rewriting Exists)

Once the assembler handles FEL rewriting, Studio adds:

### Tree Behavior
- `$ref` groups appear as normal nodes, visually marked "linked"
- Expanding shows referenced items as **read-only** with provenance badges
- "Fork" action: copy items into local children, remove `$ref`

### Definition Library (Project Drawer)
- Imported definitions listed by `url|version`
- "Used by" graph: which groups reference which definitions
- Missing reference warnings

### Preview / Validation
- Pass authored definition + library through `assembleDefinitionSync()`
- Feed resolved output to FormEngine for preview and validation
- Preserve original authoring form (with `$ref`) for export
