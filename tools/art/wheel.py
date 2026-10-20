"""Generate wheel SVG, 3x PNG and manual-size sprite from the collision radius.

No runtime dependency: Pillow is only used by the developer/CI generator.
SVG circle/rect primitives are the common input to both exports.
"""
import argparse
from io import BytesIO
import math
from pathlib import Path
import re
import xml.etree.ElementTree as ET

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
EXPORT_SCALE = 3
SUPERSAMPLE = 4
# Register later round vehicle sprites here so the same contract covers them.
ROUND_ASSETS = ('wheel',)


def radius(root, name):
    shape = (root / f'main/gym/{name}.convexshape').read_text()
    values = re.findall(r'^data:\s*([0-9.]+)\s*$', shape, re.M)
    if 'shape_type: TYPE_SPHERE' not in shape or len(values) != 1:
        raise ValueError('Expected a centred circular collision shape with one radius')
    value = float(values[0])
    if not math.isfinite(value) or value <= 7:
        raise ValueError('Wheel radius must exceed the hub radius')
    return value


def vector(radius):
    size = 2 * math.ceil(radius + 2)
    c = size / 2
    svg = ET.Element('svg', xmlns='http://www.w3.org/2000/svg',
                     width=str(size), height=str(size), viewBox=f'0 0 {size} {size}')
    ET.SubElement(svg, 'title').text = 'Centred wheel; geometry derived from collision radius'
    for r, color in [(radius, '#879ba6'), (radius-3, '#1c2630')]:
        ET.SubElement(svg, 'circle', cx=str(c), cy=str(c), r=str(r), fill=color)
    length = radius-5
    ET.SubElement(svg, 'rect', x=str(c-1.5), y=str(c-length), width='3',
                  height=str(2*length), fill='#5c6f79')
    ET.SubElement(svg, 'rect', x=str(c-length), y=str(c-1.5), width=str(2*length),
                  height='3', fill='#5c6f79')
    ET.SubElement(svg, 'circle', cx=str(c), cy=str(c), r='7', fill='#69cbb8')
    ET.indent(svg, space='  ')
    return ET.tostring(svg, encoding='unicode')+'\n'


def raster(svg):
    """Rasterize this generator's circle/rect SVG subset at subpixel coverage.

    Also used by strut.py for its non-square sprite.

    SVG uses pixel-boundary coordinates. Pillow's inclusive final pixel needs -1;
    omitting that is exactly the former half-pixel centring defect.
    BOX reduction preserves coverage without a ringing halo outside the tyre.
    """
    doc = ET.fromstring(svg)
    width, height = int(doc.attrib['width']), int(doc.attrib['height'])
    scale = EXPORT_SCALE * SUPERSAMPLE
    image = Image.new('RGBA', (width*scale, height*scale))
    draw = ImageDraw.Draw(image)
    for element in doc:
        tag = element.tag.rsplit('}', 1)[-1]
        if tag == 'title':
            continue
        a = element.attrib
        if tag == 'circle':
            x, y, r = (float(a[k]) for k in ('cx', 'cy', 'r'))
            box = (x-r, y-r, x+r, y+r)
        elif tag == 'rect':
            x, y, w, h = (float(a[k]) for k in ('x', 'y', 'width', 'height'))
            box = (x, y, x+w, y+h)
        else:
            raise ValueError('Unsupported generator primitive: '+tag)
        box = tuple(round(v*scale)-(1 if i>=2 else 0) for i,v in enumerate(box))
        (draw.ellipse if tag=='circle' else draw.rectangle)(box, fill=a['fill'])
    return image.resize((width*EXPORT_SCALE, height*EXPORT_SCALE), Image.Resampling.BOX)


def outputs(root=ROOT, name='wheel'):
    svg = vector(radius(root, name))
    logical_size = int(ET.fromstring(svg).attrib['width'])
    sprite = (f'default_animation: "{name}"\n'
              'material: "/builtins/materials/sprite.material"\n'
              'textures { sampler: "texture_sampler" texture: "/main/gym/assets/gym.atlas" }\n'
              f'size_mode: SIZE_MODE_MANUAL\nsize {{ x: {logical_size}.0 y: {logical_size}.0 }}\n')
    png = BytesIO()
    raster(svg).save(png, format='PNG', optimize=False, compress_level=9)
    return {f'main/gym/assets/{name}.svg': svg.encode(),
            f'main/gym/assets/{name}.png': png.getvalue(),
            f'main/gym/{name}.sprite': sprite.encode()}


def check(root=ROOT):
    stale = []
    for name in ROUND_ASSETS:
        for path, expected in outputs(root, name).items():
            actual = root/path
            if not actual.exists():
                stale.append(path)
            elif path.endswith('.png'):
                # zlib encodings may vary across OS; deterministic decoded pixels matter.
                with Image.open(actual) as a, Image.open(BytesIO(expected)) as b:
                    if a.mode!='RGBA' or a.size!=b.size or a.tobytes()!=b.tobytes():
                        stale.append(path)
            elif actual.read_bytes()!=expected:
                stale.append(path)
    return stale


if __name__=='__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    if args.check:
        stale = check()
        if stale:
            raise SystemExit('Stale generated wheel files: '+', '.join(stale))
        print('PASS: generated SVG/PNG/sprite match the collision radius')
    else:
        for name in ROUND_ASSETS:
            for path, content in outputs(name=name).items():
                (ROOT/path).write_bytes(content)
        print('Generated centred 3x wheel assets and unchanged-size sprite')
