"""#538: committed level material presets match their manifest and the rules of the level visuals contract."""
import json
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT/'tools/art'))
import level_materials  # noqa: E402

KENNEY = ROOT/'main/terrain_material/kenney_terrain_64.png'


class LevelMaterialArt(unittest.TestCase):
    def test_committed_presets_pass_every_check(self):
        self.assertEqual(level_materials.check(), [])

    def test_meadow_is_the_first_of_several_presets(self):
        manifest = json.loads((level_materials.OUT/'manifest.json').read_text(encoding='utf-8'))
        ids = [p['id'] for p in manifest['presets']]
        self.assertEqual(ids[0], 'meadow')
        self.assertGreaterEqual(len(ids), 3)
        self.assertEqual(len(ids), len(set(ids)))

    def test_provenance_names_the_original_generator(self):
        text = (ROOT/'main/terrain_material/PROVENANCE.md').read_text(encoding='utf-8')
        self.assertIn('tools/art/level_materials.cjs', text)

    def test_kenney_test_fixture_stays_separate(self):
        self.assertTrue(KENNEY.is_file())
        self.assertFalse(list(level_materials.OUT.glob('*/kenney*')))

    def test_seam_check_finds_a_real_seam(self):
        from PIL import Image
        image = Image.new('RGBA', (64, 64), (10, 10, 10, 255))
        image.paste((240, 240, 240, 255), (32, 0, 64, 64))
        across, inner = level_materials.edge_difference(image, 'u')
        self.assertGreater(across, 100)
        self.assertLess(inner, 50)


if __name__ == '__main__':
    unittest.main()
