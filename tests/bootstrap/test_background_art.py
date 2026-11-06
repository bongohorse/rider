"""Integrity checks run on committed art; no generator inputs or source archive required."""
import hashlib
import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT/'tools/art'))
import background_presets as art


class BackgroundArt(unittest.TestCase):
    def test_committed_presets(self):
        self.assertEqual(art.check(), [])

    def test_corrupt_pixel_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            out = Path(directory)/'presets'
            shutil.copytree(art.OUT, out)
            path = out/'meadow/layer2.png'
            image = Image.open(path)
            image.putpixel((400,400), (255,0,255,255))
            image.save(path)
            self.assertIn('pixels differ', ' '.join(art.check(out)))

    def mutate(self, change):
        with tempfile.TemporaryDirectory() as directory:
            out = Path(directory)/'presets'
            shutil.copytree(art.OUT, out)
            path = out/'meadow/layer2.png'
            image = Image.open(path)
            change(image)
            image.save(path)
            # Integrity hashes alone cannot establish a clean seam or alpha contract.
            manifest = json.loads((out/'manifest.json').read_text())
            manifest['presets'][0]['files']['layer2'] = {
                'sha256': art.digest(path),
                'rgba_sha256': hashlib.sha256(image.tobytes()).hexdigest(),
            }
            (out/'manifest.json').write_text(json.dumps(manifest))
            return ' '.join(art.check(out))

    def test_seam_with_updated_hash_is_rejected(self):
        self.assertIn('repeat seam', self.mutate(lambda image: image.putpixel((1023,300),(255,0,0,255))))

    def test_opaque_overlay_top_with_updated_hash_is_rejected(self):
        self.assertIn('overlay alpha', self.mutate(lambda image: image.putpixel((400,0),(255,0,0,255))))

    def test_wrong_licence_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            out = Path(directory)/'presets'
            shutil.copytree(art.OUT, out)
            (out/'License.txt').write_text('unverified')
            self.assertIn('license differs', art.check(out))


if __name__ == '__main__':
    unittest.main()
