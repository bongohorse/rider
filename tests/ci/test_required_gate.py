"""Required refuses to conceal a failure under a selective skip."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "tools" / "ci"))
from required_gate import NAMES, evaluate


def needs(docs=False, gym=False):
    obj = {"changes": {"result": "success", "outputs": {
        "docs_only": "true" if docs else "false",
        "skip_special": "true" if gym else "false"}}}
    for name in NAMES:
        obj[name] = {"result": "skipped" if docs or (gym and name == "bridge") else "success"}
    return obj


class RequiredGate(unittest.TestCase):
    def test_docs_fast_path(self):
        self.assertEqual(evaluate(needs(docs=True)), [])

    def test_gym_safe_skips(self):
        self.assertEqual(evaluate(needs(gym=True)), [])

    def test_full_suite(self):
        self.assertEqual(evaluate(needs()), [])

    def test_needed_missing_failed_cancelled_skipped(self):
        for name in NAMES:
            for status in ("failure", "cancelled", "skipped"):
                obj = needs()
                obj[name]["result"] = status
                self.assertTrue(evaluate(obj), (name, status))

    def test_unexpected_execution_not_accepted(self):
        obj = needs(gym=True)
        obj["bridge"]["result"] = "success"
        self.assertTrue(evaluate(obj))
        obj = needs(docs=True)
        obj["preview"]["result"] = "success"
        self.assertTrue(evaluate(obj))

    def test_missing_dependency_and_classifier_failure(self):
        obj = needs()
        del obj["physics"]
        self.assertTrue(evaluate(obj))
        obj = needs()
        obj["changes"]["result"] = "failure"
        self.assertTrue(evaluate(obj))


if __name__ == "__main__":
    unittest.main()
