#!/bin/bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PACKAGE_DIR="$(dirname "$SCRIPT_DIR")"
REPO_ROOT="$(cd "$PACKAGE_DIR/../.." && pwd)"

echo "Building formspec-swift bridge bundle..."

# Ensure formspec-engine is built
if [ ! -d "$REPO_ROOT/packages/formspec-engine/dist" ]; then
    echo "Building formspec-engine first..."
    npm run build --workspace=formspec-engine --prefix="$REPO_ROOT"
fi

cd "$PACKAGE_DIR"
node bridge/esbuild.config.mjs
echo "Bridge bundle built successfully."
