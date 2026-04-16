"""Atlas Kit install primitives. Plan 2 fills this in task by task."""
from __future__ import annotations

import hashlib
import json
import re
import sqlite3
import shutil
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Any

PLACEHOLDER_RE = re.compile(r"\[([A-Z][A-Z0-9_]*)\]")


def load_manifest(component_dir: Path) -> dict[str, Any]:
    manifest_path = Path(component_dir) / "manifest.json"
    if not manifest_path.exists():
        raise FileNotFoundError(f"no manifest.json in {component_dir}")
    return json.loads(manifest_path.read_text())


def load_kit(kit_root: Path) -> dict[str, dict[str, Any]]:
    kit_root = Path(kit_root)
    out: dict[str, dict[str, Any]] = {}
    for manifest_path in sorted(kit_root.rglob("manifest.json")):
        data = json.loads(manifest_path.read_text())
        cid = data["id"]
        if cid in out:
            raise ValueError(f"duplicate component id {cid} in {manifest_path}")
        out[cid] = data
    return out


def load_bundles(kit_root: Path) -> dict[str, dict[str, Any]]:
    bundles_path = Path(kit_root) / "bundles.json"
    doc = json.loads(bundles_path.read_text())
    return doc.get("bundles", {})
