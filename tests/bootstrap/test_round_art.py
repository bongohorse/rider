"""Measure real exported pixels; catch centring and visual/physics size regressions."""
from io import BytesIO
from pathlib import Path
import re
import sys
import unittest

from PIL import Image, ImageDraw, ImageOps

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT/'tools/art'))
import wheel


def assert_round(image, world_size, physics_radius, max_offset=0.25):
    alpha = image.convert('RGBA').getchannel('A')
    w, h = image.size
    mass = sum(alpha.tobytes())
    if not mass:
        raise AssertionError('Empty round sprite')
    cx = sum(x*alpha.getpixel((x,y)) for y in range(h) for x in range(w))/mass
    cy = sum(y*alpha.getpixel((x,y)) for y in range(h) for x in range(w))/mass
    if max(abs(cx-(w-1)/2),abs(cy-(h-1)/2)) > max_offset:
        raise AssertionError(f'Off-centre alpha mass: {(cx,cy)} in {image.size}')
    # Solid silhouette (50% coverage), excluding the antialiased fringe.
    x0,y0,x1,y1 = alpha.point(lambda a: 255 if a>=128 else 0).getbbox()
    for diameter, resolution in [(x1-x0,w),(y1-y0,h)]:
        if abs(diameter/resolution*world_size-2*physics_radius)>0.25:
            raise AssertionError('Visible diameter does not match collision circle')
    return cx,cy


class RoundArt(unittest.TestCase):
    def test_exported_round_assets(self):
        for name in wheel.ROUND_ASSETS:
            with self.subTest(asset=name):
                shape = (ROOT/f'main/gym/{name}.convexshape').read_text()
                radius = float(re.search(r'^data:\s*([0-9.]+)',shape,re.M)[1])
                sprite = (ROOT/f'main/gym/{name}.sprite').read_text()
                self.assertIn('size_mode: SIZE_MODE_MANUAL',sprite)
                size = float(re.search(r'size\s*\{\s*x:\s*([0-9.]+)',sprite)[1])
                with Image.open(ROOT/f'main/gym/assets/{name}.png') as image:
                    self.assertEqual(image.size,(int(size*3),int(size*3)))
                    assert_round(image,size,radius)
                    # Interior art must also stay centred, not only the outer silhouette.
                    self.assertEqual(image.tobytes(),ImageOps.mirror(image).tobytes())
                    self.assertEqual(image.tobytes(),ImageOps.flip(image).tobytes())
                    for angle in (15,30,45,90):
                        rotated=image.rotate(angle,resample=Image.Resampling.BICUBIC)
                        alpha=rotated.getchannel('A')
                        # Only centroid here: rotated raster bounds quantize differently.
                        mass=sum(alpha.tobytes());w,h=image.size
                        cx=sum(x*alpha.getpixel((x,y)) for y in range(h) for x in range(w))/mass
                        cy=sum(y*alpha.getpixel((x,y)) for y in range(h) for x in range(w))/mass
                        self.assertLessEqual(max(abs(cx-(w-1)/2),abs(cy-(h-1)/2)),0.25)

    def test_legacy_half_pixel_offset_is_rejected(self):
        image=Image.new('RGBA',(48,48))
        ImageDraw.Draw(image).ellipse((2,2,46,46),fill='white')
        with self.assertRaisesRegex(AssertionError,'Off-centre'):
            assert_round(image,48,22)

    def test_centred_but_oversized_circle_is_rejected(self):
        image=Image.new('RGBA',(144,144))
        ImageDraw.Draw(image).ellipse((4,4,139,139),fill='white')
        with self.assertRaisesRegex(AssertionError,'diameter'):
            assert_round(image,48,22)

    def test_generated_files_are_current(self):
        self.assertEqual(wheel.check(),[])
