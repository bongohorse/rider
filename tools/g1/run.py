#!/usr/bin/env python3
"""Build and execute identical core assertions per platform/configuration."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import uuid
from build import ROOT, build
from protocol import Collector, PREFIX


def stop(process):
    if os.name == 'nt':
        subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'], capture_output=True, timeout=15)
    else:
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
    process.wait(timeout=15)


def native(directory, collector, run_id):
    name = 'RiderG1.exe' if os.name == 'nt' else 'RiderG1.x86_64'
    binaries = list(directory.rglob(name))
    if len(binaries) != 1:
        raise RuntimeError(f'Expected one {name}, got {binaries}')
    command = [str(binaries[0].resolve()), '--config=rider.run_id=' + run_id]
    with (directory / 'runtime.log').open('w', encoding='utf-8') as log:
        process = subprocess.Popen(command, cwd=binaries[0].parent, stdout=log, stderr=subprocess.STDOUT,
                                   start_new_session=os.name != 'nt')
        try:
            code = process.wait(timeout=60)
        finally:
            # Clean the process tree even after successful completion, if it remains.
            stop(process)
    lines = (directory / 'runtime.log').read_text(encoding='utf-8', errors='replace').splitlines()
    for line in lines:
        collector.feed(line)
    if code != 0:
        raise RuntimeError(f'Runtime exit {code}: ' + '\n'.join(lines[-20:]))


def browser(directory, collector):
    collector_file = directory / 'browser-lines.json'
    process = subprocess.Popen(['node', str(ROOT / 'tools/g1/browser.cjs'), str(directory), str(collector_file)], start_new_session=os.name != 'nt')
    try:
        code = process.wait(timeout=100)
    finally:
        stop(process)
    if code:
        raise RuntimeError('Browser runner failed; see browser log')
    for line in json.loads(collector_file.read_text()):
        collector.feed(line)


def run(platform, output, variant=None):
    source_sha = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    reports = []
    for scale, fps in [(0.01, 60), (0.02, 30)]:
        directory = Path(output).resolve() / f'scale-{scale}-fps-{fps}'
        directory.mkdir(parents=True, exist_ok=True)
        run_id = str(uuid.uuid4())
        settings_core = ('[project]\ndependencies =\n' if platform == 'wasm-web' else '') + f'[physics]\nscale = {scale}\n[display]\nupdate_frequency = {fps}\n'
        identity = (ROOT / 'game.project').read_bytes() + (ROOT / 'main/physics.appmanifest').read_bytes() + settings_core.encode()
        config_hash = hashlib.sha256(identity).hexdigest()
        settings = directory / 'runner.settings'
        settings.write_text(settings_core + f'[rider]\nrun_id = {run_id}\nsource_sha = {source_sha}\nconfig_hash = {config_hash}\n')
        collector = Collector(run_id, source_sha, config_hash)
        # Prove that a foreign completion cannot authorize this fresh run.
        collector.feed(PREFIX + json.dumps({'event': 'suite_end', 'run_id': 'stale-' + run_id, 'status': 'PASS'}))
        build(platform, directory, settings, variant=variant)
        if platform == 'wasm-web':
            browser(directory, collector)
        else:
            native(directory, collector, run_id)
        report = collector.finish()
        report.update(platform=platform, variant=variant or ('debug' if platform=='wasm-web' else 'headless'), render_target=fps, scale=scale)
        (directory / 'result.json').write_text(json.dumps(report, indent=2) + '\n')
        print(json.dumps(report), flush=True)
        reports.append(report)
    a, b = (x['cases'] for x in reports)
    if abs(a['units']['fall_30'] - b['units']['fall_30']) > 0.5:
        raise RuntimeError('Changed-scale probe mismatch > 0.5 engine units')
    ratios = [x['fixed_ticks']['ticks'] / x['fixed_ticks']['frames'] for x in (a, b)]
    if not (0.8 < ratios[0] < 1.3 and 1.6 < ratios[1] < 2.5):
        raise RuntimeError(f'Render/physics rates not separated: {ratios}')
    Path(output, 'comparison.json').write_text(json.dumps({'status': 'PASS', 'source_sha': source_sha,
        'scale_fall_delta': abs(a['units']['fall_30']-b['units']['fall_30']), 'ticks_per_frame': ratios}, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--platform', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--variant', choices=['debug','headless'])
    args = parser.parse_args()
    try:
        run(args.platform, args.output, args.variant)
    except Exception as exc:
        print('FAIL:', exc, file=sys.stderr)
        raise SystemExit(1)
