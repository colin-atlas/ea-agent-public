#!/usr/bin/env python3
"""
Cross-reference checker for atlas-kit component manifests.

Reads every kit/**/manifest.json and kit/bundles.json, and verifies:
  1. Every requires.components entry refers to an existing component id.
  2. Every bundles[] entry in a manifest refers to a bundle defined in kit/bundles.json.
  3. Every component id listed in a bundle's components[] refers to an existing component.
  4. Component IDs are unique across the kit.

Exits 0 on success, 1 on any error (with errors printed to stderr).
"""
import json
import sys
from pathlib import Path


def main() -> int:
    root = Path(__file__).resolve().parents[2]
    kit = root / "kit"
    bundles_path = kit / "bundles.json"

    if not bundles_path.exists():
        print(f"ERROR: {bundles_path} does not exist", file=sys.stderr)
        return 1

    bundles_doc = json.loads(bundles_path.read_text())
    bundles = bundles_doc.get("bundles", {})
    if not isinstance(bundles, dict):
        print("ERROR: kit/bundles.json 'bundles' must be an object", file=sys.stderr)
        return 1

    manifests: dict[str, dict] = {}
    for manifest_path in sorted(kit.rglob("manifest.json")):
        data = json.loads(manifest_path.read_text())
        cid = data.get("id")
        if not cid:
            print(f"ERROR: {manifest_path} has no 'id'", file=sys.stderr)
            return 1
        if cid in manifests:
            print(f"ERROR: duplicate component id '{cid}' in {manifest_path}", file=sys.stderr)
            return 1
        expected_dir = kit / cid
        if manifest_path.parent != expected_dir:
            print(
                f"ERROR: component id '{cid}' in {manifest_path} does not match "
                f"its directory (expected {expected_dir})",
                file=sys.stderr,
            )
            return 1
        manifests[cid] = data

    errors: list[str] = []

    for cid, data in manifests.items():
        for dep in data.get("requires", {}).get("components", []):
            if dep not in manifests:
                errors.append(
                    f"{cid}: requires.components references unknown component '{dep}'"
                )
        for bundle in data.get("bundles", []):
            if bundle not in bundles:
                errors.append(
                    f"{cid}: bundles[] references unknown bundle '{bundle}'"
                )

    for bundle_id, bundle in bundles.items():
        for cid in bundle.get("components", []):
            if cid not in manifests:
                errors.append(
                    f"bundles.json: bundle '{bundle_id}' references unknown component '{cid}'"
                )

    if errors:
        for e in errors:
            print(f"ERROR: {e}", file=sys.stderr)
        return 1

    print(f"OK: {len(manifests)} component(s), {len(bundles)} bundle(s), cross-refs valid")
    return 0


if __name__ == "__main__":
    sys.exit(main())
