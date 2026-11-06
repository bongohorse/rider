# Terrain material atlas provenance (#392)

| Field | Value |
| --- | --- |
| Source | Kenney New Platformer Pack 1.1, https://kenney.nl/assets/new-platformer-pack |
| Archive | `kenney_new-platformer-pack-1.1.zip`, 3,276,507 bytes, downloaded 2026-11-03 from the page's download link |
| Archive SHA-256 | `553b907f3f0e505ab65f56f245ccaff3123c8fe3f3a0dfce9373b996bfc18cc2` (the value recorded on #392) |
| License | CC0 1.0 Universal; `License.txt` here is the archive's file, byte for byte |
| Generator | `python -I tools/art/terrain_material.py <archive>`; it refuses any other SHA-256 |
| Used tiles | 24 PNGs from `Sprites/Tiles/Default/` (64 px): `terrain_<family>_{block_top,horizontal_middle,block_center,vertical_middle}.png` for grass, dirt, sand, snow, stone and purple |

Committed outputs: `kenney_terrain_64.png` (512×512 RGBA, six family rows × four slot columns surface/rim/side/end, each 64 px tile in an 80 px cell with an 8 px edge extrusion, top-left pixel origin), `manifest.json` (slot ids, source paths and SHA-256 per tile, rectangles, raw-pixel SHA-256) and `License.txt`. No archive, other tile or Kenney branding is committed. `python tools/art/terrain_material.py --check` verifies the committed files without the archive.

# Original level material presets (#538)

| Field | Value |
| --- | --- |
| Source | Original work: `tools/art/level_materials.cjs` draws every pixel procedurally with fixed seeds in headless Chromium; no third-party input |
| Commands | `node tools/art/level_materials.cjs`, then `python tools/art/level_materials.py --write`; `--check` verifies without Chromium |
| Output | `presets/<id>/{surface,band,fill,thumb}.png` and `presets/manifest.json`, which records seeds, browser version and hashes |
| Layout | 128 px = 1 m; Surface and Band 512×128, repeating along the track; Fill 512×512, repeating both ways |
| Art direction | The Meadow preset follows the look Claudio accepted in #536; he judges the set in #543 |

The Kenney atlas above is a test fixture, separate from these presets.

`main/game/assets/vehicle_shadow.png` is original: a soft dark ellipse computed with Pillow, no input (#572).
