"""Deterministic diagnostic RGBA layers for #545, generated only from this recipe."""
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2] / 'main/parallax545'
COLORS = [(70, 100, 190), (90, 150, 190), (100, 170, 130), (170, 150, 90), (170, 110, 110), (100, 80, 150)]


def chunk(kind, data):
    return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data))


for i, color in enumerate(COLORS, 1):
    # Seamless in both axes; transparent field with a coloured grid. Foreground art only at bottom.
    rows = []
    for y in range(512):
        row = bytearray([0])
        for x in range(1024):
            alpha = (100 if x % 128 < 5 or y % 128 < 5 else 16) if i < 6 else (130 if y > 448 else 0)
            row.extend((*color, alpha))
        rows.append(row)
    data = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', 1024, 512, 8, 6, 0, 0, 0))
    data += chunk(b'IDAT', zlib.compress(b''.join(rows), 9)) + chunk(b'IEND', b'')
    (ROOT / f'layer{i}.png').write_bytes(data)
