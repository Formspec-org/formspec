# Grant Application — Formspec Kitchen-Sink Reference

A complete vertical slice demonstrating the full Formspec lifecycle and nearly every feature across all specification tiers:
**screener routing → form authoring → browser rendering → submission → server re-validation → mapping output**

## What's here

<!-- filled by Task 2 -->

## Running

### 1. Install and build (one-time)

```bash
# From repo root
npm install
npm run build
```

### 2. Start the form (browser)

```bash
cd examples/grant-application
npm run dev
```

Open: http://localhost:8081

> `npm run start:grant-app` from the repo root is an alias.
> The `test:serve` script (port 8080) serves the Playwright test harness — use `npm run dev` here for the demo.

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

## Feature coverage by spec tier

### Core (data & logic)

<!-- filled by Task 3 -->

### FEL (expression language)

<!-- filled by Task 4 -->

### Theme (presentation)

<!-- filled by Task 5 -->

### Components (interaction)

<!-- filled by Task 6 -->

### Mapping DSL (data transforms)

<!-- filled by Task 7 -->

### Registry & Changelog (extensions & versioning)

<!-- filled by Task 8 -->

## What this does NOT cover

<!-- filled by Task 9 -->
