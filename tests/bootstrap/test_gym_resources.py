"""Ensure telemetry's config is really bundled, not silently ignored by Bob."""
import configparser
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]

class GymResources(unittest.TestCase):
    def test_budget_is_an_existing_project_custom_resource(self):
        config = configparser.ConfigParser()
        config.read(ROOT / 'game.project')
        resources = config.get('project', 'custom_resources').split(',')
        self.assertIn('/main/gym/budget.json', resources)
        budget = json.loads((ROOT / resources[0].lstrip('/')).read_text())
        self.assertEqual(budget['fps_min'], 60)
        self.assertGreater(budget['frame_ms_max'], 0)
        self.assertIsNone(budget['physics_ms_max'])

    def test_seam_variants_share_twenty_internal_abutments(self):
        chain=json.loads((ROOT/'main/gym/stations/seams-chain.json').read_text())
        hull=json.loads((ROOT/'main/gym/stations/seams-hull.json').read_text())
        for key in ('spawn','start_speed','baseline','window','bounds','seams'):
            self.assertEqual(chain[key],hull[key])
        self.assertEqual(chain['seams'],list(range(40,80,2)))
        self.assertEqual(len(chain['chains'][0]),22)
        self.assertEqual(len(hull['hulls']),21)
        ends=list(reversed(chain['chains'][0]))
        for i,section in enumerate(hull['hulls']):
            a,b=ends[i][0],ends[i+1][0]
            self.assertEqual(section['vertices'],[[a,-.2],[b,-.2],[b,.8],[a,.8]])
