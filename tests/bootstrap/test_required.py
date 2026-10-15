"""Exercise the actual required job script with failed/cancelled/skipped physics."""
import json
import os
from pathlib import Path
import subprocess
import sys
import unittest
import yaml

ROOT = Path(__file__).resolve().parents[2]

class RequiredCheck(unittest.TestCase):
    def test_dependency_results_fail_closed(self):
        workflow = yaml.load((ROOT / '.github/workflows/ci.yml').read_text(), Loader=yaml.BaseLoader)
        job = workflow['jobs']['required']
        self.assertEqual(job['if'], '${{ always() }}')
        self.assertEqual(set(job['needs']), {'bootstrap', 'renovate', 'physics', 'tooling', 'bridge'})
        for state in ['success', 'failure', 'cancelled', 'skipped']:
            with self.subTest(physics=state):
                needs = {name: {'result': 'success'} for name in job['needs']}
                needs['physics']['result'] = state
                result = subprocess.run([sys.executable, '-c', job['steps'][0]['run'].split("<<'PYTHON'\n", 1)[1].rsplit('\nPYTHON', 1)[0]],
                    env={**os.environ, 'RESULTS': json.dumps(needs)}, capture_output=True, text=True)
                self.assertEqual(result.returncode, 0 if state == 'success' else 1, result.stderr)

    def test_physics_runs_for_pr_and_main_via_reusable_workflows(self):
        workflow = yaml.load((ROOT / '.github/workflows/ci.yml').read_text(), Loader=yaml.BaseLoader)
        self.assertIn('pull_request', workflow['on'])
        self.assertIn('main', workflow['on']['push']['branches'])
        for job, name in [('physics', 'g1'), ('tooling', 'g2'), ('bridge', 'bridge')]:
            self.assertEqual(workflow['jobs'][job]['uses'], f'./.github/workflows/{name}.yml')
            called = yaml.load((ROOT / f'.github/workflows/{name}.yml').read_text(), Loader=yaml.BaseLoader)
            self.assertIn('workflow_call', called['on'])
