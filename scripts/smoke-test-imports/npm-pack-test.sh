#!/usr/bin/env bash
# Packaging smoke test: verifies the package actually works once packed
# with `npm pack` (which runs the real `prepack` lifecycle: lint + build)
# and installed as a real dependency in an external scratch project —
# unlike self-reference (importing "donly" from inside this repo), this
# exercises the real npm `exports`/`files` resolution consumers will hit,
# including whether "files" actually ships everything the package needs.
#
# Usage: scripts/smoke-test-imports/npm-pack-test.sh <node|bun|types>
#   node|bun  runs run.mjs with that runtime against the installed package
#   types     type-checks check-types.ts against the installed package's
#             .d.ts files, using this repo's own installed typescript

set -euo pipefail

MODE="${1:?Usage: $0 <node|bun|types>}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

echo "==> Packing $REPO_ROOT (npm pack runs prepack: lint + build)"
cd "$REPO_ROOT"
npm pack --pack-destination "$WORK_DIR"
TARBALL_PATH="$(ls "$WORK_DIR"/*.tgz)"
echo "==> Packed: $TARBALL_PATH"

PROJECT_DIR="$WORK_DIR/project"
mkdir -p "$PROJECT_DIR"
cd "$PROJECT_DIR"
npm init -y >/dev/null

echo "==> Installing the packed tarball as a real dependency"
npm install "$TARBALL_PATH" --silent

case "$MODE" in
  node | bun)
    cp "$REPO_ROOT/scripts/smoke-test-imports/run.mjs" ./run.mjs
    echo "==> Running the runtime import smoke test with '$MODE' against the installed package"
    "$MODE" run.mjs
    ;;
  types)
    cp "$REPO_ROOT/scripts/smoke-test-imports/check-types.ts" ./check-types.ts
    cp "$REPO_ROOT/scripts/smoke-test-imports/tsconfig.json" ./tsconfig.json
    echo "==> Type-checking against the installed package's declaration files"
    "$REPO_ROOT/node_modules/.bin/tsc" -p ./tsconfig.json
    ;;
  *)
    echo "Unknown mode: $MODE (expected 'node', 'bun', or 'types')" >&2
    exit 1
    ;;
esac
