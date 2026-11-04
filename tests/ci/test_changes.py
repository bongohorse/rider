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


class DocsAssets494(unittest.TestCase):
    def test_runtime_asset_consumers_fail_closed_including_atlases(self):
        import subprocess
        from classify_changes import doc_asset_consumers
        self.assertEqual(doc_asset_consumers(ROOT), [])
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            subprocess.run(["git", "init", "-q", tmp], check=True)
            project = root / "game.project"
            project.write_text("[project]\ncustom_resources = /main/stations\n")
            atlas = root / "main.atlas"
            atlas.write_text('images { image: "/docs/images/a.png" }\n')
            subprocess.run(["git", "-C", tmp, "add", "-A"], check=True)
            self.assertEqual(doc_asset_consumers(root), ["main.atlas"])
            self.assertFalse(is_docs_only(["docs/images/a.png"], project))
            atlas.write_text('images { image: "/main/a.png" }\n')
            self.assertTrue(is_docs_only(["docs/images/a.png"], project))
        self.assertTrue(doc_asset_consumers(Path(tmp)))

    def test_allowlist_rename_and_mixed_controls(self):
        from classify_changes import selection
        for suffix in ("png", "svg", "jpg", "jpeg", "webp"):
            paths = [f"docs/editor-a/old.{suffix}", f"docs/images/new.{suffix}"]
            self.assertEqual(selection(paths), ("true", "false", "false", "docs-assets-and-text-only"))
            # --no-renames includes both old and new names; moving into runtime/data is full.
            self.assertEqual(selection(paths + [f"main/new.{suffix}"]), FULL)
        for path in ("docs/reports/fixture.json", "tests/gameplay/level-fixtures/one.json",
                     "docs/editor-a/render_layouts.py", "docs/editor-a/fixture.json",
                     "docs/editor-a/file.txt.py", "docs/unknown/fixture.png", "main/icon.svg"):
            self.assertEqual(selection(["docs/images/shot.png", path]), FULL)

    def test_bundled_assets_and_missing_manifest_fail_closed(self):
        with tempfile.TemporaryDirectory() as tmp:
            project = Path(tmp) / "game.project"
            project.write_text("[project]\ncustom_resources = /docs/images\n")
            self.assertFalse(is_docs_only(["docs/images/a.png"], project))
            # No Git inventory in this synthetic directory: image classification fails closed.
            self.assertFalse(is_docs_only(["docs/editor-a/a.svg"], project))
            self.assertFalse(is_docs_only(["docs/editor-a/a.svg"], Path(tmp) / "missing"))


class MainBaseline494(unittest.TestCase):
    def test_only_complete_successful_ancestor_push_ci_is_accepted(self):
        from classify_changes import successful_main_base
        good = dict(head_sha="a" * 40, event="push", head_branch="main",
                    path=".github/workflows/ci.yml", status="completed", conclusion="success")
        for key, values in {
            "event": ["pull_request", "workflow_dispatch", "schedule"],
            "head_branch": ["feature"], "path": [".github/workflows/pages.yml"],
            "status": ["queued", "in_progress", "pending"],
            "conclusion": [None, "failure", "cancelled"], "head_sha": ["invalid", ""],
        }.items():
            for value in values:
                self.assertIsNone(successful_main_base([{**good, key: value}], lambda sha: True))
        self.assertIsNone(successful_main_base([good], lambda sha: False))
        self.assertIsNone(successful_main_base([], lambda sha: True))
        self.assertEqual(successful_main_base([{**good, "status": "in_progress"}, good],
                                             lambda sha: True), "a" * 40)

    def test_replaced_code_push_stays_in_cumulative_diff(self):
        import subprocess
        from classify_changes import selection, successful_main_base
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            git = ["git", "-C", tmp, "-c", "user.name=test", "-c", "user.email=test@example.invalid",
                   "-c", "commit.gpgsign=false"]
            subprocess.run(git + ["init", "-q"], check=True)
            def commit(path):
                p = root / path
                p.parent.mkdir(parents=True, exist_ok=True)
                p.write_text("changed")
                subprocess.run(git + ["add", "-A"], check=True)
                subprocess.run(git + ["commit", "-qm", path], check=True)
                return subprocess.check_output(git + ["rev-parse", "HEAD"], text=True).strip()
            baseline = commit("README.md")
            pending_code = commit("main/game/change.lua")
            commit("docs/images/one.png")
            commit("docs/images/two.png")
            runs = [dict(head_sha=sha, event="push", head_branch="main", path=".github/workflows/ci.yml",
                         status=status, conclusion=conclusion) for sha, status, conclusion in
                    [(pending_code, "completed", "cancelled"), (baseline, "completed", "success")]]
            base = successful_main_base(runs, lambda sha: subprocess.run(
                git + ["merge-base", "--is-ancestor", sha, "HEAD"]).returncode == 0)
            self.assertEqual(base, baseline)
            paths = subprocess.check_output(git + ["diff", "--no-renames", "--name-only", "-z", base, "HEAD"])
            self.assertEqual(selection(paths.decode().strip("\0").split("\0"))[0], "false")
            # Once that code AND its Pages deployment finish, subsequent docs can skip safely.
            paths = subprocess.check_output(git + ["diff", "--no-renames", "--name-only", "-z", pending_code, "HEAD"])
            self.assertEqual(selection(paths.decode().strip("\0").split("\0"))[0], "true")

    def test_api_failure_falls_back_without_logging_request(self):
        from unittest.mock import patch
        from classify_changes import main_push_base
        with patch.dict("os.environ", {"GITHUB_REPOSITORY": "bongohorse/rider", "GH_TOKEN": "test"}), \
                patch("classify_changes.urlopen", side_effect=OSError("unavailable")):
            self.assertIsNone(main_push_base())


if __name__ == "__main__":
    unittest.main()
