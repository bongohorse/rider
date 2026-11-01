"""Regression checks: the docs-only fast path must never omit runnable changes."""
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "tools" / "ci"))
from classify_changes import bundled_paths, is_docs_only, read_paths


class ClassificationTest(unittest.TestCase):
    def test_docs_only(self):
        self.assertTrue(is_docs_only(["docs/README.md", "docs/VSCODE_MIGRATION_REVIEW.md"]))
        self.assertTrue(is_docs_only(["README.md", "STATUS.md", "AGENTS.md", "docs/PLAN.md"]))
        self.assertTrue(is_docs_only(["main/gym/README.md", "main/README.md"]))
        self.assertTrue(is_docs_only([".github/PULL_REQUEST_TEMPLATE.md"]))
        self.assertTrue(is_docs_only(["main/gym/stations.md"]))
        self.assertTrue(is_docs_only(["docs/research/evidence/empty.txt"]))
        self.assertTrue(is_docs_only(["README.md", "docs/README.md", "docs/terrain-p5/native-memory.txt"]))

    def test_not_docs_only(self):
        for paths in (
            [], ["main/buggy.script"], ["docs/README.md", "main/buggy.script"],
            [".github/workflows/ci.yml"], ["tools/preview/verify.cjs"],
            ["tools/ci/classify_changes.py"], [".vscode/settings.json"],
            ["docs/review.json"], ["docs/terrain-p0/fixture.json"],
            ["docs/evidence.csv"], ["docs/data.yaml"], ["tools/trace.txt"],
            ["main/gym/README.txt"], [".github/notes.txt"],
            ["docs/README.md", "docs/extra.py"],
            ["main/gym/stations/notes.md"], ["main/gym/presets/README.md"],
            ["docs/README.md", "tools/old.script"],  # rename with --no-renames
        ):
            with self.subTest(paths=paths):
                self.assertFalse(is_docs_only(paths))

    def test_bundled_paths_from_project(self):
        bundled = bundled_paths()
        self.assertIn("main/gym/stations", bundled)
        self.assertIn("main/gym/presets", bundled)
        with tempfile.TemporaryDirectory() as tmp:
            f = Path(tmp) / "game.project"
            f.write_text("[project]\ncustom_resources = /a/b, /c.json,\n", encoding="utf-8")
            self.assertEqual(bundled_paths(f), ["a/b", "c.json"])
            self.assertFalse(is_docs_only(["a/b/x.md"], f))
            self.assertTrue(is_docs_only(["a/bc.md"], f))
            self.assertIsNone(bundled_paths(Path(tmp) / "missing.project"))

    def test_unreadable_project_fails_closed(self):
        with tempfile.TemporaryDirectory() as tmp:
            missing = Path(tmp) / "missing.project"
            self.assertFalse(is_docs_only(["main/gym/README.md"], missing))
            self.assertTrue(is_docs_only(["docs/README.md"], missing))
            self.assertTrue(is_docs_only(["docs/log.txt"], missing))
            self.assertFalse(is_docs_only(["tools/notes.txt"], missing))

    def test_git_nul_path_list(self):
        with tempfile.TemporaryDirectory() as tmp:
            f = Path(tmp) / "paths"
            f.write_bytes(b"docs/README.md\0docs/name with spaces.md\0")
            self.assertEqual(read_paths(f), ["docs/README.md", "docs/name with spaces.md"])
            f.write_bytes(b"docs/README.md\n")
            with self.assertRaises(ValueError):
                read_paths(f)

    def test_empty_diff_fails_closed(self):
        with tempfile.TemporaryDirectory() as tmp:
            f = Path(tmp) / "paths"
            f.write_bytes(b"")
            self.assertEqual(read_paths(f), [])
            self.assertFalse(is_docs_only(read_paths(f)))
    
    def test_gym_selection_and_conservative_fallback(self):
        from classify_changes import is_gym_only, selection
        self.assertTrue(is_gym_only(["main/gym/game.script", "docs/TOOLING.md"]))
        self.assertEqual(selection(["main/gym/game.script"])[1], "true")
        self.assertEqual(selection(["docs/README.md"])[0], "true")
        self.assertEqual(selection(["docs/README.md", "docs/research/evidence/empty.txt"]),
                         ("true", "false", "docs-text-only"))
        self.assertEqual(selection(["docs/samples.json"])[0], "false")
        self.assertEqual(selection(["main/gym/game.script", "docs/evidence.txt"])[1], "true")
        for path in (
            "tools/project.py", ".github/workflows/ci.yml", "game.project",
            "main/physics.appmanifest", "requirements-dev.txt",
            "package-lock.json", "main/physics/rig.lua", "main/bridge/fixture.lua",
            ".vscode/settings.json"
        ):
            with self.subTest(path=path):
                self.assertFalse(is_gym_only(["main/gym/game.script", path]))
                self.assertEqual(selection(["main/gym/game.script", path])[1], "false")


if __name__ == "__main__":
    unittest.main()
