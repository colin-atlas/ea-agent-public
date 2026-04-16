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


class InstallComponentTest(unittest.TestCase):
    def setUp(self):
        import tempfile
        self.tmp = Path(tempfile.mkdtemp())
        self.kit_root = _make_fake_kit(self.tmp)
        self.workspace = self.tmp / "ws"
        self.workspace.mkdir()

    def tearDown(self):
        import shutil
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_install_identity_copies_and_substitutes(self):
        result = kitlib.install_component(
            "identity/bootstrap",
            self.kit_root,
            self.workspace,
            {"NAME": "Kai"},
        )
        soul = self.workspace / "SOUL.md"
        self.assertTrue(soul.exists())
        self.assertEqual(soul.read_text(), "Hello Kai\n")
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["path"], "SOUL.md")
        self.assertEqual(len(result[0]["sha256"]), 64)

    def test_install_missing_placeholder_raises_and_does_not_write(self):
        with self.assertRaises(RuntimeError):
            kitlib.install_component(
                "skills/demo",
                self.kit_root,
                self.workspace,
                {"NAME": "Kai"},  # missing GREETING
            )
        self.assertFalse((self.workspace / "skills/demo/SKILL.md").exists())

    def test_install_db_component_runs_schema(self):
        db_dir = self.kit_root / "db/demo"
        db_dir.mkdir(parents=True)
        (db_dir / "manifest.json").write_text(json.dumps({
            "id": "db/demo",
            "type": "db",
            "version": "0.1.0",
            "description": "test db",
            "bundles": ["full"],
            "requires": {"components": [], "placeholders": [], "env": []},
            "files": [{"src": "schema.sql", "dest": "db/demo.db", "template": False}],
        }))
        (db_dir / "schema.sql").write_text(
            "CREATE TABLE things (id INTEGER PRIMARY KEY, name TEXT);\n"
        )
        result = kitlib.install_component(
            "db/demo", self.kit_root, self.workspace, {}
        )
        dbfile = self.workspace / "db/demo.db"
        self.assertTrue(dbfile.exists())
        import sqlite3
        con = sqlite3.connect(dbfile)
        rows = con.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()
        con.close()
        self.assertIn(("things",), rows)
        self.assertEqual(result[0]["path"], "db/demo.db")
        self.assertEqual(result[0]["sha256"], "initialized")


class InstallCliTest(unittest.TestCase):
    def setUp(self):
        import tempfile
        self.tmp = Path(tempfile.mkdtemp())
        self.kit_root = _make_fake_kit(self.tmp)
        (self.kit_root / "VERSION").write_text("0.1.0\n")
        self.workspace = self.tmp / "ws"

    def tearDown(self):
        import shutil
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_full_install_via_cli(self):
        import subprocess
        repo_root = Path(__file__).resolve().parents[1]
        answers = self.tmp / "answers.json"
        answers.write_text(json.dumps({"NAME": "Kai", "GREETING": "Hello"}))

        result = subprocess.run(
            [
                "python3",
                str(repo_root / "scripts" / "install.py"),
                "--kit-root", str(self.kit_root),
                "--workspace", str(self.workspace),
                "--answers", str(answers),
                "--components", "skills/demo",
            ],
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 0, msg=result.stderr)
        self.assertTrue((self.workspace / "SOUL.md").exists())
        self.assertEqual(
            (self.workspace / "SOUL.md").read_text(), "Hello Kai\n"
        )
        self.assertTrue((self.workspace / "skills/demo/SKILL.md").exists())
        self.assertEqual(
            (self.workspace / "skills/demo/SKILL.md").read_text(),
            "Hello, Kai!\n",
        )
        state = json.loads(
            (self.workspace / "atlas-kit.local.json").read_text()
        )
        self.assertEqual(
            set(state["components"].keys()),
            {"identity/bootstrap", "skills/demo"},
        )
        self.assertEqual(state["answers"]["NAME"], "Kai")

    def test_custom_state_file_location(self):
        import subprocess
        repo_root = Path(__file__).resolve().parents[1]
        answers = self.tmp / "answers.json"
        answers.write_text(json.dumps({"NAME": "Kai", "GREETING": "Hi"}))
        state_path = self.tmp / "custom-state" / "atlas-kit.local.json"

        result = subprocess.run(
            [
                "python3",
                str(repo_root / "scripts" / "install.py"),
                "--kit-root", str(self.kit_root),
                "--workspace", str(self.workspace),
                "--answers", str(answers),
                "--components", "skills/demo",
                "--state-file", str(state_path),
            ],
            capture_output=True, text=True,
        )
        self.assertEqual(result.returncode, 0, msg=result.stderr)
        # State file lands at the custom path, not in workspace
        self.assertTrue(state_path.exists())
        self.assertFalse((self.workspace / "atlas-kit.local.json").exists())
        state = json.loads(state_path.read_text())
        self.assertIn("skills/demo", state["components"])
        # Workspace still got the actual files
        self.assertTrue((self.workspace / "skills/demo/SKILL.md").exists())

    def test_missing_placeholder_fails_fast(self):
        import subprocess
        repo_root = Path(__file__).resolve().parents[1]
        answers = self.tmp / "answers.json"
        answers.write_text(json.dumps({"NAME": "Kai"}))

        result = subprocess.run(
            [
                "python3",
                str(repo_root / "scripts" / "install.py"),
                "--kit-root", str(self.kit_root),
                "--workspace", str(self.workspace),
                "--answers", str(answers),
                "--components", "skills/demo",
            ],
            capture_output=True,
            text=True,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("GREETING", result.stderr)


class UpdateDetectionTest(unittest.TestCase):
    def test_detects_version_change(self):
        state_components = {
            "identity/bootstrap": {"version": "0.1.0", "files": []},
            "skills/demo": {"version": "0.1.0", "files": []},
        }
        kit = {
            "identity/bootstrap": {"id": "identity/bootstrap", "version": "0.2.0"},
            "skills/demo": {"id": "skills/demo", "version": "0.1.0"},
        }
        result = kitlib.components_needing_update(state_components, kit)
        self.assertEqual(result, ["identity/bootstrap"])

    def test_no_updates_when_versions_match(self):
        state_components = {
            "identity/bootstrap": {"version": "0.1.0", "files": []},
        }
        kit = {
            "identity/bootstrap": {"id": "identity/bootstrap", "version": "0.1.0"},
        }
        result = kitlib.components_needing_update(state_components, kit)
        self.assertEqual(result, [])

    def test_ignores_components_not_in_kit(self):
        state_components = {
            "identity/removed": {"version": "0.1.0", "files": []},
        }
        kit = {}
        result = kitlib.components_needing_update(state_components, kit)
        self.assertEqual(result, [])


class RemoveComponentFilesTest(unittest.TestCase):
    def setUp(self):
        import tempfile
        self.tmp = Path(tempfile.mkdtemp())
        self.kit_root = _make_fake_kit(self.tmp)
        self.workspace = self.tmp / "ws"
        self.workspace.mkdir()
        # Install identity/bootstrap first
        self.files = kitlib.install_component(
            "identity/bootstrap", self.kit_root, self.workspace, {"NAME": "Kai"}
        )

    def tearDown(self):
        import shutil
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_removes_unmodified_file(self):
        removed, skipped = kitlib.remove_component_files(
            self.workspace, self.files
        )
        self.assertEqual(len(removed), 1)
        self.assertEqual(removed[0], "SOUL.md")
        self.assertEqual(len(skipped), 0)
        self.assertFalse((self.workspace / "SOUL.md").exists())

    def test_skips_modified_file(self):
        # Modify the file after install
        (self.workspace / "SOUL.md").write_text("User edited this\n")
        removed, skipped = kitlib.remove_component_files(
            self.workspace, self.files
        )
        self.assertEqual(len(removed), 0)
        self.assertEqual(len(skipped), 1)
        self.assertEqual(skipped[0], "SOUL.md")
        # File should still exist
        self.assertTrue((self.workspace / "SOUL.md").exists())

    def test_skips_already_deleted_file(self):
        (self.workspace / "SOUL.md").unlink()
        removed, skipped = kitlib.remove_component_files(
            self.workspace, self.files
        )
        self.assertEqual(len(removed), 0)
        self.assertEqual(len(skipped), 0)


class CheckDependentsTest(unittest.TestCase):
    def setUp(self):
        import tempfile
        self.tmp = Path(tempfile.mkdtemp())
        self.kit_root = _make_fake_kit(self.tmp)
        self.kit = kitlib.load_kit(self.kit_root)

    def tearDown(self):
        import shutil
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_identity_has_dependent(self):
        installed = {"identity/bootstrap", "skills/demo"}
        result = kitlib.check_dependents("identity/bootstrap", installed, self.kit)
        self.assertIn("skills/demo", result)

    def test_skill_has_no_dependents(self):
        installed = {"identity/bootstrap", "skills/demo"}
        result = kitlib.check_dependents("skills/demo", installed, self.kit)
        self.assertEqual(result, [])

    def test_uninstalled_dependent_not_returned(self):
        installed = {"identity/bootstrap"}
        result = kitlib.check_dependents("identity/bootstrap", installed, self.kit)
        self.assertEqual(result, [])


class AtomicSaveTest(unittest.TestCase):
    def setUp(self):
        import tempfile
        self.tmp = Path(tempfile.mkdtemp())

    def tearDown(self):
        import shutil
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_save_state_no_tmp_file_left(self):
        s = kitlib.empty_state()
        s["answers"]["NAME"] = "Test"
        kitlib.save_state(self.tmp, s)
        # No .tmp file should remain after save
        tmp_files = list(self.tmp.glob("*.tmp"))
        self.assertEqual(tmp_files, [])
        # The real file should exist and be valid
        loaded = kitlib.load_state(self.tmp)
        self.assertEqual(loaded["answers"]["NAME"], "Test")

    def test_save_state_overwrites_existing(self):
        s1 = kitlib.empty_state()
        s1["answers"]["A"] = "1"
        kitlib.save_state(self.tmp, s1)
        s2 = kitlib.empty_state()
        s2["answers"]["A"] = "2"
        kitlib.save_state(self.tmp, s2)
        loaded = kitlib.load_state(self.tmp)
        self.assertEqual(loaded["answers"]["A"], "2")


class RemoveCliTest(unittest.TestCase):
    def setUp(self):
        import tempfile
        self.tmp = Path(tempfile.mkdtemp())
        self.kit_root = _make_fake_kit(self.tmp)
        (self.kit_root / "VERSION").write_text("0.1.0\n")
        self.workspace = self.tmp / "ws"
        self.state_file = self.tmp / "state" / "atlas-kit.local.json"
        # Install first
        import subprocess
        repo_root = Path(__file__).resolve().parents[1]
        answers = self.tmp / "answers.json"
        answers.write_text(json.dumps({"NAME": "Kai", "GREETING": "Hi"}))
        subprocess.run(
            ["python3", str(repo_root / "scripts" / "install.py"),
             "--kit-root", str(self.kit_root),
             "--workspace", str(self.workspace),
             "--answers", str(answers),
             "--state-file", str(self.state_file),
             "--components", "skills/demo"],
            check=True, capture_output=True,
        )

    def tearDown(self):
        import shutil
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_remove_leaf_component(self):
        import subprocess
        repo_root = Path(__file__).resolve().parents[1]
        result = subprocess.run(
            ["python3", str(repo_root / "scripts" / "remove.py"),
             "--kit-root", str(self.kit_root),
             "--workspace", str(self.workspace),
             "--state-file", str(self.state_file),
             "--components", "skills/demo"],
            capture_output=True, text=True,
        )
        self.assertEqual(result.returncode, 0, msg=result.stderr)
        self.assertIn("Removed 1", result.stdout)
        # File should be gone
        self.assertFalse((self.workspace / "skills/demo/SKILL.md").exists())
        # State should not have it
        state = json.loads(self.state_file.read_text())
        self.assertNotIn("skills/demo", state["components"])
        # identity/bootstrap should still be there
        self.assertIn("identity/bootstrap", state["components"])

    def test_remove_dependency_blocked(self):
        import subprocess
        repo_root = Path(__file__).resolve().parents[1]
        result = subprocess.run(
            ["python3", str(repo_root / "scripts" / "remove.py"),
             "--kit-root", str(self.kit_root),
             "--workspace", str(self.workspace),
             "--state-file", str(self.state_file),
             "--components", "identity/bootstrap"],
            capture_output=True, text=True,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("depended on by", result.stderr)

    def test_remove_dependency_force(self):
        import subprocess
        repo_root = Path(__file__).resolve().parents[1]
        result = subprocess.run(
            ["python3", str(repo_root / "scripts" / "remove.py"),
             "--kit-root", str(self.kit_root),
             "--workspace", str(self.workspace),
             "--state-file", str(self.state_file),
             "--components", "identity/bootstrap",
             "--force"],
            capture_output=True, text=True,
        )
        self.assertEqual(result.returncode, 0, msg=result.stderr)
        self.assertIn("Removed 2", result.stdout)
        state = json.loads(self.state_file.read_text())
        self.assertEqual(state["components"], {})


class AddCliTest(unittest.TestCase):
    def setUp(self):
        import tempfile
        self.tmp = Path(tempfile.mkdtemp())
        self.kit_root = _make_fake_kit(self.tmp)
        (self.kit_root / "VERSION").write_text("0.1.0\n")
        self.workspace = self.tmp / "ws"
        self.state_file = self.tmp / "state" / "atlas-kit.local.json"
        # Install only identity/bootstrap first
        import subprocess
        repo_root = Path(__file__).resolve().parents[1]
        answers = self.tmp / "answers.json"
        answers.write_text(json.dumps({"NAME": "Kai"}))
        subprocess.run(
            ["python3", str(repo_root / "scripts" / "install.py"),
             "--kit-root", str(self.kit_root),
             "--workspace", str(self.workspace),
             "--answers", str(answers),
             "--state-file", str(self.state_file),
             "--components", "identity/bootstrap"],
            check=True, capture_output=True,
        )

    def tearDown(self):
        import shutil
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_add_new_component(self):
        import subprocess
        repo_root = Path(__file__).resolve().parents[1]
        answers = self.tmp / "answers2.json"
        answers.write_text(json.dumps({"GREETING": "Hi"}))
        result = subprocess.run(
            ["python3", str(repo_root / "scripts" / "add.py"),
             "--kit-root", str(self.kit_root),
             "--workspace", str(self.workspace),
             "--answers", str(answers),
             "--state-file", str(self.state_file),
             "--components", "skills/demo"],
            capture_output=True, text=True,
        )
        self.assertEqual(result.returncode, 0, msg=result.stderr)
        self.assertIn("Added 1", result.stdout)
        self.assertIn("Skipped", result.stdout)  # identity/bootstrap was already installed
        self.assertTrue((self.workspace / "skills/demo/SKILL.md").exists())

    def test_add_already_installed_noop(self):
        import subprocess
        repo_root = Path(__file__).resolve().parents[1]
        answers = self.tmp / "answers2.json"
        answers.write_text(json.dumps({}))
        result = subprocess.run(
            ["python3", str(repo_root / "scripts" / "add.py"),
             "--kit-root", str(self.kit_root),
             "--workspace", str(self.workspace),
             "--answers", str(answers),
             "--state-file", str(self.state_file),
             "--components", "identity/bootstrap"],
            capture_output=True, text=True,
        )
        self.assertEqual(result.returncode, 0)
        self.assertIn("Nothing to add", result.stdout)


if __name__ == "__main__":
    unittest.main()
