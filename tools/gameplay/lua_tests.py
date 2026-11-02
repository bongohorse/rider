#!/usr/bin/env python3
"""Run every tests/gameplay/*.lua suite with the pinned Bob LuaJIT (#395).

This is Bob's verified LuaJIT, not the Defold engine runtime (see #385).
Fails closed on no suites, a non-zero exit, a timeout or a missing PASS line.
"""
import argparse
import platform
import subprocess
import sys
import time
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SUITES = 'tests/gameplay'
TIMEOUT_S = 120
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
        temporary = target.with_suffix('.download')
        temporary.write_bytes(data)
        temporary.chmod(0o755)
        temporary.replace(target)
    return target


def discover(root):
    return sorted(p.relative_to(root).as_posix() for p in (root / SUITES).glob('*.lua'))


def run_suite(luajit, root, suite, timeout=TIMEOUT_S):
    """Return (ok, detail, seconds) for one suite run from the repository root."""
    started = time.monotonic()
    env = {'LUA_PATH': './?.lua', 'LUA_CPATH': '', 'PATH': '/usr/bin:/bin'}
    try:
        done = subprocess.run([str(luajit), '-joff', suite], cwd=root, env=env, capture_output=True,
                              text=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        return False, f'TIMEOUT after {timeout} s', time.monotonic() - started
    seconds = time.monotonic() - started
    output = (done.stdout + done.stderr).strip()
    passes = [line for line in done.stdout.splitlines() if line.startswith('PASS')]
    if done.returncode != 0:
        return False, f'exit {done.returncode}\n{output}', seconds
    if not passes:
        return False, f'no PASS line\n{output}', seconds
    return True, passes[-1], seconds


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
        sys.path.insert(0, str(ROOT / 'tools/g1'))
        import build
        luajit = luajit_from_bob(build.bob_jar(), ROOT / '.cache/g1/luajit')
    return run_all(luajit.resolve(), ROOT)


if __name__ == '__main__':
    sys.exit(main())
