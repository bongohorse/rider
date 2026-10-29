#!/usr/bin/env python3
"""Local-first Rider commands. No installations, pushes or CI policy changes."""
import argparse
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


def fast_check(output, sha):
    commands = [('bootstrap', [sys.executable, 'tools/bootstrap_check.py'], False)]
    for name in ('bootstrap', 'g1', 'g2', 'ci'):
        commands.append(('unit_' + name, [sys.executable, '-m', 'unittest', 'discover', '-s', 'tests/' + name, '-v'], True))
    node_tests = sorted(glob.glob(str(ROOT / 'tests/ci/*.cjs')) + glob.glob(str(ROOT / 'tests/mobile/*.cjs')))
    if not node_tests:
        raise RuntimeError('No Node test inventory found')
    commands.append(('node_ci_mobile', ['node', '--test', *node_tests], False))
    tests = [execute(name, command, output, 180, units) for name, command, units in commands]
    return write_report(output, 'local-check', tests, [c[0] for c in commands], sha)


def gym_case(case, output, sha, server, fresh=False):
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
    test = execute('gym_' + case,
                   [sys.executable, 'tools/gym/smoke.py', '--bundle', str(cached),
                    '--case', case, '--output', str(output / 'gym')], output, 720)
    if source_fingerprint() != fingerprint:
        test.update(status='FAIL', detail='Sources changed during the Gym run; repeat on a stable working tree')
    return write_report(output, 'local-gym-' + case, [test], [test['id']], sha)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--server', default=LOCAL_SERVER, help='Loopback Extender URL; no public fallback')
    parser.add_argument('--output', type=Path, help='New evidence directory under artifacts/ or outside the checkout')
    sub = parser.add_subparsers(dest='command', required=True)
    sub.add_parser('doctor')
    sub.add_parser('check')
    gym = sub.add_parser('gym')
    gym.add_argument('--case', required=True, help='Existing Gym case, e.g. le6')
    gym.add_argument('--fresh', action='store_true', help='Build a new bundle even with unchanged sources')
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
            if args.command == 'check':
                mismatches = requirements_ready()
                if mismatches:
                    raise RuntimeError('BLOCKED: install pinned requirements-dev.txt in this interpreter; '
                                       + '; '.join(mismatches))
                return fast_check(output, sha)
            require_build_host()
            if args.command == 'gym':
                if not args.case.replace('-', '').isalnum():
                    raise RuntimeError('BLOCKED: invalid Gym case name')
                return gym_case(args.case, output, sha, server, args.fresh)
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
