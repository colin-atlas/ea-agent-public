#!/usr/bin/env bash
#
# Test the manifest validator by invoking it against a throwaway mini-kit
# constructed from fixtures. Each test case sets up a kit/ layout in a
# temporary directory, runs validate-manifests.sh from that directory, and
# asserts the expected exit code and output.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FIXTURES="$REPO_ROOT/tests/fixtures"

pass=0
fail=0

run_case() {
  local name="$1"
  local fixture="$2"
  local expected_exit="$3"

  local tmp
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' RETURN

  # Stage a minimal kit with only the fixture under test.
  mkdir -p "$tmp/kit/identity/fixture" "$tmp/schema" "$tmp/scripts/lib"
  cp "$fixture/manifest.json" "$tmp/kit/identity/fixture/manifest.json"
  cp "$REPO_ROOT/schema/component-manifest.schema.json" "$tmp/schema/"
  cp "$REPO_ROOT/scripts/validate-manifests.sh" "$tmp/scripts/"
  cp "$REPO_ROOT/scripts/lib/check-refs.py" "$tmp/scripts/lib/"
  chmod +x "$tmp/scripts/validate-manifests.sh"

  # Every case needs a bundles.json. For valid and missing-field we reference
  # the fixture bundle 'test-bundle'. For bad-bundle we deliberately omit it.
  # For bad-ref we don't care about bundles.
  if [[ "$name" == "invalid-bad-bundle" ]]; then
    echo '{"bundles": {"other-bundle": {"name": "Other", "description": "x", "components": []}}}' > "$tmp/kit/bundles.json"
  else
    echo '{"bundles": {"test-bundle": {"name": "Test", "description": "x", "components": []}}}' > "$tmp/kit/bundles.json"
  fi

  set +e
  ( cd "$tmp" && ./scripts/validate-manifests.sh ) >/dev/null 2>&1
  local actual_exit=$?
  set -e

  if [[ "$actual_exit" -eq "$expected_exit" ]]; then
    echo "PASS: $name (exit=$actual_exit)"
    pass=$((pass + 1))
  else
    echo "FAIL: $name (expected exit=$expected_exit, got $actual_exit)"
    fail=$((fail + 1))
  fi
}

run_case "valid"                 "$FIXTURES/valid"                 0
run_case "invalid-missing-field" "$FIXTURES/invalid-missing-field" 1
run_case "invalid-bad-ref"       "$FIXTURES/invalid-bad-ref"       1
run_case "invalid-bad-bundle"    "$FIXTURES/invalid-bad-bundle"    1

echo
echo "Results: $pass passed, $fail failed"
[[ "$fail" -eq 0 ]]
