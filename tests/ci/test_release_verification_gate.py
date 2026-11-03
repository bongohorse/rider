"""Negative controls for the release matrix's fail-closed artifact gate."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/preview'))
from verify_artifacts import verify, gameplay_timing, GROUP_CASES, GAMEPLAY, GAMEPLAY_SHARDS, DESKTOP_SIZES, PHONE_SIZES

SHA = 'a' * 40
BUILD = '123456-1'


class ReleaseVerificationGate(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        for mode, expected in GROUP_CASES.items():
            directory = self.root / f'preview-verification-{mode}-{BUILD}' / mode
            self.write_case(directory, mode, expected)
        self.write_case(self.path('desktop-layout').parent / 'deployment',
                        'deployment', ('desktop', 'phone-emulation'))

    def path(self, mode):
        return self.root / f'preview-verification-{mode}-{BUILD}' / mode

    @staticmethod
    def save(path, record):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(record), encoding='utf-8')

    def write_case(self, directory, mode, expected):
        cases = [{'name': name, 'status': 'PASS'} for name in expected]
        phases = ['browser/launch', 'final-assertions', 'cleanup/global']
        screenshots = []
        if mode in GAMEPLAY_SHARDS:
            cases[0]['checks'] = list(GAMEPLAY_SHARDS[mode])
            phases += [gameplay_timing(x) for x in GAMEPLAY_SHARDS[mode]]
        if mode in ('desktop-layout', 'phone'):
            name = 'desktop' if mode == 'desktop-layout' else 'phone-emulation'
            sizes = DESKTOP_SIZES if mode == 'desktop-layout' else PHONE_SIZES
            cases[0]['responsive'] = [{'viewport': {'width': w, 'height': h},
                                        'sliders': 11, 'status': 'PASS'} for w, h in sizes]
            phases += [f'{name}/loader-ready', f'{name}/keyboard-driving',
                       f'{name}/quality/dpi-1', f'{name}/quality/dpi-0']
            phases += [f'{name}/{kind}/{w}x{h}' for w, h in sizes
                       for kind in ('sliders', 'presets')]
            screenshots += [f'{name}-{w}x{h}.png' for w, h in sizes]
            screenshots += [f'{name}-compact-hud.png', f'{name}.png']
        if mode == 'phone':
            phases += ['gameplay/check_mobile', 'gameplay/check_levels/phone',
                       'gameplay/check_objects_mobile']
        if mode in ('touch', 'stations'):
            scripts = ('mobile', 'tilt') if mode == 'touch' else (
                'ramps', 'steps', 'seams', 'gaps', 'balance', 'bumps', 'air')
            phases += [f'preview/{script}' for script in scripts]
        if mode == 'deployment':
            phases += ['desktop/loader-ready', 'phone-emulation/loader-ready']
            screenshots += ['desktop.png', 'phone-emulation.png']
        identity = {'source_sha': SHA, 'build_id': BUILD, 'mode': mode, 'status': 'PASS'}
        self.save(directory / 'result.json', {**identity, 'cases': cases})
        self.save(directory / 'timings.json', {**identity,
                  'cases': [{'name': name, 'status': 'PASS'} for name in phases]})
        for screenshot in screenshots:
            (directory / screenshot).touch()

    def mutate(self, mode, filename, change):
        file = self.path(mode) / filename
        record = json.loads(file.read_text(encoding='utf-8'))
        change(record)
        self.save(file, record)

    def test_complete_inventory_passes(self):
        verify(self.root, SHA, BUILD)

    def test_missing_group_fails(self):
        import shutil
        shutil.rmtree(self.path('desktop-gameplay-2').parent)
        with self.assertRaisesRegex(ValueError, 'group artifacts'):
            verify(self.root, SHA, BUILD)

    def test_duplicate_case_fails(self):
        self.mutate('stations', 'result.json',
                    lambda x: x['cases'].append(dict(x['cases'][0])))
        with self.assertRaisesRegex(ValueError, 'Missing/duplicate'):
            verify(self.root, SHA, BUILD)

    def test_wrong_source_or_build_fails(self):
        for field, value in [('source_sha', 'b' * 40), ('build_id', '456-1')]:
            with self.subTest(field=field):
                self.mutate('desktop-gameplay-1', 'timings.json',
                            lambda x: x.__setitem__(field, value))
                with self.assertRaisesRegex(ValueError, 'Wrong'):
                    verify(self.root, SHA, BUILD)
                self.mutate('desktop-gameplay-1', 'timings.json',
                            lambda x: x.__setitem__(field, SHA if field == 'source_sha' else BUILD))

    def test_failed_group_fails(self):
        self.mutate('desktop-gameplay-1', 'result.json',
                    lambda x: x.__setitem__('status', 'FAIL'))
        with self.assertRaisesRegex(ValueError, 'Failed'):
            verify(self.root, SHA, BUILD)

    def test_missing_artifact_fails(self):
        (self.path('phone') / 'timings.json').unlink()
        with self.assertRaisesRegex(ValueError, 'Missing artifact'):
            verify(self.root, SHA, BUILD)

    def test_missing_gameplay_check_fails(self):
        self.mutate('desktop-gameplay-1', 'timings.json',
                    lambda x: x['cases'].pop(3))
        with self.assertRaisesRegex(ValueError, 'Missing desktop gameplay'):
            verify(self.root, SHA, BUILD)

    def test_shards_cover_all_seven_modules_in_order(self):
        self.assertEqual([x for checks in GAMEPLAY_SHARDS.values() for x in checks], list(GAMEPLAY))
        self.assertEqual(len(GAMEPLAY), 7)

    def test_gameplay_module_in_wrong_shard_fails(self):
        self.mutate('desktop-gameplay-1', 'timings.json',
                    lambda x: x['cases'].append({'name': 'gameplay/check_progress', 'status': 'PASS'}))
        with self.assertRaisesRegex(ValueError, 'wrong shard'):
            verify(self.root, SHA, BUILD)

    def test_gameplay_shard_check_list_must_match(self):
        self.mutate('desktop-gameplay-2', 'result.json',
                    lambda x: x['cases'][0]['checks'].pop())
        with self.assertRaisesRegex(ValueError, 'reordered desktop gameplay checks'):
            verify(self.root, SHA, BUILD)

    def test_hidpi_layout_cannot_be_dropped(self):
        self.mutate('desktop-layout', 'result.json',
                    lambda x: x['cases'][0]['responsive'].pop(1))
        with self.assertRaisesRegex(ValueError, 'viewport inventory'):
            verify(self.root, SHA, BUILD)

    def test_missing_deployment_screenshot_fails(self):
        (self.path('desktop-layout').parent / 'deployment' / 'phone-emulation.png').unlink()
        with self.assertRaisesRegex(ValueError, 'Missing screenshot'):
            verify(self.root, SHA, BUILD)


class GameplayShardInventory(unittest.TestCase):
    """The Python gate and the JS verifier must agree on the shard split (#402)."""

    def test_python_shards_match_js_verification_plan(self):
        script = ("const p=require(process.argv[1]);"
                  "console.log(JSON.stringify({checks:p.DESKTOP_GAMEPLAY_CHECKS,shards:p.DESKTOP_GAMEPLAY_SHARDS}))")
        out = subprocess.run(['node', '-e', script, str(ROOT / 'tools/preview/verification-plan.cjs')],
                             check=True, capture_output=True, text=True).stdout
        js = json.loads(out)
        self.assertEqual(js['checks'], list(GAMEPLAY))
        self.assertEqual({k: list(v) for k, v in GAMEPLAY_SHARDS.items()}, js['shards'])

    def test_shards_cover_every_module_once_in_order(self):
        sharded = [check for checks in GAMEPLAY_SHARDS.values() for check in checks]
        self.assertEqual(sharded, list(GAMEPLAY))


if __name__ == '__main__':
    unittest.main()
