"""Regression checks: the docs-only fast path must never omit runnable changes."""
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "tools" / "ci"))
from classify_changes import is_docs_only, read_paths


class ClassificationTest(unittest.TestCase):
    def test_docs_only(self):
        self.assertTrue(is_docs_only(["docs/README.md", "docs/VSCODE_MIGRATION_REVIEW.md"]))
        self.assertTrue(is_docs_only(["README.md", "STATUS.md", "AGENTS.md", "docs/PLAN.md"]))

    def test_not_docs_only(self):
        for paths in (
            [], ["main/buggy.script"], ["docs/README.md", "main/buggy.script"],
            [".github/workflows/ci.yml"], ["tools/preview/verify.cjs"],
            ["tools/ci/classify_changes.py"], [".vscode/settings.json"],
            ["docs/review.json"], ["main/README.md"],
            ["docs/README.md", "tools/old.script"],  # rename with --no-renames
        ):
            with self.subTest(paths=paths):
                self.assertFalse(is_docs_only(paths))

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
