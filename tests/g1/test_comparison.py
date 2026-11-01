"""G1 comparison diagnostics must not turn a failed physics probe green (#335)."""
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tools/g1'))
from run import compare_reports


def report(scale, fps, fall, ticks, frames, identity):
    return {'platform': 'wasm-web', 'variant': 'debug', 'scale': scale,
            'render_target': fps, 'run_id': f'run-{identity}',
            'config_hash': f'hash-{identity}',
            'cases': {'units': {'fall_30': fall},
                      'fixed_ticks': {'ticks': ticks, 'frames': frames}}}


class ComparisonTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.output = Path(self.temporary.name)
        self.reports = [report(0.01, 60, 123.817, 60, 60, 'a'),
                        report(0.02, 30, 124.260, 60, 30, 'b')]

    def saved(self):
        return json.loads((self.output / 'comparison.json').read_text())

    def test_pass_writes_both_real_configurations_and_ratios(self):
        result = compare_reports(self.output, self.reports, 'source-sha', 'wasm-web')
        self.assertEqual(result, self.saved())
        self.assertEqual(result['status'], 'PASS')
        self.assertEqual(result['source_sha'], 'source-sha')
        self.assertEqual(result['platform'], 'wasm-web')
        self.assertEqual(result['ticks_per_frame'], [1.0, 2.0])
        self.assertAlmostEqual(result['scale_fall_delta'], 0.443)
        self.assertEqual(result['scale_fall_threshold'], 0.5)
        self.assertEqual([x['run_id'] for x in result['configurations']], ['run-a', 'run-b'])
        self.assertEqual([x['config_hash'] for x in result['configurations']], ['hash-a', 'hash-b'])
        self.assertEqual([x['render_target'] for x in result['configurations']], [60, 30])
        self.assertEqual([x['fall_30'] for x in result['configurations']], [123.817, 124.260])

    def test_cross_scale_failure_writes_artifact_then_raises_with_measurements(self):
        self.reports[1]['cases']['units']['fall_30'] = 124.975
        with self.assertRaisesRegex(RuntimeError, r'Changed-scale probe mismatch > 0.5.*fall_30=123.817.*fall_30=124.975.*abs_delta='):
            compare_reports(self.output, self.reports, 'source-sha', 'wasm-web')
        result = self.saved()
        self.assertEqual(result['status'], 'FAIL')
        self.assertAlmostEqual(result['scale_fall_delta'], 1.158)
        self.assertIn('abs_delta=', result['error'])
        self.assertEqual([x['run_id'] for x in result['configurations']], ['run-a', 'run-b'])

    def test_exact_half_unit_passes_but_greater_fails(self):
        self.reports[0]['cases']['units']['fall_30'] = 124.0
        self.reports[1]['cases']['units']['fall_30'] = 124.5
        self.assertEqual(compare_reports(self.output, self.reports, 'sha', 'wasm-web')['status'], 'PASS')
        self.reports[1]['cases']['units']['fall_30'] = 124.5001
        with self.assertRaisesRegex(RuntimeError, 'Changed-scale probe mismatch'):
            compare_reports(self.output, self.reports, 'sha', 'wasm-web')
        self.assertEqual(self.saved()['status'], 'FAIL')

    def test_tick_ratio_failure_is_not_reported_as_pass(self):
        self.reports[1]['cases']['fixed_ticks']['frames'] = 60
        with self.assertRaisesRegex(RuntimeError, 'Render/physics rates not separated'):
            compare_reports(self.output, self.reports, 'sha', 'wasm-web')
        self.assertEqual(self.saved()['status'], 'FAIL')
        self.assertEqual(self.saved()['ticks_per_frame'], [1.0, 1.0])

    def test_missing_frame_ratio_is_not_a_false_pass(self):
        self.reports[1]['cases']['fixed_ticks']['frames'] = 0
        with self.assertRaisesRegex(RuntimeError, 'Render/physics rates not separated'):
            compare_reports(self.output, self.reports, 'sha', 'wasm-web')
        self.assertEqual(self.saved()['status'], 'FAIL')
        self.assertIsNone(self.saved()['configurations'][1]['ticks_per_frame'])


if __name__ == '__main__':
    unittest.main()
