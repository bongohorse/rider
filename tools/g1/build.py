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


# Bob extender cache (#209). Bob keeps <root>/.internal/cache/<arch>/build.zip
# plus a shared .buildcache index (Java properties: zip path=sha256 key). It
# caches any 200 job result unchecked, so a bad result is reused on a cache
# hit. Before Bob runs, invalid zips are removed; after an engine-guard
# failure the platform's cache and build/<arch> results are removed. Any
# layout this code does not recognise clears the whole cache (costs a rebuild).
CACHE_INDEX = '.buildcache'
CACHE_ZIP = 'build.zip'
CACHE_KEY = re.compile(r'[0-9a-f]{64}')
PLATFORM_ARCHS = {'wasm-web': ('wasm-web', 'wasm_pthread-web'), 'arm64-android': ('arm64-android', 'armv7-android')}


def remove_inside(path, base, root):
    """Delete path only when it resolves inside base, itself strictly inside root."""
    root, base, target = Path(root).resolve(), Path(base).resolve(), Path(path).resolve()
    if base == root or not base.is_relative_to(root):
        raise RuntimeError(f'CACHE: refusing to delete outside the repository: base {base}')
    if not target.is_relative_to(base):
        raise RuntimeError(f'CACHE: refusing to delete {target}: not inside {base}')
    if target.is_dir():
        shutil.rmtree(target)
    elif target.exists():
        target.unlink()


def properties_key(text):
    return re.sub(r'\\u([0-9a-fA-F]{4})|\\(.)', lambda m: chr(int(m.group(1), 16)) if m.group(1)
                  else {'t': '\t', 'n': '\n', 'r': '\r', 'f': '\f'}.get(m.group(2), m.group(2)), text)


def read_cache_index(path):
    """{zip path: raw line}; ValueError for anything that is not Bob's format."""
    entries = {}
    for line in Path(path).read_bytes().decode('latin-1').splitlines():
        text = line.strip()
        if not text or text[0] in '#!':
            continue
        match = re.fullmatch(r'((?:[^\\=:]|\\.)+)[=:](.*)', text)
        if not match or not CACHE_KEY.fullmatch(match.group(2).strip()):
            raise ValueError(f'unparsable index line {line!r}')
        entries[properties_key(match.group(1))] = line
    return entries


def cached_zip_problem(path):
    """Why a cached extender result is unusable, or None."""
    try:
        with zipfile.ZipFile(path) as archive:
            corrupt = archive.testzip()
            entries = {info.filename: info for info in archive.infolist()}
    except Exception as exc:  # any read failure makes the cached result unusable
        return f'not a readable zip ({type(exc).__name__}: {exc})'
    if corrupt:
        return f'corrupt zip entry {corrupt}'
    if not any(EXTENDER_ENGINE.fullmatch(name) for name in entries):
        return 'no engine binary in the cached result'
    if 'log.txt' not in entries or entries['log.txt'].file_size == 0:
        return 'missing or empty log.txt in the cached result'
    return None


def drop_index_entries(cache, removed):
    """Remove index lines that point at removed cache directories."""
    index = cache / CACHE_INDEX
    if not index.is_file():
        return
    keep = [line for key, line in read_cache_index(index).items()
            if not any(Path(key).resolve().is_relative_to(r.resolve()) for r in removed)]
    temporary = index.with_name(CACHE_INDEX + '.rider-tmp')
    temporary.write_bytes(('\n'.join(keep) + '\n' if keep else '').encode('latin-1'))
    temporary.replace(index)


def clear_cache(root, cache, reason):
    remove_inside(cache, cache, root)
    return [{'path': cache.relative_to(root).as_posix(), 'reason': reason}]


def validate_cache(root):
    """Before Bob: remove cached extender results Bob would reuse unchecked."""
    root = Path(root)
    cache = root / '.internal' / 'cache'
    if not cache.is_dir():
        return []
    index = cache / CACHE_INDEX
    try:
        if index.exists():
            read_cache_index(index)
    except (OSError, ValueError) as exc:
        return clear_cache(root, cache, f'unreadable {CACHE_INDEX}: {exc}')
    invalid, removed = [], []
    for item in sorted(cache.iterdir()):
        if item.name == CACHE_INDEX:
            continue
        if item.is_symlink() or not item.is_dir() or [p.name for p in item.iterdir()] != [CACHE_ZIP]:
            return clear_cache(root, cache, f'unknown cache layout at {item.name}')
        problem = cached_zip_problem(item / CACHE_ZIP)
        if problem:
            remove_inside(item, cache, root)
            removed.append(item)
            invalid.append({'path': item.relative_to(root).as_posix(), 'reason': problem})
    if removed:
        drop_index_entries(cache, removed)
    return invalid


def invalidate_after_guard(root, platform, error):
    """After an engine-guard failure: drop the platform's cached and unpacked
    extender results so the next build cannot reuse them."""
    root = Path(root)
    cache, build_dir = root / '.internal' / 'cache', root / 'build'
    invalid, removed = [], []
    for arch in PLATFORM_ARCHS.get(platform, (platform,)):
        for base, target in [(cache, cache / arch), (build_dir, build_dir / arch)]:
            if target.exists() or target.is_symlink():
                remove_inside(target, base, root)
                removed.append(target)
                invalid.append({'path': target.relative_to(root).as_posix(), 'reason': f'engine guard failed: {error}'})
    if cache.is_dir():
        try:
            drop_index_entries(cache, [r for r in removed if r.parent == cache])
        except (OSError, ValueError) as exc:
            invalid += clear_cache(root, cache, f'unreadable {CACHE_INDEX}: {exc}')
    return invalid


def log_invalidations(log, invalidations):
    for item in invalidations:
        log.write(f'RIDER CACHE INVALIDATED {item["path"]}: {item["reason"]}\n')


def verify_engines(platform, output, root, started, bob, invalidations=()):
    """Fail closed unless every bundled engine is this build's extender result."""
    output, root = Path(output), Path(root)
    title = project_title(root)
    engines = bundled_engines(platform, output / title, title)
    archs = sorted({e[0] for e in engines})
    if platform not in archs:
        raise RuntimeError(f'ENGINE GUARD: {platform}: no {platform} engine in the bundle')
    report = {'platform': platform, 'status': 'PASS', 'cache_invalidations': list(invalidations), 'architectures': {}}
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
    invalidations = validate_cache(ROOT)
    started = build_started(ROOT)
    with (output / 'build.log').open('w') as log:
        log_invalidations(log, invalidations)
        log.flush()
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
    try:
        verify_engines(platform, output, ROOT, started, bob, invalidations)
    except RuntimeError as exc:
        cleaned = invalidate_after_guard(ROOT, platform, exc)
        with (output / 'build.log').open('a') as log:
            log_invalidations(log, cleaned)
        (output / 'engines.json').write_text(json.dumps({'platform': platform, 'status': 'FAIL', 'error': str(exc),
            'cache_invalidations': invalidations + cleaned}, indent=2) + '\n')
        raise
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
