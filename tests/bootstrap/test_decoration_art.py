"""Integrity checks on the committed decoration set; no generator inputs or source archive required."""
from pathlib import Path
import shutil
import sys
import tempfile
import unittest

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT/'tools/art'))
import decorations as art


class DecorationArt(unittest.TestCase):
    def mutated(self, change):
        with tempfile.TemporaryDirectory() as directory:
            out = Path(directory)/'meadow'
            shutil.copytree(art.OUT, out)
            change(out)
            return ' '.join(art.check(out))

    def test_committed_set(self):
        self.assertEqual(art.check(), [])

    def test_generator_reproduces_pixels(self):
        for asset in art.ASSETS:
            self.assertEqual(art.render(asset).tobytes(), Image.open(art.OUT/f'{asset}.png').tobytes(), asset)

    def test_corrupt_pixel_is_rejected(self):
        def change(out):
            image = Image.open(out/'cone.png')
            image.putpixel((20, 40), (255, 0, 255, 255))
            image.save(out/'cone.png')
        self.assertIn('pixels differ', self.mutated(change))

    def test_missing_asset_and_licence_are_rejected(self):
        self.assertIn('cone', self.mutated(lambda out: (out/'cone.png').unlink()))
        self.assertIn('license differs', self.mutated(lambda out: (out/'License.txt').write_text('other')))

    def test_unexpected_file_is_rejected(self):
        self.assertIn('unexpected files', self.mutated(lambda out: (out/'kenney.png').write_bytes(b'x')))


if __name__ == '__main__':
    unittest.main()
