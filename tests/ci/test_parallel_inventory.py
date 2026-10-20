"""A matrix edit must not silently drop or duplicate a previously required case."""
from collections import Counter
from pathlib import Path
import re
import unittest
import yaml

ROOT = Path(__file__).resolve().parents[2]
# Must match PARTS in tools/gym/smoke.py, seam_report.cjs and sizes_report.cjs.
SPLIT = {'a18': ['1/2', '2/2'], 'le1b': ['1/2', '2/2'], 'a19b': ['1/2', '2/2']}


class ParallelInventory(unittest.TestCase):
    def test_every_debug_case_runs_once_or_once_per_part(self):
        workflow = yaml.load((ROOT / '.github/workflows/g1.yml').read_text(), Loader=yaml.BaseLoader)
        job = workflow['jobs']['gym']
        expected = set('a15 le1a le1b le2 le3 le4 le5a le5b le5c le5d a16 a17 a18 a19 a19b a19c a19d a3 a6 coast a15a hud a7 a8 m2feedback a9 a9invalid a10 a11 a12 a20 cf3 a21'.split())
        groups = job['strategy']['matrix']['include']
        selected = Counter(case for group in groups for case in group['cases'].split())
        # A split case runs once per part, alone in its group, and every part exactly once.
        parts = {}
        for group in groups:
            if 'part' in group:
                self.assertEqual(group['cases'].split(), [group['cases']])
                parts.setdefault(group['cases'], []).append(group['part'])
        self.assertEqual(parts, SPLIT)
        self.assertEqual(selected, Counter({case: len(SPLIT.get(case, [None])) for case in expected}))
        commands = []
        for step in job['steps']:
            match = re.search(r'--case (\w+)', step.get('run', ''))
            if match:
                case = match.group(1)
                commands.append(case)
                self.assertEqual(step['if'], f"contains(format(' {{0}} ', matrix.cases), ' {case} ')")
                self.assertEqual('--part "$PART"' in step['run'], case in SPLIT)
                if case in SPLIT: self.assertEqual(step['env']['PART'], '${{ matrix.part }}')
        self.assertEqual(Counter(commands), Counter(set(selected)))
        self.assertEqual(job['strategy']['fail-fast'], 'false')
        self.assertEqual(job['needs'], 'gym-build')

    def test_split_reports_are_merged_from_every_part(self):
        workflow = yaml.load((ROOT / '.github/workflows/g1.yml').read_text(), Loader=yaml.BaseLoader)
        job = workflow['jobs']['gym-reports']
        self.assertEqual(job['needs'], 'gym')
        merges = {}
        for step in job['steps']:
            match = re.search(r'--case (\w+) .*--merge (.*)$', step.get('run', ''))
            if match: merges[match.group(1)] = re.findall(r'g1-gym-(\w+)-(\d)-\$RUN/', match.group(2))
        self.assertEqual({case: [n for _, n in dirs] for case, dirs in merges.items()}, {case: ['1', '2'] for case in SPLIT})
        # Each merge reads the directory its gym step wrote, from the artifacts the download step selects.
        outputs = {re.search(r'--case (\w+)', s['run']).group(1): re.search(r'--output artifacts/g1/(\w+)', s['run']).group(1)
                   for s in workflow['jobs']['gym']['steps'] if '--case' in s.get('run', '')}
        for step in job['steps']:
            match = re.search(r'--case (\w+) .*--merge (.*)$', step.get('run', ''))
            if match:
                self.assertEqual(set(re.findall(r'-\$RUN/(\w+)"', match.group(2))), {outputs[match.group(1)]})
        download = next(s for s in job['steps'] if s.get('uses', '').startswith('actions/download-artifact@'))
        self.assertEqual(download['with']['pattern'], 'g1-gym-*-[12]-${{ github.run_id }}-${{ github.run_attempt }}')
        self.assertIn("PARTS={'a18':['1/2','2/2'],'le1b':['1/2','2/2'],'a19b':['1/2','2/2']}", (ROOT / 'tools/gym/smoke.py').read_text())
        groups = {g['group'] for g in workflow['jobs']['gym']['strategy']['matrix']['include']}
        for dirs in merges.values():
            self.assertEqual(len({name for name, _ in dirs}), 1)
            self.assertTrue({f'{name}-{n}' for name, n in dirs} <= groups)

    def test_release_groups_gate_deployment(self):
        workflow = yaml.load((ROOT / '.github/workflows/preview.yml').read_text(), Loader=yaml.BaseLoader)
        verify = workflow['jobs']['verify']
        self.assertEqual(verify['strategy']['matrix']['group'], ['desktop', 'phone', 'touch', 'stations'])
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
