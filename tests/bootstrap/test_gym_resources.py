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

    def test_gap_ladder_geometry(self):
        ladder=json.loads((ROOT/'main/gym/stations/gaps.json').read_text())
        landing=json.loads((ROOT/'main/gym/stations/gaps-landing.json').read_text())
        gaps=[s['gap'] for s in ladder['sections']]
        self.assertEqual(gaps,[1,1.5,2,2.5,3,4,5,6,8,10])
        self.assertEqual([s['landing'] for s in landing['sections']],['flat','down','up'])
        for station in (ladder,landing):
            self.assertEqual(len(station['labels']),len(station['sections']))
            points={tuple(p) for p in station['chains'][0]}
            for s in station['sections']:
                self.assertAlmostEqual(s['land_x']-s['lip_x'],s['gap'],places=5)
                self.assertAlmostEqual(s['lip_y']-0.8,1.0,places=5)
                # A pit floor 3 m below ground spans the whole gap.
                self.assertIn((s['lip_x'],-2.2),points)
                self.assertIn((s['land_x'],-2.2),points)
                self.assertEqual(s['mode'],'up')

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

    def test_custom_level_helper_and_samples(self):
        config = configparser.ConfigParser()
        config.read(ROOT / 'game.project')
        self.assertIn('/main/gym/custom.js', config.get('project', 'custom_resources').split(','))
        samples = ROOT / 'main/gym/samples'
        for name in ('rolling-hills', 'kicker-platform'):
            level = json.loads((samples / f'{name}.json').read_text())
            self.assertEqual(level['id'], name)
            self.assertNotIn('kind', level)
            x0, x1, y0, y1 = level['bounds']
            self.assertTrue(x0 < level['spawn'][0] < x1 and y0 < level['spawn'][1] < y1)
            objects = len(level.get('labels', [])) + sum(len(h['vertices']) for h in level.get('hulls', []))
            for chain in level['chains']:
                objects += len(chain) - 1
                # Right-to-left like the built-in stations: solid side below the line.
                self.assertTrue(all(b[0] <= a[0] for a, b in zip(chain, chain[1:])))
                self.assertTrue(all((a[0]-b[0])**2 + (a[1]-b[1])**2 >= 0.0001 for a, b in zip(chain, chain[1:])))
                # The vehicle cannot leave the bounds sideways without passing the chain ends.
                self.assertTrue(chain[-1][0] < x0 and chain[0][0] > x1)
            self.assertLessEqual(objects, 800)
        invalid = json.loads((samples / 'invalid-bounds.json').read_text())
        self.assertLessEqual(invalid['spawn'][0], invalid['bounds'][0])
