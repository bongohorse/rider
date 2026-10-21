"""Car Feel 3 strut art: generated files current, end-to-end silhouette, centred, sprite size matches the PNG."""
from pathlib import Path
import re
import sys
import unittest

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT/'tools/art'))
import strut


class StrutArt(unittest.TestCase):
    def test_generated_files_are_current(self):
        self.assertEqual(strut.check(), [])

    def test_sprite_spans_mount_to_wheel_centre(self):
        sprite = (ROOT/'main/gym/strut.sprite').read_text()
        self.assertIn('size_mode: SIZE_MODE_MANUAL', sprite)
        size = re.search(r'size\s*\{\s*x:\s*([0-9.]+)\s*y:\s*([0-9.]+)', sprite)
        width, length = float(size[1]), float(size[2])
        self.assertEqual((width, length), (strut.WIDTH, strut.LENGTH))
        with Image.open(ROOT/'main/gym/assets/strut.png') as image:
            self.assertEqual(image.size, (int(width*3), int(length*3)))
            # juice.lua stretches the sprite centre-to-centre: the solid silhouette must reach both ends.
            alpha = image.getchannel('A').point(lambda a: 255 if a >= 128 else 0)
            self.assertEqual(alpha.getbbox(), (0, 0, image.width, image.height))
            # Symmetric, so the drawn direction (mount->wheel or wheel->mount) does not matter.
            self.assertEqual(image.tobytes(), ImageOps.mirror(image).tobytes())
            self.assertEqual(image.tobytes(), ImageOps.flip(image).tobytes())

    def test_atlas_and_factory_reference_the_strut(self):
        self.assertIn('/main/gym/assets/car_spring.png', (ROOT/'main/gym/assets/gym.atlas').read_text())
        self.assertIn('/main/gym/strut.sprite', (ROOT/'main/gym/strut.go').read_text())
        self.assertIn('/main/gym/strut.factory', (ROOT/'main/gym/controller.go').read_text())


if __name__ == '__main__':
    unittest.main()
