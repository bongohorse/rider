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

from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT/'main/terrain_material/presets'
GENERATOR = ROOT/'tools/art/level_materials.cjs'
LICENSE = 'Original work generated for Rider; no third-party input.'
SIZES = {'surface': (512, 128), 'band': (512, 128), 'fill': (512, 512)}
FILES = (*SIZES, 'thumb')
RENDER_FILES = ('chunk.mesh', 'chunk.go', 'chunk.factory')
THUMB = 128
SURFACE_OPAQUE_FROM = 24  # far edge may fray above this row; the contact side stays opaque
SEGMENT = 16  # pixels compared at once across a repeat edge
SEAM_FACTOR = 1.5  # the worst edge segment may differ at most this much more than the worst inner one
SEAM_MEAN_FACTOR = 2.5  # the same for the whole edge, which catches a uniform colour step
FRAYED_SHARE = .5  # share of each such row that must be fully transparent
FOLD_LIMIT = 8  # mean brightness levels Surface and Band may differ near the fold
FOLD_ROWS = 6  # rows compared on each side of the fold, averaged into one row
FRAY_ROWS = 4  # rows of the Surface's far edge that must each be mostly transparent; it may fray or be straight
THUMB_LIMIT = .25  # mean brightness levels a thumbnail may differ from its preset


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


def render_files(preset_id):
    """The preset's mesh, game object and factory; loaded only when a level uses this preset."""
    root = f'/main/terrain_material/presets/{preset_id}'
    return {
        'chunk.mesh': ('material: "/main/terrain_perspective/preset.material"\n'
                       'vertices: "/main/terrain_perspective/textured_empty.buffer"\n'
                       + ''.join(f'textures: "{root}/{name}.png"\n' for name in SIZES)
                       + 'primitive_type: PRIMITIVE_TRIANGLES\nposition_stream: "position"\n'),
        'chunk.go': f'components {{ id: "mesh" component: "{root}/chunk.mesh" }}\n',
        'chunk.factory': f'prototype: "{root}/chunk.go"\nload_dynamically: true\n',
    }


def write_render_files():
    manifest = json.loads((OUT/'manifest.json').read_text(encoding='utf-8'))
    for preset in manifest['presets']:
        for name, text in render_files(preset['id']).items():
            (OUT/preset['id']/name).write_text(text, encoding='utf-8')


def write():
    meta = json.loads((OUT/'generation.json').read_text(encoding='utf-8'))
    if meta['generator_sha256'] != sha256(GENERATOR):
        raise SystemExit('generator changed after it ran; run it again')
    presets = []
    for p in meta['presets']:
        folder = OUT/p['id']
        thumbnail(folder).save(folder/'thumb.png', optimize=True)
        files = {name: sha256(folder/f'{name}.png') for name in FILES}
        presets.append({'id': p['id'], 'name': p['name'], 'seed': p['seed'], 'sha256': files})
    manifest = {'schema': 1, 'issue': 538, 'license': LICENSE, 'generator': meta['generator'],
                'generator_sha256': meta['generator_sha256'], 'browser': meta['browser'], 'pixels_per_metre': 128,
                'sizes': {k: list(v) for k, v in SIZES.items()}, 'presets': presets}
    (OUT/'manifest.json').write_text(json.dumps(manifest, indent=1)+'\n', encoding='utf-8')
    (OUT/'generation.json').unlink()
    write_render_files()


def line_difference(image, axis, a, b):
    """Mean RGBA difference between two lines, per SEGMENT pixels, so a local break does not average away."""
    pixels = image.load()
    w, h = image.size
    length = h if axis == 'u' else w
    out = []
    for start in range(0, length, SEGMENT):
        total = count = 0
        for i in range(start, min(start+SEGMENT, length)):
            p, q = (pixels[a, i], pixels[b, i]) if axis == 'u' else (pixels[i, a], pixels[i, b])
            total += sum(abs(x-y) for x, y in zip(p, q))
            count += 1
        out.append(total/count)
    return out


def edge_difference(image, axis):
    """Edge and inner differences: ((worst edge segment, edge mean), (worst inner segment, inner mean))."""
    data = image.convert('RGBA')
    lines = data.size[0] if axis == 'u' else data.size[1]
    step = max(1, lines//64)
    inner = [line_difference(data, axis, i, i+1) for i in range(step//2, lines-1, step)]
    edge = line_difference(data, axis, lines-1, 0)
    return (max(edge), sum(edge)/len(edge)), (max(max(v) for v in inner), sum(sum(v)/len(v) for v in inner)/len(inner))


def has_seam(across, inner):
    return across[0] > max(inner[0]*SEAM_FACTOR, 1) or across[1] > max(inner[1]*SEAM_MEAN_FACTOR, 1)


def mean_difference(a, b):
    a, b = a.convert('RGB'), b.convert('RGB')
    diff = ImageChops.difference(a, b).convert('L').tobytes()
    return sum(diff)/len(diff)


def check_preset(preset, out):
    """Every rule for one preset; returns its errors."""
    errors = []
    name_ = preset['id']
    folder = out/name_
    if set(preset['sha256']) != set(FILES):
        return [f'{name_}: manifest lists {sorted(preset["sha256"])}']
    for name, digest in preset['sha256'].items():
        path = folder/f'{name}.png'
        if not path.is_file() or sha256(path) != digest:
            errors.append(f'{name_}/{name}: pixels differ from the manifest')
    if errors:
        return errors
    images = {name: Image.open(folder/f'{name}.png').convert('RGBA') for name in SIZES}
    for name, size in SIZES.items():
        if images[name].size != size:
            errors.append(f'{name_}/{name}: size {images[name].size}')
    if errors:
        return errors
    thumb = Image.open(folder/'thumb.png').convert('RGBA')
    if thumb.size != (THUMB, THUMB) or mean_difference(thumb, thumbnail(folder)) > THUMB_LIMIT:
        errors.append(f'{name_}/thumb: does not show this preset')
    surface_alpha = images['surface'].getchannel('A')
    if surface_alpha.crop((0, SURFACE_OPAQUE_FROM, 512, 128)).getextrema()[0] != 255:
        errors.append(f'{name_}/surface: holes in the opaque zone')
    rows = [surface_alpha.crop((0, i, 512, i+1)).tobytes() for i in range(FRAY_ROWS)]
    if min(row.count(0)/len(row) for row in rows) < FRAYED_SHARE:
        errors.append(f'{name_}/surface: far edge is not open')
    band_alpha = images['band'].getchannel('A')
    if band_alpha.crop((0, 127, 512, 128)).getextrema()[1] != 0:
        errors.append(f'{name_}/band: art reaches the last row')
    if band_alpha.crop((0, 0, 512, 1)).getextrema()[0] != 255:
        errors.append(f'{name_}/band: gap at the fold')
    if images['fill'].getchannel('A').getextrema()[0] != 255:
        errors.append(f'{name_}/fill: not opaque')
    near_surface = images['surface'].crop((0, 128-FOLD_ROWS, 512, 128)).resize((512, 1), Image.BOX)
    near_band = images['band'].crop((0, 0, 512, FOLD_ROWS)).resize((512, 1), Image.BOX)
    fold = mean_difference(near_surface, near_band)
    if fold > FOLD_LIMIT:
        errors.append(f'{name_}: Surface and Band differ at the fold ({fold:.1f})')
    for name, axes in (('surface', 'u'), ('band', 'u'), ('fill', 'uv')):
        for axis in axes:
            across, inner = edge_difference(images[name], axis)
            if has_seam(across, inner):
                errors.append(f'{name_}/{name}: seam in {axis} ({across[0]:.1f} and {across[1]:.1f} against {inner[0]:.1f} and {inner[1]:.1f})')
    return errors


def check(out=OUT):
    try:
        manifest = json.loads((out/'manifest.json').read_text(encoding='utf-8'))
    except (OSError, ValueError) as exc:
        return [f'manifest: {exc}']
    errors = []
    if manifest.get('sizes') != {k: list(v) for k, v in SIZES.items()} or manifest.get('pixels_per_metre') != 128:
        errors.append('layout differs from the manifest')
    entries = {p.name for p in out.iterdir()}
    expected = {'manifest.json'} | {p['id'] for p in manifest.get('presets', [])}
    if entries != expected:
        errors.append(f'unexpected files: {sorted(entries ^ expected)}')
    for preset in manifest.get('presets', []):
        folder = out/preset['id']
        files = {p.name for p in folder.iterdir()} if folder.is_dir() else set()
        if files != {f'{name}.png' for name in FILES} | set(RENDER_FILES):
            errors.append(f'{preset["id"]}: unexpected files {sorted(files)}')
        else:
            for name, text in render_files(preset['id']).items():
                if (folder/name).read_text(encoding='utf-8') != text:
                    errors.append(f'{preset["id"]}/{name}: differs from the generator')
    if manifest.get('generator_sha256') != sha256(GENERATOR):
        errors.append('generator changed after the last generation')
    if manifest.get('license') != LICENSE:
        errors.append('license text differs')
    if not manifest.get('presets'):
        errors.append('no presets')
    for preset in manifest.get('presets', []):
        errors += check_preset(preset, out)
    return errors


def contact(path):
    manifest = json.loads((OUT/'manifest.json').read_text(encoding='utf-8'))
    rows = []
    for preset in manifest['presets']:
        folder = OUT/preset['id']
        row = Image.new('RGBA', (1024, 896), (24, 30, 38, 255))
        fill = Image.open(folder/'fill.png').convert('RGBA')
        for x in (0, 512):
            row.paste(fill.crop((0, 0, 512, 256)), (x, 128))
            row.alpha_composite(Image.open(folder/'surface.png').convert('RGBA'), (x, 0))
            row.alpha_composite(Image.open(folder/'band.png').convert('RGBA'), (x, 128))
        # The Fill repeats both ways: 2 x 2 at half size.
        half = fill.resize((256, 256), Image.LANCZOS)
        for x in (0, 256):
            for y in (0, 256):
                row.paste(half, (x, 384+y))
        rows.append(row)
    sheet = Image.new('RGBA', (1024, 904*len(rows)), (0, 0, 0, 255))
    for i, row in enumerate(rows):
        sheet.paste(row, (0, 904*i))
    sheet.save(path)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--write', action='store_true')
    parser.add_argument('--write-render-files', action='store_true')
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--contact')
    args = parser.parse_args()
    if args.write:
        write()
    if args.write_render_files:
        write_render_files()
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
