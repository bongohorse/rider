"""Build the 24-slot Kenney terrain atlas and manifest for #392 Stage A.

Input: the official Kenney "New Platformer Pack" 1.1 ZIP (CC0), downloaded by
hand from https://kenney.nl/assets/new-platformer-pack. The archive is
untrusted data: this script only verifies its SHA-256, then reads 24 exact PNG
entries and License.txt into memory (no extraction, no code from the archive).
Run it isolated from the archive's directory, for example:

    python -I tools/art/terrain_material.py /tmp/kenney/kenney_new-platformer-pack-1.1.zip

Output (committed): main/terrain_material/kenney_terrain_64.png, manifest.json
and License.txt (verbatim). The atlas is six family rows x four slot columns;
each 64 px tile sits in an 80 px cell with an 8 px edge extrusion, top-left
pixel origin. The renderer flips V once in the fragment shader.

`check()` (used by tests/bootstrap/test_terrain_material_art.py) needs no ZIP:
it verifies the committed atlas pixels, layout and license against the manifest.
"""
import argparse
import hashlib
import io
import json
from pathlib import Path
import sys
import zipfile

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT/'main/terrain_material'
ZIP_SHA256 = '553b907f3f0e505ab65f56f245ccaff3123c8fe3f3a0dfce9373b996bfc18cc2'
PAGE = 'https://kenney.nl/assets/new-platformer-pack'
FAMILIES = ('grass', 'dirt', 'sand', 'snow', 'stone', 'purple')
# Slot -> Kenney tile name. Column order is the renderer's face index.
SLOTS = (('surface', 'block_top'), ('rim', 'horizontal_middle'), ('side', 'block_center'), ('end', 'vertical_middle'))
TILE, PAD, SIZE = 64, 8, 512
CELL = TILE+2*PAD
ATLAS = 'kenney_terrain_64.png'
MAX_ENTRY = 1 << 20  # refuse oversized/bomb entries before decoding


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def entry_name(family, tile):
    return f'Sprites/Tiles/Default/terrain_{family}_{tile}.png'


def extrude(tile):
    """Tile in an 80x80 cell, edge pixels repeated PAD times on every side (linear-filter guard)."""
    cell = Image.new('RGBA', (CELL, CELL))
    cell.paste(tile, (PAD, PAD))
    w = h = TILE
    strips = [((0, 0, w, 1), (w, PAD), (PAD, 0)), ((0, h-1, w, h), (w, PAD), (PAD, PAD+h)),
              ((0, 0, 1, h), (PAD, h), (0, PAD)), ((w-1, 0, w, h), (PAD, h), (PAD+w, PAD))]
    corners = [((0, 0), (0, 0)), ((w-1, 0), (PAD+w, 0)), ((0, h-1), (0, PAD+h)), ((w-1, h-1), (PAD+w, PAD+h))]
    for box, size, at in strips:
        cell.paste(tile.crop(box).resize(size, Image.NEAREST), at)
    for (x, y), at in corners:
        cell.paste(Image.new('RGBA', (PAD, PAD), tile.getpixel((x, y))), at)
    return cell


def build(zip_bytes):
    if sha256(zip_bytes) != ZIP_SHA256:
        raise SystemExit(f'Refusing archive: SHA-256 {sha256(zip_bytes)} != pinned {ZIP_SHA256}')
    atlas = Image.new('RGBA', (SIZE, SIZE))
    entries = []
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as z:
        def read(name):
            info = z.getinfo(name)
            if info.file_size > MAX_ENTRY:
                raise SystemExit(f'Refusing oversized entry {name}')
            return z.read(info)
        license_bytes = read('License.txt')
        for row, family in enumerate(FAMILIES):
            for col, (slot, tile_name) in enumerate(SLOTS):
                name = entry_name(family, tile_name)
                data = read(name)
                with Image.open(io.BytesIO(data)) as source:
                    if source.format != 'PNG' or source.size != (TILE, TILE):
                        raise SystemExit(f'Unexpected tile {name}: {source.format} {source.size}')
                    tile = source.convert('RGBA')
                if tile.getextrema()[3][0] != 255:
                    raise SystemExit(f'Tile {name} is not fully opaque')
                x, y = col*CELL, row*CELL
                atlas.paste(extrude(tile), (x, y))
                entries.append({'id': f'kenney-v1/{family}/{slot}', 'family': family, 'slot': slot,
                                'index': row*len(SLOTS)+col, 'source': name, 'source_sha256': sha256(data),
                                'rect': [x+PAD, y+PAD, TILE, TILE]})
    manifest = {
        'schema': 1,
        'issue': 392,
        'source': {'name': 'Kenney New Platformer Pack', 'version': '1.1', 'page': PAGE,
                   'archive': 'kenney_new-platformer-pack-1.1.zip', 'archive_sha256': ZIP_SHA256,
                   'license': 'CC0 1.0 Universal (see License.txt)', 'license_sha256': sha256(license_bytes)},
        'atlas': {'file': ATLAS, 'width': SIZE, 'height': SIZE, 'tile': TILE, 'padding': PAD, 'cell': CELL,
                  'origin': 'top-left pixels; the shader flips V once', 'pixels_sha256': sha256(atlas.tobytes())},
        'families': list(FAMILIES),
        'slots': [s for s, _ in SLOTS],
        'entries': entries,
    }
    return atlas, manifest, license_bytes


def write(zip_path, out=OUT):
    atlas, manifest, license_bytes = build(Path(zip_path).read_bytes())
    out.mkdir(parents=True, exist_ok=True)
    atlas.save(out/ATLAS, format='PNG', optimize=False, compress_level=9)
    (out/'manifest.json').write_text(json.dumps(manifest, indent=1)+'\n', encoding='utf-8')
    (out/'License.txt').write_bytes(license_bytes)
    return manifest


def check(out=OUT):
    """Committed atlas/manifest/license agree; no archive needed."""
    errors = []
    manifest = json.loads((out/'manifest.json').read_text(encoding='utf-8'))
    a = manifest['atlas']
    if (a['width'], a['height'], a['tile'], a['padding'], a['cell']) != (SIZE, SIZE, TILE, PAD, CELL):
        errors.append('atlas layout constants differ from the generator')
    if manifest['source']['archive_sha256'] != ZIP_SHA256:
        errors.append('archive SHA-256 differs from the pinned value')
    if sha256((out/'License.txt').read_bytes()) != manifest['source']['license_sha256']:
        errors.append('License.txt differs from the archive copy')
    with Image.open(out/ATLAS) as image:
        if image.mode != 'RGBA' or image.size != (SIZE, SIZE):
            errors.append(f'atlas is {image.mode} {image.size}')
        elif sha256(image.tobytes()) != a['pixels_sha256']:
            errors.append('atlas pixels differ from the manifest hash')
    expected = [(f, s) for f in FAMILIES for s, _ in SLOTS]
    got = [(e.get('family'), e.get('slot')) for e in manifest['entries']]
    if got != expected or [e.get('index') for e in manifest['entries']] != list(range(len(expected))):
        errors.append('manifest entries are not the fixed 6x4 family/slot order')
        return errors
    for e in manifest['entries']:
        row, col = divmod(e['index'], len(SLOTS))
        if e.get('rect') != [col*CELL+PAD, row*CELL+PAD, TILE, TILE]:
            errors.append(f"manifest rect of {e.get('id')} is not its fixed atlas cell")
    return errors


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    parser.add_argument('zip', nargs='?', help='official kenney_new-platformer-pack-1.1.zip (omit with --check)')
    parser.add_argument('--check', action='store_true', help='verify the committed files only')
    args = parser.parse_args(argv)
    if args.check or not args.zip:
        errors = check()
        print('\n'.join(errors) or 'terrain material atlas: OK')
        return 1 if errors else 0
    manifest = write(args.zip)
    print(f"wrote {OUT.relative_to(ROOT)}: {len(manifest['entries'])} tiles, pixels {manifest['atlas']['pixels_sha256']}")
    return 0


if __name__ == '__main__':
    sys.exit(main())
