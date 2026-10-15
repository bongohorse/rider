#!/usr/bin/env python3
"""Pinned Bob candidate build. Native engines are rebuilt for the manifest."""
import argparse
import hashlib
import json
import os
import signal
from pathlib import Path
import shutil
import subprocess
import sys
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
BOB_SHA256 = '90da834167c21be956af2be5a2a64b2ee1e16ad980dfa99f35a6b26516958d0f'


def bob_jar():
    target = ROOT / '.cache/g1/bob.jar'
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists():
        request = urllib.request.Request('https://github.com/defold/defold/releases/download/1.14.0/bob.jar', headers={'User-Agent': 'Rider-G1'})
        temporary = target.with_suffix('.download')
        with urllib.request.urlopen(request, timeout=180) as response, temporary.open('wb') as output:
            shutil.copyfileobj(response, output)
        temporary.replace(target)
    with target.open('rb') as source:
        digest = hashlib.file_digest(source, 'sha256').hexdigest()
    if digest != BOB_SHA256:
        raise RuntimeError('Bob SHA-256 mismatch; do not run unverified candidate')
    return target


def build(platform, output, settings=None, variant=None):
    output = Path(output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    java = shutil.which('java')
    if not java:
        raise RuntimeError('BLOCKED: JDK 25 java not available')
    version = subprocess.run([java, '-version'], capture_output=True, text=True, timeout=15)
    if 'version "25' not in version.stdout + version.stderr:
        raise RuntimeError('BLOCKED: JDK 25 required; use the pinned CI toolchain')
    command = [java, '-jar', str(bob_jar()), '--platform', platform, '--variant', variant or ('debug' if platform == 'wasm-web' else 'headless'),
               '--archive', '--bundle-output', str(output)]
    if settings:
        command += ['--settings', str(Path(settings).resolve())]
    command += ['resolve', 'build', 'bundle']
    (output / 'toolchain.json').write_text(json.dumps({'java': version.stdout + version.stderr,
        'bob_sha256': BOB_SHA256, 'platform': platform, 'variant': variant or ('debug' if platform == 'wasm-web' else 'headless')}, indent=2))
    with (output / 'build.log').open('w') as log:
        process = subprocess.Popen(command, cwd=ROOT, stdout=log, stderr=subprocess.STDOUT, start_new_session=os.name != 'nt')
        try:
            code = process.wait(timeout=900)
        except subprocess.TimeoutExpired:
            if os.name == 'nt':
                subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'], capture_output=True, timeout=15)
            else:
                os.killpg(process.pid, signal.SIGKILL)
            process.wait(timeout=15)
            raise

    for source in (ROOT / 'build').rglob('log.txt'):
        destination = output / 'extender' / source.relative_to(ROOT / 'build')
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, destination)
        if code:
            print(source.read_text(errors='replace')[-18000:], file=sys.stderr)
    if code:
        print((output / 'build.log').read_text()[-18000:], file=sys.stderr)
        raise RuntimeError(f'Bob build failed: {platform}; see {output / "build.log"}')
    print(f'PASS build {platform}: {output}', flush=True)
    return output


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--platform', required=True, choices=['x86_64-linux', 'x86_64-win32', 'wasm-web', 'arm64-android'])
    parser.add_argument('--output', required=True)
    parser.add_argument('--settings')
    args = parser.parse_args()
    try:
        build(args.platform, args.output, args.settings)
    except (RuntimeError, OSError, subprocess.TimeoutExpired) as exc:
        print(str(exc), file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
