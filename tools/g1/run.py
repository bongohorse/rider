#!/usr/bin/env python3
"""Build and execute identical core assertions per platform/configuration."""
import argparse
from contextlib import ExitStack
import hashlib
import json
import os
from pathlib import Path
import signal
import shutil
import tempfile
import time
import subprocess
import sys
import uuid
from build import ROOT, build
from protocol import Collector, PREFIX


def process_snapshot():
    """Local PID -> (parent PID, state), including nested PID namespaces."""
    if sys.platform.startswith('linux'):
        namespace=os.readlink('/proc/self/ns/pid')
        records={}
        for path in Path('/proc').iterdir():
            if not path.name.isdigit():continue
            try:
                if os.readlink(path/'ns/pid')!=namespace:continue
                fields=dict(line.split(':',1) for line in (path/'status').read_text().splitlines() if ':' in line)
                local=int(fields.get('NSpid',fields['Pid']).split()[-1])
                records[int(fields['Pid'])]=(local,int(fields['PPid']),fields['State'].strip()[0])
            except (OSError,ValueError,KeyError):continue
        return {local:(records[parent][0] if parent in records else -1,state) for local,parent,state in records.values()}
    rows=subprocess.check_output(['ps','-eo','pid=,ppid=,stat='],text=True,timeout=5)
    return {int(parts[0]):(int(parts[1]),parts[2]) for line in rows.splitlines() if (parts:=line.split())}


def stop(process):
    if os.name == 'nt':
        subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'], capture_output=True, timeout=15)
        process.wait(timeout=15)
        return
    groups={process.pid}
    snapshot=process_snapshot()
    children={}
    for pid,(parent,state) in snapshot.items():children.setdefault(parent,[]).append(pid)
    pending=[process.pid];seen=set()
    while pending:
        pid=pending.pop()
        if pid in seen:continue
        seen.add(pid);pending.extend(children.get(pid,[]))
        try:groups.add(os.getpgid(pid))
        except ProcessLookupError:pass
    for group in groups:
        if group==os.getpgrp():continue
        try:os.killpg(group,signal.SIGKILL)
        except ProcessLookupError:pass
    process.wait(timeout=15)
    deadline=time.monotonic()+5
    while True:
        states=process_snapshot()
        alive=[pid for pid in seen if pid!=process.pid and pid in states and not states[pid][1].startswith('Z')]
        if not alive:break
        if time.monotonic()>=deadline:raise RuntimeError(f'Child cleanup incomplete: {alive}')
        time.sleep(0.02)


def native(directory, collector, run_id):
    name = 'RiderG1.exe' if os.name == 'nt' else 'RiderG1.x86_64'
    binaries = list(directory.rglob(name))
    if len(binaries) != 1:
        raise RuntimeError(f'Expected one {name}, got {binaries}')
    with ExitStack() as cleanup:
        executable=binaries[0].resolve()
        mesa=os.environ.get('RIDER_MESA_DIR')
        if os.name=='nt' and mesa:
            # Per-process software driver in a disposable copy. The archived
            # stock Rider bundle never contains Mesa DLLs.
            temporary=Path(cleanup.enter_context(tempfile.TemporaryDirectory(prefix='rider-native-')))
            bundle=temporary/'bundle'
            shutil.copytree(executable.parent,bundle)
            dlls=list(Path(mesa).glob('*.dll'))
            if not any(x.name.lower()=='opengl32.dll' for x in dlls):raise RuntimeError('Missing software OpenGL driver')
            for dll in dlls:shutil.copyfile(dll,bundle/dll.name)
            executable=bundle/executable.name
            lock=json.loads((ROOT/'tools/ci-graphics-lock.json').read_text())
            (directory/'graphics-runtime.json').write_text(json.dumps(dict(lock,driver='llvmpipe',deployment='temporary per-process copy'),indent=2))
        command = [str(executable), '--config=rider.run_id=' + run_id]
        with (directory / 'runtime.log').open('w', encoding='utf-8') as log:
            process = subprocess.Popen(command, cwd=executable.parent, stdout=log, stderr=subprocess.STDOUT,
                                       env=dict(os.environ,GALLIUM_DRIVER='llvmpipe') if mesa else None,
                                       start_new_session=os.name != 'nt')
            try:
                code = process.wait(timeout=60)
            finally:
                stop(process)
    lines = (directory / 'runtime.log').read_text(encoding='utf-8', errors='replace').splitlines()
    for line in lines:
        collector.feed(line)
    if code != 0:
        raise RuntimeError(f'Runtime exit {code}: ' + '\n'.join(lines[-20:]))


# HTML5 players run (#215): the same bundle once more without COOP/COEP, so the
# browser loads the wasm-web engine that GitHub Pages serves to players.
PLAYERS_MODE = 'players'
PLAYERS_DIR = 'wasm-web'


def browser(directory, collector, mode=None, out=None):
    collector_file = (out or directory) / 'browser-lines.json'
    command = ['node', str(ROOT / 'tools/g1/browser.cjs'), str(directory), str(collector_file)]
    if mode:
        command += [mode, str(out or directory)]
    process = subprocess.Popen(command, start_new_session=os.name != 'nt')
    try:
        code = process.wait(timeout=100)
    finally:
        stop(process)
    if code:
        raise RuntimeError('Browser runner failed; see browser log')
    for line in json.loads(collector_file.read_text()):
        collector.feed(line)


def players(directory, run_id, source_sha, config_hash, variant, fps, scale):
    """Run the already built bundle as players load it; same assertions."""
    out = directory / PLAYERS_DIR
    out.mkdir(parents=True, exist_ok=True)
    collector = Collector(run_id, source_sha, config_hash)
    collector.feed(PREFIX + json.dumps({'event': 'suite_end', 'run_id': 'stale-' + run_id, 'status': 'PASS'}))
    browser(directory, collector, PLAYERS_MODE, out)
    report = collector.finish()
    load = json.loads((out / 'engine-load.json').read_text())
    if load.get('mode') != PLAYERS_MODE or load.get('wasm') != ['RiderG1.wasm'] or load.get('cross_origin_isolated') is not False:
        raise RuntimeError(f'Players run did not load the wasm-web engine: {load}')
    report.update(platform='wasm-web', variant=variant or 'debug', render_target=fps, scale=scale, engine_load=load)
    (out / 'result.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report), flush=True)
    return report


def compare_reports(output, reports, source_sha, platform):
    """Persist both successful and failed cross-configuration G1 comparisons."""
    first, second = reports
    cases = [report['cases'] for report in reports]
    values = [case['units']['fall_30'] for case in cases]
    delta = abs(values[0] - values[1])
    threshold = 0.5
    ratios = []
    for case in cases:
        ticks = case.get('fixed_ticks', {})
        frames = ticks.get('frames')
        ratios.append(ticks['ticks'] / frames if frames else None)

    configurations = []
    for report, value, ratio in zip(reports, values, ratios):
        config = {key: report[key] for key in
                  ('platform', 'variant', 'scale', 'render_target', 'run_id', 'config_hash')
                  if key in report}
        config.update(fall_30=value, ticks_per_frame=ratio)
        configurations.append(config)

    error = None
    if delta > threshold:
        error = (f'Changed-scale probe mismatch > {threshold} engine units: '
                 f'scale={first["scale"]} fps={first["render_target"]} fall_30={values[0]}, '
                 f'scale={second["scale"]} fps={second["render_target"]} fall_30={values[1]}, '
                 f'abs_delta={delta}')
    elif not (ratios[0] is not None and ratios[1] is not None
              and 0.8 < ratios[0] < 1.3 and 1.6 < ratios[1] < 2.5):
        error = f'Render/physics rates not separated: {ratios}'

    comparison = {'status': 'FAIL' if error else 'PASS', 'source_sha': source_sha,
                  'platform': platform, 'configurations': configurations,
                  'scale_fall_delta': delta, 'scale_fall_threshold': threshold,
                  'ticks_per_frame': ratios}
    if error:
        comparison['error'] = error
    Path(output, 'comparison.json').write_text(json.dumps(comparison, indent=2) + '\n')
    if error:
        raise RuntimeError(error)
    return comparison


def run(platform, output, variant=None):
    source_sha = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    reports = []
    for scale, fps in [(0.01, 60), (0.02, 30)]:
        directory = Path(output).resolve() / f'scale-{scale}-fps-{fps}'
        directory.mkdir(parents=True, exist_ok=True)
        run_id = str(uuid.uuid4())
        settings_core = '[bootstrap]\nmain_collection = /main/main.collectionc\n' + ('[project]\ndependencies =\n' if platform == 'wasm-web' else '') + f'[physics]\nscale = {scale}\n[display]\nupdate_frequency = {fps}\n'
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
        if platform == 'wasm-web':
            players(directory, run_id, source_sha, config_hash, variant, fps, scale)
    compare_reports(output, reports, source_sha, platform)


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
