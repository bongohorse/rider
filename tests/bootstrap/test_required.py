"""Exercise the real required job script in full and docs-only modes.

Docs-only must skip expensive suites deliberately; all other cases fail closed.
"""
import json
import os
from pathlib import Path
import subprocess
import sys
import unittest
import yaml

ROOT = Path(__file__).resolve().parents[2]


def load_workflow():
    return yaml.load((ROOT / ".github/workflows/ci.yml").read_text(), Loader=yaml.BaseLoader)


def run_required(job, needs):
    # Run the exact script configured in the required workflow job.
    assert job["steps"][-1]["run"] == "python3 tools/ci/required_gate.py"
    return subprocess.run(
        [sys.executable, str(ROOT / "tools/ci/required_gate.py")],
        env={**os.environ, "RESULTS": json.dumps(needs)},
        capture_output=True, text=True,
    )


class RequiredCheck(unittest.TestCase):
    def test_dependency_results_fail_closed_in_full_mode(self):
        job = load_workflow()["jobs"]["required"]
        self.assertEqual(job["if"], "${{ always() }}")
        expected = {"changes", "bootstrap", "renovate", "physics", "tooling", "bridge", "preview"}
        self.assertEqual(set(job["needs"]), expected)
        baseline = {name: {"result": "success"} for name in expected}
        baseline["changes"]["outputs"] = {"docs_only": "false"}
        self.assertEqual(run_required(job, baseline).returncode, 0)
        for dependency in job["needs"]:
            for state in ("failure", "cancelled", "skipped"):
                with self.subTest(dependency=dependency, state=state):
                    needs = json.loads(json.dumps(baseline))
                    needs[dependency]["result"] = state
                    result = run_required(job, needs)
                    self.assertNotEqual(result.returncode, 0, result.stdout)

    def test_docs_only_mode_requires_exactly_skipped_heavy_jobs(self):
        job = load_workflow()["jobs"]["required"]
        others = {name: {"result": "skipped"} for name in job["needs"] if name != "changes"}
        expected = {"changes": {"result": "success", "outputs": {"docs_only": "true"}}, **others}
        self.assertEqual(run_required(job, expected).returncode, 0)
        for dependency in others:
            for state in ("success", "failure", "cancelled"):
                with self.subTest(dependency=dependency, state=state):
                    needs = json.loads(json.dumps(expected))
                    needs[dependency]["result"] = state
                    self.assertNotEqual(run_required(job, needs).returncode, 0)
        for bad in ("failure", "cancelled", "skipped"):
            needs = json.loads(json.dumps(expected))
            needs["changes"]["result"] = bad
            self.assertNotEqual(run_required(job, needs).returncode, 0)
        needs = json.loads(json.dumps(expected))
        del needs["preview"]
        self.assertNotEqual(run_required(job, needs).returncode, 0)

    def test_change_gating_is_scoped_to_heavy_jobs(self):
        workflow = load_workflow()
        self.assertIn("pull_request", workflow["on"])
        self.assertIn("main", workflow["on"]["push"]["branches"])
        self.assertEqual(workflow["jobs"]["changes"]["outputs"]["docs_only"],
                         "${{ steps.classify.outputs.docs_only }}")
        for job in ("bootstrap", "renovate", "physics", "tooling", "bridge", "preview"):
            self.assertEqual(workflow["jobs"][job]["needs"], "changes")
            expected = "needs.changes.outputs.docs_only != 'true'"
            if job == "bridge":
                expected += " && needs.changes.outputs.skip_special != 'true'"
            self.assertEqual(workflow["jobs"][job]["if"], expected)
        self.assertEqual(workflow["jobs"]["physics"]["with"]["run_windows_native"],
                         "${{ needs.changes.outputs.skip_special != 'true' }}")
        self.assertEqual(workflow["jobs"]["tooling"]["with"]["run_negative"],
                         "${{ needs.changes.outputs.skip_special != 'true' }}")
        for job, name in (("physics", "g1"), ("tooling", "g2"), ("bridge", "bridge"), ("preview", "preview")):
            self.assertEqual(workflow["jobs"][job]["uses"], f"./.github/workflows/{name}.yml")
            called = yaml.load((ROOT / f".github/workflows/{name}.yml").read_text(), Loader=yaml.BaseLoader)
            self.assertIn("workflow_call", called["on"])

    def test_gameplay_mode_omits_only_explicit_special_jobs(self):
        job = load_workflow()["jobs"]["required"]
        baseline = {name: {"result": "success"} for name in job["needs"]}
        baseline["changes"]["outputs"] = {"docs_only": "false", "skip_special": "true"}
        baseline["bridge"]["result"] = "skipped"
        self.assertEqual(run_required(job, baseline).returncode, 0)
        for name in ("physics", "tooling", "preview", "bootstrap", "renovate"):
            tampered = json.loads(json.dumps(baseline))
            tampered[name]["result"] = "skipped"
            self.assertNotEqual(run_required(job, tampered).returncode, 0)

    def test_g1_keeps_linux_and_conditionally_selects_windows(self):
        g1 = yaml.load((ROOT / ".github/workflows/g1.yml").read_text(), Loader=yaml.BaseLoader)
        native = g1["jobs"]["native"]
        win = g1["jobs"]["native-windows"]
        self.assertEqual([item["os"] for item in native["strategy"]["matrix"]["include"]],
                         ["ubuntu-26.04"])
        self.assertEqual(win["runs-on"], "windows-2025")
        self.assertEqual(win["if"],
                         "${{ !inputs.caller_managed_concurrency || inputs.run_windows_native }}")
        self.assertIn("html5", g1["jobs"])

    def test_nightly_full_and_notification_scoped(self):
        workflow = load_workflow()
        self.assertIn("schedule", workflow["on"])
        self.assertEqual(workflow["on"]["schedule"][0]["cron"], "17 2 * * *")
        notifier = workflow["jobs"]["nightly_alert"]
        self.assertEqual(notifier["needs"], "required")
        self.assertEqual(notifier["permissions"], {"contents": "read", "issues": "write"})
        self.assertEqual(notifier["if"], "${{ always() && github.event_name == 'schedule' }}")

    def test_pages_deploy_waits_for_required_and_only_main_full_suite(self):
        workflow = load_workflow()
        deploy = workflow["jobs"]["pages"]
        self.assertEqual(deploy["needs"], ["changes", "required"])
        self.assertEqual(deploy["if"],
                         "github.ref == 'refs/heads/main' && needs.changes.outputs.docs_only != 'true'")
        self.assertEqual(deploy["uses"], "./.github/workflows/pages.yml")
        self.assertIn("workflow_dispatch", workflow["on"])
        self.assertEqual(workflow["concurrency"]["cancel-in-progress"],
                         "${{ github.ref != 'refs/heads/main' }}")


if __name__ == "__main__":
    unittest.main()
