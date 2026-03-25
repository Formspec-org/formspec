#!/usr/bin/env bash
set -euo pipefail

# Build all apps and assemble into public/ for Firebase Hosting.
#
# Layout:
#   public/
#   ├── index.html              ← marketing site
#   ├── docs/                   ← HTML specs + API docs (Python, TypeScript, Rust)
#   ├── studio/                 ← studio SPA
#   ├── references/             ← reference frontend
#   ├── examples/               ← form definition data (used by references)
#   ├── registries/             ← registry JSON (used by references)
#   └── schemas/                ← JSON Schema files (public spec)

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PUBLIC="$ROOT/public"

echo "==> Cleaning public/"
rm -rf "$PUBLIC"
mkdir -p "$PUBLIC"

# ── 0. Generate API docs + HTML specs (must run before Astro copies docs/) ──
echo "==> Generating API docs and HTML specs"
(cd "$ROOT" && make api-docs html-docs)

# ── 1. Marketing site + Studio (Astro SSG + Vite SPA) ──
echo "==> Building marketing site and studio"
(cd "$ROOT/site" && npm run build)
cp -r "$ROOT/site/dist/"* "$PUBLIC/"

# ── 2. Reference frontend ──
echo "==> Building references"
(cd "$ROOT/examples/refrences" && npx vite build --base=/references/)
cp -r "$ROOT/examples/refrences/dist/" "$PUBLIC/references/"

# References SPA uses base /references/ — example JSON must live under references/examples/
echo "==> Copying reference example data (nested under /references/)"
mkdir -p "$PUBLIC/references/examples"
for dir in clinical-intake grant-application grant-report invoice uswds-grant; do
  cp -r "$ROOT/examples/$dir" "$PUBLIC/references/examples/$dir"
done
mkdir -p "$PUBLIC/references/registries"
cp "$ROOT/registries/"*.json "$PUBLIC/references/registries/"

# ── 3. Example data + registries (site root /examples, /registries) ──
echo "==> Copying example data"
mkdir -p "$PUBLIC/examples"
for dir in clinical-intake grant-application grant-report invoice uswds-grant; do
  cp -r "$ROOT/examples/$dir" "$PUBLIC/examples/$dir"
done

echo "==> Copying registries"
cp -r "$ROOT/registries" "$PUBLIC/registries"

echo "==> Copying schemas"
cp -r "$ROOT/schemas" "$PUBLIC/schemas"

echo "==> Build complete. Contents of public/:"
ls -la "$PUBLIC"
echo ""
du -sh "$PUBLIC"
