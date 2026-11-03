"""Pinned luacheck runner and configuration (#400)."""
import hashlib
import http.client
import importlib.util
import io
import json
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location('lint_lua', ROOT / 'tools/ci/lint_lua.py')
lint_lua = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(lint_lua)


class LockTest(unittest.TestCase):
    def test_lock_pins_release_urls_and_sha256(self):
        lock = json.loads((ROOT / 'tools/ci/luacheck-lock.json').read_text())
        self.assertRegex(lock['version'], r'^\d+\.\d+\.\d+$')
        self.assertEqual(set(lock['binaries']), {'linux-x86_64', 'windows-x86_64'})
        for entry in lock['binaries'].values():
            self.assertTrue(entry['url'].startswith(
                f"https://github.com/lunarmodules/luacheck/releases/download/v{lock['version']}/"))
            self.assertRegex(entry['sha256'], r'^[0-9a-f]{64}$')

    def test_host_keys(self):
        self.assertEqual(lint_lua.host_key('Linux', 'x86_64'), 'linux-x86_64')
        self.assertEqual(lint_lua.host_key('Windows', 'AMD64'), 'windows-x86_64')
        self.assertEqual(lint_lua.host_key('Linux', 'aarch64'), 'linux-aarch64')

    def test_unpinned_host_is_blocked(self):
        with self.assertRaisesRegex(RuntimeError, '^BLOCKED'):
            lint_lua.ensure_binary('linux-aarch64')

    def test_corrupt_cached_binary_fails_and_is_not_replaced(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / 'luacheck'
            target.write_bytes(b'not luacheck')
            with mock.patch.object(lint_lua, 'binary_path', return_value=target), \
                    mock.patch.object(lint_lua.urllib.request, 'urlopen') as urlopen:
                with self.assertRaisesRegex(RuntimeError, 'SHA-256 mismatch'):
                    lint_lua.ensure_binary('linux-x86_64')
                urlopen.assert_not_called()
            self.assertEqual(target.read_bytes(), b'not luacheck')

    def _http_error(self, code):
        return lint_lua.urllib.error.HTTPError('https://example.invalid', code, 'x', {}, io.BytesIO(b''))

    def _response(self, data):
        response = mock.MagicMock()
        response.__enter__.return_value.read.return_value = data
        return response

    def test_download_retries_transient_server_errors(self):
        sleeps = []
        with mock.patch.object(lint_lua.urllib.request, 'urlopen',
                               side_effect=[self._http_error(500), lint_lua.urllib.error.URLError('reset'),
                                            self._response(b'ok')]) as urlopen:
            self.assertEqual(lint_lua.download('https://example.invalid', sleep=sleeps.append), b'ok')
        self.assertEqual(urlopen.call_count, 3)
        self.assertEqual(sleeps, [2.0, 4.0])

    def test_download_retries_timeouts_resets_and_truncated_bodies(self):
        for error in (TimeoutError('slow'), ConnectionResetError('reset'), http.client.IncompleteRead(b'x', 5)):
            with mock.patch.object(lint_lua.urllib.request, 'urlopen',
                                   side_effect=[error, self._response(b'ok')]) as urlopen:
                self.assertEqual(lint_lua.download('https://example.invalid', sleep=lambda _: None), b'ok')
            self.assertEqual(urlopen.call_count, 2, error)

    def test_truncated_body_on_every_attempt_blocks(self):
        with mock.patch.object(lint_lua.urllib.request, 'urlopen',
                               side_effect=[http.client.IncompleteRead(b'x', 5)] * 3):
            with self.assertRaises(OSError):
                lint_lua.download('https://example.invalid', sleep=lambda _: None)

    def test_download_gives_up_after_three_server_errors_and_main_blocks(self):
        with tempfile.TemporaryDirectory() as directory, \
                mock.patch.object(lint_lua, 'binary_path', return_value=Path(directory) / 'luacheck'), \
                mock.patch.object(lint_lua.time, 'sleep') as sleep, \
                mock.patch.object(lint_lua.urllib.request, 'urlopen',
                                  side_effect=[self._http_error(503)] * 3) as urlopen, \
                mock.patch.object(lint_lua, 'host_key', return_value='linux-x86_64'):
            self.assertEqual(lint_lua.main([]), 2)
            self.assertEqual(urlopen.call_count, 3)
            self.assertEqual(sleep.call_count, 2)
            self.assertFalse((Path(directory) / 'luacheck').exists())

    def test_download_does_not_retry_client_errors(self):
        with mock.patch.object(lint_lua.urllib.request, 'urlopen',
                               side_effect=[self._http_error(404)]) as urlopen:
            with self.assertRaises(lint_lua.urllib.error.HTTPError):
                lint_lua.download('https://example.invalid', sleep=lambda _: None)
        self.assertEqual(urlopen.call_count, 1)

    def test_downloaded_hash_mismatch_is_not_retried(self):
        with tempfile.TemporaryDirectory() as directory, \
                mock.patch.object(lint_lua, 'binary_path', return_value=Path(directory) / 'luacheck'), \
                mock.patch.object(lint_lua.urllib.request, 'urlopen',
                                  return_value=self._response(b'tampered')) as urlopen:
            with self.assertRaisesRegex(RuntimeError, 'downloaded luacheck SHA-256 mismatch'):
                lint_lua.ensure_binary('linux-x86_64')
            self.assertEqual(urlopen.call_count, 1)
            self.assertFalse((Path(directory) / 'luacheck').exists())

    def test_tracked_inventory_covers_every_defold_lua_kind(self):
        files = lint_lua.tracked_lua_files()
        suffixes = {Path(name).suffix for name in files}
        self.assertTrue({'.lua', '.script', '.gui_script'} <= suffixes)
        self.assertTrue(any(name.startswith('tests/gameplay/') for name in files))


class WorkflowTest(unittest.TestCase):
    def test_required_classification_job_runs_lint_with_cached_pinned_binary(self):
        workflow = (ROOT / '.github/workflows/ci.yml').read_text()
        changes = workflow.split('\n  changes:\n', 1)[1].split('\n  bootstrap:\n', 1)[0]
        self.assertIn('run: python3 tools/ci/lint_lua.py', changes)
        self.assertIn("hashFiles('tools/ci/luacheck-lock.json')", changes)
        self.assertNotRegex(changes, r'lint_lua\.py[^\n]*\|\|')

    def test_local_check_runs_lint(self):
        self.assertIn("'tools/ci/lint_lua.py'", (ROOT / 'tools/local.py').read_text())

    def test_config_keeps_undefined_globals_and_unused_values_enabled(self):
        config = (ROOT / '.luacheckrc').read_text()
        ignored = re.search(r'^ignore\s*=\s*\{([^}]*)\}', config, re.M)[1]
        for code in ('1', '2', '3', '5'):
            self.assertNotRegex(ignored, rf'"{code}')
        for option in ('unused', 'global', 'unused_values', 'redefined'):
            self.assertNotRegex(config, rf'(?m)^\s*{option}\s*=\s*false')
        self.assertNotRegex(config, r'allow_defined(_top)?\s*=\s*true')


@unittest.skipUnless(lint_lua.binary_path(lint_lua.host_key()).is_file()
                     and lint_lua.host_key() in lint_lua.LOCK['binaries'],
                     'pinned luacheck not cached; run tools/ci/lint_lua.py first')
class RealLuacheckTest(unittest.TestCase):
    def lint(self, source, name):
        binary = lint_lua.ensure_binary()
        with tempfile.TemporaryDirectory(dir=ROOT / '.cache/ci') as directory:
            path = Path(directory) / name
            path.write_text(source)
            return subprocess.run([str(binary), '--config', str(ROOT / '.luacheckrc'), '--codes',
                                   '--no-color', '--no-cache', '--filename', f'main/game/{name}', str(path)],
                                  capture_output=True, text=True)

    def test_undefined_global_and_dead_value_fail(self):
        result = self.lint('local M={}\nfunction M.f() local unused=1; return go.get_id(), undefined_thing end\nreturn M\n', 'bad.lua')
        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertIn('(W113)', result.stdout)
        self.assertIn('(W211)', result.stdout)

    def test_defold_callbacks_and_api_pass(self):
        result = self.lint('function init(self) msg.post(".", "acquire_input_focus") end\n'
                           'function update(self, dt) go.set_position(vmath.vector3()) end\n', 'ok.script')
        self.assertEqual(result.returncode, 0, result.stdout)

    def test_plain_module_cannot_define_lifecycle_globals(self):
        result = self.lint('function update(self, dt) end\n', 'module.lua')
        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertIn('(W111)', result.stdout)

    def test_repository_is_clean(self):
        self.assertEqual(subprocess.run([sys.executable, 'tools/ci/lint_lua.py'], cwd=ROOT,
                                        capture_output=True).returncode, 0)


if __name__ == '__main__':
    unittest.main()
