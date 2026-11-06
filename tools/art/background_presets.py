"""Original periodic environment art; --write regenerates, --check audits committed pixels."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import random

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'main/background_presets'
LICENSE = 'Original work generated for Rider; no third-party input.'
SIZE = (1024, 512)
THUMB = (256, 128)
FILES = [f'layer{i}' for i in range(1, 6)] + ['foreground', 'thumb']
# Sky top/bottom; distant, middle, near and foreground colours. Fixed seeds are inputs.
PRESETS = {
    'meadow': (5471, 'Meadow', ['#7caec2', '#e7e5b5', '#a0b8a3', '#718f7c', '#466a58', '#294e40']),
    'quarry': (5472, 'Quarry', ['#91a7af', '#e5d5b7', '#b9afa0', '#978d7c', '#6c736c', '#414f4e']),
    'city': (5473, 'City', ['#7b8fa9', '#dfbca3', '#9c9ea6', '#737e90', '#4a596d', '#303e50']),
    'volcano': (5474, 'Volcano', ['#4b495f', '#c38a79', '#89808b', '#6b6173', '#493f53', '#2f2b3b']),
}


def rgb(colour):
    return tuple(bytes.fromhex(colour[1:]))


def mix(a, b, t):
    return tuple(round(x + (y-x)*t) for x, y in zip(a, b))


def image_for(preset, slot):
    seed, _, colours = PRESETS[preset]
    colours = [rgb(c) for c in colours]
    w, h = SIZE
    scale = 2
    image = Image.new('RGBA', (w*scale, h*scale))
    draw = ImageDraw.Draw(image)
    rng = random.Random(seed + slot*101)
    period = w-1

    def polygon(points, colour):
        for offset in (-period, 0, period):
            draw.polygon([((x+offset)*scale, y*scale) for x, y in points], fill=colour)

    def ellipse(box, colour):
        for offset in (-period, 0, period):
            x0, y0, x1, y1 = box
            draw.ellipse(((x0+offset)*scale, y0*scale, (x1+offset)*scale, y1*scale), fill=colour)

    if slot == 0:
        for y in range(h*scale):
            draw.line((0, y, w*scale, y), fill=(*mix(colours[0], colours[1], y/(h*scale-1)), 255))
        # Thin, soft cloud banks, not a fixed sun repeated every tile.
        for _ in range(11):
            x, y = rng.randrange(period), rng.randrange(45, 205)
            ellipse((x-65, y-9, x+65, y+9), (*mix(mix(colours[0], colours[1], y/h), colours[1], .35), 255))
    else:
        foreground = slot == 5
        band = 5 if foreground else slot+1
        base = colours[min(band, 5)]
        baseline = 420 if foreground else 215 + slot*43
        amplitude = 15 if foreground else (90 if preset in ('quarry', 'volcano') else 35)
        ridge = []
        for x in range(-64, w+65, 8):
            phase = 2*math.pi*x/period
            y = baseline + amplitude*(.6*math.sin(phase*3+.8*slot)+.3*math.sin(phase*7+slot))
            ridge.append((x, y))
        polygon(ridge+[(w+64,h+2),(-64,h+2)], (*base, 255))
        if preset == 'city':
            for _ in range(22 if slot < 4 else 12):
                x = rng.randrange(period)
                bw = rng.randrange(20, 65)
                top = baseline-rng.randrange(20, 105)
                polygon([(x,top),(x+bw,top),(x+bw,baseline+40),(x,baseline+40)], (*base,255))
                # Unlit windows and a restrained warm highlight avoid visual noise.
                for wy in range(top+9, baseline-8, 15):
                    for wx in range(x+7, x+bw-4, 13):
                        if rng.random() < .35:
                            colour = mix(base, colours[1], .25 if slot < 4 else .4)
                            polygon([(wx,wy),(wx+3,wy),(wx+3,wy+5),(wx,wy+5)], (*colour,255))
        elif preset == 'meadow':
            for _ in range(24):
                x = rng.randrange(period)
                y = baseline+rng.randrange(-10, 25)
                height = rng.randrange(18, 75) if not foreground else rng.randrange(12, 32)
                polygon([(x-3,y),(x+3,y),(x+2,y-height),(x-2,y-height)], (*base,255))
                ellipse((x-height*.35,y-height,x+height*.35,y-height*.25), (*base,255))
        else:
            for _ in range(28):
                x = rng.randrange(period)
                width = rng.randrange(16, 80)
                y = baseline+rng.randrange(-4, 28)
                peak = y-rng.randrange(12, 65)
                polygon([(x-width/2,y+30),(x-width/3,peak+10),(x,peak),(x+width/2,y+30)], (*base,255))
                polygon([(x-width/3,peak+10),(x,peak),(x+width*.12,y+20)], (*mix(base,colours[1],.13),255))
            if preset == 'volcano' and slot >= 3:
                # Small amber fissures within rock; no particles, weather or animation.
                for _ in range(10):
                    x, y = rng.randrange(period), rng.randrange(baseline+35, h-12)
                    polygon([(x,y),(x+4,y+2),(x+16,y+5),(x+10,y+7)], (201,112,67,255))
    image = image.resize(SIZE, Image.Resampling.LANCZOS)
    # The repeat endpoints are byte-identical after filtering, including alpha.
    image.paste(image.crop((0,0,1,h)), (w-1,0))
    # Transparent pixels carry no hidden RGB; upload premultiplication is unambiguous.
    image.putdata([p if p[3] else (0,0,0,0) for p in image.get_flattened_data()])
    return image


def thumbnail(layers):
    result = layers[0].copy()
    for layer in layers[1:5]:
        result.alpha_composite(layer)
    # Runtime confines foreground to a lower safe strip; show that separate strip here.
    fg = layers[5].crop((0,384,1024,512)).resize((1024,64), Image.Resampling.LANCZOS)
    result.alpha_composite(fg, (0,448))
    return result.resize(THUMB, Image.Resampling.LANCZOS)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write():
    OUT.mkdir(parents=True, exist_ok=True)
    presets = []
    for preset, (seed, name, _) in PRESETS.items():
        folder = OUT/preset
        folder.mkdir(exist_ok=True)
        layers = [image_for(preset, slot) for slot in range(6)]
        images = layers+[thumbnail(layers)]
        entries = {}
        for filename, image in zip(FILES, images):
            path = folder/f'{filename}.png'
            image.save(path, optimize=False, compress_level=9)
            entries[filename] = {'sha256':digest(path), 'rgba_sha256':hashlib.sha256(image.tobytes()).hexdigest()}
        presets.append({'id':preset, 'name':name, 'seed':seed, 'files':entries})
    manifest = {'version':1, 'license':LICENSE, 'generator':'tools/art/background_presets.py',
                'generator_sha256':digest(Path(__file__)), 'size':list(SIZE), 'thumbnail_size':list(THUMB),
                'presets':presets}
    (OUT/'manifest.json').write_text(json.dumps(manifest, indent=2)+'\n', encoding='utf-8')


def check(out=OUT):
    errors = []
    try:
        manifest = json.loads((out/'manifest.json').read_text(encoding='utf-8'))
        if manifest.get('license') != LICENSE or (out/'License.txt').read_text().strip() != LICENSE:
            errors.append('license differs')
        if manifest.get('generator_sha256') != digest(Path(__file__)):
            errors.append('generator differs')
        if manifest.get('version') != 1 or manifest.get('size') != list(SIZE) or manifest.get('thumbnail_size') != list(THUMB):
            errors.append('layout differs')
        if [p['id'] for p in manifest['presets']] != list(PRESETS):
            errors.append('preset inventory differs')
        expected = {'manifest.json','PROVENANCE.md','License.txt'} | set(PRESETS)
        if {p.name for p in out.iterdir()} != expected:
            errors.append('unexpected root files')
        for preset in manifest['presets']:
            folder = out/preset['id']
            if set(preset['files']) != set(FILES) or {p.name for p in folder.iterdir()} != {f'{n}.png' for n in FILES}:
                errors.append('file inventory differs')
                continue
            images = []
            for filename in FILES:
                path = folder/f'{filename}.png'
                image = Image.open(path)
                if image.mode != 'RGBA' or image.size != (THUMB if filename == 'thumb' else SIZE):
                    errors.append(f'{preset["id"]}/{filename}: dimensions or mode differ')
                    continue
                images.append(image)
                actual = {'sha256':digest(path),'rgba_sha256':hashlib.sha256(image.tobytes()).hexdigest()}
                if preset['files'][filename] != actual:
                    errors.append(f'{preset["id"]}/{filename}: pixels differ')
                if filename != 'thumb':
                    if image.crop((0,0,1,512)).tobytes() != image.crop((1023,0,1024,512)).tobytes():
                        errors.append(f'{preset["id"]}/{filename}: repeat seam')
                    alpha = image.getchannel('A')
                    if filename == 'layer1':
                        if alpha.getextrema() != (255,255):
                            errors.append('sky is not opaque')
                    elif alpha.crop((0,0,1024,1)).getextrema() != (0,0) or alpha.getextrema() != (0,255):
                        errors.append('overlay alpha differs')
            if len(images) == 7 and images[-1].tobytes() != thumbnail(images[:6]).tobytes():
                errors.append('thumbnail differs from layers')
    except (OSError, ValueError, KeyError, TypeError) as exc:
        errors.append(str(exc))
    return errors


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--write', action='store_true')
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    if args.write:
        write()
    if args.check:
        failures = check()
        print('\n'.join(failures) if failures else 'background presets: PASS')
        raise SystemExit(bool(failures))
