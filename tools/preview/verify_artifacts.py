"""Fail-closed inventory and identity gate for every release verifier artifact.

Each matrix job uploads its own directory. Deployment is intentionally repeated
as a separate loader-only check, not a second desktop layout/gameplay case.
"""
import json
from collections import Counter
from pathlib import Path
import sys

GROUP_CASES = {
    'desktop-layout': ('desktop',),
    'desktop-gameplay': ('desktop-gameplay',),
    'phone': ('phone-emulation',),
    'touch': ('mobile-touch-emulation', 'tilt-injected-orientation'),
    'stations': ('ramps-release', 'steps-release', 'seams-release', 'gaps-release',
                 'balance-release', 'bumps-release', 'air-release'),
}
GAMEPLAY = ('check_run', 'check_gem_release', 'check_fuel_release',
            'check_levels', 'check_level_storage', 'check_objects', 'check_progress')
GAMEPLAY_TIMINGS = tuple('gameplay/' + ('check_levels/desktop' if x == 'check_levels' else x)
                         for x in GAMEPLAY)
DESKTOP_SIZES = ((1920, 1080), (2560, 1440), (1280, 720))
PHONE_SIZES = ((1080, 486), (486, 1080), (896, 400), (1080, 486))


def require(condition, message):
    if not condition:
        raise ValueError(message)


def load(path):
    require(path.is_file(), f'Missing artifact: {path}')
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except (ValueError, OSError) as error:
        raise ValueError(f'Invalid artifact {path}: {error}') from error


def check_identity(record, sha, build_id, mode, path):
    require(record.get('source_sha') == sha, f'Wrong source SHA in {path}')
    require(record.get('build_id') == build_id, f'Wrong build ID in {path}')
    require(record.get('mode') == mode, f'Wrong mode in {path}')
    require(record.get('status') == 'PASS', f'Failed or unfinished group in {path}')


def check_screenshots(directory, names):
    for name in names:
        require((directory / name).is_file(), f'Missing screenshot {directory / name}')


def check_group(directory, mode, expected, sha, build_id):
    result_path = directory / 'result.json'
    timing_path = directory / 'timings.json'
    result, timings = load(result_path), load(timing_path)
    check_identity(result, sha, build_id, mode, result_path)
    check_identity(timings, sha, build_id, mode, timing_path)
    cases = result.get('cases')
    require(isinstance(cases, list), f'Missing cases in {result_path}')
    names = [case.get('name') for case in cases]
    require(Counter(names) == Counter(expected), f'Missing/duplicate/unexpected cases in {result_path}: {names}')
    require(all(case.get('status') == 'PASS' for case in cases), f'Failed case in {result_path}')
    phases = timings.get('cases')
    require(isinstance(phases, list), f'Missing timing cases in {timing_path}')
    phase_names = [phase.get('name') for phase in phases]
    # The phone layout deliberately revisits 1080x486 after rotation. Those
    # two real slider/preset sweeps share phase names and must each run twice.
    duplicates = {name: count for name, count in Counter(phase_names).items() if count > 1}
    allowed = ({f'phone-emulation/{kind}/1080x486': 2 for kind in ('sliders', 'presets')}
               if mode == 'phone' else {})
    require(duplicates == allowed, f'Missing/duplicate timing phases in {timing_path}: {duplicates}')
    require(all(phase.get('status') == 'PASS' for phase in phases), f'Failed timing phase in {timing_path}')
    require({'browser/launch', 'final-assertions', 'cleanup/global'} <= set(phase_names),
            f'Missing verifier phases in {timing_path}')

    if mode == 'desktop-gameplay':
        require(cases[0].get('checks') == list(GAMEPLAY), 'Missing/reordered desktop gameplay checks')
        require(set(GAMEPLAY_TIMINGS) <= set(phase_names), 'Missing desktop gameplay module timing')
    if mode in ('desktop-layout', 'phone'):
        is_desktop = mode == 'desktop-layout'
        sizes = DESKTOP_SIZES if is_desktop else PHONE_SIZES
        name = 'desktop' if is_desktop else 'phone-emulation'
        responsive = cases[0].get('responsive')
        require(isinstance(responsive, list), f'Missing responsive results for {name}')
        actual = [(r['viewport']['width'], r['viewport']['height']) for r in responsive]
        require(actual == list(sizes), f'Wrong viewport inventory for {name}: {actual}')
        require(all(r.get('sliders') == 11 and r.get('status') == 'PASS' for r in responsive),
                f'Missing slider pairs for {name}')
        expected_phases = {f'{name}/loader-ready', f'{name}/keyboard-driving',
                           f'{name}/quality/dpi-1', f'{name}/quality/dpi-0'}
        expected_phases.update(f'{name}/{kind}/{w}x{h}'
                               for w, h in sizes for kind in ('sliders', 'presets'))
        require(expected_phases <= set(phase_names), f'Missing layout phases for {name}')
        check_screenshots(directory, [f'{name}-{w}x{h}.png' for w, h in sizes]
                          + [f'{name}-compact-hud.png', f'{name}.png'])
    if mode == 'phone':
        require({'gameplay/check_mobile', 'gameplay/check_levels/phone',
                 'gameplay/check_objects_mobile'} <= set(phase_names),
                'Missing phone gameplay checks')
    if mode in ('touch', 'stations'):
        scripts = ('mobile', 'tilt') if mode == 'touch' else (
            'ramps', 'steps', 'seams', 'gaps', 'balance', 'bumps', 'air')
        require({f'preview/{script}' for script in scripts} <= set(phase_names),
                f'Missing {mode} release phases')


def verify(root, sha, build_id):
    require(len(sha) == 40 and all(c in '0123456789abcdef' for c in sha), 'Invalid source SHA')
    require(build_id.count('-') == 1 and all(x.isdigit() for x in build_id.split('-')), 'Invalid build ID')
    require(root.is_dir(), f'Missing verification artifact directory: {root}')
    expected_dirs = {f'preview-verification-{mode}-{build_id}' for mode in GROUP_CASES}
    actual_dirs = {p.name for p in root.iterdir() if p.is_dir()}
    require(actual_dirs == expected_dirs, f'Missing/duplicate/unexpected group artifacts: {actual_dirs ^ expected_dirs}')
    all_cases = []
    for mode, expected in GROUP_CASES.items():
        directory = root / f'preview-verification-{mode}-{build_id}' / mode
        check_group(directory, mode, expected, sha, build_id)
        all_cases.extend(expected)
    require(len(all_cases) == len(set(all_cases)), 'Case assigned to multiple release groups')
    deployment = root / f'preview-verification-desktop-layout-{build_id}' / 'deployment'
    check_group(deployment, 'deployment', ('desktop', 'phone-emulation'), sha, build_id)
    check_screenshots(deployment, ['desktop.png', 'phone-emulation.png'])
    print(f'PASS: {len(GROUP_CASES)} release groups, {len(all_cases)} unique cases, '
          f'{len(GAMEPLAY)} desktop gameplay checks, deployment and source/build identity')


if __name__ == '__main__':
    try:
        verify(Path(sys.argv[1]), sys.argv[2], sys.argv[3])
    except (ValueError, IndexError) as error:
        print(f'FAIL: {error}', file=sys.stderr)
        sys.exit(1)
