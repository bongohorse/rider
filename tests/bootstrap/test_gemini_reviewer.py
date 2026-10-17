"""Static checks for the restricted Gemini review policy and setup entry point."""

import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
SETTINGS = ROOT / "tools/security/gemini-readonly-settings.json"
SETUP = ROOT / "tools/security/setup_gemini_reviewer.sh"

class GeminiReviewerPolicyTests(unittest.TestCase):
    def test_explicit_deny_with_no_permission_bypass(self):
        settings = json.loads(SETTINGS.read_text(encoding="utf-8"))
        self.assertTrue(settings["enableTerminalSandbox"])
        self.assertEqual(settings["permissions"]["allow"], [])
        for item in ("write_file(*)", "command(*)", "unsandboxed(*)",
                     "mcp(*)", "execute_url(*)"):
            self.assertIn(item, settings["permissions"]["deny"])
        self.assertEqual(settings["permissions"]["ask"], ["read_url(*)"])

    def test_script_refuses_root_and_reserves_snapshot_for_root(self):
        script = SETUP.read_text(encoding="utf-8")
        self.assertIn("id -u", script)
        self.assertIn("git -C \"$repo\" archive", script)
        self.assertIn("sudo chown -R root:root", script)
        self.assertIn("sudo chmod -R a-w", script)
        self.assertIn('sudo -u "$review_user" -H test -w', script)
        self.assertIn('sudo -u "$review_user" -H test -r "$owner_gh"', script)

if __name__ == "__main__":
    unittest.main()
