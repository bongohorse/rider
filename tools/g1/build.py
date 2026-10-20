#!/usr/bin/env python3
"""Pinned Bob candidate build. Native engines are rebuilt for the manifest."""
import argparse
import hashlib
import json
import os
import re
import signal
from pathlib import Path
import shutil
import subprocess
import sys
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[2]
LOCK = json.loads((ROOT / 'tools/toolchain-lock.json').read_text())
BOB_SHA256 = LOCK['bob']['sha256']
JDK_BUILD = 'Temurin-' + LOCK['jdk']['build']


def approved_java(output):
    return re.search(re.escape(JDK_BUILD) + r"(?=[\s)])", output) is not None


def bob_jar():
    target = ROOT / '.cache/g1/bob.jar'
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists():
        request = urllib.request.Request(LOCK['bob']['url'], headers={'User-Agent': 'Rider-G1'})
        temporary = target.with_suffix('.download')
        with urllib.request.urlopen(request, timeout=180) as response, temporary.open('wb') as output:
            shutil.copyfileobj(response, output)
        temporary.replace(target)
    with target.open('rb') as source:
        digest = hashlib.file_digest(source, 'sha256').hexdigest()
    if digest != BOB_SHA256:
        raise RuntimeError('Bob SHA-256 mismatch; do not run unverified candidate')
    return target


# Engine guard (#208). Bob silently bundles a stock engine (Box2D v2, no app
# manifest) for an architecture whose extender result is missing from
# build/<arch>/. Every bundled engine must therefore be byte-identical to a
# fresh extender result of its architecture and must not be a stock engine.
EXTENDER_ENGINE = re.compile(r'(lib)?dmengine(_unstripped)?(\.exe|\.so|\.wasm|\.js)?')
STOCK_ENGINE = re.compile(r'(lib)?dmengine(_[a-z]+)?(\.exe|\.so|\.wasm|\.js)?')
ANDROID_ABIS = {'arm64-v8a': 'arm64-android', 'armeabi-v7a': 'armv7-android', 'x86_64': 'x86_64-android'}
EXTENDER_LINE = 'Using extender binary for WASM'
FRESHNESS_SLACK_S = 2
START_MARKER = '.engine-guard-start'
MODIFIED_HINT = ('If Bob now modifies the engine while bundling (for example a [windows] app_icon or '
                 'Android executable stripping), the guard needs an explicit rule; see engine pitfall 8.')


def sha256_stream(stream):
    return hashlib.file_digest(stream, 'sha256').hexdigest()


def sha256_file(path):
    with Path(path).open('rb') as source:
        return sha256_stream(source)


def project_title(root):
    section = None
    for line in (Path(root) / 'game.project').read_text().splitlines():
        line = line.strip()
        if line.startswith('['):
            section = line
        elif section == '[project]' and (match := re.fullmatch(r'title\s*=\s*(.+)', line)):
            return match.group(1).strip()
    raise RuntimeError('ENGINE GUARD: game.project has no [project] title')


def build_started(root):
    """Filesystem time of the build start: a marker in build/, so it shares the
    clock of the extender results even when that differs from time.time()."""
    marker = Path(root) / 'build' / START_MARKER
    marker.parent.mkdir(parents=True, exist_ok=True)
    marker.write_text(f'{os.getpid()}\n')
    return marker.stat().st_mtime


def bundled_engines(platform, bundle, title):
    """[(arch, label, sha256, extender name or None)] for every engine binary in
    this build's bundle directory (output/<title>)."""
    bundle = Path(bundle)
    if not bundle.is_dir():
        raise RuntimeError(f'ENGINE GUARD: {platform}: bundle directory {bundle} is missing')
    engines = []
    if platform == 'wasm-web':
        if not (bundle / 'index.html').is_file():
            raise RuntimeError(f'ENGINE GUARD: wasm-web: no index.html in {bundle}')
        for path in sorted(bundle.iterdir()):
            match = re.fullmatch(re.escape(title) + r'(_pthread)?(\.wasm|_wasm\.js)', path.name)
            if path.is_file() and match:
                arch = 'wasm_pthread-web' if match.group(1) else 'wasm-web'
                engines.append((arch, path.name, sha256_file(path), 'dmengine.wasm' if match.group(2) == '.wasm' else 'dmengine.js'))
        for arch in sorted({e[0] for e in engines}):
            parts = sorted(e[3] for e in engines if e[0] == arch)
            if parts != ['dmengine.js', 'dmengine.wasm']:
                raise RuntimeError(f'ENGINE GUARD: {arch}: the bundle must contain both the .wasm and the _wasm.js engine, got {parts}')
    elif platform.endswith('-android'):
        packages = list(bundle.glob('*.apk'))
        if len(packages) != 1:
            raise RuntimeError(f'ENGINE GUARD: {platform}: expected one APK, got {len(packages)}')
        with zipfile.ZipFile(packages[0]) as package:
            for name in sorted(package.namelist()):
                match = re.fullmatch(r'lib/([^/]+)/lib' + re.escape(title) + r'\.so', name)
                if match:
                    if match.group(1) not in ANDROID_ABIS:
                        raise RuntimeError(f'ENGINE GUARD: {platform}: unknown Android ABI in {name}')
                    with package.open(name) as entry:
                        engines.append((ANDROID_ABIS[match.group(1)], f'{packages[0].name}!{name}', sha256_stream(entry), None))
    else:
        name = title + {'x86_64-win32': '.exe', 'x86_64-linux': '.x86_64'}.get(platform, '')
        binary = bundle / name
        if not binary.is_file():
            raise RuntimeError(f'ENGINE GUARD: {platform}: no {name} in {bundle}')
        engines.append((platform, name, sha256_file(binary), None))
    return engines


def stock_engine_hashes(bob, arch):
    """SHA-256 of the stock engines shipped inside the verified Bob for arch.
    The stock pthread engine is not in Bob (Bob downloads it), so that case is
    covered by the extender identity check alone."""
    hashes = set()
    with zipfile.ZipFile(bob) as jar:
        for name in jar.namelist():
            folder, _, base = name.rpartition('/')
            if folder == f'libexec/{arch}' and STOCK_ENGINE.fullmatch(base):
                with jar.open(name) as entry:
                    hashes.add(sha256_stream(entry))
    return hashes


def verify_engines(platform, output, root, started, bob):
    """Fail closed unless every bundled engine is this build's extender result."""
    output, root = Path(output), Path(root)
    title = project_title(root)
    engines = bundled_engines(platform, output / title, title)
    archs = sorted({e[0] for e in engines})
    if platform not in archs:
        raise RuntimeError(f'ENGINE GUARD: {platform}: no {platform} engine in the bundle')
    report = {'platform': platform, 'architectures': {}}
    for arch in archs:
        directory = root / 'build' / arch
        log = directory / 'log.txt'
        for path, what in [(log, 'extender log'), (output / 'extender' / arch / 'log.txt', 'copied extender log')]:
            if not path.is_file() or path.stat().st_size == 0:
                raise RuntimeError(f'ENGINE GUARD: {arch}: {what} {path} is missing or empty')
        if log.stat().st_mtime < started - FRESHNESS_SLACK_S:
            raise RuntimeError(f'ENGINE GUARD: {arch}: extender log {log} is older than this build')
        results = {p.name: p for p in sorted(directory.iterdir()) if p.is_file() and EXTENDER_ENGINE.fullmatch(p.name)}
        if not results:
            raise RuntimeError(f'ENGINE GUARD: {arch}: no extender engine in {directory}; Bob bundled a fallback engine')
        stale = [name for name, p in results.items() if p.stat().st_mtime < started - FRESHNESS_SLACK_S]
        if stale:
            raise RuntimeError(f'ENGINE GUARD: {arch}: extender engine {stale} is older than this build')
        expected = {sha256_file(p): name for name, p in results.items()}
        stock = stock_engine_hashes(bob, arch)
        entries = []
        for _, label, digest, required in (e for e in engines if e[0] == arch):
            if digest in stock:
                raise RuntimeError(f'ENGINE GUARD: {arch}: bundled {label} is the stock Defold engine (sha256 {digest})')
            if digest not in expected or (required and expected[digest] != required):
                wanted = f'extender {required}' if required else 'extender engine'
                raise RuntimeError(f'ENGINE GUARD: {arch}: bundled {label} (sha256 {digest}) is not the {wanted} in {directory}. {MODIFIED_HINT}')
            entries.append({'bundled': label, 'extender': expected[digest], 'sha256': digest})
        report['architectures'][arch] = entries
    if platform == 'wasm-web':
        count = (output / 'build.log').read_text(errors='replace').count(EXTENDER_LINE)
        if count != len(archs):
            raise RuntimeError(f'ENGINE GUARD: wasm-web: Bob logged "{EXTENDER_LINE}" {count} times for {len(archs)} architectures {archs}')
        report['extender_lines'] = count
    (output / 'engines.json').write_text(json.dumps(report, indent=2) + '\n')
    return report


def build(platform, output, settings=None, variant=None):
    output = Path(output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    java = shutil.which('java')
    if not java:
        raise RuntimeError('BLOCKED: JDK 25 java not available')
    version = subprocess.run([java, '-version'], capture_output=True, text=True, timeout=15)
    if not approved_java(version.stdout + version.stderr):
        raise RuntimeError(f'BLOCKED: approved JDK is {JDK_BUILD}; selector must resolve to the locked build')
    bob = bob_jar()
    command = [java, '-jar', str(bob), '--platform', platform, '--variant', variant or ('debug' if platform == 'wasm-web' else 'headless'),
               '--archive', '--bundle-output', str(output)]
    if settings:
        command += ['--settings', str(Path(settings).resolve())]
    command += ['resolve', 'build', 'bundle']
    (output / 'toolchain.json').write_text(json.dumps({'java': version.stdout + version.stderr,
        'bob_sha256': BOB_SHA256, 'platform': platform, 'variant': variant or ('debug' if platform == 'wasm-web' else 'headless')}, indent=2))
    # This build's bundle and copied logs only; a reused output never mixes builds.
    for stale in [output / project_title(ROOT), output / 'extender']:
        if stale.exists():
            shutil.rmtree(stale)
    started = build_started(ROOT)
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
    verify_engines(platform, output, ROOT, started, bob)
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
