"""Validate the complete #545 inventory and report the unchanged desktop budget gate."""
import argparse
import copy
import math
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools'))
from project import write_report

EXPECTED = [(route, layers, hidden) for layers, hidden in [(0, False), (3, False), (6, False), (6, True)] for route in ['mesh', 'sprites']]


def statistics(values):
    ordered = sorted(values)
    if not ordered or any(not math.isfinite(x) for x in ordered):
        raise ValueError('Nonfinite or missing timing')
    return dict(n=len(ordered), p50=ordered[math.ceil(len(ordered)*0.5)-1],
                p95=ordered[math.ceil(len(ordered)*0.95)-1], max=ordered[-1], mean=sum(ordered)/len(ordered))


def texture_bytes(textures):
    total = 0
    channels = {6406: 1, 6409: 1, 6410: 2, 6407: 3, 6408: 4}
    for t in textures:
        if t.get('generated_mipmap'):
            raise ValueError('Generated mipmap accounting unsupported by this fixture')
        for level in t['levels'].values():
            if level['type'] != 5121 or level['format'] not in channels:
                raise ValueError('Unknown upload format/type')
            total += level['width'] * level['height'] * channels[level['format']]
    return total


def analyze(raw):
    raw = copy.deepcopy(raw)
    if raw.get('status') != 'MEASURED' or raw.get('errors'):
        raise ValueError('Engine/page measurement failed or incomplete')
    runs = raw['runs']
    if [(r['route'], r['layers'], r['hidden']) for r in runs] != EXPECTED:
        raise ValueError('Missing, duplicated or foreign matrix entries')
    if len(raw['loaded_engines']) != len(EXPECTED):
        raise ValueError('Missing loaded-engine byte checks')
    renderers = [r['end']['webgl'] for r in runs]
    if any(x != renderers[0] for x in renderers[1:]):
        raise ValueError('Renderer changed')
    for r in runs:
        for sample in r['samples'].values():
            frames = sample['raw']
            if len(frames) < 60 or not all(math.isfinite(f['at']) and math.isfinite(f['callback_ms']) and f['callback_ms'] >= 0 and isinstance(f['draws'], int) and f['draws'] >= 0 for f in frames):
                raise ValueError('Invalid or missing raw frames')
            if any(b['at']<=a['at'] for a,b in zip(frames,frames[1:])):
                raise ValueError('Nonmonotonic timestamps')
            frames = [f for f in frames if f['draws']>0]
            if len(frames)<60: raise ValueError('Insufficient rendered frames')
            intervals = [b['at']-a['at'] for a, b in zip(frames, frames[1:])]
            if any(t <= 0 for t in intervals):
                raise ValueError('Nonmonotonic timestamps')
            sample['interval_ms'] = statistics(intervals)
            sample['callback_ms'] = statistics([f['callback_ms'] for f in frames])
            sample['draw_calls'] = statistics([f['draws'] for f in frames])
        measured = texture_bytes(r['end']['textures'])
        if measured != r['texture_payload_bytes']:
            raise ValueError('Texture summary disagrees with uploads')
    baselines = {r['route']: r for r in runs if r['layers'] == 0}
    tests, rows = [], []
    for r in runs:
        case = f"{r['route']}-{r['layers']}" + ('-hidden' if r['hidden'] else '')
        for phase in ['idle', 'drive']:
            sample = r['samples'][phase]
            if len(sample['raw']) < 60 or not all(x['callback_ms'] >= 0 and x['draws'] >= 0 for x in sample['raw']):
                raise ValueError('Missing raw frames or invalid measured values')
        probe = r['end']['probe']
        if (probe['route'], probe['layers'], probe['hidden']) != (r['route'], r['layers'], r['hidden']):
            raise ValueError('Foreign runtime configuration')
        if (r['hidden'] or not r['layers']) and probe['objects'] != 0:
            raise ValueError('Empty or initially hidden layer created objects')
        base = baselines[r['route']]
        delta = r['texture_payload_bytes'] - base['texture_payload_bytes']
        expected_bytes = 0 if r['hidden'] else r['layers'] * 1024 * 512 * 4
        if delta != expected_bytes:
            raise ValueError(f'{case}: wrong explicit texture payload {delta} != {expected_bytes}')
        # Each route must add one batched draw per visible layer, including foreground.
        draw_delta = r['samples']['idle']['draw_calls']['p50'] - base['samples']['idle']['draw_calls']['p50']
        if draw_delta != (0 if r['hidden'] else r['layers']):
            raise ValueError('Unexpected visible or hidden draw cost')
        budget = all(r['samples'][p]['interval_ms']['p95'] <= 16.67 for p in ['idle', 'drive'])
        gated = r['layers'] == 6 and not r['hidden']
        tests.append(dict(id=case, status='FAIL' if gated and not budget else 'PASS', duration_ms=None,
                          assertions=6, detail='Total frame-interval p95 <= 16.67 ms' if gated else 'Inventory, resources, draw cost and raw frames', artifacts=['measurement.json']))
        rows.append(dict(case=case, texture_delta_bytes=delta, objects=probe['objects'], draws=r['samples']['drive']['draw_calls']['p50'],
                         frame_p50_ms=r['samples']['drive']['interval_ms']['p50'], callback_p95_ms=r['samples']['drive']['callback_ms']['p95'], frame_p95_ms=r['samples']['drive']['interval_ms']['p95'],
                         callback_delta_p95_ms=r['samples']['drive']['callback_ms']['p95']-base['samples']['drive']['callback_ms']['p95'], budget_pass=budget))
    return tests, rows


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('measurement', type=Path)
    args = parser.parse_args()
    raw = json.loads((args.measurement / 'measurement.json').read_text())
    tests, rows = analyze(raw)
    expected = [t['id'] for t in tests]
    report = args.measurement
    report.mkdir(exist_ok=True)
    (report / 'comparison.json').write_text(json.dumps(rows, indent=2) + '\n')
    text = '| Case | Objects | Texture delta B | Draws | Drive callback p95 ms | Increment ms | Drive interval median ms | Drive interval p95 ms |\n|---|---:|---:|---:|---:|---:|---:|---:|\n'
    for r in rows:
        text += f"| {r['case']} | {r['objects']} | {r['texture_delta_bytes']} | {r['draws']} | {r['callback_p95_ms']:.2f} | {r['callback_delta_p95_ms']:+.2f} | {r['frame_p50_ms']:.2f} | {r['frame_p95_ms']:.2f} |\n"
    (report / 'comparison.md').write_text(text)
    return write_report(report, 'parallax545', tests, expected, raw['source_sha'])


if __name__ == '__main__':
    sys.exit(main())
