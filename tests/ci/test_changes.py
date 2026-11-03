"""Regression checks: the docs-only fast path must never omit runnable changes."""
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools" / "ci"))
from classify_changes import bundled_paths, is_docs_only, read_paths


class ClassificationTest(unittest.TestCase):
    def test_docs_only(self):
        self.assertTrue(is_docs_only(["docs/README.md", "docs/VSCODE_MIGRATION_REVIEW.md"]))
        self.assertTrue(is_docs_only(["README.md", "STATUS.md", "AGENTS.md", "docs/PLAN.md"]))
        self.assertTrue(is_docs_only(["main/gym/README.md", "main/README.md"]))
        self.assertTrue(is_docs_only([".github/PULL_REQUEST_TEMPLATE.md"]))
        self.assertTrue(is_docs_only(["main/game/stations.md"]))
        self.assertTrue(is_docs_only(["docs/research/evidence/empty.txt"]))
        self.assertTrue(is_docs_only(["README.md", "docs/README.md", "docs/reports/terrain-p5/native-memory.txt"]))

    def test_not_docs_only(self):
        for paths in (
            [], ["main/buggy.script"], ["docs/README.md", "main/buggy.script"],
            [".github/workflows/ci.yml"], ["tools/preview/verify.cjs"],
            ["tools/ci/classify_changes.py"], [".vscode/settings.json"],
            ["docs/review.json"], ["docs/reports/terrain-p0/fixture.json"],
            ["docs/evidence.csv"], ["docs/data.yaml"], ["tools/trace.txt"],
            ["main/gym/README.txt"], [".github/notes.txt"],
            ["docs/README.md", "docs/extra.py"],
            ["main/game/stations/notes.md"], ["main/game/presets/README.md"],
            ["docs/README.md", "tools/old.script"],  # rename with --no-renames
        ):
            with self.subTest(paths=paths):
                self.assertFalse(is_docs_only(paths))

    def test_bundled_paths_from_project(self):
        bundled = bundled_paths()
        self.assertIn("main/game/stations", bundled)
        self.assertIn("main/game/presets", bundled)
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
                         ("true", "false", "false", "docs-text-only"))
        self.assertEqual(selection(["docs/samples.json"])[0], "false")
        self.assertEqual(selection(["main/gym/game.script", "docs/evidence.txt"])[1], "true")
        # #405 split main/gym into game, editor and gym; all three keep the same selection.
        self.assertEqual(selection(["main/game/controller.script", "main/editor/editor.lua",
                                    "main/game/ramp_metrics.lua"])[1], "true")
        self.assertFalse(is_gym_only(["main/games/x.lua"]))
        for path in (
            "tools/project.py", ".github/workflows/ci.yml", "game.project",
            "main/physics.appmanifest", "requirements-dev.txt",
            "package-lock.json", "main/physics/rig.lua", "main/bridge/fixture.lua",
            ".vscode/settings.json"
        ):
            with self.subTest(path=path):
                self.assertFalse(is_gym_only(["main/gym/game.script", path]))
                self.assertEqual(selection(["main/gym/game.script", path])[1], "false")


FULL = ("false", "false", "false", "unknown-or-shared-change-full")
TOOLING = ("false", "false", "true", "repo-tooling-and-docs-only")


class RepoToolingSelection(unittest.TestCase):
    """#437: only repo tooling plus non-runtime docs takes the short path; all else is full."""

    def test_tooling_only_and_with_docs(self):
        from classify_changes import selection
        for paths in (
            ["tools/bootstrap_check.py"],
            ["tools/ci/lint_lua.py"], ["tools/ci/luacheck-lock.json"],
            ["tools/ci/lint_workflows.py", "tools/ci/actionlint-lock.json"],
            ["tools/ci/check_docs_links.py", "tools/ci/nightly_alert.py"],
            ["tests/ci/test_changes.py"], ["tests/ci/levels.test.cjs"],
            ["tests/ci/test_required_gate.py", "tests/ci/playwright-setup.test.cjs"],
            ["tools/bootstrap_check.py", "docs/TOOLING.md", "README.md"],
            ["tests/ci/test_lint_lua.py", "docs/reports/notes.txt"],
        ):
            with self.subTest(paths=paths):
                self.assertEqual(selection(paths), TOOLING)

    def test_negative_controls_select_full(self):
        from classify_changes import selection
        for paths in (
            # empty or unknown
            [], ["tools/ci"], ["tools/ci/sub/helper.py"], ["tests/ci/fixtures/case.json"],
            ["tools/cix.py"], ["tools/ci.py"], ["tests/cifoo/x.py"], ["tools/bootstrap_check.pyc"],
            ["tests/bootstrap/test_required.py"], ["tools/local.py"],
            # tooling plus one game or gameplay-loaded file
            ["tools/ci/lint_lua.py", "main/game/controller.script"],
            ["tests/ci/levels.test.cjs", "main/gym/game.script"],
            ["tools/bootstrap_check.py", "tools/gym/smoke.py"],
            ["tools/ci/lint_lua.py", "tools/project.py"],
            ["tools/ci/lint_lua.py", "tools/preview/verify.cjs"],
            ["tools/ci/lint_lua.py", "tools/g1/run.py"],
            ["tools/ci/lint_lua.py", "tools/gameplay/lua_tests.py"],
            ["tools/ci/lint_lua.py", "game.project"],
            ["tools/ci/lint_lua.py", "package-lock.json"],
            ["tools/ci/lint_lua.py", "docs/data.json"],
            # workflows, including workflow-adjacent Markdown
            [".github/workflows/ci.yml"],
            [".github/workflows/ci.yml", "tools/ci/lint_lua.py"],
            [".github/workflows/g1.yml", "tests/ci/levels.test.cjs"],
            [".github/PULL_REQUEST_TEMPLATE.md", "tools/ci/lint_lua.py"],
            # the selection and the required gate themselves
            ["tools/ci/classify_changes.py"],
            ["tools/ci/classify_changes.py", "tests/ci/test_changes.py"],
            ["tools/ci/required_gate.py"],
            ["tools/ci/required_gate.py", "tests/ci/test_required_gate.py", "docs/TOOLING.md"],
            # loaded by G1 HTML5, Gym and release verification
            ["tools/ci/setup_playwright.cjs"],
            ["tools/ci/setup_playwright.cjs", "tests/ci/playwright-setup.test.cjs"],
        ):
            with self.subTest(paths=paths):
                self.assertEqual(selection(paths), FULL)

    def test_only_ci_tooling_file_types_take_the_short_path(self):
        from classify_changes import selection
        for path in ("tools/ci/new_check.py", "tests/ci/new.test.cjs",
                     "tools/ci/actionlint-lock.json", "tools/ci/luacheck-lock.json"):
            with self.subTest(path=path):
                self.assertEqual(selection([path]), TOOLING)
        # Manifests, configuration and data that Renovate, npm, pip or Actions could pick up.
        for path in (
            "tools/ci/package.json", "tests/ci/package.json", "tools/ci/package-lock.json",
            "tools/ci/requirements.txt", "tests/ci/requirements-dev.txt", "tools/ci/pyproject.toml",
            "tools/ci/setup.cfg", "tools/ci/Pipfile", "tools/ci/.npmrc", "tools/ci/renovate.json",
            "tools/ci/action.yml", "tests/ci/action.yaml", "tools/ci/Dockerfile",
            "tools/ci/.gitattributes", "tests/ci/.gitattributes", "tools/ci/.gitignore",
            "tools/ci/new-lock.json", "tests/ci/actionlint-lock.json", "tests/ci/fixture.json",
            "tools/ci/run.sh", "tools/ci/run.ps1", "tests/ci/x.js", "tools/ci/x.mjs", "tools/ci/x.lua",
            "tools/ci/go.mod", "tools/ci/notes.txt", "tests/ci/data.csv", "tools/ci/Makefile",
        ):
            for paths in ([path], [path, "tools/ci/lint_lua.py"], [path, "docs/TOOLING.md"]):
                with self.subTest(paths=paths):
                    self.assertEqual(selection(paths), FULL)

    def test_github_paths_never_take_a_fast_path(self):
        # The workflow guard fails any fast path that touches .github/, so the classifier
        # must select full for its Markdown too (#437 review).
        from classify_changes import selection
        for paths in ([".github/PULL_REQUEST_TEMPLATE.md"], [".github/ISSUE_TEMPLATE/bug.md"],
                      [".github/PULL_REQUEST_TEMPLATE.md", "docs/README.md"],
                      [".github/PULL_REQUEST_TEMPLATE.md", "main/game/controller.script"],
                      [".github/PULL_REQUEST_TEMPLATE.md", "tools/ci/lint_lua.py"]):
            with self.subTest(paths=paths):
                self.assertEqual(selection(paths), FULL)

    def test_docs_and_gym_selection_unchanged(self):
        from classify_changes import selection
        self.assertEqual(selection(["docs/TOOLING.md"]), ("true", "false", "false", "docs-text-only"))
        self.assertEqual(selection(["main/game/controller.script", "docs/TOOLING.md"]),
                         ("false", "true", "false", "gym-and-docs-only"))

    def test_bundled_or_unreadable_project_fails_closed(self):
        from classify_changes import is_repo_tooling
        with tempfile.TemporaryDirectory() as tmp:
            project = Path(tmp) / "game.project"
            project.write_text("[project]\ncustom_resources = /tests/ci\n", encoding="utf-8")
            self.assertFalse(is_repo_tooling(["tests/ci/levels.test.cjs"], project))
            self.assertTrue(is_repo_tooling(["tools/ci/lint_lua.py"], project))
            self.assertFalse(is_repo_tooling(["tools/ci/lint_lua.py"], Path(tmp) / "missing.project"))

    def test_full_run_exclusions_are_explained(self):
        from classify_changes import FULL_RUN_TOOLING
        self.assertEqual(set(FULL_RUN_TOOLING), {
            "tools/ci/classify_changes.py", "tools/ci/required_gate.py",
            "tools/ci/setup_playwright.cjs"})
        for path, reason in FULL_RUN_TOOLING.items():
            self.assertTrue((ROOT / path).is_file(), path)
            self.assertGreater(len(reason), 20, path)

    def test_cli_prints_every_selection_output(self):
        import subprocess
        with tempfile.TemporaryDirectory() as tmp:
            f = Path(tmp) / "paths"
            f.write_bytes(b"tools/ci/lint_lua.py\0docs/TOOLING.md\0")
            out = subprocess.run([sys.executable, str(ROOT / "tools/ci/classify_changes.py"), str(f)],
                                 capture_output=True, text=True, check=True).stdout
            self.assertEqual(out.splitlines(), ["docs_only=false", "skip_special=false",
                                                "repo_tooling=true",
                                                "selection_reason=repo-tooling-and-docs-only"])


if __name__ == "__main__":
    unittest.main()
