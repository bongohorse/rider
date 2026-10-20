"""Ensure telemetry's config is really bundled, not silently ignored by Bob."""
import configparser
import json
import math
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

    def test_bump_ladder_geometry(self):
        station=json.loads((ROOT/'main/gym/stations/bumps.json').read_text())
        source=json.loads((ROOT/'tools/gym/bumps-source.json').read_text())['editor']
        sections=station['sections']
        heights=[0.05,0.1,0.15,0.2,0.3]
        self.assertEqual([s['id'] for s in sections],[f'long-{h:g}' for h in heights]+[f'short-{h:g}' for h in heights]+['crest-dip'])
        ladder=[s['features'][0] for s in sections[:10]]
        self.assertEqual([(f['height'],f['wavelength']) for f in ladder],[(h,3) for h in heights]+[(h,1) for h in heights])
        crest_dip=sections[-1]['features']
        self.assertEqual([(f['type'],f['height'],f['wavelength']) for f in crest_dip],[('crest',.4,w) for w in (8,6,4,3)]+[('dip',-.4,w) for w in (8,6,4,3)])
        # Every feature is one Bump/wave prefab of the editor source, at the same place and parameters.
        waves=[o for o in source['objects'] if o['kind']=='wave']
        features=[f for s in sections for f in s['features']]
        self.assertEqual([(o['at'],o['params']) for o in waves],[([f['start_x'],0],{'height':f['height'],'wavelength':f['wavelength'],'count':f['count']}) for f in features])
        self.assertEqual(source['sampling'],{'tolerance':0.005,'max_segment':0.5})
        self.assertEqual(len(station['labels']),len(features))
        chain=station['chains'][0]
        self.assertEqual(len(station['chains']),1)
        self.assertTrue(all(b[0]<a[0] for a,b in zip(chain,chain[1:])))
        self.assertLessEqual(len(chain)-1+len(station['labels']),800)
        self.assertTrue(chain[-1][0]<station['bounds'][0] and chain[0][0]>station['bounds'][1])
        for f in features:
            # The compiled vertices lie on y = h/2 (1 - cos(2 pi x / wavelength)); flat ground elsewhere.
            for x,y in chain:
                if f['start_x']<=x<=f['end_x']:
                    self.assertAlmostEqual(y,f['height']/2*(1-math.cos(2*math.pi*(x-f['start_x'])/f['wavelength'])),places=9)
        for s in sections:
            self.assertEqual(s['spawn'][1],0.9)
            self.assertTrue(all(y==0 for x,y in chain if s['spawn'][0]-1<=x<=s['features'][0]['start_x']))

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
