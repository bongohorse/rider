"""Fast #385 protocol checks; all engine/build calls below are explicitly mocked.

These tests do NOT count as pinned Defold or storage-adapter fault injection.
"""
import importlib.util
import json
import re
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock

ROOT = Path(__file__).resolve().parents[3]
SPEC = importlib.util.spec_from_file_location(
    "rider_persistence_385", ROOT / "tools/g2/persistence_385.py"
)
HARNESS = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(HARNESS)


class PersistenceProtocolTests(unittest.TestCase):
    def test_prefixed_engine_log_marker(self):
        payload = json.dumps({"case": "best", "status": "PASS"})
        line = "DEBUG:SCRIPT: RIDER_PERSISTENCE " + payload + "\n"
        self.assertEqual(HARNESS.MARKER.findall(line), [payload])
        self.assertEqual(HARNESS.MARKER.findall("engine started\n"), [])

    def test_duplicate_completion_is_distinguishable(self):
        payload = json.dumps({"case": "coin_bank", "status": "PASS"})
        line = "DEBUG:SCRIPT: RIDER_PERSISTENCE " + payload + "\n"
        self.assertEqual(len(HARNESS.MARKER.findall(line + line)), 2)

    def _main_without_engine(self, *, error=None):
        """Exercise output serialization, never simulate a genuine Defold PASS."""
        with tempfile.TemporaryDirectory(prefix="rider-385-protocol-") as directory:
            output = Path(directory) / "output"
            sha = "a" * 40

            def fake_build(platform, target, settings, variant):
                self.assertEqual((platform, variant), ("x86_64-linux", "headless"))
                binary = Path(target) / "RiderG1" / "RiderG1.x86_64"
                binary.parent.mkdir(parents=True)
                binary.write_text("UNIT-TEST-PLACEHOLDER", encoding="utf-8")

            def fake_execute(executable, case, source_sha, run_id, timeout, target):
                self.assertEqual(case, "best")
                self.assertEqual(source_sha, sha)
                self.assertEqual(Path(target), output)
                if error:
                    raise RuntimeError(error)
                return {
                    "case": case, "source_sha": source_sha, "run_id": run_id,
                    "engine_sha": HARNESS.LOCK["engine"]["commit"],
                    "engine_version": HARNESS.LOCK["engine"]["version"],
                    "pass_lines": 4, "status": "PASS",
                }

            with (
                mock.patch.object(sys, "argv", ["persistence_385.py", "--output", str(output), "--cases", "best"]),
                mock.patch.object(HARNESS, "clean_head", return_value=sha),
                mock.patch.object(HARNESS, "build", side_effect=fake_build),
                mock.patch.object(HARNESS, "execute", side_effect=fake_execute),
            ):
                exit_code = HARNESS.main()

            report_text = (output / "result.json").read_text(encoding="utf-8")
            self.assertTrue(report_text.endswith("\n"))
            self.assertFalse(report_text.endswith("\\n"))
            return exit_code, json.loads(report_text)

    def test_success_report_is_valid_json(self):
        code, report = self._main_without_engine()
        self.assertEqual(code, 0)
        self.assertEqual(report["status"], "PASS")
        self.assertEqual(len(report["cases"]), 1)

    def test_failure_report_is_valid_json_and_fails_closed(self):
        code, report = self._main_without_engine(error="injected protocol failure")
        self.assertEqual(code, 1)
        self.assertEqual(report["status"], "FAIL")
        self.assertEqual(report["cases"], [])
        self.assertIn("injected protocol failure", report["error"])

    def test_runner_cases_match_expected_counts(self):
        script = (ROOT / "tests/engine/persistence/runner.script").read_text(encoding="utf-8")
        cases = re.findall(r'case == "([a-z_]+)" then\n\s+require "tests\.gameplay\.([a-z_]+)"', script)
        self.assertEqual(sorted(c for c, _ in cases), sorted(HARNESS.EXPECTED))
        self.assertTrue(all(c == m for c, m in cases))
        table = re.search(r"local expected = \{([^}]*)\}", script)
        self.assertIsNotNone(table)
        parsed = {k: int(v) for k, v in re.findall(r"([a-z_]+) = (\d+)", table.group(1))}
        self.assertEqual(parsed, HARNESS.EXPECTED)

    def test_expected_counts_match_suite_pass_lines(self):
        for case, count in HARNESS.EXPECTED.items():
            path = ROOT / f"tests/gameplay/{case}.lua"
            self.assertTrue(path.is_file(), case)
            lines = re.findall(r"^print\(\s*['\"]PASS ", path.read_text(encoding="utf-8"), re.M)
            self.assertEqual(len(lines), count, f"{case}: top-level PASS lines vs EXPECTED")

    PRELOAD = re.compile(r"package\.preload\s*(?:\[\s*(['\"])([^'\"]+)\1\s*\]|\.([A-Za-z_]\w*)|(\[[^\]]*\]))\s*=")

    def test_suites_do_not_rely_on_package_preload_alone(self):
        for case in HARNESS.EXPECTED:
            source = (ROOT / f"tests/gameplay/{case}.lua").read_text(encoding="utf-8")
            for match in self.PRELOAD.finditer(source):
                name = match.group(2) or match.group(3)
                self.assertIsNotNone(name, f"{case}: dynamic package.preload key cannot be checked")
                loaded = re.compile(r"package\.loaded\s*(?:\[\s*['\"]" + re.escape(name)
                                    + r"['\"]\s*\]|\." + re.escape(name) + r")\s*=\s*(?!nil\b)")
                install = loaded.search(source, match.end())
                first_require = re.compile(r"\brequire\b").search(source, match.end())
                self.assertIsNotNone(install, f"{case}: stubs {name} only via package.preload, which Defold ignores")
                self.assertTrue(first_require is None or install.start() < first_require.start(),
                                f"{case}: install package.loaded['{name}'] before the next require")

    def test_preload_guard_catches_every_literal_form(self):
        for stub in ("package.preload['m.x']=f", 'package.preload["m.x"] = f', "package.preload.mx=f"):
            self.assertIsNotNone(self.PRELOAD.search(stub), stub)
        dynamic = self.PRELOAD.search("package.preload[name]=f")
        self.assertIsNotNone(dynamic)
        self.assertIsNone(dynamic.group(2) or dynamic.group(3))


if __name__ == "__main__":
    unittest.main()
