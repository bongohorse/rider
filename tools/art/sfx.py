"""Original CC0-1.0 procedural one-shot effects (#438); no external recording or sample.

Writes six short mono 16-bit PCM WAV files into main/game/assets/. Deterministic: the same
script produces byte-identical files (fixed seeds, no time or platform input).
"""
from pathlib import Path
import math, random, struct, wave

RATE = 22050
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'main/game/assets'


def tone(freq, t, phase=0.0):
    return math.sin(2 * math.pi * freq * t + phase)


def env(t, length, attack=0.004, decay=None):
    """Short linear attack, exponential decay, forced to zero at the end (no click)."""
    if t < attack:
        a = t / attack
    else:
        a = math.exp(-(t - attack) / (decay or length / 4))
    fade = min(1.0, (length - t) / 0.01)
    return a * max(0.0, fade)


def notes(seq, length, decay):
    """Sequential notes (start s, freq Hz); each rings until the end with its own envelope."""
    def f(t):
        v = 0.0
        for start, freq in seq:
            if t >= start:
                u = t - start
                v += env(u, length - start, decay=decay) * (tone(freq, u) + 0.25 * tone(2 * freq, u))
        return v
    return f


def coin():
    # Two-step "ding" (B5 -> E6), 0.18 s.
    return 0.18, notes([(0.0, 987.77), (0.05, 1318.51)], 0.18, 0.045)


def gem():
    # Brighter three-note rise (E6, G#6, B6) with a light shimmer, 0.34 s.
    base = notes([(0.0, 1318.51), (0.06, 1661.22), (0.12, 1975.53)], 0.34, 0.07)
    return 0.34, lambda t: base(t) * (1 + 0.15 * tone(18, t))


def fuel():
    # Soft rising "glug" sweep 260 -> 620 Hz with a little filtered noise, 0.26 s.
    rnd = random.Random(438_3)
    state = {'n': 0.0, 'phase': 0.0}

    def f(t):
        freq = 260 + 360 * (t / 0.26) ** 0.7
        state['phase'] += 2 * math.pi * freq / RATE
        state['n'] += 0.08 * (rnd.uniform(-1, 1) - state['n'])
        wobble = 1 + 0.3 * tone(22, t)
        return env(t, 0.26, attack=0.01, decay=0.09) * (math.sin(state['phase']) * wobble + 0.6 * state['n'])
    return 0.26, f


def land():
    # Low thump: pitch drop 120 -> 50 Hz plus a short noise transient, 0.2 s.
    rnd = random.Random(438_4)
    state = {'phase': 0.0, 'n': 0.0}

    def f(t):
        freq = 50 + 70 * math.exp(-t / 0.03)
        state['phase'] += 2 * math.pi * freq / RATE
        state['n'] += 0.25 * (rnd.uniform(-1, 1) - state['n'])
        return env(t, 0.2, attack=0.002, decay=0.05) * math.sin(state['phase']) + env(t, 0.2, attack=0.001, decay=0.012) * 0.8 * state['n']
    return 0.2, f


def crash():
    # Crunch: decaying low-passed noise over a falling thud, 0.45 s.
    rnd = random.Random(438_5)
    state = {'phase': 0.0, 'n': 0.0, 'm': 0.0}

    def f(t):
        freq = 40 + 90 * math.exp(-t / 0.06)
        state['phase'] += 2 * math.pi * freq / RATE
        state['n'] += 0.35 * (rnd.uniform(-1, 1) - state['n'])
        state['m'] += 0.06 * (rnd.uniform(-1, 1) - state['m'])
        rattle = 0.6 + 0.4 * (1 if math.sin(2 * math.pi * 31 * t) > 0 else 0)
        return (env(t, 0.45, attack=0.002, decay=0.08) * 0.9 * state['n'] * rattle
                + env(t, 0.45, attack=0.002, decay=0.12) * (0.7 * math.sin(state['phase']) + 1.5 * state['m']))
    return 0.45, f


def finish():
    # Short major arpeggio (C5, E5, G5, C6), 0.6 s.
    return 0.6, notes([(0.0, 523.25), (0.08, 659.25), (0.16, 783.99), (0.24, 1046.5)], 0.6, 0.12)


EFFECTS = {'coin': coin, 'gem': gem, 'fuel': fuel, 'land': land, 'crash': crash, 'finish': finish}
PEAK = 0.6  # normalised peak (of full scale); loudness is set by the gains in main/game/audio.lua


def render(make):
    length, f = make()
    samples = [f(i / RATE) for i in range(int(length * RATE))]
    peak = max(abs(s) for s in samples) or 1.0
    return [int(round(32767 * PEAK * s / peak)) for s in samples]


def main():
    for name, make in EFFECTS.items():
        frames = render(make)
        with wave.open(str(OUT / f'sfx_{name}.wav'), 'wb') as out:
            out.setnchannels(1); out.setsampwidth(2); out.setframerate(RATE)
            out.writeframes(b''.join(struct.pack('<h', n) for n in frames))
        print(f'sfx_{name}.wav {len(frames) / RATE:.2f} s')


if __name__ == '__main__':
    main()
