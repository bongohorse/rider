#!/usr/bin/env python3
"""Strict, testable required check for explicit CI selection."""
import json
import os
import sys

NAMES = ("bootstrap", "renovate", "physics", "tooling", "bridge", "preview")


def evaluate(needs):
    changes = needs.get("changes", {})
    if changes.get("result") != "success":
        return ["change classification failed or was skipped"]
    outputs = changes.get("outputs", {})
    docs = outputs.get("docs_only") == "true"
    skip_special = outputs.get("skip_special") == "true"
    errors = []
    if set(needs) != set(NAMES) | {"changes"}:
        errors.append("unexpected CI dependency inventory")
    for name in NAMES:
        expected = "skipped" if docs or (skip_special and name == "bridge") else "success"
        actual = needs.get(name, {}).get("result", "missing")
        if actual != expected:
            errors.append(f"{name}: expected {expected}, got {actual}")
    return errors


def main():
    needs = json.loads(os.environ["RESULTS"])
    for name, job in sorted(needs.items()):
        print(f"{name}: {job.get('result')}")
    errors = evaluate(needs)
    if errors:
        for error in errors:
            print(f"FAIL: {error}", file=sys.stderr)
        return 1
    print("required PASS: all selected jobs succeeded; only expected jobs skipped")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
