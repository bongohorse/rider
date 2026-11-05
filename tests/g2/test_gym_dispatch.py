"""Frozen pre-refactor execution tuples and independent split/preset expectations (#514)."""
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/gym'))
from dispatch import RUNNERS, PARTS, PRESET_CASES, runner_config

EXPECTED = {'w114': ('wheel114.cjs', 600),
 'fps417': ('fps417.cjs', 360),
 'fps444': ('fps444.cjs', 360),
 'cam443': ('camera443.cjs', 360),
 'coast345': ('coast_measure.cjs', 90),
 'ea3': ('versions.cjs', 600),
 'ea2': ('objects.cjs', 600),
 'a22': ('regress.cjs', 360),
 'a21': ('replay.cjs', 360),
 'a20': ('pause.cjs', 360),
 'cf3': ('struts.cjs', 360),
 'le2': ('editor.cjs', 360),
 'le3': ('draw.cjs', 360),
 'le4': ('library.cjs', 360),
 'le5a': ('prefab.cjs', 360),
 'le5b': ('curve.cjs', 360),
 'le5c': ('path.cjs', 360),
 'le5d': ('points.cjs', 360),
 'le6': ('polish.cjs', 360),
 'le1b': ('sizes.cjs', 600),
 'le1a': ('custom.cjs', 360),
 'a19': ('gaps.cjs', 360),
 'a19c': ('air.cjs', 360),
 'a19b': ('bumps.cjs', 600),
 'a19d': ('balance.cjs', 360),
 'a18': ('seams.cjs', 600),
 'a17': ('steps.cjs', 360),
 'a16': ('ramps.cjs', 360),
 'a15': ('stations.cjs', 90)}


class GymDispatch(unittest.TestCase):
    def test_every_special_case_preserves_runner_and_timeout(self):
        self.assertEqual(RUNNERS, EXPECTED)
        for case, expected in EXPECTED.items():
            self.assertEqual(runner_config(case), expected)

    def test_default_and_unknown_cases_keep_browser_dispatch(self):
        for case in ('a1', 'a2', 'a3', 'a6', 'a9invalid', 'coast', 'hud', 'm2feedback', 'not-a-case'):
            self.assertEqual(runner_config(case), ('browser.cjs', 90))

    def test_split_and_preset_contracts_remain_independent(self):
        self.assertEqual(PARTS, {'a18': ['1/2', '2/2'], 'le1b': ['1/2', '2/2'], 'a19b': ['1/2', '2/2'], 'le6': ['1/2', '2/2']})
        self.assertEqual(list(PRESET_CASES), ['a16', 'a17', 'a18', 'a19', 'a19c', 'a19b', 'a19d', 'w114'])
        self.assertEqual(list(PRESET_CASES.values()), ['ramps-result.json', 'steps-result.json', 'seams-result.json',
                         'gaps-result.json', 'air-result.json', 'bumps-result.json', 'balance-result.json', 'wheel114-result.json'])
