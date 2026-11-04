"""Local-first selection, multi-case runs and the opt-in pre-push hook (#401)."""
import fnmatch
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from unittest import mock

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools'))
import local  # noqa: E402

RULES = json.loads((ROOT / 'tools/local_affected.json').read_text(encoding='utf-8'))
CLOSURE = local.bootstrap_closure()
JS_REQUIRE = re.compile(r"""require\(\s*['"](\.{1,2}/[^'"]+)['"]\s*\)""")


def tracked(prefix=''):
    return subprocess.check_output(['git', 'ls-files', prefix], cwd=ROOT, text=True).split()


def js_closure(entry):
    """Repository files a Node runner loads through relative require()."""
    seen, pending = set(), [entry]
    while pending:
        rel = pending.pop()
        if rel in seen or not (ROOT / rel).is_file():
            continue
        seen.add(rel)
        for ref in JS_REQUIRE.findall((ROOT / rel).read_text(encoding='utf-8')):
            target = (ROOT / rel).parent / ref
            target = target if target.suffix in ('.cjs', '.js', '.json') else target.with_name(target.name + '.cjs')
            pending.append(str(target.resolve().relative_to(ROOT)))
    return seen


class AffectedTest(unittest.TestCase):
    def setUp(self):
        self.inventory = local.ci_gym_cases()

    def pick(self, *paths):
        return local.affected_cases(list(paths), RULES, self.inventory, CLOSURE)[0]

    def test_inventory_matches_the_required_gym_matrix_once_per_case(self):
        self.assertEqual(len(self.inventory), len(set(self.inventory)))
        for case in ('a15', 'a18', 'le6', 'ea3', 'a22', 'a9invalid'):
            self.assertIn(case, self.inventory)

    def test_every_rule_names_only_existing_cases(self):
        for rule in RULES['rules']:
            if rule['cases'] not in ('all', 'ci'):
                self.assertTrue(set(rule['cases']) <= set(self.inventory), rule['name'])

    def test_every_runner_named_by_a_rule_exists(self):
        for rule in RULES['rules']:
            for pattern in rule['paths']:
                if '*' not in pattern:
                    self.assertTrue((ROOT / pattern).exists(), pattern)

    def test_docs_only_selects_nothing_and_unknown_fails_closed(self):
        self.assertEqual(self.pick('docs/PLAN.md', 'STATUS.md'), [])
        self.assertEqual(self.pick('docs/PLAN.md', 'game.project'), self.inventory)
        self.assertEqual(self.pick('tools/unknown/new_tool.py'), self.inventory)

    def test_bootstrap_graph_follows_collections_resources_and_requires(self):
        for path in ('main/game/boot.script', 'main/game/controller.script', 'main/game/ui.gui_script',
                     'main/editor/editor.gui_script', 'main/game/time_scale.lua', 'main/game/seam_metrics.lua',
                     'main/game/replay.lua', 'main/game/history.lua', 'main/game/custom.lua', 'main/game/custom.js',
                     'main/game/mobile.js', 'main/editor/editor_ui.lua', 'main/terrain_perspective/look.lua'):
            self.assertIn(path, CLOSURE)
        self.assertNotIn('main/game/stations/ramps.json', CLOSURE)  # loaded per station id, not by literal path

    def test_every_module_every_case_loads_selects_the_whole_inventory(self):
        # Derived from the sources: a module newly required by boot/controller/ui/editor scripts
        # cannot stay behind a narrow rule.
        lua = [p for p in tracked('main') if p.endswith(local.LUA_SOURCES)]
        self.assertGreater(len([p for p in lua if p in CLOSURE]), 50)
        for path in sorted(CLOSURE):
            self.assertEqual(self.pick(path), self.inventory, path)
        for rule in RULES['rules']:
            if rule['cases'] != 'all':
                hits = [p for p in CLOSURE if any(fnmatch.fnmatchcase(p, g) for g in rule['paths'])]
                self.assertEqual(hits, [], f'narrow rule {rule["name"]!r} matches files every case loads')

    def test_every_runner_dependency_selects_the_cases_that_load_it(self):
        smoke = (ROOT / 'tools/gym/smoke.py').read_text(encoding='utf-8')
        runners = dict((case, runner) for runner, case in re.findall(r"'([\w.]+\.cjs)' if args\.case=='(\w+)'", smoke))
        self.assertGreater(len(runners), 20)
        for case in self.inventory:
            for path in js_closure('tools/gym/' + runners.get(case, 'browser.cjs')):
                self.assertIn(case, self.pick(path), f'{path} is loaded by {case}')

    def test_specific_paths_select_their_cases(self):
        self.assertEqual(self.pick('tools/gym/ramps.cjs'), ['a16'])
        self.assertEqual(self.pick('tools/gym/gaps.cjs'), ['a19'])
        self.assertEqual(self.pick('tools/gameplay/check_zoom_editor.cjs'), ['le6'])
        self.assertEqual(self.pick('tests/ci/test_changes.py', '.luacheckrc', 'tests/preview/timings.test.cjs'), [])
        self.assertEqual(self.pick('tools/gym/launch.cjs'), self.inventory)

    def test_paths_without_a_local_runner_are_reported_ci_only(self):
        paths = ['tools/preview/verify.cjs', 'tools/gameplay/check_levels.cjs', '.github/workflows/g1.yml',
                 'tests/engine/persistence/runner.script', 'tools/ramps.cjs.missing']
        cases, reasons, ci_only = local.affected_cases(paths, RULES, self.inventory, CLOSURE)
        self.assertEqual(sorted(ci_only), sorted(paths[:4]))
        self.assertEqual(cases, self.inventory)  # the unknown path still fails closed
        self.assertEqual(set(reasons), set(paths))
        self.assertEqual(local.affected_cases(['tests/engine/persistence/test_protocol.py'], RULES,
                                              self.inventory, CLOSURE)[2], {})

    def test_station_json_is_loaded_by_id_and_selects_every_case(self):
        # stations.lua loads /main/game/stations/<id>.json by id; editor, pause, struts, replay and
        # regress runners also open stations, so no station JSON may sit behind a narrow rule.
        stations = [p for p in tracked('main/game/stations') if p.endswith('.json')
                    and p not in ('main/game/stations/straight-test.json', 'main/game/stations/invalid-test.json')]
        self.assertGreater(len(stations), 5)
        for path in stations:
            self.assertEqual(self.pick(path), self.inventory, path)

    def test_browser_provisioning_is_ci_only_and_affected_run_is_blocked(self):
        from classify_changes import selection
        path = 'tools/ci/setup_playwright.cjs'
        self.assertEqual(selection([path]), 'full')
        cases, _, ci_only = local.affected_cases([path], RULES, self.inventory, CLOSURE)
        self.assertEqual(cases, [])
        self.assertIn(path, ci_only, 'Unit tests do not provision/probe the browser host')
        with tempfile.TemporaryDirectory() as directory, \
                mock.patch.object(local, 'changed_paths', return_value=[path]), \
                mock.patch.object(local, 'fast_check', return_value=0) as check, \
                mock.patch.object(local, 'gym_cases') as gym:
            args = type('Args', (), {'base': 'origin/main', 'run': True, 'jobs': 1})()
            self.assertEqual(local.run_affected(args, Path(directory), 'sha', local.LOCAL_SERVER), 2)
            check.assert_called_once()
            gym.assert_not_called()

    def test_g1_release_entry_paths_run_gym_and_still_block(self):
        for path in ('game.project', 'main/main.collection', 'main/controller.script', 'tools/g1/build.py',
                     'tools/project.py', 'main/g1/wheel.convexshape'):
            cases, _, ci_only = local.affected_cases([path], RULES, self.inventory, CLOSURE)
            self.assertEqual(cases, self.inventory, path)
            self.assertIn(path, ci_only, path)
        self.assertIn('main/g1/wheel.convexshape', CLOSURE)
        # Gym-only collections must not be flagged CI-only (fnmatch '*' crosses '/').
        for path in ('main/game/boot.collection', 'main/game/world.collection'):
            self.assertNotIn(path, local.affected_cases([path], RULES, self.inventory, CLOSURE)[2], path)

    def test_unknown_case_in_rules_is_rejected(self):
        rules = {'rules': [{'name': 'bad', 'cases': ['nope'], 'paths': ['x/*']}]}
        with self.assertRaisesRegex(RuntimeError, 'unknown Gym cases'):
            local.affected_cases(['x/y'], rules, self.inventory, CLOSURE)

    def test_missing_base_is_blocked(self):
        with self.assertRaisesRegex(RuntimeError, '^BLOCKED: base'):
            local.changed_paths('refs/heads/rider-no-such-base-401')


def passing(test_id, *args, **kwargs):
    return {'id': test_id, 'status': 'PASS', 'duration_ms': 1, 'assertions': 1, 'detail': '', 'artifacts': []}


class GymCasesTest(unittest.TestCase):
    def patched(self, directory, execute):
        stack = [mock.patch.object(local, 'ROOT', Path(directory)),
                 mock.patch.object(local, 'source_fingerprint', return_value='inputs'),
                 mock.patch.object(local, 'build_bundle'),
                 mock.patch.object(local, 'execute', side_effect=execute)]
        for patch in stack:
            patch.start()
            self.addCleanup(patch.stop)

    def test_cases_share_one_bundle_and_get_separate_outputs(self):
        calls = []

        def fake_execute(test_id, command, output, timeout, on_start=None):
            calls.append((test_id, command[command.index('--output') + 1], on_start))
            return passing(test_id)
        with tempfile.TemporaryDirectory() as directory:
            self.patched(directory, fake_execute)
            output = Path(directory) / 'out'
            output.mkdir()
            self.assertEqual(local.gym_cases(['a15', 'le3', 'a16'], output, 'sha', local.LOCAL_SERVER, jobs=3), 0)
            local.build_bundle.assert_called_once()
            self.assertEqual(sorted(c[0] for c in calls), ['gym_a15', 'gym_a16', 'gym_le3'])
            self.assertEqual({c[1] for c in calls}, {str(output / 'gym' / c) for c in ('a15', 'le3', 'a16')})
            self.assertTrue(all(c[2] for c in calls))  # parallel workers register their processes
            report = json.loads((output / 'results.json').read_text(encoding='utf-8'))
            self.assertEqual(len(report['tests']), 3)

    def test_single_job_runs_inline_and_evidence_dir_is_not_nested(self):
        threads = []

        def fake_execute(test_id, command, output, timeout, on_start=None):
            threads.append((threading.current_thread() is threading.main_thread(), on_start,
                            command[command.index('--output') + 1]))
            return passing(test_id)
        with tempfile.TemporaryDirectory() as directory:
            self.patched(directory, fake_execute)
            output = Path(directory) / 'gym'
            output.mkdir()
            self.assertEqual(local.gym_cases(['a15', 'le3'], output, 'sha', local.LOCAL_SERVER, evidence=output), 0)
            self.assertEqual(threads, [(True, None, str(output / 'a15')), (True, None, str(output / 'le3'))])

    def test_failure_in_one_case_fails_the_run(self):
        def fake_execute(test_id, *args, **kwargs):
            return dict(passing(test_id), status='FAIL' if test_id == 'gym_le3' else 'PASS')
        with tempfile.TemporaryDirectory() as directory:
            self.patched(directory, fake_execute)
            output = Path(directory) / 'out'
            output.mkdir()
            self.assertEqual(local.gym_cases(['a15', 'le3'], output, 'sha', local.LOCAL_SERVER, jobs=2), 1)

    def test_duplicate_invalid_and_empty_selections_are_blocked(self):
        for cases in ([], ['a15', 'a15'], ['a15;rm']):
            with self.assertRaisesRegex(RuntimeError, 'BLOCKED'):
                local.gym_cases(cases, Path('.'), 'sha', local.LOCAL_SERVER)

    @unittest.skipIf(os.name == 'nt', 'POSIX SIGINT and process groups')
    def test_ctrl_c_stops_every_running_case_promptly(self):
        real_execute = local.execute
        for jobs in (1, 2):
            started = []

            def slow_execute(test_id, command, output, timeout, on_start=None):
                def register(process):
                    started.append(process)
                    if on_start:
                        on_start(process)
                return real_execute(test_id, [sys.executable, '-c', 'import time; time.sleep(120)'],
                                    output, timeout, on_start=register)

            def interrupt(expected):
                deadline = time.monotonic() + 20
                while len(started) < expected and time.monotonic() < deadline:
                    time.sleep(0.05)
                os.kill(os.getpid(), signal.SIGINT)
            with self.subTest(jobs=jobs), tempfile.TemporaryDirectory() as directory:
                self.patched(directory, slow_execute)
                output = Path(directory) / 'out'
                output.mkdir()
                timer = threading.Thread(target=interrupt, args=(jobs,))
                begin = time.monotonic()
                timer.start()
                with self.assertRaises(KeyboardInterrupt):
                    local.gym_cases(['a15', 'le3'], output, 'sha', local.LOCAL_SERVER, jobs=jobs)
                timer.join()
                self.assertLess(time.monotonic() - begin, 30)
                self.assertEqual(len(started), jobs)  # the queued case never started
                for process in started:
                    self.assertIsNotNone(process.poll())


class HookTest(unittest.TestCase):
    def setUp(self):
        isolated = {'GIT_CONFIG_GLOBAL': os.devnull, 'GIT_CONFIG_NOSYSTEM': '1',
                    'GIT_AUTHOR_NAME': 't', 'GIT_AUTHOR_EMAIL': 't@example.invalid',
                    'GIT_COMMITTER_NAME': 't', 'GIT_COMMITTER_EMAIL': 't@example.invalid'}
        env = mock.patch.dict(os.environ, isolated)
        env.start()
        self.addCleanup(env.stop)
        for name in ('GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE'):
            os.environ.pop(name, None)
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.repo = Path(self.tmp.name) / 'main'
        self.git('init', '-q', str(self.repo), cwd=self.tmp.name)
        (self.repo / 'a.txt').write_text('a\n')
        self.git('add', 'a.txt')
        self.git('commit', '-q', '-m', 'a')
        self.hook = self.repo / '.git/hooks/pre-push'
        self.opt_in = self.repo / '.git' / local.HOOK_OPT_IN

    def git(self, *args, cwd=None):
        return subprocess.run(['git', *args], cwd=cwd or self.repo, check=True, capture_output=True,
                              text=True).stdout.strip()

    def run_hook(self, cwd):
        env = dict(os.environ, RIDER_PYTHON='false')  # `false` stands in for a failing check
        return subprocess.run(['sh', str(self.hook)], cwd=cwd, env=env, input='', capture_output=True).returncode

    def test_install_and_remove_own_hook(self):
        with mock.patch.object(local, 'ROOT', self.repo):
            self.assertEqual(local.install_hook(), 0)
            self.assertIn(local.HOOK_MARKER, self.hook.read_text(encoding='utf-8'))
            self.assertTrue(os.access(self.hook, os.X_OK))
            self.assertTrue(self.opt_in.is_file())
            self.assertEqual(local.install_hook(), 0)  # idempotent
            self.assertEqual(local.install_hook(remove=True), 0)
            self.assertFalse(self.hook.exists())
            self.assertFalse(self.opt_in.exists())

    def test_hook_acts_only_in_worktrees_that_opted_in(self):
        other = Path(self.tmp.name) / 'other'
        self.git('worktree', 'add', '-q', '-b', 'other', str(other))
        with mock.patch.object(local, 'ROOT', self.repo):
            local.install_hook()
        self.assertNotEqual(self.run_hook(self.repo), 0)  # opted in: runs the (failing) check
        self.assertEqual(self.run_hook(other), 0)  # shared hook file, but no opt-in: no-op
        with mock.patch.object(local, 'ROOT', other):
            local.install_hook()
            local.install_hook(remove=True)
        self.assertTrue(self.hook.exists())  # still used by the main worktree
        self.assertEqual(self.run_hook(other), 0)
        with mock.patch.object(local, 'ROOT', self.repo):
            local.install_hook(remove=True)
        self.assertFalse(self.hook.exists())

    def test_foreign_hook_is_never_touched(self):
        self.hook.parent.mkdir(parents=True, exist_ok=True)
        self.hook.write_text('#!/bin/sh\necho mine\n')
        with mock.patch.object(local, 'ROOT', self.repo):
            for remove in (False, True):
                with self.assertRaisesRegex(RuntimeError, 'not installed by Rider'):
                    local.install_hook(remove)
        self.assertEqual(self.hook.read_text(encoding='utf-8'), '#!/bin/sh\necho mine\n')
        self.assertFalse(self.opt_in.exists())

    def test_hook_runs_only_the_gated_fast_check(self):
        self.assertIn('exec "$PY" tools/local.py pre-push', local.HOOK)
        self.assertTrue(local.HOOK.startswith('#!/bin/sh\n'))

    def test_pre_push_verifies_only_a_clean_checked_out_head(self):
        head = self.git('rev-parse', 'HEAD')
        zero = '0' * 40
        with mock.patch.object(local, 'ROOT', self.repo):
            self.assertIsNone(local.pre_push_blocker([f'refs/heads/main {head} refs/heads/main {zero}']))
            self.assertEqual(local.pre_push_blocker([f'(delete) {zero} refs/heads/old {head}', '']), 'nothing')
            self.assertEqual(local.pre_push_blocker([]), 'nothing')
            self.assertRegex(local.pre_push_blocker(['garbage']), '^BLOCKED: unexpected')
            self.git('tag', '-a', '-m', 't', 'v1')
            tag = self.git('rev-parse', 'v1')
            self.assertIsNone(local.pre_push_blocker([f'refs/tags/v1 {tag} refs/tags/v1 {zero}']))
            (self.repo / 'b.txt').write_text('b\n')
            self.git('add', 'b.txt')
            self.git('commit', '-q', '-m', 'b')
            # Pushing an older commit than the checked-out one: the tree under test is not what is pushed.
            self.assertRegex(local.pre_push_blocker([f'refs/heads/x {head} refs/heads/x {zero}']),
                             '^BLOCKED: pushing refs/heads/x')
            new = self.git('rev-parse', 'HEAD')
            (self.repo / 'b.txt').write_text('dirty\n')
            self.assertRegex(local.pre_push_blocker([f'refs/heads/main {new} refs/heads/main {head}']),
                             '^BLOCKED: uncommitted')
            self.git('checkout', '-q', 'b.txt')
            (self.repo / 'new.txt').write_text('untracked\n')
            self.assertRegex(local.pre_push_blocker([f'refs/heads/main {new} refs/heads/main {head}']),
                             '^BLOCKED: uncommitted or untracked')


if __name__ == '__main__':
    unittest.main()
