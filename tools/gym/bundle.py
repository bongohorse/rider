#!/usr/bin/env python3
"""Build one debug Gym bundle; reject stale or modified bundles before reuse."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/g1'))
from build import build


def source_fingerprint():
    """Hash actual Git-listed inputs, including unstaged, staged and new files.

    Conservative: docs/tool changes also invalidate. Ignored artifacts do not.
    Record only the aggregate digest, never source/secret contents or a path list.
    """
    digest = hashlib.sha256()
    digest.update(subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT))
    paths = subprocess.check_output(
        ['git', 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], cwd=ROOT)
    for name in sorted(set(paths.split(b'\0')) - {b''}):
        path = ROOT / os.fsdecode(name)
        digest.update(name + b'\0')
        if path.is_symlink():
            raise RuntimeError('Source fingerprint does not support symlink inputs')
        if not path.exists():
            digest.update(b'deleted\0')
        else:
            digest.update(b'file\0' + hashlib.sha256(path.read_bytes()).digest())
    return digest.hexdigest()


def inventory(output):
    return {str(p.relative_to(output)): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in sorted(output.rglob('*')) if p.is_file() and p.name != 'bundle.json'}


def build_bundle(output, sha):
    output = Path(output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    if any(output.iterdir()):
        raise RuntimeError('Shared Gym output must be empty; stale bundles are not reusable')
    fingerprint = source_fingerprint()
    settings = output / 'gym.settings'
    settings.write_text(f'[project]\ndependencies =\n[rider]\nsource_sha = {sha}\nrun_id = shared-build\ngym_test =\n')
    build('wasm-web', output, settings, variant='debug')
    if len(list(output.rglob('index.html'))) != 1:
        raise RuntimeError('Expected exactly one shared Gym index')
    if source_fingerprint() != fingerprint:
        raise RuntimeError('Sources changed during the Gym build; rebuild from a stable working tree')
    report = {'source_sha': sha, 'source_fingerprint': fingerprint,
              'platform': 'wasm-web', 'variant': 'debug', 'files': inventory(output)}
    (output / 'bundle.json').write_text(json.dumps(report, indent=2) + '\n')


def verify_bundle(output, sha):
    output = Path(output).resolve()
    report = json.loads((output / 'bundle.json').read_text())
    if (report['source_sha'], report['platform'], report['variant']) != (sha, 'wasm-web', 'debug'):
        raise RuntimeError('Foreign source or non-debug Gym bundle')
    if report.get('source_fingerprint') != source_fingerprint():
        raise RuntimeError('Gym source inputs changed or lack a fingerprint; rebuild the bundle')
    if not report['files'] or inventory(output) != report['files']:
        raise RuntimeError('Shared Gym bundle changed after its build')
    return output


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    sha = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    build_bundle(args.output, sha)
