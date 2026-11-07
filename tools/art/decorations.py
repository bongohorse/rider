"""Original Meadow decoration set (#559); --write regenerates, --check audits committed pixels, --contact OUT previews."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import random

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT/'main/decorations/meadow'
LUA = ROOT/'main/decorations/assets.lua'
LICENSE = 'Original work generated for Rider; no third-party input.'
PPM = 96  # art pixels per metre at scale 1
SS = 4    # supersampling
THUMB = 64
SEED = 5670
# id: name, width and height in metres, how far the base sinks below the anchor so it never floats.
ASSETS = {
    'tree-oak': ('Oak tree', 3.0, 4.0, .10),
    'tree-pine': ('Pine tree', 2.0, 4.5, .10),
    'bush-round': ('Round bush', 1.5, 1.0, .06),
    'bush-berry': ('Berry bush', 1.75, 1.25, .06),
    'grass-tuft': ('Grass tuft', 1.0, .5, .03),
    'grass-tall': ('Tall grass', 1.25, 1.0, .03),
    'flowers': ('Flowers', 1.25, .625, .03),
    'rock-small': ('Small rock', 1.0, .625, .08),
    'rock-large': ('Large rock', 2.25, 1.5, .12),
    'sign': ('Wooden sign', 1.25, 1.5, .08),
    'cone': ('Traffic cone', .625, .875, .02),
}
LEAF = ((46, 92, 60), (74, 132, 72), (122, 172, 88), (172, 208, 112))
BARK = ((70, 48, 36), (112, 78, 52), (148, 110, 72))
STONE = ((92, 98, 96), (136, 140, 132), (178, 180, 166))


def blob(d, x, y, r, rng, colours, puffs=7):
    """A leafy mass: dark base, then lighter puffs shifted up and to the upper left, like the scene light."""
    for i, colour in enumerate(colours):
        t = i/max(1, len(colours)-1)
        for _ in range(puffs if i else 1):
            a = rng.uniform(0, 2*math.pi)
            spread = 0 if i == 0 else r*(.62-.3*t)
            px, py = x+math.cos(a)*spread-r*.22*t, y+math.sin(a)*spread*.75-r*.3*t
            pr = r if i == 0 else r*rng.uniform(.3, .46)*(1-.3*t)
            d.ellipse((px-pr, py-pr, px+pr, py+pr), fill=(*colour, 255))


def blade(d, x, base, height, lean, width, colour):
    d.polygon([(x-width, base), (x+width, base), (x+lean, base-height)], fill=(*colour, 255))


def rock(d, w, h, rng):
    n, pts = 11, []
    for i in range(n):
        a = math.pi+math.pi*i/(n-1)
        k = rng.uniform(.86, 1)
        pts.append((w/2+math.cos(a)*w*.47*k, h+math.sin(a)*h*.92*k))
    d.polygon(pts, fill=(*STONE[0], 255))
    d.polygon([(p[0]*.86+w*.03, h-(h-p[1])*.9) for p in pts], fill=(*STONE[1], 255))
    d.polygon([(p[0]*.5+w*.14, h*.42-(h-p[1])*.48+h*.24) for p in pts[1:8]], fill=(*STONE[2], 255))


def paint(asset, w, h, rng):
    """Draw one asset on a supersampled canvas of w x h pixels with its base on the bottom edge."""
    image = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(image)
    if asset == 'tree-oak':
        d.polygon([(w*.43, h), (w*.57, h), (w*.54, h*.42), (w*.46, h*.42)], fill=(*BARK[1], 255))
        d.polygon([(w*.43, h), (w*.48, h), (w*.485, h*.42), (w*.46, h*.42)], fill=(*BARK[2], 255))
        d.polygon([(w*.52, h*.62), (w*.54, h*.56), (w*.76, h*.42), (w*.74, h*.47)], fill=(*BARK[0], 255))
        for x, y, r in ((.5, .34, .31), (.27, .42, .2), (.74, .42, .2), (.36, .2, .19), (.64, .2, .19)):
            blob(d, w*x, h*y, w*r, rng, LEAF)
    elif asset == 'tree-pine':
        d.rectangle((w*.45, h*.8, w*.55, h), fill=(*BARK[1], 255))
        for i in range(5):
            top, bottom, half = h*(.02+.15*i), h*(.3+.14*i), w*(.2+.07*i)
            for colour, side in ((LEAF[0], 1), (LEAF[1], .72)):
                d.polygon([(w*.5, top), (w*.5+half*side, bottom), (w*.5-half, bottom)], fill=(*colour, 255))
            d.polygon([(w*.5, top+h*.03), (w*.5-half*.15, bottom-h*.03), (w*.5-half*.72, bottom-h*.03)], fill=(*LEAF[2], 255))
    elif asset in ('bush-round', 'bush-berry'):
        for x, y, r in ((.5, .54, .33), (.25, .78, .22), (.75, .78, .22)):
            blob(d, w*x, h*y, h*r*1.05, rng, LEAF, 6)
        if asset == 'bush-berry':
            for _ in range(16):
                x, y, r = rng.uniform(.14, .86)*w, rng.uniform(.3, .85)*h, w*.016
                if image.getpixel((round(x), round(y)))[3]:  # berries only on leaves
                    d.ellipse((x-r, y-r, x+r, y+r), fill=(186, 46, 58, 255))
    elif asset in ('grass-tuft', 'grass-tall'):
        for _ in range(44 if asset == 'grass-tall' else 34):
            x = rng.uniform(.08, .92)*w
            edge = 1-abs(x/w-.5)*1.6
            blade(d, x, h, h*rng.uniform(.45, .98)*edge, rng.uniform(-.12, .12)*w, w*.018, LEAF[rng.randrange(4)])
    elif asset == 'flowers':
        for _ in range(22):
            blade(d, rng.uniform(.06, .94)*w, h, h*rng.uniform(.25, .55), rng.uniform(-.05, .05)*w, w*.012, LEAF[rng.randrange(3)])
        for i in range(9):
            x, y, r = w*(.1+.1*i)+rng.uniform(-.02, .02)*w, h*rng.uniform(.14, .55), h*.075
            petals = ((244, 240, 228), (240, 196, 72), (216, 104, 136))[i % 3]
            d.line((x, y, x+rng.uniform(-.02, .02)*w, h), fill=(*LEAF[1], 255), width=max(1, round(w*.012)))
            for a in range(5):
                px, py = x+math.cos(a*1.257)*r, y+math.sin(a*1.257)*r
                d.ellipse((px-r*.7, py-r*.7, px+r*.7, py+r*.7), fill=(*petals, 255))
            d.ellipse((x-r*.5, y-r*.5, x+r*.5, y+r*.5), fill=(120, 76, 36, 255))
    elif asset in ('rock-small', 'rock-large'):
        rock(d, w, h, rng)
    elif asset == 'sign':
        d.rectangle((w*.44, h*.4, w*.56, h), fill=(*BARK[1], 255))
        d.rectangle((w*.44, h*.4, w*.48, h), fill=(*BARK[2], 255))
        d.polygon([(w*.04, h*.08), (w*.8, h*.08), (w*.98, h*.3), (w*.8, h*.52), (w*.04, h*.52)], fill=(*BARK[0], 255))
        d.polygon([(w*.08, h*.11), (w*.79, h*.11), (w*.93, h*.3), (w*.79, h*.49), (w*.08, h*.49)], fill=(*BARK[2], 255))
        for y in (.2, .3, .4):
            d.rectangle((w*.18, h*(y-.012), w*.68, h*(y+.012)), fill=(*BARK[0], 255))
    elif asset == 'cone':
        d.polygon([(w*.04, h*.93), (w*.96, h*.93), (w*.96, h), (w*.04, h)], fill=(52, 50, 50, 255))
        d.polygon([(w*.45, 0), (w*.55, 0), (w*.82, h*.93), (w*.18, h*.93)], fill=(232, 104, 36, 255))
        d.polygon([(w*.36, h*.34), (w*.64, h*.34), (w*.72, h*.6), (w*.28, h*.6)], fill=(246, 242, 232, 255))
        d.polygon([(w*.45, 0), (w*.48, 0), (w*.3, h*.93), (w*.18, h*.93)], fill=(255, 255, 255, 56))
    return image


def render(asset):
    _, width, height, _ = ASSETS[asset]
    w, h = round(width*PPM), round(height*PPM)
    # Every asset has its own stream, so changing one never changes another.
    rng = random.Random(f'{SEED}:{asset}')
    return paint(asset, w*SS, h*SS, rng).resize((w, h), Image.LANCZOS)


def thumbnail(image):
    t = Image.new('RGBA', (THUMB, THUMB), (0, 0, 0, 0))
    copy = image.copy()
    copy.thumbnail((THUMB-4, THUMB-4), Image.LANCZOS)
    t.alpha_composite(copy, ((THUMB-copy.width)//2, THUMB-2-copy.height))
    return t


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def lua_catalog():
    rows = ''.join(f"    ['{a}']={{name='{n}',width={w},height={h},sink={s}}},\n" for a, (n, w, h, s) in ASSETS.items())
    order = ','.join(f"'{a}'" for a in ASSETS)
    return ('-- Generated by tools/art/decorations.py. Stable IDs of the preset decorations; sizes in metres.\n'
            f'return {{ORDER={{{order}}},ASSETS={{\n{rows}}}}}\n')


def atlas_text():
    head = ''.join(f'images {{ image: "/main/decorations/meadow/{a}.png" }}\n' for a in ASSETS)
    anims = ''.join(f'animations {{\n  id: "{a}"\n  images {{ image: "/main/decorations/meadow/{a}.png" }}\n}}\n' for a in ASSETS)
    return head+'extrude_borders: 2\n'+anims


def write(out=OUT):
    out.mkdir(parents=True, exist_ok=True)
    (out/'thumbs').mkdir(exist_ok=True)
    files = {}
    for asset in ASSETS:
        image = render(asset)
        image.save(out/f'{asset}.png')
        thumbnail(image).save(out/'thumbs'/f'{asset}.png')
        files[asset] = {'sha256': digest(out/f'{asset}.png'), 'rgba_sha256': hashlib.sha256(image.tobytes()).hexdigest(),
                        'thumb_sha256': digest(out/'thumbs'/f'{asset}.png')}
    (out/'License.txt').write_text(LICENSE+'\n')
    (out/'PROVENANCE.md').write_text(
        '# Meadow decorations\n\nEvery pixel is generated by `tools/art/decorations.py` with Pillow. Inputs are that file and its '
        f'fixed seed {SEED}. No archive, external image, reference still or third-party asset is an input. `--write` reproduces the set; '
        '`--check` verifies committed files without any source archive. Kenney test assets are not part of this set. '
        'Claudio approves art direction in #560.\n')
    manifest = {'version': 1, 'license': LICENSE, 'seed': SEED, 'ppm': PPM, 'generator_sha256': digest(__file__), 'assets': files}
    (out/'manifest.json').write_text(json.dumps(manifest, indent=1, sort_keys=True)+'\n')
    if out == OUT:
        LUA.write_text(lua_catalog())
        (ROOT/'main/decorations/decorations.atlas').write_text(atlas_text())


def check(out=OUT):
    errors = []
    try:
        manifest = json.loads((out/'manifest.json').read_text())
        if manifest.get('license') != LICENSE or (out/'License.txt').read_text().strip() != LICENSE:
            errors.append('license differs')
        if manifest.get('generator_sha256') != digest(__file__):
            errors.append('generator differs')
        if list(sorted(manifest['assets'])) != sorted(ASSETS):
            errors.append('asset IDs differ')
        if {p.name for p in (out/'thumbs').iterdir()} != {f'{a}.png' for a in ASSETS}:
            errors.append('thumbnail inventory differs')
        if {p.name for p in out.iterdir()} != {f'{a}.png' for a in ASSETS} | {'thumbs', 'manifest.json', 'License.txt', 'PROVENANCE.md'}:
            errors.append('unexpected files')
        if out == OUT and (LUA.read_text() != lua_catalog() or (ROOT/'main/decorations/decorations.atlas').read_text() != atlas_text()):
            errors.append('catalog or atlas differs')
        for asset, entry in manifest['assets'].items():
            image = Image.open(out/f'{asset}.png')
            _, width, height, _ = ASSETS[asset]
            if image.mode != 'RGBA' or image.size != (round(width*PPM), round(height*PPM)):
                errors.append(f'{asset}: dimensions or mode differ')
                continue
            if hashlib.sha256(image.tobytes()).hexdigest() != entry['rgba_sha256'] or digest(out/f'{asset}.png') != entry['sha256']:
                errors.append(f'{asset}: pixels differ')
            alpha = image.getchannel('A')
            box = alpha.getbbox()
            if alpha.getextrema() != (0, 255) or not box or box[3] != image.height:
                errors.append(f'{asset}: must be cut out and stand on its bottom edge')
            if digest(out/'thumbs'/f'{asset}.png') != entry['thumb_sha256']:
                errors.append(f'{asset}: thumbnail differs')
    except (OSError, ValueError, KeyError, TypeError) as exc:
        errors.append(str(exc))
    return errors


def contact(path, out=OUT):
    """Preview on a Meadow background so the set can be judged in context."""
    sheet = Image.open(ROOT/'main/background_presets/meadow/layer1.png').convert('RGBA').resize((1500, 520))
    sheet.alpha_composite(Image.open(ROOT/'main/background_presets/meadow/layer3.png').convert('RGBA').resize((1500, 520)))
    x = 16
    for asset in ASSETS:
        image = Image.open(out/f'{asset}.png')
        sheet.alpha_composite(image, (x, 500-image.height))
        x += image.width+8
    ImageDraw.Draw(sheet).rectangle((0, 500, 1500, 520), fill=(92, 72, 50, 255))
    sheet.save(path)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--write', action='store_true')
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--contact')
    args = parser.parse_args()
    if args.write:
        write()
    if args.contact:
        contact(args.contact)
    if args.check:
        failures = check()
        print('\n'.join(failures) if failures else 'decorations: PASS')
        raise SystemExit(bool(failures))
