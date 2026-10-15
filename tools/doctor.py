#!/usr/bin/env python3
"""Read-only environment inventory; readiness is separate from runtime evidence."""
import argparse
import json
import os
from pathlib import Path
import platform
import re
import shutil
import subprocess
import sys


def probe(command):
    try:
        result = subprocess.run(command, capture_output=True, text=True, timeout=10)
        return result.returncode, (result.stdout + result.stderr).strip()
    except (OSError, subprocess.TimeoutExpired) as exc:
        return 1, type(exc).__name__


def java_major(text):
    match = re.search(r'version\s+"(\d+)(?:\.(\d+))?', text)
    if not match:
        return None
    return int(match[2]) if match[1] == '1' and match[2] else int(match[1])


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument('--json', action='store_true')
    parser.add_argument('--require-g1', action='store_true')
    args = parser.parse_args(argv)
    checks = []
    def add(name, passed, detail, required=False):
        checks.append({'id': name, 'status': 'PASS' if passed else ('FAIL' if required else 'WARN'),
                       'required_now': required, 'detail': detail})
    add('python', sys.version_info >= (3, 12), platform.python_version(), True)
    git = shutil.which('git')
    code, output = probe([git, '--version']) if git else (1, 'Git missing')
    add('git', code == 0, output, True)
    java = shutil.which('java')
    code, output = probe([java, '-version']) if java else (1, 'Java missing')
    major = java_major(output)
    add('jdk25_candidate', code == 0 and major == 25,
        f'Java major={major}; candidate=25; no Bob build implied', args.require_g1)
    bob = Path(os.environ.get('RIDER_BOB_JAR', 'bob.jar')).expanduser()
    add('bob_candidate', bob.is_file(), 'Set RIDER_BOB_JAR to candidate bob.jar; presence only', args.require_g1)
    editor = os.environ.get('RIDER_DEFOLD_EDITOR')
    editor_exists = bool(editor and Path(editor).expanduser().is_file())
    add('defold_editor', editor_exists,
        'Set RIDER_DEFOLD_EDITOR to the editor executable; presence only; optional for Bob-only workflows')
    for name in ('node', 'adb'):
        add(name, bool(shutil.which(name)), 'Detected on PATH' if shutil.which(name) else 'Not found; later tooling/device prerequisite')
    add('editor_mcp', False, 'NOT RUN: live editor/Bridge/MCP connection belongs to G2')
    add('android_device', False, 'NOT RUN: no device access assumed or probed')
    report = {'schema_version': 1, 'scope': 'G1_PREREQUISITES' if args.require_g1 else 'G0_ENVIRONMENT',
              'os': platform.system(), 'checks': checks,
              'status': 'FAIL' if any(c['status'] == 'FAIL' for c in checks) else 'PASS',
              'runtime_verified': False}
    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print(f"{report['scope']}: {report['status']} (tool presence only, no runtime approval)")
        for check in checks:
            print(f"{check['status']:4} {check['id']}: {check['detail']}")
    return 2 if report['status'] == 'FAIL' else 0


if __name__ == '__main__':
    raise SystemExit(main())
