#!/usr/bin/env python3
"""Print the topologically-sorted dependency closure of given component IDs."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts.lib import kit as kitlib


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--kit-root", required=True, type=Path)
    parser.add_argument("components", nargs="+")
    args = parser.parse_args()

    kit = kitlib.load_kit(args.kit_root)
    try:
        closure = kitlib.resolve_deps(args.components, kit)
    except ValueError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    for cid in closure:
        print(cid)
    return 0


if __name__ == "__main__":
    sys.exit(main())
