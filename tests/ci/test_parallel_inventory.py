"""A matrix edit must not silently drop or duplicate a previously required case."""
from collections import Counter
from pathlib import Path
import re
import unittest
import yaml

ROOT = Path(__file__).resolve().parents[2]


class ParallelInventory(unittest.TestCase):
    def test_every_debug_case_runs_in_exactly_one_group(self):
        workflow = yaml.load((ROOT / '.github/workflows/g1.yml').read_text(), Loader=yaml.BaseLoader)
        job = workflow['jobs']['gym']
        expected = set('a15 le1a le1b le2 a16 a17 a18 a19 a3 a6 coast a15a hud a7 a8 m2feedback a9 a9invalid a10 a11 a12'.split())
        selected = Counter(case for group in job['strategy']['matrix']['include'] for case in group['cases'].split())
        self.assertEqual(selected, Counter({case: 1 for case in expected}))
        commands = []
        for step in job['steps']:
            match = re.search(r'--case (\w+)', step.get('run', ''))
            if match:
                case = match.group(1)
                commands.append(case)
                self.assertEqual(step['if'], f"contains(format(' {{0}} ', matrix.cases), ' {case} ')")
        self.assertEqual(Counter(commands), selected)
        self.assertEqual(job['strategy']['fail-fast'], 'false')
        self.assertEqual(job['needs'], 'gym-build')

    def test_release_groups_gate_deployment(self):
        workflow = yaml.load((ROOT / '.github/workflows/preview.yml').read_text(), Loader=yaml.BaseLoader)
        verify = workflow['jobs']['verify']
        self.assertEqual(verify['strategy']['matrix']['group'], ['desktop', 'phone', 'stations'])
        self.assertEqual(verify['needs'], 'build')
        self.assertEqual(verify['strategy']['fail-fast'], 'false')
        run = next(step['run'] for step in verify['steps'] if 'tools/preview/verify.cjs' in step.get('run', ''))
        self.assertTrue(run.endswith('${{ matrix.group }}'))
        ci = yaml.load((ROOT / '.github/workflows/ci.yml').read_text(), Loader=yaml.BaseLoader)
        self.assertIn('preview', ci['jobs']['required']['needs'])
        self.assertIn('physics', ci['jobs']['required']['needs'])
        self.assertIn('required', ci['jobs']['pages']['needs'])


if __name__ == '__main__':
    unittest.main()
