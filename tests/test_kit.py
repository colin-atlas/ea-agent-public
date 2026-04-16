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


class ResolveDepsTest(unittest.TestCase):
    def setUp(self):
        import tempfile
        self.tmp = Path(tempfile.mkdtemp())
        self.kit_root = _make_fake_kit(self.tmp)
        self.kit = kitlib.load_kit(self.kit_root)

    def tearDown(self):
        import shutil
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_resolve_deps_pulls_in_transitive(self):
        result = kitlib.resolve_deps(["skills/demo"], self.kit)
        self.assertIn("identity/bootstrap", result)
        self.assertIn("skills/demo", result)
        self.assertLess(
            result.index("identity/bootstrap"),
            result.index("skills/demo"),
        )

    def test_resolve_deps_already_present_no_dup(self):
        result = kitlib.resolve_deps(
            ["identity/bootstrap", "skills/demo"], self.kit
        )
        self.assertEqual(result.count("identity/bootstrap"), 1)

    def test_resolve_deps_unknown_component_raises(self):
        with self.assertRaises(ValueError):
            kitlib.resolve_deps(["skills/ghost"], self.kit)

    def test_resolve_deps_cycle_raises(self):
        cyclic_kit = {
            "a/one": {"id": "a/one", "requires": {"components": ["a/two"]}},
            "a/two": {"id": "a/two", "requires": {"components": ["a/one"]}},
        }
        with self.assertRaises(ValueError):
            kitlib.resolve_deps(["a/one"], cyclic_kit)

    def test_required_placeholders_union_sorted(self):
        result = kitlib.required_placeholders(
            ["identity/bootstrap", "skills/demo"], self.kit
        )
        self.assertEqual(result, ["GREETING", "NAME"])


class SubstituteTest(unittest.TestCase):
    def test_basic_substitution(self):
        result = kitlib.substitute_placeholders(
            "Hello [NAME], welcome to [COMPANY]",
            {"NAME": "Jane", "COMPANY": "Example Co"},
        )
        self.assertEqual(result, "Hello Jane, welcome to Example Co")

    def test_repeated_token(self):
        result = kitlib.substitute_placeholders(
            "[A] and [A] again",
            {"A": "x"},
        )
        self.assertEqual(result, "x and x again")

    def test_missing_answer_raises(self):
        with self.assertRaises(KeyError):
            kitlib.substitute_placeholders("Hi [NAME]", {})

    def test_lowercase_brackets_not_substituted(self):
        result = kitlib.substitute_placeholders(
            "Array access: items[i] and [REAL]", {"REAL": "ok"}
        )
        self.assertEqual(result, "Array access: items[i] and ok")


class Sha256Test(unittest.TestCase):
    def test_sha256_of_known_content(self):
        import tempfile
        tmp = Path(tempfile.mkdtemp())
        try:
            f = tmp / "a.txt"
            f.write_bytes(b"hello\n")
            self.assertEqual(
                kitlib.sha256_file(f),
                "5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03",
            )
        finally:
            import shutil
            shutil.rmtree(tmp, ignore_errors=True)


class StateTest(unittest.TestCase):
    def setUp(self):
        import tempfile
        self.tmp = Path(tempfile.mkdtemp())

    def tearDown(self):
        import shutil
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_empty_state_shape(self):
        s = kitlib.empty_state()
        self.assertEqual(s["answers"], {})
        self.assertEqual(s["components"], {})
        self.assertIsNone(s["installed_at"])

    def test_load_state_missing_returns_empty(self):
        s = kitlib.load_state(self.tmp)
        self.assertEqual(s, kitlib.empty_state())

    def test_save_then_load_roundtrip(self):
        s = kitlib.empty_state()
        s["answers"]["NAME"] = "Kai"
        kitlib.save_state(self.tmp, s)
        self.assertTrue((self.tmp / "atlas-kit.local.json").exists())
        loaded = kitlib.load_state(self.tmp)
        self.assertEqual(loaded["answers"]["NAME"], "Kai")

    def test_save_state_has_trailing_newline(self):
        s = kitlib.empty_state()
        kitlib.save_state(self.tmp, s)
        content = (self.tmp / "atlas-kit.local.json").read_text()
        self.assertTrue(content.endswith("\n"))


if __name__ == "__main__":
    unittest.main()
