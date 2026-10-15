#!/usr/bin/env python3
"""Run pinned Renovate extraction and reject empty or incomplete results."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def main():
    output = ROOT / 'artifacts'
    output.mkdir(exist_ok=True)
    log = output / 'renovate-debug.ndjson'
    log.unlink(missing_ok=True)
    report_file = output / 'renovate-scan.json'
    report_file.unlink(missing_ok=True)
    env = dict(os.environ, LOG_LEVEL='info', LOG_FILE=str(log), LOG_FILE_LEVEL='debug')
    binary = ROOT / 'node_modules/renovate/dist/renovate.js'
    if not binary.is_file() or not shutil.which('node'):
        print('BLOCKED: run npm ci --ignore-scripts with Node 24.11+ first', file=sys.stderr)
        return 2
    try:
        result = subprocess.run([shutil.which('node'), str(binary), '--platform=local',
                                 '--dry-run=extract'], cwd=ROOT, env=env, timeout=240,
                                capture_output=True, text=True)
    except subprocess.TimeoutExpired:
        print('FAIL: Renovate extraction timed out', file=sys.stderr)
        return 1
    (output / 'renovate-console.log').write_text(result.stdout + result.stderr)
    events = [json.loads(line) for line in log.read_text().splitlines() if line.strip()] if log.exists() else []
    extraction = [e for e in events if e.get('msg') == 'Dependency extraction complete']
    managers = extraction[-1].get('stats', {}).get('managers', {}) if extraction else {}
    expected = ('github-actions', 'npm', 'pip_requirements')
    success = result.returncode == 0 and all(managers.get(m, {}).get('depCount', 0) > 0 for m in expected)
    success = success and not any(e.get('level', 0) >= 50 for e in events)
    commit = subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()
    dirty = bool(subprocess.run(['git', 'status', '--porcelain'], cwd=ROOT, capture_output=True, text=True, check=True).stdout)
    report = {'schema_version': 1, 'status': 'PASS' if success else 'FAIL',
              'mode': 'local-extraction-only', 'source_base_sha': commit, 'workspace_dirty': dirty,
              'renovate_version': json.loads((ROOT / 'package.json').read_text())['devDependencies']['renovate'],
              'managers': managers, 'dependency_total': sum(m.get('depCount', 0) for m in managers.values()),
              'hosted_app_verified': False, 'version_lookup_performed': False,
              'limitations': ['No hosted app installation proof', 'No available-version lookup',
                              'Install scripts disabled; native RE2 may fall back to JavaScript RegExp'],
              'log': log.name}
    report_file.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))
    return 0 if success else 1


if __name__ == '__main__':
    raise SystemExit(main())
