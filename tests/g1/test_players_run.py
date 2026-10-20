"""The HTML5 players run must reuse the built bundle and record the engine it loaded (#215)."""
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tools/g1'))
import run as runner
from protocol import IDS, PREFIX

LOAD = {'mode': 'players', 'wasm': ['RiderG1.wasm'], 'cross_origin_isolated': False,
        'shared_array_buffer': False, 'pthread_supported': False, 'heap_shared': False}


def fake_browser(load, complete=True):
    def browser(directory, collector, mode=None, out=None):
        assert (mode, out) == ('players', directory / 'wasm-web')
        (out / 'engine-load.json').write_text(json.dumps(load))
        lines = [{'event': 'suite_start', 'protocol': 1, 'suite': 'g1', 'expected': IDS, 'source_sha': 'sha', 'config_hash': 'hash'}]
        lines += [{'event': 'case', 'id': key, 'status': 'PASS', 'measurements': {'value': 1}} for key in IDS]
        if complete:
            lines.append({'event': 'suite_end', 'status': 'PASS', 'count': len(IDS), 'passed': len(IDS)})
        for line in lines:
            collector.feed(PREFIX + json.dumps(dict(run_id='run', **line)))
    return browser


class PlayersRunTest(unittest.TestCase):
    def players(self, browser):
        directory = Path(self.temporary.name) / 'scale-0.01-fps-60'
        directory.mkdir()
        with mock.patch.object(runner, 'browser', side_effect=browser), mock.patch.object(runner, 'build') as build:
            try:
                return runner.players(directory, 'run', 'sha', 'hash', None, 60, 0.01), directory
            finally:
                build.assert_not_called()

    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()

    def tearDown(self):
        self.temporary.cleanup()

    def test_players_run_records_the_wasm_web_engine_next_to_the_isolated_result(self):
        report, directory = self.players(fake_browser(LOAD))
        saved = json.loads((directory / 'wasm-web/result.json').read_text())
        self.assertEqual(saved, report)
        self.assertEqual((saved['run_id'], saved['config_hash'], saved['status']), ('run', 'hash', 'PASS'))
        self.assertEqual(set(saved['cases']), set(IDS))
        self.assertEqual(saved['engine_load'], LOAD)
        self.assertEqual((saved['platform'], saved['variant'], saved['render_target'], saved['scale']), ('wasm-web', 'debug', 60, 0.01))
        self.assertFalse((directory / 'result.json').exists())

    def test_wrong_engine_or_incomplete_run_fails(self):
        for load in [{**LOAD, 'wasm': ['RiderG1_pthread.wasm']}, {**LOAD, 'cross_origin_isolated': True}, {**LOAD, 'mode': 'isolated'}]:
            with self.subTest(load=load):
                self.tearDown();self.setUp()
                with self.assertRaisesRegex(RuntimeError, 'did not load the wasm-web engine'):
                    self.players(fake_browser(load))
        self.tearDown();self.setUp()
        with self.assertRaisesRegex(RuntimeError, 'Missing completion'):
            self.players(fake_browser(LOAD, complete=False))


if __name__ == '__main__':
    unittest.main()
