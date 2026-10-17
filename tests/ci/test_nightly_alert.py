"""Nightly CI failure issue management keeps only one issue active."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "tools" / "ci"))
from nightly_alert import TITLE, plan


class NightlyIssuePlan(unittest.TestCase):
    def test_create(self):
        method, body = plan(None, "failure", "https://github.com/run", "abc")
        self.assertEqual(method, "POST")
        self.assertEqual(body["title"], TITLE)
        self.assertEqual(body["labels"], ["tooling"])
        self.assertIn("https://github.com/run", body["body"])

    def test_reopen(self):
        method, data = plan({"state": "closed", "number": 12}, "cancelled", "url", "sha")
        self.assertEqual(method, "PATCH")
        self.assertEqual(data["state"], "open")

    def test_recovery_and_no_change(self):
        self.assertIsNone(plan(None, "success", "ok", "def"))
        method, data = plan({"state": "open", "body": "Earlier failure"}, "success", "passed", "def")
        self.assertEqual(method, "PATCH")
        self.assertEqual(data["state"], "closed")
        self.assertIn("Earlier failure", data["body"])
        self.assertIn("passed", data["body"])


if __name__ == "__main__":
    unittest.main()
