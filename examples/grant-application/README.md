# Grant Application — Formspec Reference Implementation

A complete vertical slice demonstrating the full Formspec lifecycle:
**form authoring → browser rendering → submission → server re-validation → mapping output**

## What's here

| File | Purpose |
|---|---|
| `definition.json` | 4-page grant application definition (items, binds, variables, shapes) |
| `component.json` | Wizard layout tree with DataTable budget and ConditionalGroup subcontractors page |
| `theme.json` | USWDS-flavored token set |
| `mapping.json` | Transforms submission → grants-management flat JSON |
| `sample-submission.json` | A complete valid response for curl testing |
| `index.html` | Styled portal page with sticky totals footer |
| `server/main.py` | FastAPI server: POST /submit → re-validate + map |

## Running

### 1. Build the TypeScript packages (one-time)

```bash
# From repo root
npm run build
```

### 2. Start the form (browser)

```bash
# From repo root
npm run start:test-server
```

Then open: `http://127.0.0.1:8080/examples/grant-application/index.html`

### 3. Start the API server (separate terminal)

```bash
cd examples/grant-application
pip install -r server/requirements.txt
PYTHONPATH=../../src uvicorn server.main:app --reload --port 8000
```

### 4. Test with curl (no browser needed)

```bash
curl -X POST http://localhost:8000/submit \
  -H "Content-Type: application/json" \
  -d @sample-submission.json | python3 -m json.tool
```

## What this exercises

- **Repeatable groups** (`lineItems`, `subcontractors`) with min/max cardinality
- **Money calculations** — element-wise `moneyAmount($unitCost) * $quantity`, `moneySum()`, `moneyAdd()`
- **Variables** — `@totalDirect`, `@indirectCosts`, `@grandTotal` computed once, used in shapes
- **Conditional relevance** — subcontractors page only when `usesSubcontractors = true`; indirect rate hidden for government orgs
- **Validation shapes** — cross-field budget match, 49% subcontractor cap, $500k warning threshold
- **Mapping DSL** — value maps, expression transforms (money field splitting), conditional rules
- **Server-side re-validation** — Python FEL evaluator re-checks constraints independently of the client

## What this does NOT cover

See `specs/core/spec.llm.md` for: screener routing, modular composition (`$ref`), version migrations,
extension registry, remote data sources (`@instance()`), CSV/XML adapter output.
