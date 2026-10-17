#!/usr/bin/env python3
"""Read-only inventory of local Python, Node, Playwright and Chromium vs Rider CI."""
import argparse
import json
import platform
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def yaml_pin(path, key):
    pattern = r"^\s*" + re.escape(key) + r":\s*['\"](\d+(?:\.\d+)+)['\"]\s*$"
    match = re.search(pattern, path.read_text(encoding="utf-8"), re.MULTILINE)
    if not match:
        raise ValueError(f"Missing CI version {key}: {path}")
    return match.group(1)


def read_command(*args):
    try:
        return subprocess.run(args, cwd=ROOT, check=True, capture_output=True,
                              text=True, timeout=15).stdout.strip()
    except (OSError, subprocess.SubprocessError):
        return None


def compare(expected, actual):
    return {"expected": expected, "actual": actual,
            "exact_match": bool(actual) and expected == actual}


def collect():
    ci = ROOT / ".github/workflows/ci.yml"
    expected_python = yaml_pin(ci, "python-version")
    expected_node = yaml_pin(ci, "node-version")
    expected_pw = json.loads((ROOT / "package.json").read_text())["devDependencies"]["playwright"]
    node_result = read_command("node", "--version")
    node = node_result.removeprefix("v") if node_result else None
    js = """const p=require('playwright/package.json');
const {chromium}=require('playwright');
const b=require('playwright-core/browsers.json').browsers.find(x=>x.name==='chromium');
console.log(JSON.stringify({version:p.version,revision:b.revision,executable:chromium.executablePath()}));"""
    raw = read_command("node", "-e", js)
    try:
        browser = json.loads(raw) if raw else {}
    except json.JSONDecodeError:
        browser = {}
    executable = browser.get("executable")
    installed = bool(executable and Path(executable).is_file())
    checks = {
        "python": compare(expected_python, platform.python_version()),
        "node": compare(expected_node, node),
        "playwright": compare(expected_pw, browser.get("version")),
        "chromium_installed": compare(True, installed),
    }
    return {
        "schema_version": 1,
        "scope": "R81_LOCAL_CI_VERSION_INVENTORY",
        "status": "MATCH" if all(v["exact_match"] for v in checks.values()) else "DEVIATION",
        "source_sha": read_command("git", "rev-parse", "HEAD"),
        "working_tree_dirty": bool(read_command("git", "status", "--porcelain")),
        "python_executable": sys.executable,
        "node_executable": read_command("which", "node"),
        "checks": checks,
        "chromium": {
            "revision_from_installed_playwright": browser.get("revision"),
            "executable": executable,
            "binary_version": read_command(executable, "--version") if installed else None,
        },
        "limitations": [
            "Exact pin matching is stricter than the project's minimum supported Python version",
            "Browser revision belongs to installed Playwright; hosted CI runtime was not examined",
            "Not a build, runtime, branch-protection, or physical-device test",
        ],
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, help="Save a non-secret JSON inventory")
    parser.add_argument("--require-ci-parity", action="store_true",
                        help="Exit nonzero if any exact version differs or Chromium is absent")
    args = parser.parse_args(argv)
    report = collect()
    result = json.dumps(report, indent=2) + "\n"
    print(result, end="")
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(result, encoding="utf-8")
    return int(args.require_ci_parity and report["status"] != "MATCH")


if __name__ == "__main__":
    raise SystemExit(main())
