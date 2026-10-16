"""Original CC0-1.0 procedural engine placeholder; no external recording."""
from pathlib import Path
import math,struct,wave
root=Path(__file__).resolve().parents[2]
with wave.open(str(root/'main/gym/assets/engine.wav'),'wb') as out:
    out.setnchannels(1);out.setsampwidth(2);out.setframerate(11025)
    # Exactly 30 fundamental cycles in 0.4 s: seamless periodic PCM.
    frames=[int(12000*(math.sin(2*math.pi*75*i/11025)+.3*math.sin(2*math.pi*150*i/11025))) for i in range(4410)]
    out.writeframes(b''.join(struct.pack('<h',n) for n in frames))
