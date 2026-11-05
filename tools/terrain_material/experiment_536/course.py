"""#536 experiment: writes the fixed test course (flat, valley, crest, long ramp, steep drop, gap, overhang)."""
import json, math
from pathlib import Path

def smooth(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)

def height(x):
    if x < 18: return 0.0
    if x < 58: return -4.5 * math.sin(math.pi * (x - 18) / 40) ** 2
    if x < 98: return 6.0 * math.sin(math.pi * (x - 58) / 40) ** 2
    if x < 112: return 0.0
    if x < 172: return 22.0 * smooth((x - 112) / 60)
    if x < 178: return 22.0
    if x < 190: return 22.0 * (1 - smooth((x - 178) / 12))
    return 0.0

def run(a, b, f, step=.5):
    pts, x = [], a
    while x < b:
        pts.append([round(x, 4), round(f(x), 4)])
        x += step
    pts.append([b, round(f(b), 4)])
    return pts

def overhang():
    pts = run(248, 258, lambda x: 0.0)
    for i in range(1, 81):
        t = i / 80
        pts.append([round(258 + 16 * t + 7 * math.sin(2 * math.pi * t), 4), round(11 * smooth(t), 4)])
    pts += run(276, 288, lambda x: 11.0)[1:]
    return pts

chains = [run(-12, 205, height), run(212, 240, lambda x: 1.2 * math.sin((x - 212) * math.pi / 14)), overhang()]
station = {'schema': 1, 'id': 'texture-test', 'name': 'Texture test', 'units': 'metres', 'spawn': [2, 1.7],
           'start_speed': 0, 'run_in': 0, 'run_out': 0, 'bounds': [-14, 300, -12, 40],
           'chains': [list(reversed(c)) for c in chains], 'hulls': []}
out = Path(__file__).resolve().parents[3] / 'main/game/stations/texture-test.json'
out.write_text(json.dumps(station, separators=(',', ':')) + '\n')
print(out, [len(c) for c in chains])
