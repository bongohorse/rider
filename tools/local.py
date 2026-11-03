#!/usr/bin/env python3
"""Local-first Rider commands. No installations, pushes or CI policy changes.

Typical loop (#401): `check` while editing; `affected --run` before a push;
`gym --suite --jobs 3` for the whole Gym inventory of the required CI. GitHub `required`
remains the final gate and always runs everything.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor, wait
import fnmatch
from contextlib import contextmanager
import glob
import hashlib
from importlib.metadata import PackageNotFoundError, version
import json
import os
from pathlib import Path
import platform
import re
import shutil
import subprocess
import sys
import threading
import uuid

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools/gym'))
from bundle import build_bundle, source_fingerprint, verify_bundle
from build import approved_java, build_server, LOCK
from local_parity import collect
from project import execute, write_report
from run import stop
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


def gameplay_lua_blocker():
    """None when tools/gameplay/lua_tests.py can use the verified Bob without a download, else why not."""
    bob = ROOT / '.cache/g1/bob.jar'
    if not bob.is_file():
        return 'BLOCKED: no verified Bob at .cache/g1/bob.jar (a first build fetches it); gameplay Lua suites not run'
    with bob.open('rb') as source:
        if hashlib.file_digest(source, 'sha256').hexdigest() != LOCK['bob']['sha256']:
            return 'BLOCKED: .cache/g1/bob.jar does not match the pinned SHA-256; gameplay Lua suites not run'
    return None


def fast_check(output, sha):
    commands = [('bootstrap', [sys.executable, 'tools/bootstrap_check.py'], False),
                ('lint_lua', [sys.executable, 'tools/ci/lint_lua.py'], False)]
    for name in ('bootstrap', 'g1', 'g2', 'ci'):
        commands.append(('unit_' + name, [sys.executable, '-m', 'unittest', 'discover', '-s', 'tests/' + name, '-v'], True))
    # Persistence harness protocol checks; -B keeps __pycache__ out of the engine test project (as in CI).
    commands.append(('unit_engine_persistence', [sys.executable, '-B', '-m', 'unittest', 'discover', '-s',
                                                 'tests/engine/persistence', '-v'], True))
    node_tests = sorted(glob.glob(str(ROOT / 'tests/ci/*.cjs')) + glob.glob(str(ROOT / 'tests/mobile/*.cjs'))
                        + glob.glob(str(ROOT / 'tests/preview/*.test.cjs')))
    if not node_tests:
        raise RuntimeError('No Node test inventory found')
    commands.append(('node_ci_mobile_preview', ['node', '--test', *node_tests], False))
    tests = [execute(name, command, output, 180, units) for name, command, units in commands]
    # Gameplay Lua suites need the verified Bob's LuaJIT; without it they are reported, never omitted.
    blocker = gameplay_lua_blocker()
    if blocker:
        print(blocker)
        tests.append({'id': 'gameplay_lua', 'status': 'BLOCKED', 'duration_ms': 0, 'assertions': 0,
                      'detail': blocker, 'artifacts': []})
    else:
        tests.append(execute('gameplay_lua', [sys.executable, 'tools/gameplay/lua_tests.py'], output, 180))
    return write_report(output, 'local-check', tests, [c[0] for c in commands] + ['gameplay_lua'], sha)


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
    if subprocess.run(['git', 'rev-parse', '--verify', '--quiet', base + '^{commit}'], cwd=ROOT,
                      capture_output=True).returncode:
        raise RuntimeError(f'BLOCKED: base {base!r} is not a known commit; run `git fetch origin main` or pass --base')
    merge_base = subprocess.run(['git', 'merge-base', base, 'HEAD'], cwd=ROOT, check=True,
                                capture_output=True, text=True).stdout.strip()
    paths = set(lines('diff', '--no-renames', '--name-only', '-z', merge_base))
    paths |= set(lines('ls-files', '--others', '--exclude-standard', '-z'))
    return sorted(p for p in paths if p)


RESOURCE_PATH = re.compile(r"""['"](/[\w./-]+\.\w+)['"]""")
LUA_REQUIRE = re.compile(r"""\brequire\s*\(?\s*['"]([\w.]+)['"]""")
LUA_SOURCES = ('.lua', '.script', '.gui_script', '.render_script')


def bootstrap_closure():
    """Repository files every Gym case loads: the files game.project names (bootstrap collection,
    app manifest, HTML shell, custom resource files), every resource they reference by literal path
    (components, factories, proxies, GUI, atlases, sys.load_resource), and every Lua module reachable
    through require. A change to any of them can break every case."""
    project = (ROOT / 'game.project').read_text()
    found = re.search(r'^main_collection\s*=\s*/(\S+)', project, re.M)
    if not found:
        raise RuntimeError('No [bootstrap] main_collection in game.project')
    start = found[1] if (ROOT / found[1]).is_file() else found[1].removesuffix('c')  # .collectionc
    named = [ref.strip()[1:] for value in re.findall(r'^\w+\s*=\s*(/.*)$', project, re.M) for ref in value.split(',')]
    named = [ref if (ROOT / ref).is_file() else ref.removesuffix('c') for ref in named]
    seen, pending = set(), [start, *(ref for ref in named if (ROOT / ref).is_file())]
    while pending:
        rel = pending.pop()
        if rel in seen:
            continue
        seen.add(rel)
        try:
            text = (ROOT / rel).read_text(encoding='utf-8')
        except (UnicodeDecodeError, OSError):
            continue  # images, sounds and other binary leaves
        refs = [ref[1:] for ref in RESOURCE_PATH.findall(text)]
        if rel.endswith(LUA_SOURCES):
            refs += [module.replace('.', '/') + '.lua' for module in LUA_REQUIRE.findall(text)]
        pending += [ref for ref in refs if '..' not in ref.split('/') and (ROOT / ref).is_file()]
    if start not in seen or len(seen) < 2:
        raise RuntimeError(f'Bootstrap resource graph from {start} is empty')
    return seen


def affected_cases(paths, rules=None, inventory=None, closure=None):
    """Suggest Gym cases for changed paths: (cases, reasons, ci_only).

    Files every case loads and paths without a rule select the whole inventory (fail closed).
    Rules with "cases": "ci" name paths no local command covers; they are returned in ci_only
    so `affected --run` cannot report PASS for them."""
    rules = rules if rules is not None else json.loads((ROOT / 'tools/local_affected.json').read_text())
    inventory = inventory if inventory is not None else ci_gym_cases()
    closure = closure if closure is not None else bootstrap_closure()
    selected, reasons, ci_only = set(), {}, {}
    for path in paths:
        if is_docs_only([path]):
            continue
        matching = [r for r in rules['rules'] if any(fnmatch.fnmatchcase(path, g) for g in r['paths'])]
        ci_rule = next((r for r in matching if r['cases'] == 'ci' or r.get('also_ci')), None)
        if path in closure:
            rule = {'name': 'loaded by every Gym case (bootstrap resource/require graph)', 'cases': 'all'}
            if ci_rule:
                ci_only[path] = ci_rule['name']
        else:
            rule = matching[0] if matching else {'name': 'no rule: whole Gym inventory', 'cases': 'all'}
            if rule['cases'] == 'ci' or rule.get('also_ci'):
                ci_only[path] = rule['name']
        reasons[path] = rule['name']
        if rule['cases'] == 'ci':
            continue
        cases = inventory if rule['cases'] == 'all' else rule['cases']
        unknown = set(cases) - set(inventory)
        if unknown:
            raise RuntimeError(f'tools/local_affected.json names unknown Gym cases: {sorted(unknown)}')
        selected |= set(cases)
    return [case for case in inventory if case in selected], reasons, ci_only


class LiveProcesses:
    """Process trees of parallel Gym workers, so Ctrl-C in the main thread can stop them all."""

    def __init__(self):
        self.lock, self.processes, self.stopping = threading.Lock(), set(), False

    def started(self, process):
        with self.lock:
            if not self.stopping:
                self.processes.add(process)
                return
        stop(process)  # Interrupted while this worker was starting: never leave it running.

    def finished(self, processes):
        with self.lock:
            self.processes.difference_update(processes)

    def stop_all(self):
        with self.lock:
            self.stopping, processes = True, list(self.processes)
        for process in processes:
            stop(process)


def run_cases(run, cases, jobs):
    """run(case, live) for every case. One job runs inline, where Ctrl-C reaches execute's own cleanup."""
    if jobs <= 1 or len(cases) == 1:
        return [run(case, None) for case in cases]
    live = LiveProcesses()
    pool = ThreadPoolExecutor(max_workers=min(jobs, len(cases)))
    futures = [pool.submit(run, case, live) for case in cases]
    try:
        while wait(futures, timeout=0.5).not_done:
            pass  # Timed waits keep the main thread responsive to KeyboardInterrupt.
        return [future.result() for future in futures]
    except BaseException:
        for future in futures:
            future.cancel()
        live.stop_all()
        raise
    finally:
        pool.shutdown(wait=True, cancel_futures=True)


def gym_cases(cases, output, sha, server, fresh=False, jobs=1, evidence=None):
    """Build or verify one cached debug bundle, then run each case in its own isolated process.

    Logs and results.json go to output; each case's Gym evidence to <evidence>/<case>."""
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

    evidence = evidence or output / 'gym'

    def run(case, live):
        # Each case serves the bundle on an ephemeral port with a fresh browser and its own output.
        mine = []

        def started(process):
            mine.append(process)
            live.started(process)
        try:
            return execute('gym_' + case,
                           [sys.executable, 'tools/gym/smoke.py', '--bundle', str(cached),
                            '--case', case, '--output', str(evidence / case)], output, 720,
                           on_start=started if live else None)
        finally:
            if live:
                live.finished(mine)
    tests = run_cases(run, cases, jobs)
    if source_fingerprint() != fingerprint:
        for test in tests:
            test.update(status='FAIL', detail='Sources changed during the Gym run; repeat on a stable working tree')
    suite = 'local-gym-' + cases[0] if len(cases) == 1 else f'local-gym-{len(cases)}-cases'
    return write_report(output, suite, tests, [t['id'] for t in tests], sha)


def gym_case(case, output, sha, server, fresh=False):
    return gym_cases([case], output, sha, server, fresh)


HOOK_MARKER = '# rider-local-pre-push (#401)'
HOOK_OPT_IN = 'rider-pre-push'
HOOK = f"""#!/bin/sh
{HOOK_MARKER}
# Installed by `tools/local.py install-hook`. Git shares this hooks directory between worktrees,
# so it acts only where that worktree's git dir holds the {HOOK_OPT_IN} opt-in file.
# Skip once with `git push --no-verify`; remove with `tools/local.py install-hook --remove`.
cd "$(git rev-parse --show-toplevel)" || exit 1
[ -f "$(git rev-parse --absolute-git-dir)/{HOOK_OPT_IN}" ] || exit 0
# Worktrees share the main checkout's pinned .venv (docs/TOOLING.md#worktrees).
PY=python3
COMMON="$(cd "$(git rev-parse --git-common-dir)/.." && pwd)"
[ -x "$COMMON/.venv/bin/python" ] && PY="$COMMON/.venv/bin/python"
[ -x .venv/bin/python ] && PY=.venv/bin/python
[ -n "$RIDER_PYTHON" ] && PY="$RIDER_PYTHON"
exec "$PY" tools/local.py pre-push
"""


def git_dir(*args):
    path = Path(subprocess.check_output(['git', 'rev-parse', *args], cwd=ROOT, text=True).strip())
    return path if path.is_absolute() else ROOT / path


def install_hook(remove=False):
    """Opt this worktree in (or out). The shared hook file is a no-op in worktrees without opt-in."""
    hook = git_dir('--git-path', 'hooks') / 'pre-push'
    opt_in = git_dir('--absolute-git-dir') / HOOK_OPT_IN
    current = hook.read_text() if hook.exists() else None
    if current is not None and HOOK_MARKER not in current:
        raise RuntimeError(f'BLOCKED: {hook} exists and was not installed by Rider; not touching it')
    if remove:
        opt_in.unlink(missing_ok=True)
        common = git_dir('--git-common-dir')
        others = [common / HOOK_OPT_IN, *common.glob(f'worktrees/*/{HOOK_OPT_IN}')]
        if current is not None and not any(p.exists() for p in others):
            hook.unlink()
        print(json.dumps({'status': 'PASS', 'hook': str(hook), 'hook_file_kept': hook.exists(),
                          'active_in_this_worktree': False}))
        return 0
    hook.parent.mkdir(parents=True, exist_ok=True)
    if current != HOOK:
        hook.write_text(HOOK)
    hook.chmod(0o755)
    opt_in.write_text('Opt-in for the Rider pre-push hook (tools/local.py install-hook, #401)\n')
    print(json.dumps({'status': 'PASS', 'hook': str(hook), 'active_in_this_worktree': True,
                      'note': 'other worktrees stay unaffected until they run install-hook themselves'}))
    return 0


def pre_push_blocker(stdin_lines):
    """The hook can only verify the checked-out tree: block unless that is exactly what is pushed.

    stdin_lines are git's pre-push lines `<local ref> <local sha> <remote ref> <remote sha>`.
    Returns None (verify), 'nothing' (only deletions) or a BLOCKED message."""
    pushed = []
    for line in stdin_lines:
        if not line.strip():
            continue
        fields = line.split()
        if len(fields) != 4:
            return f'BLOCKED: unexpected pre-push input {line!r}'
        if set(fields[1]) != {'0'}:  # all zeros: a ref deletion, nothing to verify
            pushed.append(fields)
    if not pushed:
        return 'nothing'
    head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    for local_ref, local_sha, _, _ in pushed:
        commit = subprocess.run(['git', 'rev-parse', '--verify', '--quiet', local_sha + '^{commit}'], cwd=ROOT,
                                capture_output=True, text=True).stdout.strip()
        if commit != head:
            return (f'BLOCKED: pushing {local_ref} at {local_sha[:12]}, but this worktree has {head[:12]} checked out; '
                    'the hook verifies only the checked-out tree. Check out what you push, or skip with --no-verify.')
    if subprocess.check_output(['git', 'status', '--porcelain', '--untracked-files=normal'], cwd=ROOT, text=True).strip():
        return ('BLOCKED: uncommitted or untracked changes; the hook would verify files that are not pushed. '
                'Commit or stash them, or skip with --no-verify.')
    return None


def run_affected(args, output, sha, server):
    paths = changed_paths(args.base)
    cases, reasons, ci_only = affected_cases(paths)
    plan = {'base': args.base, 'changed_paths': paths, 'gym_cases': cases, 'reasons': reasons,
            'ci_only': sorted(ci_only),
            'note': 'Suggestion for local verification only; GitHub required runs every case.'}
    (output / 'affected.json').write_text(json.dumps(plan, indent=2) + '\n')
    print(json.dumps(plan, indent=2))
    if not args.run:
        return 0
    (output / 'check').mkdir()
    code = fast_check(output / 'check', sha)
    if code:
        return code
    if cases:
        require_build_host()
        (output / 'gym').mkdir()
        code = gym_cases(cases, output / 'gym', sha, server, jobs=args.jobs, evidence=output / 'gym')
        if code:
            return code
    if ci_only:
        print(json.dumps({'status': 'BLOCKED', 'detail': 'Local runs passed, but these changed paths have no '
                          'local runner; only GitHub required verifies them', 'ci_only': sorted(ci_only)}))
        return 2
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
    hook = sub.add_parser('install-hook', help='Opt this worktree into a pre-push hook that runs check')
    hook.add_argument('--remove', action='store_true')
    sub.add_parser('pre-push', help='Used by the installed hook: reads git pre-push refs on stdin, then runs check')
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
            if args.command == 'pre-push':
                blocker = pre_push_blocker(sys.stdin.read().splitlines())
                if blocker == 'nothing':
                    print(json.dumps({'status': 'PASS', 'detail': 'only ref deletions; nothing to verify'}))
                    return 0
                if blocker:
                    raise RuntimeError(blocker)
            if args.command in ('check', 'affected', 'pre-push'):
                mismatches = requirements_ready()
                if mismatches:
                    raise RuntimeError('BLOCKED: install pinned requirements-dev.txt in this interpreter; '
                                       + '; '.join(mismatches))
            if args.command in ('check', 'pre-push'):
                return fast_check(output, sha)
            if args.command == 'affected':
                return run_affected(args, output, sha, server)
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
    except KeyboardInterrupt:
        print(json.dumps({'status': 'FAIL', 'detail': 'Interrupted; started test processes were stopped',
                          'output': str(output)}))
        return 130
    except (OSError, ValueError, RuntimeError, subprocess.SubprocessError) as exc:
        blocked = isinstance(exc, OSError) or str(exc).startswith('BLOCKED:')
        print(json.dumps({'status': 'BLOCKED' if blocked else 'FAIL', 'detail': str(exc), 'output': str(output)}))
        return 2 if blocked else 1


if __name__ == '__main__':
    raise SystemExit(main())
