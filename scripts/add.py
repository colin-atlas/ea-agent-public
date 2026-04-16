#!/usr/bin/env python3
"""Add components to an existing workspace (skips already-installed)."""
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
    parser.add_argument("--answers", required=True, type=Path)
    parser.add_argument("--state-file", type=Path, default=None)
    parser.add_argument("--components", required=True,
                        help="Comma-separated component ids to add.")
    args = parser.parse_args()

    answers = json.loads(args.answers.read_text())
    kit = kitlib.load_kit(args.kit_root)

    if args.state_file is not None:
        state_dir = args.state_file.parent
        state_filename = args.state_file.name
    else:
        state_dir = args.workspace
        state_filename = "atlas-kit.local.json"
    state = kitlib.load_state(state_dir, state_filename)

    already_installed = set(state.get("components", {}).keys())
    requested = [c.strip() for c in args.components.split(",") if c.strip()]

    try:
        closure = kitlib.resolve_deps(requested, kit)
    except ValueError as exc:
        print(f"ERROR: dependency resolution failed: {exc}", file=sys.stderr)
        return 1

    new_components = [c for c in closure if c not in already_installed]
    if not new_components:
        print("Nothing to add — all requested components are already installed.")
        return 0

    # Check placeholders for new components only
    required = kitlib.required_placeholders(new_components, kit)
    all_answers = {**state.get("answers", {}), **answers}
    missing = [t for t in required if t not in all_answers]
    if missing:
        print(
            f"ERROR: missing placeholders: {', '.join(missing)}",
            file=sys.stderr,
        )
        return 1

    now = datetime.now().astimezone().isoformat(timespec="seconds")
    state["answers"].update(answers)
    state["last_updated_at"] = now

    file_count = 0
    for cid in new_components:
        try:
            files = kitlib.install_component(
                cid, args.kit_root, args.workspace, state["answers"]
            )
        except RuntimeError as exc:
            print(f"ERROR: {exc}", file=sys.stderr)
            return 1
        state["components"][cid] = {
            "version": kit[cid]["version"],
            "installed_at": now,
            "files": files,
        }
        file_count += len(files)

    kitlib.save_state(state_dir, state, state_filename)
    print(f"Added {len(new_components)} component(s), wrote {file_count} file(s).")
    if already_installed & set(closure):
        skipped = sorted(already_installed & set(closure))
        print(f"Skipped (already installed): {', '.join(skipped)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
