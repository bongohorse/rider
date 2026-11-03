#!/usr/bin/env python3
"""Run exact-source persistence Lua tests in isolated pinned Defold headless processes.

Run by the Linux G1 native CI job (#385); see docs/ci/persistence-engine-harness.md.
"""
import argparse
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import uuid

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools" / "g1"))
from build import build  # noqa: E402 - reuse the pinned Bob/JDK and extender engine guard

LOCK = json.loads((ROOT / "tools" / "toolchain-lock.json").read_text())
# PASS lines per suite. Defold 1.14.0 require ignores package.preload: suites must
# install module stubs through package.loaded or they silently test the real module.
EXPECTED = {"best": 4, "coin_bank": 3, "level_progress": 1, "run_best_pending": 16, "coin_bank_recovery": 3, "coin_bank_late_restore": 7,
            "my_levels_storage": 8, "slot_protection": 5}
MARKER = re.compile(r"(?:^|\s)RIDER_PERSISTENCE\s+(\{[^\n]*\})\s*$", re.MULTILINE)


def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT, text=True).strip()


def clean_head():
    changes = git("status", "--porcelain", "--untracked-files=all")
    if changes:
        raise RuntimeError("Uncommitted or untracked source: refuse non-identifiable build")
    return git("rev-parse", "HEAD")


def execute(executable, case, source_sha, run_id, timeout, output):
    cmd = [str(executable), "--config=rider.persistence_case=" + case,
           "--config=rider.source_sha=" + source_sha,
           "--config=rider.run_id=" + run_id]
    process = subprocess.Popen(cmd, cwd=executable.parent, stdout=subprocess.PIPE,
                               stderr=subprocess.STDOUT, text=True, errors="replace",
                               start_new_session=True)
    timed_out = False
    try:
        log, _ = process.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        timed_out = True
        os.killpg(process.pid, signal.SIGKILL)
        log, _ = process.communicate(timeout=15)
    (output / (case + ".log")).write_text(log, encoding="utf-8")
    if timed_out:
        raise RuntimeError(case + ": engine timed out (process group killed)")
    if process.returncode != 0:
        raise RuntimeError(f"{case}: engine exited {process.returncode}; see {case}.log")
    markers = MARKER.findall(log)
    if len(markers) != 1:
        raise RuntimeError(f"{case}: expected exactly one completion marker, got {len(markers)}")
    try:
        result = json.loads(markers[0])
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"{case}: invalid completion JSON: {exc}") from exc
    expected = {
        "case": case, "source_sha": source_sha, "run_id": run_id,
        "engine_sha": LOCK["engine"]["commit"],
        "engine_version": LOCK["engine"]["version"],
        "pass_lines": EXPECTED[case], "status": "PASS"
    }
    if not isinstance(result, dict) or any(result.get(k) != v for k, v in expected.items()):
        raise RuntimeError(f"{case}: incomplete/foreign/failed Defold result: {result!r}")
    if "error" in result:
        raise RuntimeError(f"{case}: unexpected error field in PASS result")
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--cases", nargs="+", choices=tuple(EXPECTED), default=list(EXPECTED))
    parser.add_argument("--timeout", type=int, default=45)
    args = parser.parse_args()
    if args.timeout < 1 or args.timeout > 300 or len(args.cases) != len(set(args.cases)):
        parser.error("timeout must be 1..300 seconds; case names must be unique")
    output = args.output.resolve()
    if output.exists() and any(output.iterdir()):
        parser.error("output must be absent or empty; do not reuse old bundles/results")
    output.mkdir(parents=True, exist_ok=True)
    report = {"status": "FAIL", "cases": [], "engine_version": LOCK["engine"]["version"],
              "engine_sha": LOCK["engine"]["commit"], "platform": "x86_64-linux",
              "storage": "injected sys/json and slot-store stubs per suite; no native disk, IndexedDB or device storage"}
    try:
        sha = clean_head()
        report["source_sha"] = sha
        report["run_id"] = uuid.uuid4().hex
        build("x86_64-linux", output, ROOT / "tests/engine/persistence/persistence.settings",
              variant="headless")
        if clean_head() != sha:
            raise RuntimeError("Source changed during build")
        binaries = list((output / "RiderG1").rglob("RiderG1.x86_64"))
        if len(binaries) != 1:
            raise RuntimeError(f"Expected one pinned native engine, found {len(binaries)}")
        for case in args.cases:
            report["cases"].append(execute(binaries[0].resolve(), case, sha, report["run_id"],
                                           args.timeout, output))
        report["status"] = "PASS"
    except Exception as exc:  # any failure must still leave a FAIL result.json
        report["error"] = f"{type(exc).__name__}: {exc}"
    (output / "result.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": report["status"], "output": str(output),
                      "source_sha": report.get("source_sha"), "cases": len(report["cases"]),
                      "error": report.get("error")}))
    return 0 if report["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
