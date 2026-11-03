"""#101: the scheduled npm audit gate accepts only reviewed, current exceptions."""
import copy
import datetime as dt
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

import yaml

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))
sys.path.insert(0, str(ROOT / "tools" / "ci"))
import bootstrap_check
import npm_audit_alert
import npm_audit_gate as gate

GATE = ROOT / "tools/ci/npm_audit_gate.py"
SEEDED = ROOT / "tools/ci/npm-audit-exceptions.json"
TODAY = dt.date(2026, 11, 3)


def entry(ghsa, package, expires="2027-02-01", reviewed="2026-11-03"):
    return {
        "id": ghsa,
        "package": package,
        "chain": [f"renovate > {package}"],
        "reason": f"{package} only sees trusted, repo-controlled input in our use.",
        "upstream": [f"https://github.com/example/{package}/issues/1"],
        "reviewer": "Test reviewer",
        "reviewed": reviewed,
        "expires": expires,
    }


def exceptions(*entries):
    return {"schema": 1, "exceptions": list(entries)}


def audit(*findings):
    """npm audit --json (report version 2): one package entry per (ghsa, package, severity),
    plus a derived parent entry that only names the vulnerable package."""
    vulns = {}
    for ghsa, package, severity in findings:
        item = vulns.setdefault(package, {"name": package, "severity": severity, "isDirect": False,
                                          "via": [], "effects": ["renovate"], "range": "*",
                                          "nodes": [f"node_modules/{package}"], "fixAvailable": True})
        item["via"].append({"source": 1, "name": package, "dependency": package,
                            "title": f"Problem in {package}", "url": f"https://github.com/advisories/{ghsa}",
                            "severity": severity, "cwe": [], "cvss": {}, "range": "<99"})
    if vulns:
        vulns["renovate"] = {"name": "renovate", "severity": "moderate", "isDirect": True,
                             "via": sorted({p for _, p, _ in findings}), "effects": [], "range": "*",
                             "nodes": ["node_modules/renovate"], "fixAvailable": False}
    counts = {"info": 0, "low": 0, "moderate": 0, "high": 0, "critical": 0}
    for item in vulns.values():
        counts[item["severity"]] += 1
    counts["total"] = len(vulns)
    return {"auditReportVersion": 2, "vulnerabilities": vulns,
            "metadata": {"vulnerabilities": counts, "dependencies": {"prod": 1, "dev": 620, "total": 620}}}


SEEDED_FINDINGS = (("GHSA-g3hv-75wg-m249", "minimatch", "moderate"),
                   ("GHSA-3g3m-2fjr-6pw4", "glob", "moderate"),
                   ("GHSA-gcqx-w48m-w2h4", "deepmerge", "low"))
SEEDED_EXCEPTIONS = exceptions(*(entry(g, p) for g, p, _ in SEEDED_FINDINGS))


class GateVerdicts(unittest.TestCase):
    def run_gate(self, full, prod=None, exc=SEEDED_EXCEPTIONS, today=TODAY):
        return gate.evaluate(full, prod if prod is not None else audit(), exc, today)

    def test_all_excepted_and_current_passes(self):
        result = self.run_gate(audit(*SEEDED_FINDINGS))
        self.assertEqual(result.failures, [])
        self.assertEqual(result.warnings, [])
        self.assertEqual([row["status"] for row in result.rows], ["excepted"] * 3)

    def test_no_findings_passes_and_lists_stale_exceptions(self):
        result = self.run_gate(audit())
        self.assertEqual(result.failures, [])
        self.assertEqual(len(result.notes), 3)
        self.assertTrue(all("no longer reported" in note for note in result.notes))

    def test_new_advisory_fails(self):
        full = audit(*SEEDED_FINDINGS, ("GHSA-aaaa-bbbb-cccc", "undici", "high"))
        result = self.run_gate(full)
        self.assertEqual(len(result.failures), 1)
        self.assertIn("GHSA-aaaa-bbbb-cccc", result.failures[0])
        self.assertIn("high", result.failures[0])
        self.assertIn("7 days", result.failures[0])
        self.assertIn("NEW GHSA-aaaa-bbbb-cccc (undici, high)", result.summary)

    def test_moderate_new_advisory_names_the_30_day_deadline(self):
        result = self.run_gate(audit(("GHSA-aaaa-bbbb-cccc", "undici", "moderate")), exc=exceptions())
        self.assertIn("30 days", result.failures[0])

    def test_excepted_id_on_another_package_fails(self):
        result = self.run_gate(audit(("GHSA-gcqx-w48m-w2h4", "lodash", "low")))
        self.assertEqual(len(result.failures), 1)
        self.assertIn("lodash", result.failures[0])

    def test_expired_exception_fails_on_and_after_its_expiry_date(self):
        for today in (dt.date(2027, 2, 1), dt.date(2027, 5, 1)):
            with self.subTest(today=today):
                result = self.run_gate(audit(*SEEDED_FINDINGS), today=today)
                self.assertEqual(len(result.failures), 3)
                self.assertTrue(all("expired" in f for f in result.failures))
                self.assertIn("EXPIRED GHSA-gcqx-w48m-w2h4", result.summary)

    def test_expired_exception_without_finding_is_only_a_note(self):
        result = self.run_gate(audit(), today=dt.date(2027, 3, 1))
        self.assertEqual(result.failures, [])

    def test_near_expiry_warns_but_passes(self):
        result = self.run_gate(audit(*SEEDED_FINDINGS), today=dt.date(2027, 1, 20))
        self.assertEqual(result.failures, [])
        self.assertEqual(len(result.warnings), 3)
        self.assertIn("expires 2027-02-01 (12 days)", result.warnings[0])
        # Outside the warning window there is no warning.
        self.assertEqual(self.run_gate(audit(*SEEDED_FINDINGS), today=dt.date(2027, 1, 17)).warnings, [])

    def test_production_finding_fails_even_when_excepted(self):
        prod = audit(("GHSA-gcqx-w48m-w2h4", "deepmerge", "low"))
        result = self.run_gate(audit(*SEEDED_FINDINGS), prod=prod)
        self.assertEqual(len(result.failures), 1)
        self.assertIn("production", result.failures[0])
        self.assertIn("PRODUCTION", result.summary)

    def test_failed_or_inconsistent_audit_report_fails(self):
        broken = audit(*SEEDED_FINDINGS)
        broken["metadata"]["vulnerabilities"]["total"] = 2
        no_advisory = audit(*SEEDED_FINDINGS)
        for item in no_advisory["vulnerabilities"].values():
            item["via"] = ["renovate"]
        for report in ({"error": {"code": "ENOTFOUND", "summary": "registry down"}},
                       {"auditReportVersion": 1, "advisories": {}}, [], broken, no_advisory):
            with self.subTest(report=str(report)[:60]):
                with self.assertRaises(gate.Malformed):
                    self.run_gate(report)
                with self.assertRaises(gate.Malformed):
                    self.run_gate(audit(*SEEDED_FINDINGS), prod=report)


class ExceptionsFile(unittest.TestCase):
    def assert_malformed(self, data, today=TODAY):
        with self.assertRaises(gate.Malformed):
            gate.load_exceptions(data, today)

    def test_malformed_files_are_rejected(self):
        good = entry("GHSA-aaaa-bbbb-cccc", "x")
        cases = {
            "not an object": [],
            "wrong schema": {"schema": 2, "exceptions": []},
            "unknown top-level key": {"schema": 1, "exceptions": [], "extra": 1},
            "exceptions not a list": {"schema": 1, "exceptions": {}},
            "duplicate id": exceptions(good, dict(good)),
        }
        bad_entries = {
            "missing reviewer": {k: v for k, v in good.items() if k != "reviewer"},
            "unknown field": {**good, "expiry": "2027-01-01"},
            "bad id": {**good, "id": "CVE-2026-1"},
            "lowercase id": {**good, "id": "ghsa-aaaa-bbbb-cccc"},
            "empty package": {**good, "package": " "},
            "chain is a string": {**good, "chain": "renovate > x"},
            "empty chain": {**good, "chain": []},
            "empty reason": {**good, "reason": ""},
            "no upstream": {**good, "upstream": []},
            "http upstream": {**good, "upstream": ["http://example.com/x"]},
            "upstream not a URL": {**good, "upstream": ["see #12"]},
            "bad date": {**good, "expires": "1 Feb 2027"},
            "impossible date": {**good, "expires": "2027-02-30"},
            "longer than 90 days": {**good, "expires": "2027-02-02"},
            "expires before review": {**good, "expires": "2026-11-02"},
            "review in the future": {**good, "reviewed": "2026-11-04", "expires": "2026-12-01"},
            "entry not an object": "GHSA-aaaa-bbbb-cccc",
        }
        cases.update({name: exceptions(bad) for name, bad in bad_entries.items()})
        for name, data in cases.items():
            with self.subTest(name):
                self.assert_malformed(data)
        # Exactly 90 days is the longest allowed exception.
        self.assertIn("GHSA-aaaa-bbbb-cccc", gate.load_exceptions(exceptions(good), TODAY))

    def test_malformed_file_fails_the_gate(self):
        with self.assertRaises(gate.Malformed):
            gate.evaluate(audit(), audit(), {"schema": 1}, TODAY)

    def test_seeded_file_is_valid_and_covers_the_triaged_advisories(self):
        data = json.loads(SEEDED.read_text(encoding="utf-8"))
        reviewed = max(dt.date.fromisoformat(e["reviewed"]) for e in data["exceptions"])
        # Validate as of its own review date, so this test does not age.
        loaded = gate.load_exceptions(data, reviewed)
        self.assertEqual(sorted(loaded), sorted(g for g, _, _ in SEEDED_FINDINGS))
        for ghsa, package, _ in SEEDED_FINDINGS:
            self.assertEqual(loaded[ghsa]["package"], package)
            self.assertEqual(loaded[ghsa]["reviewer"], "Claude integration session (triage #101)")
            self.assertEqual(loaded[ghsa]["expires"], "2027-02-01")


class RenovateLag(unittest.TestCase):
    VIEW = {"dist-tags": {"latest": "44.209.0", "next": "45.0.0-next.1", "maint/42.x": "42.99.0"},
            "time": {"created": "2017-01-01T00:00:00.000Z", "modified": "2026-11-03T13:00:00.000Z",
                     "42.99.0": "2026-11-02T00:00:00.000Z",
                     "44.198.3": "2026-10-30T22:39:55.152Z",
                     "44.199.0": "2026-10-31T10:00:00.000Z",
                     "44.200.0": "2026-10-31T12:00:00.000Z",
                     "44.209.0": "2026-11-03T12:39:17.171Z",
                     "45.0.0-next.1": "2026-11-03T13:00:00.000Z"}}

    def test_lag_counts_newer_stable_releases_and_the_release_age_window(self):
        now = dt.datetime(2026, 11, 3, 18, tzinfo=dt.timezone.utc)
        lag = gate.renovate_lag("44.198.3", self.VIEW, now, 3)
        self.assertEqual(lag["latest"], "44.209.0")
        self.assertEqual(lag["releases_behind"], 3)
        self.assertEqual(lag["days_behind"], 3)
        self.assertEqual(lag["newest_past_release_age"], "44.200.0")
        self.assertIn("3 releases", gate.describe_lag(lag))

    def test_current_pin_and_unusable_view(self):
        now = dt.datetime(2026, 11, 7, tzinfo=dt.timezone.utc)
        view = copy.deepcopy(self.VIEW)
        view["dist-tags"]["latest"] = "44.198.3"
        self.assertEqual(gate.renovate_lag("44.198.3", view, now, 3)["releases_behind"], 0)
        for broken in (None, {}, {"dist-tags": {}}, {"error": {"code": "E404"}}):
            with self.subTest(broken=broken), self.assertRaises(ValueError):
                gate.renovate_lag("44.198.3", broken, now, 3)

    def test_release_age_comes_from_renovate_json(self):
        self.assertEqual(gate.release_age_days(ROOT / "renovate.json"), 3)


class GateCommandLine(unittest.TestCase):
    def run_cli(self, full, prod, exc, extra=()):
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            paths = {}
            for name, data in (("audit", full), ("prod", prod), ("exc", exc)):
                paths[name] = tmp / f"{name}.json"
                paths[name].write_text(data if isinstance(data, str) else json.dumps(data))
            view = tmp / "view.json"
            view.write_text(json.dumps(RenovateLag.VIEW))
            out, summary, report = tmp / "out", tmp / "summary.md", tmp / "report.md"
            result = subprocess.run(
                [sys.executable, str(GATE), "--audit", str(paths["audit"]), "--audit-prod", str(paths["prod"]),
                 "--exceptions", str(paths["exc"]), "--renovate-view", str(view), "--today", "2026-11-03",
                 "--report", str(report), "--step-summary", str(summary), "--github-output", str(out), *extra],
                capture_output=True, text=True, timeout=60)
            texts = {p.name: p.read_text() if p.exists() else "" for p in (out, summary, report)}
            return result, texts

    def test_pass_writes_report_summary_and_outputs(self):
        result, texts = self.run_cli(audit(*SEEDED_FINDINGS), audit(), SEEDED_EXCEPTIONS)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("PASS", result.stdout)
        self.assertIn("verdict=pass\n", texts["out"])
        self.assertIn("GHSA-g3hv-75wg-m249", texts["report.md"])
        self.assertIn("renovate", texts["summary.md"])
        self.assertEqual(texts["report.md"], texts["summary.md"])

    def test_failures_exit_one_with_a_one_line_summary(self):
        cases = {
            "new": (audit(*SEEDED_FINDINGS, ("GHSA-aaaa-bbbb-cccc", "undici", "high")), audit(), SEEDED_EXCEPTIONS),
            "production": (audit(*SEEDED_FINDINGS), audit(("GHSA-aaaa-bbbb-cccc", "x", "low")), SEEDED_EXCEPTIONS),
            "malformed exceptions": (audit(*SEEDED_FINDINGS), audit(), "{not json"),
            "malformed audit": ('{"error": {"code": "ENOTFOUND"}}', audit(), SEEDED_EXCEPTIONS),
        }
        for name, (full, prod, exc) in cases.items():
            with self.subTest(name):
                result, texts = self.run_cli(full, prod, exc)
                self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
                self.assertIn("FAIL", result.stdout)
                self.assertIn("verdict=fail\n", texts["out"])
                summary = [l for l in texts["out"].splitlines() if l.startswith("summary=")]
                self.assertEqual(len(summary), 1)
                self.assertNotIn("Traceback", result.stderr)

    def test_expired_via_today_flag(self):
        result, _ = self.run_cli(audit(*SEEDED_FINDINGS), audit(), SEEDED_EXCEPTIONS)
        self.assertEqual(result.returncode, 0)
        result, texts = self.run_cli(audit(*SEEDED_FINDINGS), audit(), SEEDED_EXCEPTIONS,
                                     ("--today", "2027-02-01"))
        self.assertEqual(result.returncode, 1)
        self.assertIn("EXPIRED", texts["out"])


class AlertPlan(unittest.TestCase):
    def test_create_on_failure_with_gate_summary(self):
        method, body = npm_audit_alert.plan(None, "failure", "https://run", "abc", "NEW GHSA-aaaa-bbbb-cccc (undici, high)")
        self.assertEqual(method, "POST")
        self.assertEqual(body["title"], npm_audit_alert.TITLE)
        self.assertIn("tooling", body["labels"])
        self.assertIn("NEW GHSA-aaaa-bbbb-cccc", body["body"])
        self.assertIn("https://run", body["body"])
        self.assertIn("7 days", body["body"])

    def test_update_reopen_and_recover(self):
        method, data = npm_audit_alert.plan({"state": "closed", "number": 7}, "cancelled", "u", "s", "")
        self.assertEqual((method, data["state"]), ("PATCH", "open"))
        self.assertIn("no gate verdict", data["body"])
        self.assertIsNone(npm_audit_alert.plan(None, "success", "u", "s", "PASS"))
        self.assertIsNone(npm_audit_alert.plan({"state": "closed", "body": "x"}, "success", "u", "s", "PASS"))
        method, data = npm_audit_alert.plan({"state": "open", "body": "Earlier"}, "success", "ok-run", "s", "PASS")
        self.assertEqual((method, data["state"]), ("PATCH", "closed"))
        self.assertIn("Earlier", data["body"])
        self.assertIn("ok-run", data["body"])

    def test_summary_is_one_bounded_line(self):
        _, body = npm_audit_alert.plan(None, "failure", "u", "s", "a\nb" + "x" * 5000)
        line = next(l for l in body["body"].splitlines() if l.startswith("- Gate:"))
        self.assertLess(len(line), 1100)
        self.assertNotIn("\nb", body["body"])

    def test_title_differs_from_the_nightly_issue(self):
        import nightly_alert
        self.assertNotEqual(npm_audit_alert.TITLE, nightly_alert.TITLE)


class Workflow(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.workflow = yaml.load((ROOT / ".github/workflows/audit.yml").read_text(), Loader=yaml.BaseLoader)
        cls.ci = yaml.load((ROOT / ".github/workflows/ci.yml").read_text(), Loader=yaml.BaseLoader)

    def test_schedule_and_dispatch_only(self):
        self.assertEqual(set(self.workflow["on"]), {"schedule", "workflow_dispatch"})
        self.assertEqual(self.workflow["permissions"], {"contents": "read"})
        for path in (ROOT / ".github/workflows").glob("*.yml"):
            self.assertNotIn("workflows/audit.yml", path.read_text(), path.name)
        self.assertNotIn("audit", self.ci["jobs"]["required"]["needs"])

    def test_audit_job_is_read_only_and_runs_the_gate(self):
        job = self.workflow["jobs"]["audit"]
        self.assertNotIn("permissions", job)
        runs = "\n".join(step.get("run", "") for step in job["steps"])
        self.assertIn("npm ci --ignore-scripts", runs)
        self.assertIn("npm audit --json", runs)
        self.assertIn("npm audit --omit=dev --json", runs)
        self.assertIn("tools/ci/npm_audit_gate.py", runs)
        for forbidden in ("--force", "audit fix", "--audit-level", "continue-on-error"):
            self.assertNotIn(forbidden, yaml.dump(self.workflow))
        for step in job["steps"]:
            if step.get("uses", "").startswith("actions/checkout@"):
                self.assertEqual(step["with"]["persist-credentials"], "false")

    def test_alert_job_owns_issue_write_only_on_schedule(self):
        alert = self.workflow["jobs"]["alert"]
        self.assertEqual(alert["permissions"], {"contents": "read", "issues": "write"})
        self.assertEqual(alert["needs"], "audit")
        self.assertEqual(alert["if"], "${{ always() && github.event_name == 'schedule' }}")
        self.assertIn("tools/ci/npm_audit_alert.py", alert["steps"][-1]["run"])
        self.assertEqual(bootstrap_check.validate(ROOT), [])

    def test_issue_permission_elsewhere_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            copy_root = Path(tmp)
            for name in bootstrap_check.REQUIRED + ["package.json", ".github/workflows/audit.yml"]:
                target = copy_root / name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes((ROOT / name).read_bytes())
            self.assertEqual(bootstrap_check.validate(copy_root), [])
            path = copy_root / ".github/workflows/audit.yml"
            data = yaml.load(path.read_text(), Loader=yaml.BaseLoader)
            data["jobs"]["audit"]["permissions"] = {"contents": "read", "issues": "write"}
            path.write_text(yaml.safe_dump(data))
            self.assertIn("audit.yml/audit: unexpected job permissions", bootstrap_check.validate(copy_root))

    def test_pr_ci_keeps_no_audit(self):
        for name in ("ci_node", "renovate"):
            runs = [s.get("run", "") for s in self.ci["jobs"][name]["steps"] if "npm ci" in s.get("run", "")]
            self.assertEqual(runs, ["npm ci --ignore-scripts --no-audit --no-fund"], name)


if __name__ == "__main__":
    unittest.main()
