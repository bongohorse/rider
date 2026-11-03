"""Required refuses to conceal a failure under a selective skip."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "tools" / "ci"))
from required_gate import NAMES, evaluate

HEAVY = ("renovate", "physics", "tooling", "bridge", "preview")
MODES = {
    # mode: (docs_only, skip_special, repo_tooling, selection_reason, jobs that must be skipped)
    "full": ("false", "false", "false", "unknown-or-shared-change-full", ()),
    "docs": ("true", "false", "false", "docs-text-only", NAMES),
    "gym": ("false", "true", "false", "gym-and-docs-only", ("bridge",)),
    "tooling": ("false", "false", "true", "repo-tooling-and-docs-only", HEAVY),
}


def needs(mode="full", docs=False, gym=False):
    mode = "docs" if docs else "gym" if gym else mode
    docs_only, skip_special, repo_tooling, reason, skipped = MODES[mode]
    obj = {"changes": {"result": "success", "outputs": {
        "docs_only": docs_only, "skip_special": skip_special,
        "repo_tooling": repo_tooling, "selection_reason": reason}}}
    for name in NAMES:
        obj[name] = {"result": "skipped" if name in skipped else "success"}
    return obj


class RequiredGate(unittest.TestCase):
    def test_inventory(self):
        self.assertEqual(NAMES, ("bootstrap", "ci_node") + HEAVY)

    def test_docs_fast_path(self):
        self.assertEqual(evaluate(needs(docs=True)), [])

    def test_gym_safe_skips(self):
        self.assertEqual(evaluate(needs(gym=True)), [])

    def test_full_suite(self):
        self.assertEqual(evaluate(needs()), [])
        for reason in ("scheduled-or-manual-full", "missing-base-full", "main-push-full"):
            obj = needs()
            obj["changes"]["outputs"]["selection_reason"] = reason
            self.assertEqual(evaluate(obj), [], reason)

    def test_main_push_is_full(self):
        obj = needs()
        obj["changes"]["outputs"]["selection_reason"] = "main-push-full"
        for name in NAMES:
            with self.subTest(name=name):
                tampered = {k: dict(v) for k, v in obj.items()}
                tampered[name]["result"] = "skipped"
                self.assertTrue(evaluate(tampered))
        for flag in ("docs_only", "skip_special", "repo_tooling"):
            with self.subTest(flag=flag):
                tampered = needs()
                tampered["changes"]["outputs"].update({"selection_reason": "main-push-full", flag: "true"})
                self.assertTrue(evaluate(tampered))

    def test_repo_tooling_short_path(self):
        self.assertEqual(evaluate(needs("tooling")), [])

    def test_needed_missing_failed_cancelled_skipped(self):
        for mode in MODES:
            for name in NAMES:
                if needs(mode)[name]["result"] != "success":
                    continue
                for status in ("failure", "cancelled", "skipped", None):
                    with self.subTest(mode=mode, name=name, status=status):
                        obj = needs(mode)
                        if status is None:
                            del obj[name]
                        else:
                            obj[name]["result"] = status
                        self.assertTrue(evaluate(obj))

    def test_repo_tooling_selected_jobs_fail_closed(self):
        for name in ("bootstrap", "ci_node"):
            for status in ("failure", "cancelled", "skipped"):
                with self.subTest(name=name, status=status):
                    obj = needs("tooling")
                    obj[name]["result"] = status
                    self.assertTrue(evaluate(obj))

    def test_skip_is_accepted_only_for_its_selection(self):
        # A heavy job may be skipped only under the repo-tooling (or docs) selection.
        for mode in ("full", "gym"):
            for name in HEAVY:
                if mode == "gym" and name == "bridge":
                    continue
                with self.subTest(mode=mode, name=name):
                    obj = needs(mode)
                    obj[name]["result"] = "skipped"
                    self.assertTrue(evaluate(obj))

    def test_unexpected_execution_not_accepted(self):
        obj = needs(gym=True)
        obj["bridge"]["result"] = "success"
        self.assertTrue(evaluate(obj))
        obj = needs(docs=True)
        obj["preview"]["result"] = "success"
        self.assertTrue(evaluate(obj))
        for name in HEAVY:
            for status in ("success", "failure", "cancelled"):
                with self.subTest(name=name, status=status):
                    obj = needs("tooling")
                    obj[name]["result"] = status
                    self.assertTrue(evaluate(obj))

    def test_missing_dependency_and_classifier_failure(self):
        obj = needs()
        del obj["physics"]
        self.assertTrue(evaluate(obj))
        obj = needs("tooling")
        del obj["ci_node"]
        self.assertTrue(evaluate(obj))
        obj = needs()
        obj["unexpected"] = {"result": "success"}
        self.assertTrue(evaluate(obj))
        for status in ("failure", "cancelled", "skipped"):
            for mode in MODES:
                obj = needs(mode)
                obj["changes"]["result"] = status
                self.assertTrue(evaluate(obj), (mode, status))
        self.assertTrue(evaluate({}))

    def test_classification_errors_never_pass(self):
        # Missing, malformed or contradictory selection outputs fail even if every job ran.
        def tampered(mode, **outputs):
            obj = needs(mode)
            for key, value in outputs.items():
                if value is None:
                    del obj["changes"]["outputs"][key]
                else:
                    obj["changes"]["outputs"][key] = value
            return obj

        cases = [
            tampered("full", repo_tooling=None),
            tampered("full", selection_reason=None),
            tampered("full", docs_only=None),
            tampered("full", skip_special=None),
            tampered("full", repo_tooling=""),
            tampered("tooling", repo_tooling="TRUE"),
            tampered("tooling", repo_tooling="1"),
            tampered("full", selection_reason="repo-tooling-and-docs-only"),
            tampered("tooling", selection_reason="unknown-or-shared-change-full"),
            tampered("tooling", selection_reason="made-up-reason"),
            tampered("tooling", docs_only="true"),
            tampered("tooling", skip_special="true"),
            tampered("docs", repo_tooling="true"),
            tampered("gym", repo_tooling="true"),
        ]
        no_outputs = needs()
        del no_outputs["changes"]["outputs"]
        cases.append(no_outputs)
        for obj in cases:
            with self.subTest(outputs=obj["changes"].get("outputs")):
                self.assertTrue(evaluate(obj))


if __name__ == "__main__":
    unittest.main()
