#!/usr/bin/env python3
"""Build one debug Gym bundle; reject stale or modified bundles before reuse."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/g1'))
from build import build


def inventory(output):
    return {str(p.relative_to(output)): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in sorted(output.rglob('*')) if p.is_file() and p.name != 'bundle.json'}


def build_bundle(output, sha):
    output = Path(output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    if any(output.iterdir()):
        raise RuntimeError('Shared Gym output must be empty; stale bundles are not reusable')
    settings = output / 'gym.settings'
    settings.write_text(f'[project]\ndependencies =\n[rider]\nsource_sha = {sha}\nrun_id = shared-build\ngym_test =\n')
    build('wasm-web', output, settings, variant='debug')
    if len(list(output.rglob('index.html'))) != 1:
        raise RuntimeError('Expected exactly one shared Gym index')
    report = {'source_sha': sha, 'platform': 'wasm-web', 'variant': 'debug', 'files': inventory(output)}
    (output / 'bundle.json').write_text(json.dumps(report, indent=2) + '\n')


def verify_bundle(output, sha):
    output = Path(output).resolve()
    report = json.loads((output / 'bundle.json').read_text())
    if (report['source_sha'], report['platform'], report['variant']) != (sha, 'wasm-web', 'debug'):
        raise RuntimeError('Foreign source or non-debug Gym bundle')
    if not report['files'] or inventory(output) != report['files']:
        raise RuntimeError('Shared Gym bundle changed after its build')
    return output


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    sha = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    build_bundle(args.output, sha)
