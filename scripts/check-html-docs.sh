#!/usr/bin/env bash
set -euo pipefail
make -s docs
if ! git diff --quiet -- 'docs/*.html'; then
  echo "HTML docs are stale. Run: make docs"
  exit 1
fi
