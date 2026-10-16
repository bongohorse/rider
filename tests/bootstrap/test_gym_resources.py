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
