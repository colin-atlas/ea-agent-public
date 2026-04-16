#!/usr/bin/env bash
#
# Validate every kit/**/manifest.json against schema/component-manifest.schema.json,
# then run cross-reference checks via scripts/lib/check-refs.py.
#
# Exit 0 on success, 1 on any failure.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

SCHEMA="schema/component-manifest.schema.json"

if [[ ! -f "$SCHEMA" ]]; then
  echo "ERROR: $SCHEMA not found" >&2
  exit 1
fi

# Pick a jsonschema CLI: local venv, then system, then 'python3 -m jsonschema'.
if [[ -x "$HOME/atlas-kit-dev/.venv/bin/jsonschema" ]]; then
  JSONSCHEMA=("$HOME/atlas-kit-dev/.venv/bin/jsonschema")
elif command -v jsonschema >/dev/null 2>&1; then
  JSONSCHEMA=(jsonschema)
else
  JSONSCHEMA=(python3 -m jsonschema)
fi

fail=0
count=0

while IFS= read -r -d '' manifest; do
  count=$((count + 1))
  if ! "${JSONSCHEMA[@]}" -i "$manifest" "$SCHEMA"; then
    echo "ERROR: $manifest failed schema validation" >&2
    fail=1
  fi
done < <(find kit -name manifest.json -type f -print0 2>/dev/null)

if [[ "$count" -eq 0 ]]; then
  echo "WARN: no manifests found under kit/" >&2
fi

# Also validate bundles.json is parseable JSON (schema for it TBD in a later plan).
if [[ -f kit/bundles.json ]]; then
  if ! jq empty kit/bundles.json 2>/dev/null; then
    echo "ERROR: kit/bundles.json is not valid JSON" >&2
    fail=1
  fi
fi

# Cross-reference checks.
if ! python3 scripts/lib/check-refs.py; then
  fail=1
fi

if [[ "$fail" -ne 0 ]]; then
  echo "FAIL: manifest validation failed" >&2
  exit 1
fi

echo "OK: validated $count manifest(s)"
