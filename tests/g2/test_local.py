"""Local orchestration must propagate failures and reject unsupported builds."""
import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools'))
spec = importlib.util.spec_from_file_location('rider_local', ROOT / 'tools/local.py')
local = importlib.util.module_from_spec(spec)
spec.loader.exec_module(local)


class LocalCommandTest(unittest.TestCase):
    def test_check_keeps_all_failures_and_writes_nonzero_summary(self):
        def failure(name, *args):
            return {'id': name, 'status': 'FAIL' if name == 'unit_ci' else 'PASS',
                    'duration_ms': 1, 'assertions': 1, 'detail': '', 'artifacts': []}
        blocker = 'BLOCKED: no verified Bob at .cache/g1/bob.jar'
        for bob, count in ((False, 8), (True, 9)):
            with self.subTest(bob=bob), tempfile.TemporaryDirectory() as directory, \
                    mock.patch.object(local, 'gameplay_lua_blocker', return_value=None if bob else blocker), \
                    mock.patch.object(local, 'execute', side_effect=failure) as run:
                self.assertEqual(local.fast_check(Path(directory), 'fixture'), 1)
                self.assertEqual(run.call_count, count)
                names = [call.args[0] for call in run.call_args_list]
                for name in ('lint_lua', 'unit_engine_persistence', 'node_ci_mobile_preview'):
                    self.assertIn(name, names)
                self.assertEqual('gameplay_lua' in names, bob)
                node = next(call.args[1] for call in run.call_args_list if call.args[0] == 'node_ci_mobile_preview')
                self.assertTrue(any(arg.endswith('verification-plan.test.cjs') for arg in node))
                # Without Bob the gameplay Lua suites are reported BLOCKED, never silently omitted.
                report = json.loads((Path(directory) / 'results.json').read_text())
                lua = [t for t in report['tests'] if t['id'] == 'gameplay_lua']
                self.assertEqual(len(lua), 1)
                self.assertEqual(lua[0]['status'], 'PASS' if bob else 'BLOCKED')

    def test_missing_bob_blocks_only_the_gameplay_lua_entry(self):
        def passing(name, *args):
            return {'id': name, 'status': 'PASS', 'duration_ms': 1, 'assertions': 1, 'detail': '', 'artifacts': []}
        with tempfile.TemporaryDirectory() as directory, \
                mock.patch.object(local, 'gameplay_lua_blocker', return_value='BLOCKED: no Bob'), \
                mock.patch.object(local, 'execute', side_effect=passing):
            self.assertEqual(local.fast_check(Path(directory), 'fixture'), 2)

    def test_gameplay_lua_blocker_requires_the_pinned_bob(self):
        with tempfile.TemporaryDirectory() as directory, mock.patch.object(local, 'ROOT', Path(directory)):
            self.assertIn('no verified Bob', local.gameplay_lua_blocker())
            bob = Path(directory) / '.cache/g1/bob.jar'
            bob.parent.mkdir(parents=True)
            bob.write_bytes(b'not bob')
            self.assertIn('SHA-256', local.gameplay_lua_blocker())

    def test_local_default_overrides_inherited_server_and_no_public_url_is_allowed(self):
        with mock.patch.dict(os.environ, RIDER_BUILD_SERVER='https://build.defold.com'):
            self.assertEqual(local.local_server(local.LOCAL_SERVER), local.LOCAL_SERVER)
            with self.assertRaisesRegex(RuntimeError, 'BLOCKED'):
                local.local_server('https://build.defold.com')

    def test_arm_host_is_blocked_before_build(self):
        with mock.patch.object(local.platform, 'system', return_value='Linux'), \
                mock.patch.object(local.platform, 'machine', return_value='aarch64'):
            with self.assertRaisesRegex(RuntimeError, 'Oracle ARM64'):
                local.require_build_host()

    def test_overlapping_local_commands_are_refused_and_lock_is_released(self):
        with tempfile.TemporaryDirectory() as directory, mock.patch.object(local, 'ROOT', Path(directory)):
            with local.checkout_lock():
                with self.assertRaisesRegex(RuntimeError, 'another local command'):
                    with local.checkout_lock():
                        self.fail('Concurrent command acquired the lock')
            with local.checkout_lock():
                pass  # OS lock is reusable after the previous context closes.

    def test_fresh_build_does_not_corrupt_the_unchanged_reusable_bundle(self):
        import bundle
        built = []
        def fake_build(output, sha):
            built.append(output)
            output.mkdir(parents=True)
            (output / 'index.html').write_text('fixture')
            (output / 'bundle.json').write_text(json.dumps({
                'source_sha': sha, 'source_fingerprint': 'inputs', 'platform': 'wasm-web',
                'variant': 'debug', 'files': bundle.inventory(output)}))
        test = {'id': 'gym_le6', 'status': 'PASS', 'duration_ms': 1,
                'assertions': 1, 'detail': '', 'artifacts': []}
        with tempfile.TemporaryDirectory() as directory, mock.patch.object(local, 'ROOT', Path(directory)), \
                mock.patch.object(local, 'source_fingerprint', return_value='inputs'), \
                mock.patch.object(bundle, 'source_fingerprint', return_value='inputs'), \
                mock.patch.object(local, 'build_bundle', side_effect=fake_build), \
                mock.patch.object(local, 'execute', return_value=test):
            output = Path(directory) / 'results'
            output.mkdir()
            for fresh in (False, True, False):
                self.assertEqual(local.gym_case('le6', output, 'sha', local.LOCAL_SERVER, fresh), 0)
            self.assertEqual(len(built), 2)
            self.assertEqual(built[0].parent, built[1].parent)


if __name__ == '__main__':
    unittest.main()
