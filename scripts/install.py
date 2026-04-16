#!/usr/bin/env python3
"""Install selected components from a kit into a workspace."""
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
    parser.add_argument("--components", required=True,
                        help="Comma-separated component ids.")
    parser.add_argument("--state-file", type=Path, default=None,
                        help="Path to atlas-kit.local.json. Defaults to <workspace>/atlas-kit.local.json.")
    args = parser.parse_args()

    answers = json.loads(args.answers.read_text())
    kit = kitlib.load_kit(args.kit_root)

    try:
        closure = kitlib.resolve_deps(
            [c.strip() for c in args.components.split(",") if c.strip()],
            kit,
        )
    except ValueError as exc:
        print(f"ERROR: dependency resolution failed: {exc}", file=sys.stderr)
        return 1

    required = kitlib.required_placeholders(closure, kit)
    missing = [t for t in required if t not in answers]
    if missing:
        print(
            f"ERROR: answers.json missing placeholders: {', '.join(missing)}",
            file=sys.stderr,
        )
        return 1

    args.workspace.mkdir(parents=True, exist_ok=True)
    if args.state_file is not None:
        state_dir = args.state_file.parent
        state_filename = args.state_file.name
        state_dir.mkdir(parents=True, exist_ok=True)
    else:
        state_dir = args.workspace
        state_filename = "atlas-kit.local.json"
    state = kitlib.load_state(state_dir, state_filename)
    now = datetime.now().astimezone().isoformat(timespec="seconds")
    kit_version = (args.kit_root / "VERSION").read_text().strip() \
        if (args.kit_root / "VERSION").exists() else None
    state["kit_version"] = kit_version
    if state["installed_at"] is None:
        state["installed_at"] = now
    state["last_updated_at"] = now
    state["answers"].update(answers)

    file_count = 0
    for cid in closure:
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
    print(f"Installed {len(closure)} component(s), wrote {file_count} file(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
