"""#538: committed level material presets match their manifest and the rules of the level visuals contract."""
import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest

from PIL import Image, ImageChops, ImageDraw

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


class BrokenPresets(unittest.TestCase):
    """Each rule must fail on a preset broken on purpose, with its hash rewritten so only that rule can catch it."""

    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.out = Path(temp.name)/'presets'
        shutil.copytree(level_materials.OUT, self.out)
        self.manifest = json.loads((self.out/'manifest.json').read_text(encoding='utf-8'))
        for other in self.manifest['presets'][1:]:
            shutil.rmtree(self.out/other['id'])
        self.manifest['presets'] = self.manifest['presets'][:1]
        self.preset = self.manifest['presets'][0]
        self.folder = self.out/self.preset['id']
        self.save_manifest()
        self.assertEqual(level_materials.check(self.out), [])

    def save_manifest(self):
        (self.out/'manifest.json').write_text(json.dumps(self.manifest), encoding='utf-8')

    def broken(self, name, change):
        path = self.folder/f'{name}.png'
        image = change(Image.open(path).convert('RGBA'))
        image.save(path)
        self.preset['sha256'][name] = level_materials.sha256(path)
        self.save_manifest()
        return ' '.join(level_materials.check(self.out))

    @staticmethod
    def rect(box, colour):
        def change(image):
            ImageDraw.Draw(image).rectangle(box, fill=colour)
            return image
        return change

    def test_changed_pixels_without_a_new_hash(self):
        path = self.folder/'fill.png'
        self.rect((0, 0, 9, 9), (255, 0, 255, 255))(Image.open(path).convert('RGBA')).save(path)
        self.assertIn('pixels differ', ' '.join(level_materials.check(self.out)))

    def test_missing_manifest_key(self):
        del self.preset['sha256']['fill']
        self.save_manifest()
        self.assertIn('manifest lists', ' '.join(level_materials.check(self.out)))

    def test_thumbnail_of_something_else(self):
        self.assertIn('thumb', self.broken('thumb', self.rect((0, 0, 127, 127), (255, 0, 255, 255))))

    def test_small_thumbnail(self):
        self.assertIn('thumb', self.broken('thumb', lambda image: image.resize((16, 16))))

    def test_wrong_size(self):
        self.assertIn('size', self.broken('fill', lambda image: image.resize((256, 256))))

    def test_hole_in_the_contact_zone(self):
        self.assertIn('holes', self.broken('surface', self.rect((100, 60, 110, 70), (0, 0, 0, 0))))

    def test_flat_far_edge(self):
        self.assertIn('fray', self.broken('surface', self.rect((0, 0, 511, 0), (60, 90, 40, 254))))

    def test_band_reaching_the_last_row(self):
        self.assertIn('last row', self.broken('band', self.rect((0, 127, 511, 127), (60, 90, 40, 255))))

    def test_band_gap_at_the_fold(self):
        self.assertIn('gap', self.broken('band', self.rect((0, 0, 40, 0), (0, 0, 0, 0))))

    def test_transparent_fill(self):
        self.assertIn('not opaque', self.broken('fill', self.rect((0, 0, 4, 4), (0, 0, 0, 0))))

    def test_bright_line_at_the_fold(self):
        self.assertIn('fold', self.broken('surface', self.rect((0, 118, 511, 127), (255, 255, 255, 255))))

    def test_stone_cut_at_the_repeat_edge(self):
        message = self.broken('fill', self.rect((478, 200, 511, 240), (230, 225, 215, 255)))
        self.assertIn('seam in u', message)

    def test_colour_step_across_the_whole_edge(self):
        def step(image):
            ramp = Image.linear_gradient('L').rotate(90).resize(image.size).point(lambda v: v*40//255)
            rgb = ImageChops.add(image.convert('RGB'), Image.merge('RGB', (ramp, ramp, ramp)))
            rgb.putalpha(image.getchannel('A'))
            return rgb
        self.assertIn('seam in u', self.broken('fill', step))

    def test_bright_rows_just_above_the_fold(self):
        self.assertIn('fold', self.broken('surface', self.rect((0, 122, 511, 126), (255, 255, 255, 255))))

    def test_bright_rows_just_below_the_fold(self):
        self.assertIn('fold', self.broken('band', self.rect((0, 1, 511, 5), (255, 255, 255, 255))))

    def test_flat_surface_from_the_second_row(self):
        self.assertIn('fray', self.broken('surface', self.rect((0, 1, 511, 3), (60, 90, 40, 255))))

    def test_small_patch_in_a_thumbnail(self):
        self.assertIn('thumb', self.broken('thumb', self.rect((0, 0, 9, 9), (255, 0, 255, 255))))

    def test_stray_file_in_a_preset(self):
        (self.folder/'extra.png').write_bytes(b'x')
        self.assertIn('unexpected files', ' '.join(level_materials.check(self.out)))

    def test_leftover_generation_file(self):
        (self.out/'generation.json').write_text('{}', encoding='utf-8')
        self.assertIn('unexpected files', ' '.join(level_materials.check(self.out)))

    def test_changed_layout_record(self):
        self.manifest['pixels_per_metre'] = 64
        self.save_manifest()
        self.assertIn('layout', ' '.join(level_materials.check(self.out)))

    def test_generator_change(self):
        self.manifest['generator_sha256'] = '0'*64
        self.save_manifest()
        self.assertIn('generator', ' '.join(level_materials.check(self.out)))

    def test_license_change(self):
        self.manifest['license'] = 'other'
        self.save_manifest()
        self.assertIn('license', ' '.join(level_materials.check(self.out)))


if __name__ == '__main__':
    unittest.main()
