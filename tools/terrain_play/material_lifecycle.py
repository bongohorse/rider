#!/usr/bin/env python3
"""Run the fixed debug/release material-lifecycle inventory with standard evidence (#515)."""
import argparse
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/gym'))
from bundle import source_fingerprint, inventory
sys.path.insert(0, str(ROOT / 'tools'))
from project import execute, write_report

VARIANTS = ('debug', 'release')
ROUTES = ('legacy', 'perspective', 'textured')
ROUTE_CASES = [f'{variant}-{route}' for variant in VARIANTS for route in ROUTES]
EXPECTED = ROUTE_CASES + ['evidence-integrity']
ENGINE = json.loads((ROOT / 'tools/toolchain-lock.json').read_text())['engine']


def verify(bundle, variant, sha):
    report = json.loads((bundle / 'bundle.json').read_text())
    if (report['source_sha'], report['variant'], report['platform']) != (sha, variant, 'wasm-web'):
        raise RuntimeError('Foreign source/platform/variant')
    if not report['files'] or report['source_fingerprint'] != source_fingerprint() or report['files'] != inventory(bundle):
        raise RuntimeError('Bundle/source changed')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('debug', type=Path)
    parser.add_argument('release', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    out = args.output.resolve()
    if out.exists() and any(out.iterdir()):
        parser.error('Output must be fresh and empty')
    out.mkdir(parents=True, exist_ok=True)
    sha = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    tests, reports, failure = [], {}, 'Missing: experiment incomplete'
    try:
        bundles = {'debug': args.debug.resolve(), 'release': args.release.resolve()}
        for variant, bundle in bundles.items():
            verify(bundle, variant, sha)
        (out / 'plan.json').write_text(json.dumps({'schema_version': 1, 'source_sha': sha, 'engine': ENGINE,
            'expected': EXPECTED, 'cycles_per_route': 8, 'viewport': [1280, 720], 'dpr': 1,
            'input': 'idle; identical A/B geometry; one acknowledged Retry after every route'}, indent=2) + '\n')
        for variant in VARIANTS:
            for route in ROUTES:
                case = f'{variant}-{route}'
                test = execute(case, ['node', 'tools/terrain_play/material_lifecycle.cjs', str(bundles[variant]),
                               str(out / case), route, variant], out, 600)
                raw = out / case / 'results.json'
                if raw.exists():
                    r = json.loads(raw.read_text())
                    if (r['source_sha'], r['variant'], r['route'], r['status'], r['engine']) != (sha, variant, route, 'PASS', ENGINE):
                        test.update(status='FAIL', detail='Foreign or incomplete lifecycle result')
                    else:
                        reports[case] = r
                    test['artifacts'].append(f'{case}/results.json')
                else:
                    test.update(status='FAIL', detail='Missing lifecycle result')
                if (out / case / 'failed.png').exists():
                    test['artifacts'].append(f'{case}/failed.png')
                tests.append(test)
        for variant, bundle in bundles.items():
            verify(bundle, variant, sha)
        summary = {}
        if len(reports) == len(ROUTE_CASES):
            for variant in VARIANTS:
                rows = {route: reports[f'{variant}-{route}'] for route in ROUTES}
                renderers = [r['loads'][0]['webgl']['contexts'] for r in rows.values()]
                if any(x != renderers[0] for x in renderers[1:]):
                    raise RuntimeError('Renderer changed between routes')
                sizes = set().union(*(set(x['webgl']['uniform_histogram']) for r in rows.values() for x in r['loads']))
                growth = {route: {size: r['loads'][-1]['webgl']['uniform_histogram'].get(size, 0) - r['loads'][0]['webgl']['uniform_histogram'].get(size, 0) for size in sorted(sizes, key=int)} for route, r in rows.items()}
                extra = {size: growth['textured'][size] - max(growth['legacy'][size], growth['perspective'][size]) for size in sizes}
                summary[variant] = {'uniform_growth_over_16_switches': growth, 'incremental_textured_growth': {s: n for s, n in extra.items() if n > 0}, 'renderer': renderers[0]}
            (out / 'comparison.json').write_text(json.dumps(summary, indent=2) + '\n')
            tests.append({'id': 'evidence-integrity', 'status': 'PASS', 'duration_ms': 0, 'assertions': 1,
                          'detail': 'Exact source/engine/route inventory and renderer comparison verified', 'artifacts': ['plan.json', 'comparison.json']})
    except Exception as exc:
        failure = str(exc)
    for case in EXPECTED:
        if not any(t['id'] == case for t in tests):
            tests.append({'id': case, 'status': 'FAIL', 'duration_ms': None, 'assertions': 1,
                          'detail': failure, 'artifacts': []})
    code = write_report(out, 'material-lifecycle515', tests, EXPECTED, sha)
    p = out / 'results.json';r = json.loads(p.read_text());r.update(platform='wasm-web', engine=ENGINE, backend=ENGINE['backend']);p.write_text(json.dumps(r, indent=2) + '\n')
    return code


if __name__ == '__main__':
    sys.exit(main())
