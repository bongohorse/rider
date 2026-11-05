"""Fail-closed behavior of the material lifecycle orchestrator (#515)."""
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('material_lifecycle', ROOT / 'tools/terrain_play/material_lifecycle.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class Orchestrator(unittest.TestCase):
    def run_main(self, change=lambda case, result: result):
        sha = 'a' * 40

        def execute(case, command, out, timeout):
            variant, route = case.split('-')
            result = {'source_sha': sha, 'variant': variant, 'route': route, 'status': 'PASS', 'engine': module.ENGINE,
                      'cycles': 8, 'browser': 'b', 'summary': {'per_switch': []},
                      'loads': [{'lifecycle': None, 'webgl': {'live': 1, 'contexts': [{'renderer': 'r'}], 'uniform_histogram': {'16': 1}}}]}
            result = change(case, result)
            if result is not None:
                (out / case).mkdir()
                (out / case / 'results.json').write_text(json.dumps(result))
            return {'id': case, 'status': 'PASS', 'artifacts': []}

        captured = {}

        def report(out, suite, tests, expected, source):
            captured.update({t['id']: t['status'] for t in tests})
            (out / 'results.json').write_text('{}')
            return 0

        with tempfile.TemporaryDirectory() as temp:
            argv = ['x', temp + '/d', temp + '/r', temp + '/o']
            with mock.patch.object(sys, 'argv', argv), mock.patch.object(module, 'verify'), \
                    mock.patch.object(module.subprocess, 'check_output', return_value=sha + '\n'), \
                    mock.patch.object(module, 'execute', execute), mock.patch.object(module, 'write_report', report):
                module.main()
        return captured

    def test_complete_inventory_passes(self):
        self.assertEqual(set(self.run_main().values()), {'PASS'})
        self.assertEqual(set(self.run_main()), set(module.EXPECTED))

    def test_foreign_or_missing_results_and_renderer_change_fail(self):
        def foreign(case, r):
            return {**r, 'source_sha': 'b' * 40} if case == 'debug-textured' else r

        def missing(case, r):
            return None if case == 'release-legacy' else r

        def renderer(case, r):
            if case == 'debug-textured':
                r['loads'][0]['webgl']['contexts'] = [{'renderer': 'other'}]
            return r
        self.assertEqual(self.run_main(foreign)['debug-textured'], 'FAIL')
        self.assertEqual(self.run_main(foreign)['evidence-integrity'], 'FAIL')
        self.assertEqual(self.run_main(missing)['release-legacy'], 'FAIL')
        self.assertEqual(self.run_main(renderer)['evidence-integrity'], 'FAIL')


if __name__ == '__main__':
    unittest.main()
