"""#392 Stage A: committed Kenney atlas, manifest and license agree; shader, mesh and vertex layout match them."""
import json
from pathlib import Path
import re
import sys
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT/'tools/art'))
import terrain_material  # noqa: E402

PERSPECTIVE = ROOT/'main/terrain_perspective'


class TerrainMaterialArt(unittest.TestCase):
    def test_committed_atlas_matches_manifest(self):
        self.assertEqual(terrain_material.check(), [])

    def test_provenance_names_source_and_hash(self):
        text = (ROOT/'main/terrain_material/PROVENANCE.md').read_text(encoding='utf-8')
        self.assertIn(terrain_material.ZIP_SHA256, text)
        self.assertIn(terrain_material.PAGE, text)
        self.assertIn('CC0', (ROOT/'main/terrain_material/License.txt').read_text(encoding='utf-8'))

    def test_shader_layout_matches_atlas(self):
        fp = (PERSPECTIVE/'textured.fp').read_text()
        consts = {k: float(v) for k, v in re.findall(r'const float (\w+)=([0-9.]+);', fp)}
        self.assertEqual(consts, {'ATLAS': terrain_material.SIZE, 'CELL': terrain_material.CELL,
                                  'PAD': terrain_material.PAD, 'TILE': terrain_material.TILE})
        self.assertIn('uniform lowp sampler2D tex0;', fp)
        # One vertical flip: manifest rectangles are top-left, texture V starts at the bottom row.
        self.assertIn('1.0-px.y/ATLAS', fp)
        self.assertIn('in highp float texture_slot;', (PERSPECTIVE/'textured.vp').read_text())

    def test_mesh_material_factory_wiring(self):
        mesh = (PERSPECTIVE/'textured_chunk.mesh').read_text()
        self.assertIn('textures: "/main/terrain_material/kenney_terrain_64.png"', mesh)
        self.assertIn('material: "/main/terrain_perspective/textured.material"', mesh)
        material = (PERSPECTIVE/'textured.material').read_text()
        self.assertRegex(material, r'samplers \{\s*name: "tex0"')
        self.assertIn('FILTER_MODE_MIN_LINEAR\n', material)  # no mipmap filter: no atlas mip bleeding
        # Every look constant the shared runtime writes with go.set exists on the textured material too.
        legacy = (PERSPECTIVE/'terrain.material').read_text()
        for name in re.findall(r'name: "(\w+)" type: CONSTANT_TYPE_USER', legacy):
            self.assertIn(f'name: "{name}" type: CONSTANT_TYPE_USER', material)
        factory = (PERSPECTIVE/'textured_chunk.factory').read_text()
        self.assertIn('load_dynamically: true', factory)  # untextured courses never load the atlas
        self.assertIn('/main/terrain_perspective/textured_chunk.factory', (ROOT/'main/game/controller.go').read_text())

    def test_preset_route_wiring(self):
        controller = (ROOT/'main/game/controller.go').read_text()
        material = (PERSPECTIVE/'preset.material').read_text()
        for name in ('tex0', 'tex1', 'tex2'):
            self.assertRegex(material, r'samplers \{\s*name: "%s"' % name)
            self.assertIn(f'uniform lowp sampler2D {name};', (PERSPECTIVE/'preset.fp').read_text())
        self.assertIn('"/main/terrain_perspective/preset.material"', (ROOT/'main/game/boot.script').read_text())
        lua = (PERSPECTIVE/'material.lua').read_text()
        manifest = json.loads((ROOT/'main/terrain_material/presets/manifest.json').read_text())
        for preset in manifest['presets']:
            self.assertIn(f'/main/terrain_material/presets/{preset["id"]}/chunk.factory', controller)
            self.assertIn(f"'{preset['id']}'", lua)
            factory = (ROOT/'main/terrain_material/presets'/preset['id']/'chunk.factory').read_text()
            self.assertIn('load_dynamically: true', factory)  # a level loads only its own preset
        self.assertIn('level.texture_profiles', (ROOT/'game.project').read_text())

    def test_vertex_layout_is_52_bytes(self):
        streams = json.loads((PERSPECTIVE/'textured_empty.buffer').read_text())
        self.assertEqual([s['name'] for s in streams], ['position', 'color', 'texcoord0', 'look_data', 'texture_slot'])
        self.assertTrue(all(s['type'] == 'float32' for s in streams))
        self.assertEqual(sum(s['count'] for s in streams)*4, 52)
        legacy = json.loads((PERSPECTIVE/'empty.buffer').read_text())
        self.assertEqual(sum(s['count'] for s in legacy)*4, 48)


if __name__ == '__main__':
    unittest.main()
