"""Local-first selection, multi-case runs and the opt-in pre-push hook (#401)."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools'))
import local  # noqa: E402

RULES = json.loads((ROOT / 'tools/local_affected.json').read_text())


class AffectedTest(unittest.TestCase):
    def setUp(self):
        self.inventory = local.ci_gym_cases()

    def pick(self, *paths):
        return local.affected_cases(list(paths), RULES, self.inventory)[0]

    def test_inventory_matches_the_required_gym_matrix_once_per_case(self):
        self.assertEqual(len(self.inventory), len(set(self.inventory)))
        for case in ('a15', 'a18', 'le6', 'ea3', 'a22', 'a9invalid'):
            self.assertIn(case, self.inventory)

    def test_every_rule_names_only_existing_cases(self):
        for rule in RULES['rules']:
            if rule['cases'] != 'all':
                self.assertTrue(set(rule['cases']) <= set(self.inventory), rule['name'])

    def test_every_runner_named_by_a_rule_exists(self):
        for rule in RULES['rules']:
            for pattern in rule['paths']:
                if '*' not in pattern:
                    self.assertTrue((ROOT / pattern).exists(), pattern)

    def test_docs_only_selects_nothing_and_unknown_fails_closed(self):
        self.assertEqual(self.pick('docs/PLAN.md', 'STATUS.md'), [])
        self.assertEqual(self.pick('main/gym/vehicle.lua'), self.inventory)
        self.assertEqual(self.pick('docs/PLAN.md', 'game.project'), self.inventory)

    def test_specific_paths_select_their_cases(self):
        self.assertEqual(self.pick('tools/gym/ramps.cjs'), ['a16'])
        self.assertEqual(self.pick('main/gym/seam_trial.lua', 'tools/gym/gaps.cjs'),
                         [c for c in self.inventory if c in ('a18', 'a19')])
        self.assertIn('le6', self.pick('main/gym/editor.gui_script'))
        self.assertNotIn('a16', self.pick('main/gym/editor.gui_script'))
        self.assertEqual(self.pick('tests/ci/test_changes.py', '.luacheckrc'), [])
        self.assertEqual(self.pick('tools/gym/launch.cjs'), self.inventory)

    def test_unknown_case_in_rules_is_rejected(self):
        rules = {'rules': [{'name': 'bad', 'cases': ['nope'], 'paths': ['x/*']}]}
        with self.assertRaisesRegex(RuntimeError, 'unknown Gym cases'):
            local.affected_cases(['x/y'], rules, self.inventory)


class GymCasesTest(unittest.TestCase):
    def test_cases_share_one_bundle_and_get_separate_outputs(self):
        calls = []

        def fake_execute(test_id, command, output, timeout):
            calls.append((test_id, command[command.index('--output') + 1]))
            return {'id': test_id, 'status': 'PASS', 'duration_ms': 1, 'assertions': 1,
                    'detail': '', 'artifacts': []}
        with tempfile.TemporaryDirectory() as directory, \
                mock.patch.object(local, 'ROOT', Path(directory)), \
                mock.patch.object(local, 'source_fingerprint', return_value='inputs'), \
                mock.patch.object(local, 'build_bundle') as build, \
                mock.patch.object(local, 'execute', side_effect=fake_execute):
            output = Path(directory) / 'out'
            output.mkdir()
            self.assertEqual(local.gym_cases(['a15', 'le3', 'a16'], output, 'sha', local.LOCAL_SERVER, jobs=3), 0)
            build.assert_called_once()
            self.assertEqual(sorted(c[0] for c in calls), ['gym_a15', 'gym_a16', 'gym_le3'])
            self.assertEqual(len({c[1] for c in calls}), 3)
            report = json.loads((output / 'results.json').read_text())
            self.assertEqual(len(report['tests']), 3)

    def test_failure_in_one_case_fails_the_run(self):
        def fake_execute(test_id, *args):
            return {'id': test_id, 'status': 'FAIL' if test_id == 'gym_le3' else 'PASS',
                    'duration_ms': 1, 'assertions': 1, 'detail': '', 'artifacts': []}
        with tempfile.TemporaryDirectory() as directory, \
                mock.patch.object(local, 'ROOT', Path(directory)), \
                mock.patch.object(local, 'source_fingerprint', return_value='inputs'), \
                mock.patch.object(local, 'build_bundle'), \
                mock.patch.object(local, 'execute', side_effect=fake_execute):
            output = Path(directory) / 'out'
            output.mkdir()
            self.assertEqual(local.gym_cases(['a15', 'le3'], output, 'sha', local.LOCAL_SERVER, jobs=2), 1)

    def test_duplicate_invalid_and_empty_selections_are_blocked(self):
        for cases in ([], ['a15', 'a15'], ['a15;rm']):
            with self.assertRaisesRegex(RuntimeError, 'BLOCKED'):
                local.gym_cases(cases, Path('.'), 'sha', local.LOCAL_SERVER)


class HookTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.repo = Path(self.tmp.name)
        subprocess.run(['git', 'init', '-q', str(self.repo)], check=True)
        self.hook = self.repo / '.git/hooks/pre-push'

    def test_install_and_remove_own_hook(self):
        with mock.patch.object(local, 'ROOT', self.repo):
            self.assertEqual(local.install_hook(), 0)
            self.assertIn(local.HOOK_MARKER, self.hook.read_text())
            self.assertTrue(os.access(self.hook, os.X_OK))
            self.assertEqual(local.install_hook(), 0)  # idempotent
            self.assertEqual(local.install_hook(remove=True), 0)
            self.assertFalse(self.hook.exists())

    def test_foreign_hook_is_never_touched(self):
        self.hook.parent.mkdir(parents=True, exist_ok=True)
        self.hook.write_text('#!/bin/sh\necho mine\n')
        with mock.patch.object(local, 'ROOT', self.repo):
            for remove in (False, True):
                with self.assertRaisesRegex(RuntimeError, 'not installed by Rider'):
                    local.install_hook(remove)
        self.assertEqual(self.hook.read_text(), '#!/bin/sh\necho mine\n')

    def test_hook_runs_only_the_fast_check(self):
        self.assertIn('exec "$PY" tools/local.py check', local.HOOK)
        self.assertTrue(local.HOOK.startswith('#!/bin/sh\n'))


if __name__ == '__main__':
    unittest.main()
