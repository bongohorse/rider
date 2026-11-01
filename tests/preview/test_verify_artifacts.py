"""Strict negative controls for the real release artifact gate (#363)."""
import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from tools.preview import verify_artifacts as gate

SHA = 'a' * 40
BUILD = '12345-1'
ORIGINAL = ('check_run', 'check_gem_release', 'check_fuel_release',
            'check_levels', 'check_level_storage', 'check_objects', 'check_progress')


class ReleaseArtifactGateTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def make_group(self, mode, expected=None):
        expected = expected or gate.GROUP_CASES[mode]
        directory = self.root / f'preview-verification-{mode}-{BUILD}' / mode
        directory.mkdir(parents=True, exist_ok=True)
        cases = [{'name': name, 'status': 'PASS'} for name in expected]
        phases = ['browser/launch', 'final-assertions', 'cleanup/global']
        if mode in gate.GAMEPLAY_SHARDS:
            cases[0]['checks'] = list(gate.GAMEPLAY_SHARDS[mode])
            phases += [gate.gameplay_timing(c) for c in gate.GAMEPLAY_SHARDS[mode]]
        if mode in ('desktop-layout', 'phone'):
            name = 'desktop' if mode == 'desktop-layout' else 'phone-emulation'
            sizes = gate.DESKTOP_SIZES if mode == 'desktop-layout' else gate.PHONE_SIZES
            cases[0]['responsive'] = [{'viewport': {'width': w, 'height': h},
                                        'sliders': 11, 'status': 'PASS'} for w, h in sizes]
            phases += [f'{name}/{phase}' for phase in
                       ('loader-ready', 'keyboard-driving', 'quality/dpi-1', 'quality/dpi-0')]
            phases += [f'{name}/{kind}/{w}x{h}' for w, h in sizes
                       for kind in ('sliders', 'presets')]
            for filename in [f'{name}-{w}x{h}.png' for w, h in sizes] + [
                    f'{name}-compact-hud.png', f'{name}.png']:
                (directory / filename).touch()
        if mode == 'phone':
            phases += ['gameplay/check_mobile', 'gameplay/check_levels/phone',
                       'gameplay/check_objects_mobile']
        if mode == 'touch':
            phases += ['preview/mobile', 'preview/tilt']
        if mode == 'stations':
            phases += [f'preview/{script}' for script in
                       ('ramps', 'steps', 'seams', 'gaps', 'balance', 'bumps', 'air')]
        self.write(directory / 'result.json', {
            'source_sha': SHA, 'build_id': BUILD, 'mode': mode,
            'status': 'PASS', 'cases': cases})
        self.write(directory / 'timings.json', {
            'source_sha': SHA, 'build_id': BUILD, 'mode': mode,
            'status': 'PASS', 'cases': [{'name': p, 'status': 'PASS'} for p in phases]})
        return directory

    @staticmethod
    def write(path, record):
        path.write_text(json.dumps(record), encoding='utf-8')

    def mutate(self, path, change):
        record = json.loads(path.read_text(encoding='utf-8'))
        change(record)
        self.write(path, record)

    def make_full_fixture(self):
        for mode in gate.GROUP_CASES:
            self.make_group(mode)
        deployment = self.root / f'preview-verification-desktop-layout-{BUILD}' / 'deployment'
        deployment.mkdir(exist_ok=True)
        for name in ('desktop.png', 'phone-emulation.png'):
            (deployment / name).touch()
        for filename in ('result.json', 'timings.json'):
            self.write(deployment / filename, {
                'source_sha': SHA, 'build_id': BUILD, 'mode': 'deployment',
                'status': 'PASS',
                'cases': ([{'name': n, 'status': 'PASS'} for n in
                           ('desktop', 'phone-emulation')] if filename == 'result.json' else
                          [{'name': n, 'status': 'PASS'} for n in
                           ('browser/launch', 'final-assertions', 'cleanup/global')])})

    def test_exact_frozen_inventory_and_two_shards(self):
        self.assertEqual(gate.GAMEPLAY, ORIGINAL)
        self.assertEqual(gate.GAMEPLAY_SHARDS['desktop-gameplay-a'],
                         ('check_run', 'check_progress'))
        self.assertEqual(gate.GAMEPLAY_SHARDS['desktop-gameplay-b'], ORIGINAL[1:6])
        self.assertEqual(len(gate.GROUP_CASES), 6)

    def test_manifest_negative_controls(self):
        base = {'checks': list(ORIGINAL), 'shards': {
            'desktop-gameplay-a': ['check_run', 'check_progress'],
            'desktop-gameplay-b': list(ORIGINAL[1:6])}}
        for mutate in (
            lambda x: x['shards']['desktop-gameplay-a'].pop(),
            lambda x: x['shards']['desktop-gameplay-b'].append('check_run'),
            lambda x: x['shards']['desktop-gameplay-b'].append('unknown'),
            lambda x: x['shards']['desktop-gameplay-a'].reverse(),
            lambda x: x['shards'].pop('desktop-gameplay-b'),
        ):
            bad = copy.deepcopy(base)
            mutate(bad)
            with self.subTest(bad=bad), self.assertRaises(ValueError):
                gate.validate_gameplay_manifest(bad)

    def test_six_groups_deployment_and_full_union_pass(self):
        self.make_full_fixture()
        gate.verify(self.root, SHA, BUILD)

    def test_fail_closed_missing_or_unexpected_group(self):
        self.make_full_fixture()
        (self.root / f'preview-verification-desktop-gameplay-b-{BUILD}').rename(
            self.root / 'unexpected')
        with self.assertRaisesRegex(ValueError, 'group artifacts'):
            gate.verify(self.root, SHA, BUILD)

    def test_fail_closed_module_results_and_timing(self):
        for variant in ('missing', 'duplicate', 'reordered', 'wrong-check',
                        'missing-phase', 'duplicate-phase', 'failed-phase',
                        'wrong-sha', 'wrong-build', 'failed-result'):
            with self.subTest(variant=variant):
                self.make_full_fixture()
                directory = self.root / f'preview-verification-desktop-gameplay-b-{BUILD}' / 'desktop-gameplay-b'
                result, timings = directory / 'result.json', directory / 'timings.json'
                if variant == 'missing':
                    self.mutate(result, lambda x: x['cases'][0]['checks'].pop())
                elif variant == 'duplicate':
                    self.mutate(result, lambda x: x['cases'][0]['checks'].append('check_levels'))
                elif variant == 'reordered':
                    self.mutate(result, lambda x: x['cases'][0]['checks'].reverse())
                elif variant == 'wrong-check':
                    self.mutate(result, lambda x: x['cases'][0]['checks'].__setitem__(0, 'unknown'))
                elif variant == 'missing-phase':
                    self.mutate(timings, lambda x: x['cases'].pop())
                elif variant == 'duplicate-phase':
                    self.mutate(timings, lambda x: x['cases'].append(
                        {'name': gate.gameplay_timing('check_levels'), 'status': 'PASS'}))
                elif variant == 'failed-phase':
                    self.mutate(timings, lambda x: x['cases'][-1].__setitem__('status', 'FAIL'))
                elif variant == 'wrong-sha':
                    self.mutate(timings, lambda x: x.__setitem__('source_sha', 'b' * 40))
                elif variant == 'wrong-build':
                    self.mutate(result, lambda x: x.__setitem__('build_id', '12345-2'))
                elif variant == 'failed-result':
                    self.mutate(result, lambda x: x['cases'][0].__setitem__('status', 'FAIL'))
                with self.assertRaises(ValueError):
                    gate.verify(self.root, SHA, BUILD)


if __name__ == '__main__':
    unittest.main()
