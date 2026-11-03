#!/usr/bin/env python3
"""Run the SHA-256-pinned luacheck over every tracked Lua source (#400).

The binary is downloaded once into .cache/ci/ and re-verified on every run; a mismatching
cached file is a failure, never silently replaced. Exit 0 clean, 1 findings, 2 blocked.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import subprocess
import sys
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
LOCK = json.loads(Path(__file__).with_name('luacheck-lock.json').read_text())
DOWNLOAD_ATTEMPTS = 3
DOWNLOAD_BACKOFF_S = 2.0
LUA_SUFFIXES = ('.lua', '.script', '.gui_script', '.render_script', '.editor_script')


def host_key(system=None, machine=None):
    system = (system or platform.system()).lower()
    machine = (machine or platform.machine()).lower()
    arch = {'amd64': 'x86_64', 'x64': 'x86_64'}.get(machine, machine)
    return f'{system}-{arch}'


def binary_path(key):
    suffix = '.exe' if key.startswith('windows') else ''
    return ROOT / '.cache/ci' / f"luacheck-{LOCK['version']}{suffix}"


def download(url, attempts=DOWNLOAD_ATTEMPTS, sleep=time.sleep):
    """Fetch url; retry transient failures (HTTP 5xx, network errors, timeouts) only (#434).

    A 4xx answer is not retried. The caller still verifies the SHA-256 and fails closed.
    """
    request = urllib.request.Request(url, headers={'User-Agent': 'Rider-CI'})
    for attempt in range(1, attempts + 1):
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                return response.read()
        except urllib.error.HTTPError as exc:
            if exc.code < 500 or attempt == attempts:
                raise
            reason = f'HTTP {exc.code}'
        except (urllib.error.URLError, TimeoutError) as exc:
            if attempt == attempts:
                raise
            reason = str(exc)
        print(f'lint_lua: download attempt {attempt}/{attempts} failed ({reason}); retrying',
              file=sys.stderr)
        sleep(DOWNLOAD_BACKOFF_S * attempt)
    raise AssertionError('unreachable')


def ensure_binary(key=None):
    key = key or host_key()
    entry = LOCK['binaries'].get(key)
    if entry is None:
        raise RuntimeError(f'BLOCKED: no pinned luacheck binary for {key}')
    target = binary_path(key)
    if target.is_file():
        data = target.read_bytes()
        if hashlib.sha256(data).hexdigest() != entry['sha256']:
            raise RuntimeError(f'cached {target.name} SHA-256 mismatch; delete it to re-download')
    else:
        data = download(entry['url'])
        if hashlib.sha256(data).hexdigest() != entry['sha256']:
            raise RuntimeError('downloaded luacheck SHA-256 mismatch')
        target.parent.mkdir(parents=True, exist_ok=True)
        partial = target.with_name(target.name + '.partial')
        partial.write_bytes(data)
        os.replace(partial, target)
    target.chmod(0o755)
    return target


def tracked_lua_files():
    try:
        listed = subprocess.run(['git', 'ls-files', '-z'], cwd=ROOT, check=True, capture_output=True).stdout
    except (OSError, subprocess.CalledProcessError) as exc:
        raise RuntimeError(f'BLOCKED: git ls-files failed: {exc}') from exc
    files = [name for name in listed.decode().split('\0') if name.endswith(LUA_SUFFIXES)]
    if not files:
        raise RuntimeError('BLOCKED: no tracked Lua sources found')
    return sorted(files)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('files', nargs='*', help='Limit to these files (default: every tracked Lua source)')
    args = parser.parse_args(argv)
    try:
        binary = ensure_binary()
        files = args.files or tracked_lua_files()
    except (OSError, RuntimeError, subprocess.SubprocessError) as exc:
        print(f'lint_lua: {exc}', file=sys.stderr)
        return 2 if isinstance(exc, OSError) or str(exc).startswith('BLOCKED') else 1
    command = [str(binary), '--config', str(ROOT / '.luacheckrc'), '--codes', '--no-color',
               '--formatter', 'plain', '--no-cache', *files]
    try:
        result = subprocess.run(command, cwd=ROOT)
    except OSError as exc:
        print(f'lint_lua: BLOCKED: cannot run {binary.name}: {exc}', file=sys.stderr)
        return 2
    # luacheck: 0 clean, 1 warnings, 2 syntax errors, 3+ crashes. Any finding fails.
    if result.returncode == 0:
        print(f'lint_lua: PASS ({len(files)} files, luacheck {LOCK["version"]})')
        return 0
    print(f'lint_lua: FAIL (luacheck exit {result.returncode})', file=sys.stderr)
    return 1


if __name__ == '__main__':
    raise SystemExit(main())
