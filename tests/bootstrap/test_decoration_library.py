"""#705: every decoration preset and fence has a world and category in the editor library."""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[2]


class DecorationLibrary(unittest.TestCase):
    def test_every_asset_is_tagged(self):
        assets = (ROOT/'main/decorations/assets.lua').read_text()
        library = (ROOT/'main/decorations/library.lua').read_text()
        ids = set(re.findall(r"\['([a-z0-9-]+)'\]=\{name=", assets))
        self.assertIn('fence-wood', ids)
        self.assertIn('rock-large', ids)
        tags = {i: (w, c) for i, w, c in re.findall(r"\['([a-z0-9-]+)'\]=\{world='([a-z]+)',category='([a-z]+)'\}", library)}
        worlds = set(re.findall(r"\{id='([a-z]+)',name='[^']+'\}", library.split('CATEGORIES')[0]))
        categories = set(re.findall(r"\{id='([a-z]+)',name='[^']+',icon=", library))
        self.assertEqual(sorted(ids - set(tags)), [], 'untagged decoration assets')
        self.assertEqual(sorted(set(tags) - ids), [], 'tags for unknown assets')
        for asset, (world, category) in tags.items():
            self.assertIn(world, worlds, asset)
            self.assertIn(category, categories, asset)


if __name__ == '__main__':
    unittest.main()
