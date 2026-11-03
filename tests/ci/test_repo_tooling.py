"""#437: the repo-tooling short path never skips a file the gameplay, Gym or release jobs load.

Evidence comes from two independent sources:
1. the workflow steps of every job the short path skips (paths in `run`, `with`, `env`, `if`);
2. a scan of every tracked file for references to a repo-tooling file, where each reference
   from outside the short-path jobs must be explained in KNOWN_REFERENCES.
"""
import fnmatch
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import unittest

import yaml

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools" / "ci"))
from classify_changes import FULL_RUN_TOOLING, is_docs_only, selection

FULL = ("false", "false", "false", "unknown-or-shared-change-full")
TOOLING = ("false", "false", "true", "repo-tooling-and-docs-only")
SKIP_GUARD = "needs.changes.outputs.repo_tooling != 'true'"
# Jobs that still run on the short path, and why they may load repo-tooling files.
SHORT_PATH_JOBS = {
    "changes": "classification, workflow lint, lint_lua and the tests/ci Python suite",
    "bootstrap": "bootstrap_check.py and tests/bootstrap via verify --suite bootstrap",
    "ci_node": "the tests/ci Node suite",
    "required": "the aggregate gate",
    "nightly_alert": "schedule only; scheduled runs are always classified full",
}
SKIPPED_JOBS = {"renovate", "physics", "tooling", "bridge", "preview", "pages"}
SENSITIVE = (".github/workflows/ci.yml", ".github/PULL_REQUEST_TEMPLATE.md",
             "tools/ci/required_gate.py", "tools/ci/classify_changes.py")
FAST_VERDICTS = {
    "docs": ("true", "false", "false", "docs-text-only"),
    "gym": ("false", "true", "false", "gym-and-docs-only"),
    "tooling": ("false", "false", "true", "repo-tooling-and-docs-only"),
}
FULL_VERDICT = ("false", "false", "false", "unknown-or-shared-change-full")
CI_NODE_COMMAND = "node --test tests/ci/*.cjs"
# Every reference to a repo-tooling file from a file outside the short-path jobs, with the
# reason it does not make a gameplay, Gym or release job load it. A new reference fails the
# test: either explain it here or add the file to FULL_RUN_TOOLING in classify_changes.py.
KNOWN_REFERENCES = {
    (".luacheckrc", "tools/ci/lint_lua.py"): "comment; lint_lua reads .luacheckrc, not the reverse",
    (".luacheckrc", "tools/ci/luacheck-lock.json"): "comment naming the lock lint_lua verifies",
    ("main/editor/editor.gui_script", "tests/ci/test_editor_help.py"): "comment naming the test that reads this script",
    ("tools/gym/regress_spec.cjs", "tests/ci/regress.test.cjs"): "comment naming the test that pins these tolerances",
    ("tools/gym/smoke.py", "tests/ci/coast_measure.cjs"): "same basename; smoke.py runs tools/gym/coast_measure.cjs",
    ("tools/ci/classify_changes.py", "tools/bootstrap_check.py"): "selection data; only the changes job and local tools run the classifier",
    ("tools/ci/classify_changes.py", "tools/ci/"): "selection data; only the changes job and local tools run the classifier",
    ("tools/ci/classify_changes.py", "tools/ci/actionlint-lock.json"): "selection data; only the changes job and local tools run the classifier",
    ("tools/ci/classify_changes.py", "tools/ci/luacheck-lock.json"): "selection data; only the changes job and local tools run the classifier",
    ("tools/ci/classify_changes.py", "tests/ci/test_repo_tooling.py"): "comment naming the test that keeps FULL_RUN_TOOLING in sync",
    ("tools/project.py", "tools/bootstrap_check.py"): "only under verify --suite bootstrap, which only the Bootstrap job runs",
    ("tests/bootstrap/test_bootstrap.py", "tools/bootstrap_check.py"): "tests/bootstrap runs in the Bootstrap job",
    ("tests/g2/test_local_first.py", "tests/ci/test_changes.py"): "path used as data for local selection; tests/g2 runs in the Bootstrap job",
    ("tools/local.py", "tools/bootstrap_check.py"): "local developer command; no CI job runs tools/local.py",
    ("tools/local.py", "tools/ci/lint_lua.py"): "local developer command; no CI job runs tools/local.py",
    ("tools/local.py", "tools/ci/"): "local developer command; no CI job runs tools/local.py",
    ("tools/local_affected.json", "tools/bootstrap_check.py"): "data for tools/local.py affected (local only)",
    ("tools/local_affected.json", "tools/ci/actionlint-lock.json"): "data for tools/local.py affected (local only)",
    ("tools/local_affected.json", "tools/ci/lint_workflows.py"): "data for tools/local.py affected (local only)",
    ("tools/local_affected.json", "tools/ci/"): "data for tools/local.py affected (local only)",
}
DIR_REFERENCE = re.compile(
    r"(?:tools|tests)/ci(?![\w-])(?!/[\w.-]+\.\w)"
    r"|['\"](?:tools|tests)['\"]\s*[,/]\s*['\"]ci['\"]"
    r"|\.\./ci(?:/|['\"])|['\"]\.\.['\"]\s*,\s*['\"]ci['\"]"
    r"|/\s*['\"]ci['\"]")


def tracked():
    out = subprocess.run(["git", "ls-files", "-z"], cwd=ROOT, capture_output=True, check=True).stdout
    return [p for p in out.decode("utf-8", "surrogateescape").split("\0") if p and (ROOT / p).is_file()]


def load(name):
    return yaml.load((ROOT / name).read_text(encoding="utf-8"), Loader=yaml.BaseLoader)


def strings(node):
    if isinstance(node, dict):
        for value in node.values():
            yield from strings(value)
    elif isinstance(node, list):
        for value in node:
            yield from strings(value)
    elif isinstance(node, str):
        yield node


def skipped_job_steps():
    """Every step the short path skips, following local reusable workflows."""
    ci = load(".github/workflows/ci.yml")
    for name, job in ci["jobs"].items():
        if SKIP_GUARD not in job.get("if", ""):
            continue
        if "uses" in job:
            called = load(job["uses"].removeprefix("./"))
            for called_job in called["jobs"].values():
                yield name, called_job.get("steps", [])
                yield name, [{"if": called_job.get("if", "")}]
        else:
            yield name, job["steps"]


def referenced_paths(text, files):
    found = set()
    for token in re.findall(r"[\w.*?\[\]/@-]+", text):
        token = token.removeprefix("./").rstrip(".")
        if "/" not in token and token not in files:
            continue
        if any(ch in token for ch in "*?["):
            found.update(f for f in files if fnmatch.fnmatchcase(f, token))
        elif token in files:
            found.add(token)
        else:
            prefix = token.rstrip("/") + "/"
            found.update(f for f in files if f.startswith(prefix))
    return found


class RepoToolingInventory(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.files = tracked()
        cls.file_set = set(cls.files)
        cls.tooling = {f for f in cls.files if selection([f]) == TOOLING}
        cls.loaded = set()
        cls.step_text = []
        for _, steps in skipped_job_steps():
            for step in steps:
                for text in strings(step):
                    cls.step_text.append(text)
                    cls.loaded |= referenced_paths(text, cls.file_set)

    def test_every_ci_job_is_either_short_path_or_skipped(self):
        jobs = load(".github/workflows/ci.yml")["jobs"]
        skipped = {name for name, job in jobs.items() if SKIP_GUARD in job.get("if", "")}
        self.assertEqual(skipped, SKIPPED_JOBS)
        self.assertEqual(set(jobs) - skipped, set(SHORT_PATH_JOBS))

    def test_tooling_class_is_exactly_the_allowlist_minus_exclusions(self):
        expected = {f for f in self.files
                    if f in ("tools/bootstrap_check.py", "tools/ci/actionlint-lock.json",
                             "tools/ci/luacheck-lock.json")
                    or re.fullmatch(r"(?:tools|tests)/ci/[^/]+\.(?:py|cjs)", f)} - set(FULL_RUN_TOOLING)
        self.assertEqual(self.tooling, expected)
        self.assertIn("tools/ci/lint_lua.py", self.tooling)
        self.assertIn("tests/ci/test_changes.py", self.tooling)

    def test_workflow_derived_inventory_is_not_empty(self):
        # Guard the extraction itself: these are loaded by G1, Gym, release and Android jobs.
        for path in ("tools/project.py", "tools/gym/smoke.py", "tools/gym/bundle.py",
                     "tools/preview/verify.cjs", "tools/preview/package.py",
                     "tools/preview/verify_artifacts.py", "tools/gameplay/lua_tests.py",
                     "tools/g2/negative_build.py", "tools/g2/persistence_385.py",
                     "tools/ci/setup_playwright.cjs", "tools/toolchain-lock.json",
                     "package-lock.json", "tests/mobile/tilt.test.cjs"):
            self.assertIn(path, self.loaded)
        self.assertTrue(any(f.startswith("tests/g1/") for f in self.loaded))
        self.assertTrue(any(f.startswith("tests/engine/persistence/") for f in self.loaded))

    def test_every_file_loaded_by_skipped_jobs_selects_full(self):
        self.assertEqual(self.loaded & self.tooling, set())
        for path in sorted(self.loaded):
            with self.subTest(path=path):
                self.assertNotEqual(selection([path]), TOOLING)
                self.assertEqual(selection([path, "tools/ci/lint_lua.py"]), FULL)
                self.assertEqual(selection(["tests/ci/test_changes.py", path, "docs/TOOLING.md"]), FULL)

    def test_skipped_jobs_never_run_the_bootstrap_suite(self):
        # Evidence for the tools/project.py reference in KNOWN_REFERENCES.
        self.assertFalse([t for t in self.step_text if "--suite bootstrap" in t])

    def test_selection_and_gate_select_full(self):
        for path in (".github/workflows/ci.yml", ".github/workflows/g1.yml",
                     ".github/workflows/preview.yml", "tools/ci/classify_changes.py",
                     "tools/ci/required_gate.py"):
            with self.subTest(path=path):
                self.assertEqual(selection([path]), FULL)
                self.assertEqual(selection([path, "tools/ci/lint_lua.py"]), FULL)

    def test_any_mix_with_a_non_tooling_path_selects_full(self):
        for path in self.files:
            mixed = selection([path, "tools/ci/lint_lua.py"])
            short = path in self.tooling or (is_docs_only([path]) and not path.startswith(".github/"))
            with self.subTest(path=path):
                self.assertEqual(mixed, TOOLING if short else FULL)

    def test_ci_node_is_the_only_job_running_the_tests_ci_node_suite(self):
        runners = []
        for workflow in sorted((ROOT / ".github/workflows").glob("*.yml")):
            for name, job in load(f".github/workflows/{workflow.name}")["jobs"].items():
                if any(CI_NODE_COMMAND in step.get("run", "") for step in job.get("steps", [])):
                    runners.append((workflow.name, name))
        self.assertEqual(runners, [("ci.yml", "ci_node")])
        ci = load(".github/workflows/ci.yml")
        job = ci["jobs"]["ci_node"]
        self.assertEqual(job["if"], "needs.changes.outputs.docs_only != 'true'")
        self.assertEqual([s["run"] for s in job["steps"] if CI_NODE_COMMAND in s.get("run", "")],
                         [CI_NODE_COMMAND])
        self.assertIn("ci_node", ci["jobs"]["required"]["needs"])

    def test_known_reference_approvals_hold(self):
        # tools/local.py and its rule data never run in CI.
        for workflow in sorted((ROOT / ".github/workflows").glob("*.yml")):
            text = workflow.read_text(encoding="utf-8")
            with self.subTest(workflow=workflow.name):
                self.assertNotIn("tools/local.py", text)
                self.assertNotIn("local_affected.json", text)
        # tools/project.py reaches bootstrap_check.py only inside its bootstrap suite.
        lines = (ROOT / "tools/project.py").read_text(encoding="utf-8").splitlines()
        hits = [i for i, line in enumerate(lines) if "bootstrap_check" in line]
        self.assertTrue(hits)
        for i in hits:
            self.assertIn("args.suite=='bootstrap'", lines[i - 1])
        # ...and only the Bootstrap job runs that suite.
        ci = load(".github/workflows/ci.yml")
        runs = [(name, s.get("run", "")) for name, job in ci["jobs"].items()
                for s in job.get("steps", []) if "--suite bootstrap" in s.get("run", "")]
        self.assertEqual({name for name, _ in runs}, {"bootstrap"})
        # The classifier and the gate run only in the changes and required jobs.
        for script, jobs in (("tools/ci/classify_changes.py", {"changes"}),
                             ("tools/ci/required_gate.py", {"required"})):
            users = {name for name, job in ci["jobs"].items() if script in "\n".join(strings(job))}
            self.assertEqual(users, jobs, script)
            for workflow in sorted((ROOT / ".github/workflows").glob("*.yml")):
                if workflow.name != "ci.yml":
                    self.assertNotIn(script, workflow.read_text(encoding="utf-8"))

    def test_directory_reference_patterns(self):
        for text in ("ROOT / 'tools' / 'ci'", "tools/ci", "glob('tests/ci/*.cjs')",
                     "require('../ci/x.cjs')", "path.join(__dirname, '../ci')",
                     "path.join(__dirname, '..', 'ci', name)", 'here.parent / "ci"',
                     "Path(__file__).parents[1] / 'ci' / 'x.py'"):
            with self.subTest(text=text):
                self.assertTrue(DIR_REFERENCE.search(text))
        for text in ("tools/ci/lint_lua.py", "'cinema'", "../circle.cjs", "tests/cifoo"):
            with self.subTest(text=text):
                self.assertIsNone(DIR_REFERENCE.search(text))

    def test_references_to_tooling_files_are_explained(self):
        seen, unexplained = set(), []
        workflows = ".github/workflows/"
        for referrer in self.files:
            if referrer in self.tooling or referrer.startswith(workflows) or is_docs_only([referrer]):
                continue
            try:
                text = (ROOT / referrer).read_text(encoding="utf-8")
            except UnicodeDecodeError:
                continue
            for target in sorted(self.tooling):
                base = target.rsplit("/", 1)[1]
                stem = base.split(".")[0]
                if (target in text or base in text
                        or (target.endswith(".py") and re.search(rf"\b(?:import|from)\s+{stem}\b", text))):
                    key = (referrer, target)
                    seen.add(key)
                    if key not in KNOWN_REFERENCES:
                        unexplained.append(key)
            if DIR_REFERENCE.search(text):
                key = (referrer, "tools/ci/")
                seen.add(key)
                if key not in KNOWN_REFERENCES:
                    unexplained.append(key)
        self.assertEqual(unexplained, [], "explain each reference in KNOWN_REFERENCES or add the "
                         "target to FULL_RUN_TOOLING in tools/ci/classify_changes.py")
        self.assertEqual(sorted(set(KNOWN_REFERENCES) - seen), [], "stale KNOWN_REFERENCES entry")

    def test_workflow_references_come_only_from_short_path_jobs(self):
        ci = load(".github/workflows/ci.yml")
        for name, job in ci["jobs"].items():
            if name in SHORT_PATH_JOBS:
                continue
            text = "\n".join(strings(job))
            with self.subTest(job=name):
                self.assertEqual(referenced_paths(text, self.file_set) & self.tooling, set())
        for workflow in sorted((ROOT / ".github/workflows").glob("*.yml")):
            if workflow.name == "ci.yml":
                continue
            text = workflow.read_text(encoding="utf-8")
            with self.subTest(workflow=workflow.name):
                self.assertEqual(referenced_paths(text, self.file_set) & self.tooling, set())
                self.assertIsNone(DIR_REFERENCE.search(text))


class ClassifyStepGuard(unittest.TestCase):
    """The workflow refuses a short path for the classifier, gate or workflows, even if the
    classifier under test is broken (the classifier itself is never trusted to exclude itself)."""

    def run_step(self, changed, verdict, event="pull_request", ref="refs/pull/1/merge"):
        step = next(s for s in load(".github/workflows/ci.yml")["jobs"]["changes"]["steps"]
                    if s.get("id") == "classify")
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp) / "repo"
            (repo / "tools/ci").mkdir(parents=True)
            git = ["git", "-c", "user.name=t", "-c", "user.email=t@example.invalid",
                   "-c", "commit.gpgsign=false", "-C", str(repo)]
            subprocess.run(["git", "init", "-q", str(repo)], check=True)
            # A deliberately broken classifier that returns a fixed verdict for any diff.
            stub = repo / "tools/ci/classify_changes.py"
            keys = ("docs_only", "skip_special", "repo_tooling", "selection_reason")
            stub.write_text("".join(f"print('{k}={v}')\n" for k, v in zip(keys, verdict)))
            subprocess.run(git + ["add", "-A"], check=True)
            subprocess.run(git + ["commit", "-qm", "base"], check=True)
            base = subprocess.run(git + ["rev-parse", "HEAD"], capture_output=True, text=True,
                                  check=True).stdout.strip()
            for path in changed:
                target = repo / path
                target.parent.mkdir(parents=True, exist_ok=True)
                with target.open("a") as handle:
                    handle.write("# changed\n")
            subprocess.run(git + ["add", "-A"], check=True)
            subprocess.run(git + ["commit", "-qm", "head"], check=True)
            output, temp = Path(tmp) / "output", Path(tmp) / "runner"
            temp.mkdir()
            env = {**os.environ, "GITHUB_EVENT_NAME": event, "GITHUB_REF": ref,
                   "PR_BASE": base if event == "pull_request" else "",
                   "PUSH_BEFORE": base if event == "push" else "",
                   "GITHUB_OUTPUT": str(output), "RUNNER_TEMP": str(temp)}
            result = subprocess.run([shutil.which("bash"), "-c", step["run"]], cwd=repo, env=env,
                                    capture_output=True, text=True)
            return result, output.read_text() if output.exists() else ""

    @staticmethod
    def outputs(text):
        return dict(line.split("=", 1) for line in text.splitlines() if "=" in line)

    @unittest.skipUnless(shutil.which("bash") and shutil.which("git"), "needs bash and git")
    def test_any_fast_path_for_selection_logic_or_github_fails_the_job(self):
        for path in SENSITIVE:
            for mode, verdict in FAST_VERDICTS.items():
                with self.subTest(path=path, mode=mode):
                    result, output = self.run_step([path], verdict)
                    self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
                    self.assertEqual(output, "")

    @unittest.skipUnless(shutil.which("bash") and shutil.which("git"), "needs bash and git")
    def test_guard_passes_other_selections_through(self):
        cases = [("tools/ci/lint_lua.py", FAST_VERDICTS["tooling"]),
                 ("docs/TOOLING.md", FAST_VERDICTS["docs"]),
                 ("main/game/controller.script", FAST_VERDICTS["gym"]),
                 ("tools/ci/lint_lua.py", FULL_VERDICT)]
        cases += [(path, FULL_VERDICT) for path in SENSITIVE]
        for path, verdict in cases:
            with self.subTest(path=path, verdict=verdict):
                result, output = self.run_step([path], verdict)
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assertEqual(self.outputs(output), dict(zip(
                    ("docs_only", "skip_special", "repo_tooling", "selection_reason"), verdict)))

    @unittest.skipUnless(shutil.which("bash") and shutil.which("git"), "needs bash and git")
    def test_main_pushes_always_select_full(self):
        # A newer push can replace a pending main run; a later fast-path push must not then
        # skip the replaced change's suites or its Pages deploy.
        main_full = {"docs_only": "false", "skip_special": "false", "repo_tooling": "false",
                     "selection_reason": "main-push-full"}
        for path, verdict in (("docs/TOOLING.md", FAST_VERDICTS["docs"]),
                              ("main/game/controller.script", FAST_VERDICTS["gym"]),
                              ("tools/ci/lint_lua.py", FAST_VERDICTS["tooling"])):
            with self.subTest(path=path):
                result, output = self.run_step([path], verdict, "push", "refs/heads/main")
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assertEqual(self.outputs(output), main_full)
                # Pages then deploys: its selection terms all hold for a main push.
                pages = load(".github/workflows/ci.yml")["jobs"]["pages"]["if"]
                terms = re.findall(r"needs\.changes\.outputs\.(\w+) != 'true'", pages)
                self.assertEqual(sorted(terms), ["docs_only", "repo_tooling"])
                self.assertTrue(all(main_full[term] != "true" for term in terms))
        # Other pushes and pull requests keep their fast paths.
        for event, ref in (("push", "refs/heads/setup/g0-bootstrap"),
                           ("pull_request", "refs/pull/1/merge")):
            with self.subTest(event=event, ref=ref):
                result, output = self.run_step(["docs/TOOLING.md"], FAST_VERDICTS["docs"], event, ref)
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assertEqual(self.outputs(output)["selection_reason"], "docs-text-only")

if __name__ == "__main__":
    unittest.main()
