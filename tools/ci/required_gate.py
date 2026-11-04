#!/usr/bin/env python3
"""Strict, testable required check for explicit CI selection."""
import json
import os
import sys

NAMES = ("bootstrap", "ci_node", "renovate", "physics", "tooling", "bridge", "preview")
FLAGS = ("docs_only", "skip_special", "repo_tooling")
# Jobs the repo-tooling short path (#437) skips; Bootstrap and the CI Node tests stay.
HEAVY = ("renovate", "physics", "tooling", "bridge", "preview")
FULL = (("false", "false", "false"), ())
# selection_reason -> (exact FLAGS values, jobs that must be skipped). Every other job must
# succeed. An unknown reason or contradicting flags is a classification error and fails.
SELECTIONS = {
    "docs-assets-and-text-only": (("true", "false", "false"), NAMES),
    "docs-text-only": (("true", "false", "false"), NAMES),
    "gym-and-docs-only": (("false", "true", "false"), ("bridge",)),
    "repo-tooling-and-docs-only": (("false", "false", "true"), HEAVY),
    "unknown-or-shared-change-full": FULL,
    "scheduled-or-manual-full": FULL,
    "missing-base-full": FULL,
    "main-push-full": FULL,
}


def evaluate(needs):
    changes = needs.get("changes", {})
    if changes.get("result") != "success":
        return ["change classification failed or was skipped"]
    outputs = changes.get("outputs") or {}
    reason = outputs.get("selection_reason")
    if reason not in SELECTIONS:
        return [f"unknown CI selection reason {reason!r}"]
    flags, skipped = SELECTIONS[reason]
    actual = tuple(outputs.get(flag) for flag in FLAGS)
    if actual != flags:
        return [f"selection outputs {dict(zip(FLAGS, actual))} contradict {reason}"]
    errors = []
    if set(needs) != set(NAMES) | {"changes"}:
        errors.append("unexpected CI dependency inventory")
    for name in NAMES:
        expected = "skipped" if name in skipped else "success"
        actual = needs.get(name, {}).get("result", "missing")
        if actual != expected:
            errors.append(f"{name}: expected {expected}, got {actual}")
    return errors


def main():
    needs = json.loads(os.environ["RESULTS"])
    for name, job in sorted(needs.items()):
        print(f"{name}: {job.get('result')}")
    outputs = needs.get("changes", {}).get("outputs") or {}
    print(f"selection: {outputs.get('selection_reason')}")
    errors = evaluate(needs)
    if errors:
        for error in errors:
            print(f"FAIL: {error}", file=sys.stderr)
        return 1
    print("required PASS: all selected jobs succeeded; only expected jobs skipped")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
