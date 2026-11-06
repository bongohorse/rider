"""Original deterministic diagnostic RGBA grids for the bg546 engine case; no preset art."""
from pathlib import Path
import struct
import zlib
ROOT=Path(__file__).resolve().parents[2]/'main/backgrounds'
def chunk(k,b): return struct.pack('>I',len(b))+k+b+struct.pack('>I',zlib.crc32(k+b))
def png(w,h,pixel):
    rows=b''.join(b'\0'+bytes(c for x in range(w) for c in pixel(x,y)) for y in range(h))
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(rows,9))+chunk(b'IEND',b'')
(ROOT/'seed.png').write_bytes(png(1,1,lambda x,y:(255,255,255,255)))
(ROOT/'fixtures/grid.png').write_bytes(png(64,32,lambda x,y:(x*4,y*8,180,255)))
(ROOT/'fixtures/foreground.png').write_bytes(png(64,32,lambda x,y:(130,70,160,180)))
