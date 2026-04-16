#!/usr/bin/env python3
"""Update installed components whose kit version has changed."""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts.lib import kit as kitlib


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--kit-root", required=True, type=Path)
    parser.add_argument("--workspace", required=True, type=Path)
    parser.add_argument("--answers", type=Path, default=None,
                        help="Optional new answers (merged with existing).")
    parser.add_argument("--state-file", type=Path, default=None)
    args = parser.parse_args()

    kit = kitlib.load_kit(args.kit_root)

    if args.state_file is not None:
        state_dir = args.state_file.parent
        state_filename = args.state_file.name
    else:
        state_dir = args.workspace
        state_filename = "atlas-kit.local.json"
    state = kitlib.load_state(state_dir, state_filename)

    if not state.get("components"):
        print("Nothing installed — run install.py first.")
        return 0

    if args.answers:
        state["answers"].update(json.loads(args.answers.read_text()))

    to_update = kitlib.components_needing_update(state["components"], kit)
    if not to_update:
        print("All components are up to date.")
        return 0

    now = datetime.now().astimezone().isoformat(timespec="seconds")
    updated_count = 0
    skipped_files = 0

    for cid in to_update:
        old_files = state["components"][cid].get("files", [])
        # Remove old files (checksum-guarded)
        removed, skipped = kitlib.remove_component_files(args.workspace, old_files)
        skipped_files += len(skipped)
        if skipped:
            print(f"  WARN: {cid}: kept {len(skipped)} modified file(s): {', '.join(skipped)}")

        # Re-install from kit
        try:
            new_files = kitlib.install_component(
                cid, args.kit_root, args.workspace, state["answers"]
            )
        except RuntimeError as exc:
            print(f"ERROR: {exc}", file=sys.stderr)
            return 1

        state["components"][cid] = {
            "version": kit[cid]["version"],
            "installed_at": now,
            "files": new_files,
        }
        updated_count += 1

    kit_version = (args.kit_root / "VERSION").read_text().strip() \
        if (args.kit_root / "VERSION").exists() else None
    state["kit_version"] = kit_version
    state["last_updated_at"] = now
    kitlib.save_state(state_dir, state, state_filename)
    print(f"Updated {updated_count} component(s). {skipped_files} modified file(s) preserved.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
