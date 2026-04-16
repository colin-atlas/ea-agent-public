import json
import unittest
from pathlib import Path

from scripts.lib import kit
from scripts.lib import kit as kitlib


class SmokeTest(unittest.TestCase):
    def test_module_imports(self):
        self.assertTrue(hasattr(kit, "PLACEHOLDER_RE"))


def _write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content)


def _make_fake_kit(tmp: Path) -> Path:
    """Create a minimal kit_root at tmp/kit with two components and bundles.json."""
    kit_root = tmp / "kit"
    _write(
        kit_root / "bundles.json",
        json.dumps({
            "bundles": {
                "full": {"name": "Full", "description": "x", "components": ["identity/bootstrap"]}
            }
        }),
    )
    _write(
        kit_root / "identity/bootstrap/manifest.json",
        json.dumps({
            "id": "identity/bootstrap",
            "type": "identity",
            "version": "0.1.0",
            "description": "test",
            "bundles": ["full"],
            "requires": {"components": [], "placeholders": ["NAME"], "env": []},
            "files": [{"src": "SOUL.md", "dest": "SOUL.md", "template": True}],
        }),
    )
    _write(kit_root / "identity/bootstrap/SOUL.md", "Hello [NAME]\n")
    _write(
        kit_root / "skills/demo/manifest.json",
        json.dumps({
            "id": "skills/demo",
            "type": "skills",
            "version": "0.1.0",
            "description": "test skill",
            "bundles": ["full"],
            "requires": {
                "components": ["identity/bootstrap"],
                "placeholders": ["NAME", "GREETING"],
                "env": [],
            },
            "files": [{"src": "SKILL.md", "dest": "skills/demo/SKILL.md", "template": True}],
        }),
    )
    _write(kit_root / "skills/demo/SKILL.md", "[GREETING], [NAME]!\n")
    return kit_root


class KitLoadingTest(unittest.TestCase):
    def setUp(self):
        import tempfile
        self.tmp = Path(tempfile.mkdtemp())

    def tearDown(self):
        import shutil
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_load_manifest_reads_json(self):
        kit_root = _make_fake_kit(self.tmp)
        manifest = kitlib.load_manifest(kit_root / "identity/bootstrap")
        self.assertEqual(manifest["id"], "identity/bootstrap")
        self.assertEqual(manifest["version"], "0.1.0")

    def test_load_manifest_missing_raises(self):
        with self.assertRaises(FileNotFoundError):
            kitlib.load_manifest(self.tmp / "nope")

    def test_load_kit_returns_all_components_by_id(self):
        kit_root = _make_fake_kit(self.tmp)
        loaded = kitlib.load_kit(kit_root)
        self.assertEqual(set(loaded.keys()), {"identity/bootstrap", "skills/demo"})
        self.assertEqual(loaded["skills/demo"]["type"], "skills")

    def test_load_bundles_returns_mapping(self):
        kit_root = _make_fake_kit(self.tmp)
        bundles = kitlib.load_bundles(kit_root)
        self.assertIn("full", bundles)
        self.assertEqual(bundles["full"]["components"], ["identity/bootstrap"])


if __name__ == "__main__":
    unittest.main()
