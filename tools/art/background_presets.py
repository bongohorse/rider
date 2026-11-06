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


def meadow_layer(slot, rng, polygon, ellipse, draw, w, h, scale, period):
    """One distinct motif per depth: sky, far peaks, farmland, forest, near meadow, foreground grass."""
    def ridge(base, waves):
        points = []
        for x in range(-64, w+65, 4):
            phase = 2*math.pi*x/period
            points.append((x, base+sum(a*math.sin(phase*n+o) for a, n, o in waves)))
        return points

    def land(points, colour):
        polygon(points+[(w+64, h+2), (-64, h+2)], (*colour, 255))

    def height_at(points, x):
        x %= period
        return min(points, key=lambda p: abs(p[0]-x))[1]

    if slot == 0:
        top, bottom = (92, 158, 204), (236, 234, 200)
        for y in range(h*scale):
            draw.line((0, y, w*scale, y), fill=(*mix(top, bottom, (y/(h*scale-1))**.8), 255))
        # Layered cumulus: bright crowns over a soft, sky-tinted base.
        for _ in range(6):
            x, y, size = rng.randrange(period), rng.randrange(36, 120), rng.randrange(22, 54)
            sky = mix(top, bottom, y/h)
            puffs = [(x+rng.randint(-size*2, size*2), y+rng.randint(-size//5, size//6), rng.randint(size//2, size))
                     for _ in range(9)]
            for shade, lift in ((.45, -.05), (.8, .16), (.97, .3)):
                colour = mix(sky, (255, 253, 244), shade)
                for px, py, r in puffs:
                    r = r*(1-lift*.6)
                    ellipse((px-r*1.25, py-r*(.55+lift)-lift*12, px+r*1.25, py+r*.34-lift*12), (*colour, 255))
    elif slot == 1:
        # Far blue peaks with snow caps; hazy, widely spaced, no trees.
        rock, snow = (136, 165, 186), (230, 238, 240)
        for _ in range(7):
            x, base, half = rng.randrange(period), 330, rng.randrange(70, 170)
            peak = rng.randrange(120, 210)
            mid = x+rng.randint(-half//4, half//4)
            polygon([(x-half, base+40), (mid, peak), (x+half, base+40)], (*rock, 255))
            polygon([(mid, peak), (x+half, base+40), (mid+half*.1, base+40)], (*mix(rock, (104, 132, 158), .55), 255))
            cap = .22
            lx, rx = mid+(x-half-mid)*cap, mid+(x+half-mid)*cap
            ly = peak+(base+40-peak)*cap
            polygon([(mid, peak), (rx, ly), (mid+(rx-mid)*.35, ly+9), (mid, ly-3), (mid-(mid-lx)*.4, ly+11), (lx, ly)], (*snow, 255))
        land(ridge(345, [(9, 3, .4), (5, 7, 1.2)]), (150, 178, 186))
    elif slot == 2:
        # Sunlit farmland: rolling hills cut into field strips, hedges and tiny barns.
        for base, colour, seed_offset in ((325, (150, 186, 138), 0), (372, (128, 172, 112), 2)):
            line = ridge(base, [(20, 2, seed_offset), (10, 5, 1+seed_offset)])
            land(line, colour)
            for _ in range(11):
                x, width = rng.randrange(period), rng.randrange(50, 130)
                y = height_at(line, x)+rng.randrange(14, 70)
                tone = mix(colour, rng.choice([(226, 210, 122), (178, 204, 112), (108, 150, 96)]), .6)
                polygon([(x, y), (x+width, y-5), (x+width+22, y+22), (x+18, y+27)], (*tone, 255))
                polygon([(x, y-2), (x+width, y-7), (x+width, y-4), (x, y+1)], (*mix(colour, (62, 104, 74), .7), 255))
        for _ in range(4):
            x = rng.randrange(period)
            y = height_at(ridge(325, [(20, 2, 0), (10, 5, 1)]), x)+5
            polygon([(x, y), (x, y-11), (x+7, y-17), (x+14, y-11), (x+14, y)], (160, 76, 62, 255))
    elif slot == 3:
        # Dense forest edge: mixed conifers and round crowns, darker toward the ground.
        dark, mid_tone, light = (44, 92, 80), (62, 116, 92), (86, 142, 104)
        line = ridge(372, [(12, 3, 1.1), (6, 8, .3)])
        land(line, dark)
        trees = [(rng.randrange(period), rng.random(), rng.randrange(42, 104)) for _ in range(120)]
        for x, kind, tall in sorted(trees, key=lambda t: t[2], reverse=True):
            y = height_at(line, x)+12
            if kind < .55:
                for tier in range(4):
                    top = y-tall+tier*tall*.2
                    half = tall*(.13+tier*.055)
                    polygon([(x-half, top+tall*.36), (x, top), (x+half, top+tall*.36)], (*(dark if tier % 2 else mid_tone), 255))
            else:
                r = tall*.32
                ellipse((x-r, y-tall*.85, x+r, y-tall*.2), (*mid_tone, 255))
                ellipse((x-r*.75, y-tall*.84, x+r*.35, y-tall*.46), (*light, 255))
                polygon([(x-3, y), (x+3, y), (x+2, y-tall*.3), (x-2, y-tall*.3)], (*dark, 255))
    elif slot == 4:
        # Near meadow: a warm grass bank with bushes, a fence and flower dots.
        grass, shade = (92, 144, 72), (66, 118, 62)
        line = ridge(425, [(16, 2, 2.1), (7, 5, .6)])
        for _ in range(16):
            x, r = rng.randrange(period), rng.randrange(18, 50)
            y = height_at(line, x)+6
            ellipse((x-r*1.3, y-r, x+r*1.3, y+r*.5), (*shade, 255))
            ellipse((x-r*.8, y-r*.92, x+r*.5, y-r*.1), (*grass, 255))
        land(line, grass)
        for start in range(0, 1020, 340):
            for i in range(6):
                x = start+40+i*30
                y = height_at(line, x)
                polygon([(x-2, y+3), (x+2, y+3), (x+2, y-27), (x-2, y-27)], (118, 92, 66, 255))
                if i < 5:
                    y2 = height_at(line, x+30)
                    polygon([(x, y-20), (x+30, y2-20), (x+30, y2-17), (x, y-17)], (138, 110, 78, 255))
        for _ in range(170):
            x = rng.randrange(period)
            y = height_at(line, x)+rng.randrange(8, 80)
            colour = rng.choice([(244, 232, 150), (246, 246, 236), (226, 134, 150), (112, 170, 84)])
            ellipse((x-1.6, y-1.6, x+1.6, y+1.6), (*colour, 255))
    else:
        # Foreground: a low dark grass and fern fringe, under a fifth of the image high.
        dark, tone = (26, 58, 44), (38, 76, 54)
        line = ridge(474, [(5, 3, .7), (3, 9, 1.9)])
        land(line, dark)
        for _ in range(620):
            x = rng.randrange(period)
            y = height_at(line, x)+3
            tall, lean = rng.randrange(10, 42), rng.randint(-11, 11)
            polygon([(x-2.2, y), (x+2.2, y), (x+lean, y-tall)], (*(tone if rng.random() < .35 else dark), 255))
        for _ in range(13):
            x, y = rng.randrange(period), 468
            for frond in range(-3, 4):
                tip = (x+frond*11, y-44+abs(frond)*7)
                polygon([(x-2, y+6), (x+2, y+6), tip], (*dark, 255))


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

    if preset == 'meadow':
        meadow_layer(slot, rng, polygon, ellipse, draw, w, h, scale, period)
    elif slot == 0:
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


def thumbnail(layers, preset=''):
    result = layers[0].copy()
    for layer in layers[1:5]:
        result.alpha_composite(layer)
    # #603 shows the complete foreground at viewport height; other presets keep their strip until they are rebuilt.
    if preset == 'meadow':
        result.alpha_composite(layers[5])
        return result.resize(THUMB, Image.Resampling.LANCZOS)
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
        images = layers+[thumbnail(layers, preset)]
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
            if len(images) == 7 and images[-1].tobytes() != thumbnail(images[:6], preset['id']).tobytes():
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
