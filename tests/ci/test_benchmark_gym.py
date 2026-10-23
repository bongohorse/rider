"""Remote job names must not escape the benchmark evidence directory."""
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('benchmark_gym', Path(__file__).resolve().parents[2] / 'tools/ci/benchmark_gym.py')
benchmark = importlib.util.module_from_spec(spec)
spec.loader.exec_module(benchmark)


class BenchmarkPaths(unittest.TestCase):
    def test_current_called_and_standalone_job_names(self):
        self.assertEqual(benchmark.gym_group('physics / Gym (bumps-2)'), 'bumps-2')
        self.assertEqual(benchmark.gym_group('Gym (struts)'), 'struts')

    def test_remote_paths_controls_and_ambiguous_suffixes_are_rejected(self):
        for name in ['Gym (../escape)', 'Gym (/tmp/escape)', 'physics / Gym (x/y)',
                     'Gym (x\\y)', 'Gym (a\nb)', 'Gym ()', 'Gym (a b)',
                     'Gym (struts) extra', 'Gym (\x1b[31mred)']:
            with self.subTest(name=name):
                with self.assertRaises(ValueError):
                    benchmark.gym_group(name)
