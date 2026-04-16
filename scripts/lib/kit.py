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


STATE_FILENAME = "atlas-kit.local.json"


def empty_state() -> dict[str, Any]:
    return {
        "kit_version": None,
        "installed_at": None,
        "last_updated_at": None,
        "answers": {},
        "components": {},
    }


def load_state(workspace: Path, filename: str = STATE_FILENAME) -> dict[str, Any]:
    path = Path(workspace) / filename
    if not path.exists():
        return empty_state()
    return json.loads(path.read_text())


def save_state(workspace: Path, state: dict[str, Any], filename: str = STATE_FILENAME) -> None:
    path = Path(workspace) / filename
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, indent=2, sort_keys=False) + "\n")
    tmp.replace(path)


def install_component(
    component_id: str,
    kit_root: Path,
    workspace: Path,
    answers: dict[str, str],
) -> list[dict[str, str]]:
    kit_root = Path(kit_root)
    workspace = Path(workspace)
    component_dir = kit_root / component_id
    manifest = load_manifest(component_dir)

    staging = Path(tempfile.mkdtemp(prefix="atlas-install-"))
    try:
        written: list[dict[str, str]] = []
        for entry in manifest["files"]:
            src = component_dir / entry["src"]
            dest_rel = entry["dest"]
            staged = staging / dest_rel
            staged.parent.mkdir(parents=True, exist_ok=True)

            if manifest["type"] == "db":
                sql = src.read_text()
                con = sqlite3.connect(staged)
                try:
                    con.executescript(sql)
                    con.commit()
                finally:
                    con.close()
                written.append({"path": dest_rel, "sha256": "initialized"})
            elif entry.get("template", False):
                text = substitute_placeholders(src.read_text(), answers)
                staged.write_text(text)
                written.append(
                    {"path": dest_rel, "sha256": sha256_file(staged)}
                )
            else:
                shutil.copyfile(src, staged)
                written.append(
                    {"path": dest_rel, "sha256": sha256_file(staged)}
                )

        for entry in written:
            final = workspace / entry["path"]
            final.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(staging / entry["path"]), str(final))

        return written
    except Exception as exc:
        raise RuntimeError(
            f"install_component({component_id}) failed: {exc}"
        ) from exc
    finally:
        shutil.rmtree(staging, ignore_errors=True)
