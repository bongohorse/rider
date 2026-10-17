"""Rider profile schema drift and local CI version evidence tests."""
import json
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))
from local_parity import compare, yaml_pin


class TestLocalTooling(unittest.TestCase):
    def test_exact_and_missing_versions(self):
        self.assertTrue(compare("24.21.0", "24.21.0")["exact_match"])
        self.assertFalse(compare("3.14.8", "3.14.4")["exact_match"])
        self.assertFalse(compare("1.64.1", None)["exact_match"])
        self.assertTrue(compare(True, True)["exact_match"])

    def test_ci_version_pins(self):
        ci = ROOT / ".github/workflows/ci.yml"
        self.assertEqual(yaml_pin(ci, "python-version"), "3.14.8")
        self.assertEqual(yaml_pin(ci, "node-version"), "24.21.0")

    def test_windows_profile_settings_match_workspace(self):
        profile = json.loads((ROOT / "profiles/Rider.code-profile").read_text(encoding="utf-8"))
        decoded = json.loads(json.loads(profile["settings"])["settings"])
        workspace = json.loads((ROOT / ".vscode/settings.json").read_text(encoding="utf-8"))
        self.assertEqual(decoded, workspace)


if __name__ == "__main__":
    unittest.main()
