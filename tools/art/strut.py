"""Generate the suspension strut SVG, 3x PNG and manual-size sprite (Car Feel 3).

The strut is drawn end to end: its two eye centres sit 3 u inside the sprite
ends and the eyes reach the ends, so the stretched sprite spans exactly the
chassis mount and the wheel centre. juice.lua reads the sprite size at runtime
and scales y only; the coil rungs then visibly bunch up under compression.
"""
import argparse
from io import BytesIO
from pathlib import Path
import xml.etree.ElementTree as ET

from wheel import raster

ROOT = Path(__file__).resolve().parents[2]
# Logical sprite size in engine units: about the rest length mount -> wheel centre.
WIDTH, LENGTH = 8, 28


def vector():
    svg = ET.Element('svg', xmlns='http://www.w3.org/2000/svg', width=str(WIDTH), height=str(LENGTH),
                     viewBox=f'0 0 {WIDTH} {LENGTH}')
    ET.SubElement(svg, 'title').text = 'Suspension strut; eyes at both ends, stretched along y at runtime'
    c = WIDTH/2
    ET.SubElement(svg, 'rect', x=str(c-1), y='0', width='2', height=str(LENGTH), fill='#d9e2e6')
    for y in range(5, LENGTH-5, 4):
        ET.SubElement(svg, 'rect', x='0', y=str(y), width=str(WIDTH), height='2', fill='#e0a43a')
    for cy in (3, LENGTH-3):
        ET.SubElement(svg, 'circle', cx=str(c), cy=str(cy), r='3', fill='#2b343a')
        ET.SubElement(svg, 'circle', cx=str(c), cy=str(cy), r='1.5', fill='#e7eef0')
    ET.indent(svg, space='  ')
    return ET.tostring(svg, encoding='unicode')+'\n'


def outputs():
    svg = vector()
    sprite = ('default_animation: "strut"\n'
              'material: "/builtins/materials/sprite.material"\n'
              'textures { sampler: "texture_sampler" texture: "/main/gym/assets/gym.atlas" }\n'
              f'size_mode: SIZE_MODE_MANUAL\nsize {{ x: {WIDTH}.0 y: {LENGTH}.0 }}\n')
    png = BytesIO()
    raster(svg).save(png, format='PNG', optimize=False, compress_level=9)
    return {'main/gym/assets/strut.svg': svg.encode(),
            'main/gym/assets/strut.png': png.getvalue(),
            'main/gym/strut.sprite': sprite.encode()}


def check(root=ROOT):
    from PIL import Image
    stale = []
    for path, expected in outputs().items():
        actual = root/path
        if not actual.exists():
            stale.append(path)
        elif path.endswith('.png'):
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
            raise SystemExit('Stale generated strut files: '+', '.join(stale))
        print('PASS: generated strut SVG/PNG/sprite are current')
    else:
        for path, content in outputs().items():
            (ROOT/path).write_bytes(content)
        print('Generated 3x strut assets and the manual-size sprite')
