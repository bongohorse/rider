"""Evidence must fail closed on partial matrices, foreign runs and budget misses."""
import copy
import importlib.util
from pathlib import Path
import unittest

SPEC = importlib.util.spec_from_file_location('parallax545', Path(__file__).resolve().parents[2] / 'tools/parallax545/analyze.py')
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def complete():
    runs = []
    for route, layers, hidden in MODULE.EXPECTED:
        active = 0 if hidden else layers
        sample = dict(raw=[dict(at=i*16.6, callback_ms=2, draws=20+active) for i in range(100)],
                      interval_ms=dict(p95=16.6), callback_ms=dict(p95=2), draw_calls=dict(p50=20+active))
        runs.append(dict(route=route, layers=layers, hidden=hidden, samples=dict(idle=sample, drive=sample),
                         end=dict(textures=[dict(levels={'0':dict(width=250,height=1,format=6408,type=5121)})]+[dict(levels={'0':dict(width=1024,height=512,format=6408,type=5121)}) for _ in range(active)], webgl='same-renderer', probe=dict(route=route, layers=layers, hidden=hidden, objects=active)),
                         texture_payload_bytes=1000+active*1024*512*4))
    return dict(status='MEASURED', errors=[], loaded_engines=['verified']*8, runs=runs)


class Evidence545(unittest.TestCase):
    def test_complete_inventory(self):
        tests, _ = MODULE.analyze(complete())
        self.assertEqual([t['status'] for t in tests], ['PASS']*8)

    def test_budget_is_a_failure_even_with_fast_callback(self):
        raw = complete()
        raw['runs'][4]['samples'] = copy.deepcopy(raw['runs'][4]['samples'])
        raw['runs'][4]['samples']['drive']['raw'] = [dict(at=i*33.3, callback_ms=2, draws=26) for i in range(100)]
        raw['runs'][4]['samples']['drive']['interval_ms']['p95'] = 1  # stale summary cannot make this pass
        tests, _ = MODULE.analyze(raw)
        self.assertEqual(tests[4]['status'], 'FAIL')

    def test_partial_matrix(self):
        raw = complete(); raw['runs'].pop()
        with self.assertRaises(ValueError): MODULE.analyze(raw)

    def test_missing_engine_verification(self):
        raw = complete(); raw['loaded_engines'].pop()
        with self.assertRaises(ValueError): MODULE.analyze(raw)

    def test_foreign_runtime(self):
        raw = complete(); raw['runs'][2]['end']['probe']['route'] = 'other'
        with self.assertRaises(ValueError): MODULE.analyze(raw)

    def test_hidden_still_costs_texture(self):
        raw = complete(); raw['runs'][6]['texture_payload_bytes'] += 1024*512*4
        with self.assertRaises(ValueError): MODULE.analyze(raw)

    def test_renderer_changed(self):
        raw = complete(); raw['runs'][1]['end']['webgl'] = 'other'
        with self.assertRaises(ValueError): MODULE.analyze(raw)

    def test_missing_raw_frames(self):
        raw = complete(); raw['runs'][0]['samples']['idle']['raw'] = []
        with self.assertRaises(ValueError): MODULE.analyze(raw)

    def test_nonfinite_timing(self):
        raw = complete(); raw['runs'][0]['samples']['idle']['raw'][5]['at'] = float('nan')
        with self.assertRaises(ValueError): MODULE.analyze(raw)

    def test_nonmonotonic_timing(self):
        raw = complete(); raw['runs'][0]['samples']['idle']['raw'][5]['at'] = 0
        with self.assertRaises(ValueError): MODULE.analyze(raw)

    def test_false_texture_summary(self):
        raw = complete(); raw['runs'][2]['end']['textures'].pop()
        with self.assertRaises(ValueError): MODULE.analyze(raw)

    def test_nonrender_callbacks_do_not_mask_dropped_render_frames(self):
        raw = complete()
        sample = raw['runs'][4]['samples']['drive']
        sample['raw'] = [dict(at=i*16.6,callback_ms=2,draws=26 if i%2 else 0) for i in range(200)]
        tests, _ = MODULE.analyze(raw)
        self.assertEqual(tests[4]['status'], 'FAIL')

    def test_no_rendered_frames(self):
        raw = complete()
        for f in raw['runs'][0]['samples']['idle']['raw']: f['draws'] = 0
        with self.assertRaises(ValueError): MODULE.analyze(raw)
