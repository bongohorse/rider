#!/usr/bin/env python3
"""Local-first Rider commands. No installations, pushes or CI policy changes.

Typical loop (#401): `check` (about 10 s) while editing; `affected --run` before a push;
`gym --suite --jobs 3` for the whole Gym inventory of the required CI. GitHub `required`
remains the final gate and always runs everything.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
import fnmatch
from contextlib import contextmanager
import glob
import hashlib
from importlib.metadata import PackageNotFoundError, version
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess
import sys
import uuid

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools/gym'))
from bundle import build_bundle, source_fingerprint, verify_bundle
from build import approved_java, build_server, LOCK
from local_parity import collect
from project import execute, write_report
sys.path.insert(0, str(ROOT / 'tools/ci'))
from classify_changes import is_docs_only

LOCAL_SERVER = 'http://127.0.0.1:9000'


def requirements_ready():
    mismatches = []
    for line in (ROOT / 'requirements-dev.txt').read_text().splitlines():
        if not line.strip() or line.lstrip().startswith('#'):
            continue
        name, expected = line.strip().split('==')
        try:
            actual = version(name)
        except PackageNotFoundError:
            actual = 'missing'
        if actual != expected:
            mismatches.append(f'{name}: need {expected}, found {actual}')
    return mismatches


@contextmanager
def checkout_lock():
    """Local commands share Bob's mutable build/cache directories; never overlap."""
    lock = ROOT / '.cache/local-command.lock'
    lock.parent.mkdir(parents=True, exist_ok=True)
    with lock.open('a+b') as handle:
        try:
            if os.name == 'nt':
                import msvcrt
                if handle.tell() == 0:
                    handle.write(b'0')
                    handle.flush()
                handle.seek(0)
                msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            raise RuntimeError('BLOCKED: another local command holds .cache/local-command.lock')
        yield
        # Closing the file releases the OS lock, also after exceptions/crashes.


def local_server(value):
    os.environ['RIDER_BUILD_SERVER'] = value
    return build_server()


def require_build_host():
    if platform.system() != 'Linux' or platform.machine().lower() not in ('x86_64', 'amd64'):
        raise RuntimeError('BLOCKED: this prepared build profile requires Linux x86-64 (WSL); '
                           'Oracle ARM64 build/runtime compatibility is not accepted')


def doctor(output):
    parity = collect()
    tools = {name: bool(shutil.which(name)) for name in ('git', 'java', 'node', 't3', 'codex', 'docker')}
    java = subprocess.run(['java', '-version'], capture_output=True, text=True, timeout=15) if tools['java'] else None
    jdk_ok = bool(java and java.returncode == 0 and approved_java(java.stdout + java.stderr))
    bob = ROOT / '.cache/g1/bob.jar'
    bob_ok = bob.is_file() and hashlib.sha256(bob.read_bytes()).hexdigest() == LOCK['bob']['sha256']
    build_host = platform.system() == 'Linux' and platform.machine().lower() in ('x86_64', 'amd64')
    dependencies = requirements_ready()
    ready = all(tools.values()) and jdk_ok and bob_ok and build_host and parity['status'] == 'MATCH' and not dependencies
    report = {'status': 'READY_FOR_HOST_CHECKS' if ready else 'BLOCKED',
              'architecture': platform.machine(), 'system': platform.system(), 'tools_present': tools,
              'exact_jdk': jdk_ok, 'verified_bob_present': bob_ok, 'build_host_profile': build_host,
              'python_dependency_mismatches': dependencies,
              'version_parity': parity, 'build_server': build_server(),
              'runtime_verified': False, 'not_checked': ['T3/provider login', 'Docker daemon and Compose',
                  'Extender availability, versions and SDK/container identities', 'browser WebGL/runtime',
                  'offline operation', 'physical device']}
    (output / 'doctor.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))
    return 0 if ready else 2


def gameplay_lua_available():
    return bool(os.environ.get('RIDER_BOB_JAR')) or (ROOT / '.cache/g1/bob.jar').is_file()


def fast_check(output, sha):
    commands = [('bootstrap', [sys.executable, 'tools/bootstrap_check.py'], False),
                ('lint_lua', [sys.executable, 'tools/ci/lint_lua.py'], False)]
    for name in ('bootstrap', 'g1', 'g2', 'ci'):
        commands.append(('unit_' + name, [sys.executable, '-m', 'unittest', 'discover', '-s', 'tests/' + name, '-v'], True))
    node_tests = sorted(glob.glob(str(ROOT / 'tests/ci/*.cjs')) + glob.glob(str(ROOT / 'tests/mobile/*.cjs')))
    if not node_tests:
        raise RuntimeError('No Node test inventory found')
    commands.append(('node_ci_mobile', ['node', '--test', *node_tests], False))
    # Gameplay Lua suites need the verified Bob's LuaJIT; include them wherever Bob is present.
    if gameplay_lua_available():
        commands.append(('gameplay_lua', [sys.executable, 'tools/gameplay/lua_tests.py'], False))
    tests = [execute(name, command, output, 180, units) for name, command, units in commands]
    return write_report(output, 'local-check', tests, [c[0] for c in commands], sha)


def ci_gym_cases():
    """Every Gym case of the required CI matrix, in matrix order (split cases run whole locally)."""
    import yaml
    workflow = yaml.load((ROOT / '.github/workflows/g1.yml').read_text(), Loader=yaml.BaseLoader)
    cases = []
    for group in workflow['jobs']['gym']['strategy']['matrix']['include']:
        for case in group['cases'].split():
            if case not in cases:
                cases.append(case)
    if not cases:
        raise RuntimeError('No Gym cases found in .github/workflows/g1.yml')
    return cases


def changed_paths(base='origin/main'):
    """Committed branch changes since the merge base plus staged, unstaged and untracked files."""
    def lines(*args):
        return subprocess.run(['git', *args], cwd=ROOT, check=True, capture_output=True, text=True).stdout.split('\0')
    merge_base = subprocess.run(['git', 'merge-base', base, 'HEAD'], cwd=ROOT, check=True,
                                capture_output=True, text=True).stdout.strip()
    paths = set(lines('diff', '--no-renames', '--name-only', '-z', merge_base))
    paths |= set(lines('ls-files', '--others', '--exclude-standard', '-z'))
    return sorted(p for p in paths if p)


def affected_cases(paths, rules=None, inventory=None):
    """Suggest Gym cases for changed paths. Unknown paths fail closed to the whole inventory."""
    rules = rules if rules is not None else json.loads((ROOT / 'tools/local_affected.json').read_text())
    inventory = inventory if inventory is not None else ci_gym_cases()
    selected, reasons = set(), {}
    for path in paths:
        if is_docs_only([path]):
            continue
        rule = next((r for r in rules['rules'] if any(fnmatch.fnmatchcase(path, g) for g in r['paths'])), None)
        if rule is None:
            return list(inventory), {path: 'no rule: whole Gym inventory'}
        cases = inventory if rule['cases'] == 'all' else rule['cases']
        unknown = set(cases) - set(inventory)
        if unknown:
            raise RuntimeError(f'tools/local_affected.json names unknown Gym cases: {sorted(unknown)}')
        selected |= set(cases)
        reasons[path] = rule['name']
    return [case for case in inventory if case in selected], reasons


def gym_cases(cases, output, sha, server, fresh=False, jobs=1):
    """Build or verify one cached debug bundle, then run each case in its own isolated process."""
    if not cases:
        raise RuntimeError('BLOCKED: no Gym case selected')
    for case in cases:
        if not case.replace('-', '').isalnum():
            raise RuntimeError(f'BLOCKED: invalid Gym case name {case!r}')
    if len(set(cases)) != len(cases):
        raise RuntimeError('BLOCKED: duplicate Gym case')
    # Cache only within this checkout; never use a different server's candidate.
    server_key = hashlib.sha256(server.encode()).hexdigest()[:12]
    fingerprint = source_fingerprint()
    cached = ROOT / 'artifacts/local/bundles' / server_key / fingerprint
    if fresh:
        cached = cached.with_name(cached.name + '-' + str(uuid.uuid4()))
    if cached.exists():
        verify_bundle(cached, sha)  # Modified/incomplete caches fail; never mask corruption.
    else:
        build_bundle(cached, sha)

    def run(case):
        # Each case serves the bundle on an ephemeral port with a fresh browser and its own output.
        return execute('gym_' + case,
                       [sys.executable, 'tools/gym/smoke.py', '--bundle', str(cached),
                        '--case', case, '--output', str(output / 'gym' / case)], output, 720)
    with ThreadPoolExecutor(max_workers=max(1, jobs)) as pool:
        tests = list(pool.map(run, cases))
    if source_fingerprint() != fingerprint:
        for test in tests:
            test.update(status='FAIL', detail='Sources changed during the Gym run; repeat on a stable working tree')
    suite = 'local-gym-' + cases[0] if len(cases) == 1 else f'local-gym-{len(cases)}-cases'
    return write_report(output, suite, tests, [t['id'] for t in tests], sha)


def gym_case(case, output, sha, server, fresh=False):
    return gym_cases([case], output, sha, server, fresh)


HOOK_MARKER = '# rider-local-pre-push (#401)'
HOOK = f"""#!/bin/sh
{HOOK_MARKER}
# Installed by `tools/local.py install-hook`. Runs the ~10 s local check before every push.
# Skip once with `git push --no-verify`; remove with `tools/local.py install-hook --remove`.
cd "$(git rev-parse --show-toplevel)" || exit 1
# Worktrees share the main checkout's pinned .venv (docs/TOOLING.md#worktrees).
PY=python3
COMMON="$(cd "$(git rev-parse --git-common-dir)/.." && pwd)"
[ -x "$COMMON/.venv/bin/python" ] && PY="$COMMON/.venv/bin/python"
[ -x .venv/bin/python ] && PY=.venv/bin/python
[ -n "$RIDER_PYTHON" ] && PY="$RIDER_PYTHON"
exec "$PY" tools/local.py check
"""


def install_hook(remove=False):
    hooks = Path(subprocess.check_output(['git', 'rev-parse', '--git-path', 'hooks'], cwd=ROOT, text=True).strip())
    hook = (hooks if hooks.is_absolute() else ROOT / hooks) / 'pre-push'
    current = hook.read_text() if hook.exists() else None
    if current is not None and HOOK_MARKER not in current:
        raise RuntimeError(f'BLOCKED: {hook} exists and was not installed by Rider; not touching it')
    if remove:
        if current is not None:
            hook.unlink()
        print(json.dumps({'status': 'PASS', 'hook': str(hook), 'installed': False}))
        return 0
    hook.parent.mkdir(parents=True, exist_ok=True)
    hook.write_text(HOOK)
    hook.chmod(0o755)
    print(json.dumps({'status': 'PASS', 'hook': str(hook), 'installed': True,
                      'note': 'shared by every worktree of this repository'}))
    return 0


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--server', default=LOCAL_SERVER, help='Loopback Extender URL; no public fallback')
    parser.add_argument('--output', type=Path, help='New evidence directory under artifacts/ or outside the checkout')
    sub = parser.add_subparsers(dest='command', required=True)
    sub.add_parser('doctor')
    sub.add_parser('check')
    gym = sub.add_parser('gym')
    selection = gym.add_mutually_exclusive_group(required=True)
    selection.add_argument('--case', help='Gym case(s), comma separated, e.g. le6 or a15,le3')
    selection.add_argument('--suite', action='store_true', help='Every Gym case of the required CI matrix')
    gym.add_argument('--fresh', action='store_true', help='Build a new bundle even with unchanged sources')
    gym.add_argument('--jobs', type=int, default=1, help='Cases in parallel (each its own browser); default 1')
    affected = sub.add_parser('affected', help='Suggest (and with --run, run) the Gym cases for changed files')
    affected.add_argument('--base', default='origin/main', help='Compare against the merge base with this ref')
    affected.add_argument('--run', action='store_true', help='Run check, then the suggested Gym cases')
    affected.add_argument('--jobs', type=int, default=1, help='Gym cases in parallel; default 1')
    hook = sub.add_parser('install-hook', help='Install an opt-in pre-push hook that runs check')
    hook.add_argument('--remove', action='store_true')
    build = sub.add_parser('build')
    build.add_argument('--target', choices=('html5', 'desktop', 'android'), default='html5')
    build.add_argument('--configuration', choices=('debug', 'release'), default='debug')
    verify = sub.add_parser('physics')
    verify.add_argument('--target', choices=('html5', 'desktop'), default='html5')
    args = parser.parse_args(argv)
    output = (args.output or ROOT / 'artifacts/local/runs' / str(uuid.uuid4())).resolve()
    try:
        if output.is_relative_to(ROOT) and not output.is_relative_to(ROOT / 'artifacts'):
            raise RuntimeError('BLOCKED: keep local evidence under artifacts/ or outside the checkout')
        output.mkdir(parents=True, exist_ok=True)
        if any(output.iterdir()):
            raise RuntimeError('BLOCKED: choose a new, empty evidence directory')
        server = local_server(args.server)
        sha = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
        with checkout_lock():
            if args.command == 'doctor':
                return doctor(output)
            if args.command == 'install-hook':
                return install_hook(args.remove)
            if args.command in ('check', 'affected'):
                mismatches = requirements_ready()
                if mismatches:
                    raise RuntimeError('BLOCKED: install pinned requirements-dev.txt in this interpreter; '
                                       + '; '.join(mismatches))
            if args.command == 'check':
                return fast_check(output, sha)
            if args.command == 'affected':
                paths = changed_paths(args.base)
                cases, reasons = affected_cases(paths)
                plan = {'base': args.base, 'changed_paths': paths, 'gym_cases': cases, 'reasons': reasons,
                        'note': 'Suggestion for local verification only; GitHub required runs every case.'}
                (output / 'affected.json').write_text(json.dumps(plan, indent=2) + '\n')
                print(json.dumps(plan, indent=2))
                if not args.run:
                    return 0
                (output / 'check').mkdir()
                code = fast_check(output / 'check', sha)
                if code or not cases:
                    return code
                require_build_host()
                (output / 'gym').mkdir()
                return gym_cases(cases, output / 'gym', sha, server, jobs=args.jobs)
            require_build_host()
            if args.command == 'gym':
                cases = ci_gym_cases() if args.suite else [c.strip() for c in args.case.split(',') if c.strip()]
                return gym_cases(cases, output, sha, server, args.fresh, args.jobs)
            if args.command == 'physics':
                command = [sys.executable, 'tools/project.py', 'verify', '--suite', 'physics', '--target', args.target]
            else:
                command = [sys.executable, 'tools/project.py', 'build', '--target', args.target,
                           '--configuration', args.configuration]
            test = execute(args.command, command + ['--output', str(output / 'evidence')], output, 2200)
            return write_report(output, 'local-' + args.command, [test], [args.command], sha)
    except (OSError, ValueError, RuntimeError, subprocess.SubprocessError) as exc:
        blocked = isinstance(exc, OSError) or str(exc).startswith('BLOCKED:')
        print(json.dumps({'status': 'BLOCKED' if blocked else 'FAIL', 'detail': str(exc), 'output': str(output)}))
        return 2 if blocked else 1


if __name__ == '__main__':
    raise SystemExit(main())
