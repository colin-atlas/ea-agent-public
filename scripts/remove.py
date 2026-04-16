#!/usr/bin/env python3
"""Remove installed components from a workspace."""
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
    parser.add_argument("--state-file", type=Path, default=None)
    parser.add_argument("--components", required=True,
                        help="Comma-separated component ids to remove.")
    parser.add_argument("--force", action="store_true",
                        help="Also remove dependents.")
    args = parser.parse_args()

    kit = kitlib.load_kit(args.kit_root)

    if args.state_file is not None:
        state_dir = args.state_file.parent
        state_filename = args.state_file.name
    else:
        state_dir = args.workspace
        state_filename = "atlas-kit.local.json"
    state = kitlib.load_state(state_dir, state_filename)

    to_remove = [c.strip() for c in args.components.split(",") if c.strip()]
    installed = set(state.get("components", {}).keys())

    # Check each component is actually installed
    for cid in to_remove:
        if cid not in installed:
            print(f"ERROR: {cid} is not installed", file=sys.stderr)
            return 1

    # Check dependents
    all_to_remove = set(to_remove)
    for cid in to_remove:
        dependents = kitlib.check_dependents(cid, installed - all_to_remove, kit)
        if dependents:
            if args.force:
                all_to_remove.update(dependents)
            else:
                print(
                    f"ERROR: cannot remove {cid} — depended on by: {', '.join(dependents)}. "
                    f"Use --force to also remove dependents.",
                    file=sys.stderr,
                )
                return 1

    total_removed = 0
    total_skipped = 0
    for cid in sorted(all_to_remove):
        file_entries = state["components"][cid].get("files", [])
        removed, skipped = kitlib.remove_component_files(args.workspace, file_entries)
        total_removed += len(removed)
        total_skipped += len(skipped)
        if skipped:
            print(f"  WARN: {cid}: skipped modified files: {', '.join(skipped)}")
        del state["components"][cid]

    state["last_updated_at"] = datetime.now().astimezone().isoformat(timespec="seconds")
    kitlib.save_state(state_dir, state, state_filename)
    print(f"Removed {len(all_to_remove)} component(s), deleted {total_removed} file(s), skipped {total_skipped} modified file(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
