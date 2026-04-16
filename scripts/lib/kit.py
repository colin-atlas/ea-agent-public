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


def resolve_deps(
    requested: list[str], kit: dict[str, dict[str, Any]]
) -> list[str]:
    order: list[str] = []
    visiting: set[str] = set()
    visited: set[str] = set()

    def visit(cid: str) -> None:
        if cid in visited:
            return
        if cid in visiting:
            raise ValueError(f"dependency cycle involving {cid}")
        if cid not in kit:
            raise ValueError(f"unknown component {cid}")
        visiting.add(cid)
        for dep in kit[cid].get("requires", {}).get("components", []):
            visit(dep)
        visiting.remove(cid)
        visited.add(cid)
        order.append(cid)

    for cid in requested:
        visit(cid)
    return order


def required_placeholders(
    components: list[str], kit: dict[str, dict[str, Any]]
) -> list[str]:
    tokens: set[str] = set()
    for cid in components:
        tokens.update(kit[cid].get("requires", {}).get("placeholders", []))
    return sorted(tokens)


def substitute_placeholders(text: str, answers: dict[str, str]) -> str:
    def repl(m: re.Match[str]) -> str:
        token = m.group(1)
        if token not in answers:
            raise KeyError(f"no answer for placeholder [{token}]")
        return answers[token]

    return PLACEHOLDER_RE.sub(repl, text)


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()
