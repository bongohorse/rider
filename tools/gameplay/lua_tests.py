#!/usr/bin/env python3
"""Run every tests/gameplay/*.lua suite with the pinned Bob LuaJIT (#395).

This is Bob's verified LuaJIT, not the Defold engine runtime (see #385).
Fails closed on no suites, a non-zero exit, a timeout or a missing PASS line.
"""
import argparse
import os
import platform
import subprocess
import sys
import time
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/g1'))
from run import stop
SUITES = 'tests/gameplay'
TIMEOUT_S = 120
PASS_TOKEN = 'PASS '
HOSTS = {('Linux', 'x86_64'): 'x86_64-linux', ('Linux', 'aarch64'): 'arm64-linux',
         ('Darwin', 'x86_64'): 'x86_64-macos', ('Darwin', 'arm64'): 'arm64-macos'}


def luajit_from_bob(bob, target):
    """Extract the host LuaJIT from the verified Bob jar into target."""
    host = HOSTS.get((platform.system(), platform.machine()))
    if host is None:
        raise RuntimeError(f'BLOCKED: no pinned Bob LuaJIT for {platform.system()} {platform.machine()}')
    member = f'libexec/{host}/luajit-64'
    with zipfile.ZipFile(bob) as archive, archive.open(member) as source:
        data = source.read()
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists() or target.read_bytes() != data:
        temporary = target.with_name(f'{target.name}.{os.getpid()}.download')
        temporary.write_bytes(data)
        temporary.replace(target)
    target.chmod(0o755)
    return target


def discover(root):
    return sorted(p.relative_to(root).as_posix() for p in (root / SUITES).glob('*.lua'))


def verdict(returncode, stdout, stderr):
    """Return (ok, detail): exit 0 and a stdout line with the deliberate 'PASS ' token (#397)."""
    output = (stdout + stderr).strip()
    passes = [line for line in stdout.splitlines() if line.startswith(PASS_TOKEN)]
    if returncode != 0:
        return False, f'exit {returncode}\n{output}'
    if not passes:
        return False, f'no PASS line\n{output}'
    return True, passes[-1]


def run_suite(luajit, root, suite, timeout=TIMEOUT_S):
    """Return (ok, detail, seconds) for one suite run from the repository root."""
    started = time.monotonic()
    env = {'LUA_PATH': './?.lua', 'LUA_CPATH': '', 'PATH': '/usr/bin:/bin'}
    # Own session/process group so stop() kills and reaps the whole suite tree (#397).
    process = subprocess.Popen([str(luajit), '-joff', suite], cwd=root, env=env, stdout=subprocess.PIPE,
                               stderr=subprocess.PIPE, encoding='utf-8', errors='replace',
                               start_new_session=os.name != 'nt')
    try:
        try:
            stdout, stderr = process.communicate(timeout=timeout)
        except subprocess.TimeoutExpired:
            stdout = None
    finally:
        stop(process)
    seconds = time.monotonic() - started
    if stdout is None:
        process.communicate()
        return False, f'TIMEOUT after {timeout} s', seconds
    return (*verdict(process.returncode, stdout, stderr), seconds)


def run_all(luajit, root):
    suites = discover(root)
    if not suites:
        print(f'FAIL: no suites under {SUITES}')
        return 1
    print(f'{len(suites)} gameplay Lua suites with {luajit.name} -joff:')
    failed = []
    for suite in suites:
        ok, detail, seconds = run_suite(luajit, root, suite)
        print(f'  {"PASS" if ok else "FAIL"} {suite} ({seconds:.2f} s): {detail if ok else ""}')
        if not ok:
            failed.append(suite)
            print('    ' + detail.replace('\n', '\n    '))
    print(f'gameplay Lua: {len(suites) - len(failed)}/{len(suites)} PASS')
    return 1 if failed else 0


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--luajit', type=Path, help='LuaJIT executable (default: extract from the verified Bob jar)')
    args = parser.parse_args(argv)
    luajit = args.luajit
    if luajit is None:
        import build
        luajit = luajit_from_bob(build.bob_jar(), ROOT / '.cache/g1/luajit')
    return run_all(luajit.resolve(), ROOT)


if __name__ == '__main__':
    sys.exit(main())
