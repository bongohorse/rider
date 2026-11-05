"""Manifest, thumbnails and checks for the original level material presets (#538).

    node tools/art/level_materials.cjs
    python tools/art/level_materials.py --write
    python tools/art/level_materials.py --check
    python tools/art/level_materials.py --contact OUT.png

`check()` needs neither Chromium nor network: it verifies committed pixels, layout, thumbnails and that the generator
did not change after the last generation. Rules: docs/contracts/level-visuals.md.
"""
import argparse
import hashlib
import json
from pathlib import Path
import sys

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT/'main/terrain_material/presets'
GENERATOR = ROOT/'tools/art/level_materials.cjs'
LICENSE = 'Original work generated for Rider; no third-party input.'
SIZES = {'surface': (512, 128), 'band': (512, 128), 'fill': (512, 512)}
THUMB = 128
SURFACE_OPAQUE_FROM = 24  # far edge may fray above this row; the contact side stays opaque
SEAM_FACTOR = 2.5  # a repeat edge may differ at most this much more than neighbouring columns or rows


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def thumbnail(folder):
    """Fill with the Band over it, the Surface strip above: how the preset reads on a track."""
    surface = Image.open(folder/'surface.png').convert('RGBA').resize((THUMB, 32), Image.LANCZOS)
    band = Image.open(folder/'band.png').convert('RGBA').resize((THUMB, 32), Image.LANCZOS)
    fill = Image.open(folder/'fill.png').convert('RGBA').crop((0, 0, 256, 192)).resize((THUMB, 96), Image.LANCZOS)
    out = Image.new('RGBA', (THUMB, THUMB), (24, 30, 38, 255))
    out.paste(fill, (0, 32))
    out.alpha_composite(surface, (0, 0))
    out.alpha_composite(band, (0, 32))
    return out


def write():
    meta = json.loads((OUT/'generation.json').read_text(encoding='utf-8'))
    presets = []
    for p in meta['presets']:
        folder = OUT/p['id']
        thumbnail(folder).save(folder/'thumb.png', optimize=True)
        files = {name: sha256(folder/f'{name}.png') for name in (*SIZES, 'thumb')}
        presets.append({'id': p['id'], 'name': p['name'], 'seed': p['seed'], 'sha256': files})
    manifest = {'schema': 1, 'issue': 538, 'license': LICENSE, 'generator': meta['generator'],
                'generator_sha256': sha256(GENERATOR), 'browser': meta['browser'], 'pixels_per_metre': 128,
                'sizes': {k: list(v) for k, v in SIZES.items()}, 'presets': presets}
    (OUT/'manifest.json').write_text(json.dumps(manifest, indent=1)+'\n', encoding='utf-8')
    (OUT/'generation.json').unlink()


def edge_difference(image, axis):
    """(difference across the repeat edge, typical difference between neighbouring lines), RGBA means."""
    data = image.convert('RGBA')
    w, h = data.size
    pixels = data.load()
    length, lines = (h, w) if axis == 'u' else (w, h)

    def at(line, i):
        return pixels[line, i] if axis == 'u' else pixels[i, line]

    def diff(a, b):
        return sum(sum(abs(p-q) for p, q in zip(at(a, i), at(b, i))) for i in range(length))/length
    inner = sum(diff(i, i+1) for i in range(0, lines-1, max(1, lines//32)))/len(range(0, lines-1, max(1, lines//32)))
    return diff(lines-1, 0), inner


def check():
    errors = []
    try:
        manifest = json.loads((OUT/'manifest.json').read_text(encoding='utf-8'))
    except (OSError, ValueError) as exc:
        return [f'manifest: {exc}']
    if manifest.get('generator_sha256') != sha256(GENERATOR):
        errors.append('generator changed after the last generation')
    if manifest.get('license') != LICENSE:
        errors.append('license text differs')
    if not manifest.get('presets'):
        errors.append('no presets')
    for preset in manifest.get('presets', []):
        folder = OUT/preset['id']
        for name, digest in preset['sha256'].items():
            path = folder/f'{name}.png'
            if not path.is_file() or sha256(path) != digest:
                errors.append(f'{preset["id"]}/{name}: pixels differ from the manifest')
        if errors:
            continue
        images = {name: Image.open(folder/f'{name}.png').convert('RGBA') for name in SIZES}
        for name, size in SIZES.items():
            if images[name].size != size:
                errors.append(f'{preset["id"]}/{name}: size {images[name].size}')
        alpha = images['surface'].getchannel('A').crop((0, SURFACE_OPAQUE_FROM, 512, 128))
        if alpha.getextrema()[0] != 255:
            errors.append(f'{preset["id"]}/surface: holes in the opaque zone')
        if images['surface'].getchannel('A').crop((0, 0, 512, 2)).getextrema()[0] == 255:
            errors.append(f'{preset["id"]}/surface: far edge does not fray')
        if images['band'].getchannel('A').crop((0, 127, 512, 128)).getextrema()[1] != 0:
            errors.append(f'{preset["id"]}/band: art reaches the last row')
        if images['band'].getchannel('A').crop((0, 0, 512, 1)).getextrema()[0] != 255:
            errors.append(f'{preset["id"]}/band: gap at the fold')
        if images['fill'].getchannel('A').getextrema()[0] != 255:
            errors.append(f'{preset["id"]}/fill: not opaque')
        for name, axes in (('surface', 'u'), ('band', 'u'), ('fill', 'uv')):
            for axis in axes:
                across, inner = edge_difference(images[name], axis)
                if across > max(inner*SEAM_FACTOR, 1):
                    errors.append(f'{preset["id"]}/{name}: seam in {axis} ({across:.1f} against {inner:.1f})')
    return errors


def contact(path):
    manifest = json.loads((OUT/'manifest.json').read_text(encoding='utf-8'))
    rows = []
    for preset in manifest['presets']:
        folder = OUT/preset['id']
        row = Image.new('RGBA', (1024, 384), (24, 30, 38, 255))
        fill = Image.open(folder/'fill.png').convert('RGBA')
        for x in (0, 512):
            row.paste(fill.crop((0, 0, 512, 256)), (x, 128))
            row.alpha_composite(Image.open(folder/'surface.png').convert('RGBA'), (x, 0))
            row.alpha_composite(Image.open(folder/'band.png').convert('RGBA'), (x, 128))
        rows.append(row)
    sheet = Image.new('RGBA', (1024, 392*len(rows)), (0, 0, 0, 255))
    for i, row in enumerate(rows):
        sheet.paste(row, (0, 392*i))
    sheet.save(path)


def main():
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
        errors = check()
        for error in errors:
            print(error)
        print('level materials:', 'FAIL' if errors else 'PASS')
        return 1 if errors else 0
    return 0


if __name__ == '__main__':
    sys.exit(main())
