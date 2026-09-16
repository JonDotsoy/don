#!/usr/bin/env bash
# Packaging smoke test: verifies the package actually works once packed
# with `npm pack` (which runs the real `prepack` lifecycle: lint + build)
# and installed as a real dependency in an external scratch project —
# unlike self-reference (importing "donly" from inside this repo), this
# exercises the real npm `exports`/`files` resolution consumers will hit,
# including whether "files" actually ships everything the package needs.
#
# Usage: scripts/smoke-test-imports/npm-pack-test.sh <node|bun|types|cli|bundle>
#   node|bun  runs run.mjs with that runtime against the installed package
#   types     type-checks check-types.ts against the installed package's
#             .d.ts files, using this repo's own installed typescript
#   cli       runs the packaged `donly` bin with `bunx donly` against the
#             installed package, exercising the `donly lint` command
#   bundle    generates one entry script per import path (see
#             generate-bundle-entries.mjs) and runs `bun build` on each,
#             for every target it declares support for (node, bun,
#             browser), against the installed package — verifying every
#             entry point (and its dependencies) actually bundles

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
  cli)
    cat > rules.json <<'EOF'
{
  "/server/port": {
    "[1]": { "type": "number", "message": "port must be a number" }
  }
}
EOF
    cat > file.donly <<'EOF'
server {
  port "3000"
}
EOF
    echo "==> Running 'bunx donly lint --rules rules.json file.donly' against the installed package"
    if bunx donly lint --rules rules.json file.donly; then
      echo "Expected 'bunx donly lint' to exit non-zero on a lint error" >&2
      exit 1
    fi

    echo "==> Running 'bunx donly inspect file.donly' against the installed package"
    INSPECT_OUTPUT="$(bunx donly inspect file.donly)"
    echo "$INSPECT_OUTPUT"
    if [ "$INSPECT_OUTPUT" != '{
  "server": {
    "port": "3000"
  }
}' ]; then
      echo "Unexpected 'bunx donly inspect' output" >&2
      exit 1
    fi

    # Exercises --rules with a .donly (DON-syntax) rules file instead of
    # JSON — see src/demo/lint/rules.donly, a multi-level ruleset covering
    # most of the schema (required, max/min, [N]/path[N], every `type`,
    # or/and/not at every level, severity, etc.), paired with a fully
    # valid and a fully invalid example document.
    cp "$REPO_ROOT/src/demo/lint/rules.donly" ./rules.donly
    cp "$REPO_ROOT/src/demo/lint/example-valid.donly" ./example-valid.donly
    cp "$REPO_ROOT/src/demo/lint/example-invalid.donly" ./example-invalid.donly

    echo "==> Running 'bunx donly lint --rules rules.donly example-valid.donly' against the installed package"
    if ! bunx donly lint --rules rules.donly example-valid.donly; then
      echo "Expected 'bunx donly lint --rules rules.donly example-valid.donly' to exit zero" >&2
      exit 1
    fi

    echo "==> Running 'bunx donly lint --rules rules.donly example-invalid.donly' against the installed package"
    if bunx donly lint --rules rules.donly example-invalid.donly; then
      echo "Expected 'bunx donly lint --rules rules.donly example-invalid.donly' to exit non-zero on lint errors" >&2
      exit 1
    fi
    ;;
  bundle)
    ENTRIES_DIR="$PROJECT_DIR/bundle-entries"
    node "$REPO_ROOT/scripts/smoke-test-imports/generate-bundle-entries.mjs" "$ENTRIES_DIR"

    # manifest.json maps each entry script to the targets it must bundle
    # under; print it as "<file> <target>" pairs, one per line.
    while IFS=' ' read -r file target; do
      echo "==> Running 'bun build --target $target $file' against the installed package"
      bun build --target "$target" "$ENTRIES_DIR/$file" \
        --outdir "$PROJECT_DIR/bundle-out/$target" >/dev/null
    done < <(
      node -e '
        const manifest = require(process.argv[1]);
        for (const [file, targets] of Object.entries(manifest)) {
          for (const target of targets) console.log(`${file} ${target}`);
        }
      ' "$ENTRIES_DIR/manifest.json"
    )
    ;;
  *)
    echo "Unknown mode: $MODE (expected 'node', 'bun', 'types', 'cli', or 'bundle')" >&2
    exit 1
    ;;
esac
