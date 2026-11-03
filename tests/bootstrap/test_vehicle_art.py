"""Authored vehicle PNG provenance, runtime routing and visual/physics alignment."""
import hashlib
from pathlib import Path
import re
import unittest

from PIL import Image

from test_round_art import assert_round

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT/'main/game/assets'
UPLOADS = {
    'body': ((750, 343), '326593b7b5ea3009b61a9d667df240dba014a4bb7024b69ce3311f88ee3c5d5f'),
    'rider': ((189, 225), '4c31a37414ddb599ff29664b6465e8707a50b3037921451acbfe614bdeaf4845'),
    'spring': ((32, 115), '950250273158e4a4b45cc53b948d848d8ed40c5e6eaf228a7f97765d695c07c2'),
    'wheel': ((290, 290), 'c675f795f522045b64250d7cfa233ec84a4d0c0fe88d2d30bbe147f84f375d86'),
}


class VehicleArt(unittest.TestCase):
    def test_original_uploads_keep_pixels_dimensions_and_transparency(self):
        for name, (size, digest) in UPLOADS.items():
            with self.subTest(asset=name):
                path = ART/f'car_{name}.png'
                self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), digest)
                with Image.open(path) as image:
                    self.assertEqual(image.size, size)
                    alpha = image.convert('RGBA').getchannel('A')
                    self.assertEqual(alpha.getextrema()[0], 0)
                    self.assertGreater(alpha.getextrema()[1], 128)

    def test_runtime_atlas_replaces_every_placeholder(self):
        atlas = (ART/'gym.atlas').read_text()
        for animation, image in [('chassis', 'body'), ('rider', 'rider'), ('strut', 'spring'), ('wheel', 'wheel')]:
            self.assertRegex(atlas, rf'id: "{animation}"\s+images \{{ image: "/main/game/assets/car_{image}.png"')
        for name in ('chassis', 'rider', 'strut', 'wheel'):
            self.assertNotIn(f'/main/game/assets/{name}.png', atlas)

    def test_live_and_replay_wheels_match_collision_radius(self):
        sprite = (ROOT/'main/game/wheel.sprite').read_text()
        size = float(re.search(r'size\s*\{\s*x:\s*([0-9.]+)', sprite)[1])
        radius = float(re.search(r'^data:\s*([0-9.]+)', (ROOT/'main/game/wheel.convexshape').read_text(), re.M)[1])
        for name in ('wheel_view', 'ghost_wheel'):
            source = (ROOT/f'main/game/{name}.go').read_text()
            scale = re.search(r'scale \{ x: ([0-9.]+) y: ([0-9.]+)', source)
            self.assertEqual(scale[1], scale[2])
            world_size = size*float(scale[1])
            with Image.open(ART/'car_wheel.png') as image:
                assert_round(image, world_size, radius)
                for angle in (15, 30, 45, 90):
                    # Centroid is measured in source pixels, like the generated-wheel regression.
                    rotated = image.convert('RGBA').rotate(angle, resample=Image.Resampling.BICUBIC)
                    alpha = rotated.getchannel('A'); w, h = rotated.size
                    mass = sum(alpha.tobytes())
                    cx = sum(x*alpha.getpixel((x,y)) for y in range(h) for x in range(w))/mass
                    cy = sum(y*alpha.getpixel((x,y)) for y in range(h) for x in range(w))/mass
                    self.assertLessEqual(max(abs(cx-(w-1)/2), abs(cy-(h-1)/2)), 0.25)

    def test_physics_objects_carry_no_sprite_and_views_keep_the_old_ones(self):
        # #479: the physics game objects keep only their collision object; each sprite moved unchanged (same component,
        # offset and scale) to a sprite-only visual twin spawned by its own factory on the controller.
        sprites = {
            'chassis': 'components { id: "sprite" component: "/main/game/chassis.sprite" position { x: 0 y: -4 z: 0 } }\n',
            'wheel': 'components { id: "sprite" component: "/main/game/wheel.sprite" scale { x: 0.919791667 y: 0.919791667 z: 1 } }\n',
            'wheel26': 'components { id: "sprite" component: "/main/game/wheel.sprite" scale { x: 1.087026516 y: 1.087026516 z: 1 } }\n',
            'wheel30': 'components { id: "sprite" component: "/main/game/wheel.sprite" scale { x: 1.254261364 y: 1.254261364 z: 1 } }\n',
        }
        controller = (ROOT/'main/game/controller.go').read_text()
        for name, sprite in sprites.items():
            with self.subTest(object=name):
                self.assertEqual((ROOT/f'main/game/{name}.go').read_text(),
                                 f'components {{ id: "body" component: "/main/game/{name}.collisionobject" }}\n')
                self.assertEqual((ROOT/f'main/game/{name}_view.go').read_text(), sprite)
                factory = (ROOT/f'main/game/{name}_view.factory').read_text()
                self.assertTrue(factory.startswith(f'prototype: "/main/game/{name}_view.go"\n'))
                # The view loads like its physics twin (the debug wheel candidates load dynamically).
                self.assertEqual('load_dynamically: true' in factory,
                                 'load_dynamically: true' in (ROOT/f'main/game/{name}.factory').read_text())
                self.assertIn(f'components {{ id: "{name}_view" component: "/main/game/{name}_view.factory" }}', controller)

    def test_body_and_rider_preserve_aspect_ratio(self):
        for sprite, name in [('chassis', 'body'), ('rider', 'rider')]:
            source = (ROOT/f'main/game/{sprite}.sprite').read_text()
            size = re.search(r'size \{ x: ([0-9.]+) y: ([0-9.]+)', source)
            w, h = UPLOADS[name][0]
            self.assertAlmostEqual(float(size[1])/float(size[2]), w/h, places=4)
