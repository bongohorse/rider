"""The gameplay Lua runner must fail closed (#395)."""
import io
import os
from pathlib import Path
import signal
import sys
import tempfile
import time
import unittest
from contextlib import redirect_stdout

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tools/gameplay'))
import lua_tests

# Stand-in interpreter: runs a suite whose body is a shell snippet.
FAKE = '#!/bin/sh\n[ "$1" = "-joff" ] || exit 9\nexec /bin/sh "$2"\n'

# Only a deliberate "PASS " token counts (#397); real suites print('PASS <what>').
PASS_TABLE = (
    ('PASSIVE (zero assertions)', 0, False),
    ('NO ASSERTIONS', 0, False),
    ('PASS 1 real suite', 0, True),
    ('PASS 1 real suite', 1, False),
)


def alive(pid):
    """True while pid runs; a zombie awaiting its reaper counts as gone."""
    stat = Path(f'/proc/{pid}/stat')
    if stat.parent.parent.is_dir():
        try:
            return stat.read_text(encoding='utf-8').rsplit(')', 1)[1].split()[0] != 'Z'
        except OSError:
            return False
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


class PassTokenTest(unittest.TestCase):
    """Portable: the verdict on captured output runs on every OS (#397)."""

    def test_pass_token_table(self):
        for stdout, code, expected in PASS_TABLE:
            with self.subTest(stdout=stdout, code=code):
                ok, detail = lua_tests.verdict(code, stdout + '\n', '')
                self.assertIs(ok, expected, detail)

    def test_pass_on_stderr_does_not_count(self):
        self.assertFalse(lua_tests.verdict(0, 'done\n', 'PASS hidden\n')[0])

    def test_last_pass_line_is_reported(self):
        self.assertEqual(lua_tests.verdict(0, 'PASS a\r\nnoise\nPASS b\n', ''), (True, 'PASS b'))


@unittest.skipIf(os.name == 'nt', 'POSIX shell stand-in interpreter')
class GameplayLuaRunnerTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        (self.root / lua_tests.SUITES).mkdir(parents=True)
        self.luajit = self.root / 'fake-luajit'
        self.luajit.write_text(FAKE, encoding='utf-8')
        self.luajit.chmod(0o755)

    def tearDown(self):
        self.temporary.cleanup()

    def suite(self, name, body):
        (self.root / lua_tests.SUITES / name).write_text(body, encoding='utf-8')

    def run_all(self):
        out = io.StringIO()
        with redirect_stdout(out):
            code = lua_tests.run_all(self.luajit, self.root)
        return code, out.getvalue()

    def test_all_suites_pass(self):
        self.suite('b.lua', 'echo "PASS b"\n')
        self.suite('a.lua', 'echo noise; echo "PASS a"\n')
        code, out = self.run_all()
        self.assertEqual(code, 0)
        self.assertIn('gameplay Lua: 2/2 PASS', out)
        self.assertLess(out.index('tests/gameplay/a.lua'), out.index('tests/gameplay/b.lua'))

    def test_no_suites_fails(self):
        code, out = self.run_all()
        self.assertEqual(code, 1)
        self.assertIn('no suites', out)

    def test_nonzero_exit_fails_even_after_pass_line(self):
        self.suite('ok.lua', 'echo "PASS ok"\n')
        self.suite('bad.lua', 'echo "PASS early"; echo "assertion failed" >&2; exit 1\n')
        code, out = self.run_all()
        self.assertEqual(code, 1)
        self.assertIn('FAIL tests/gameplay/bad.lua', out)
        self.assertIn('assertion failed', out)
        self.assertIn('gameplay Lua: 1/2 PASS', out)

    def test_missing_pass_line_fails(self):
        self.suite('silent.lua', 'echo done\n')
        code, out = self.run_all()
        self.assertEqual(code, 1)
        self.assertIn('no PASS line', out)

    def test_pass_on_stderr_does_not_count(self):
        self.suite('stderr.lua', 'echo "PASS hidden" >&2\n')
        self.assertEqual(self.run_all()[0], 1)

    def test_timeout_fails(self):
        self.suite('hang.lua', 'sleep 5\n')
        ok, detail, _ = lua_tests.run_suite(self.luajit, self.root, 'tests/gameplay/hang.lua', timeout=0.5)
        self.assertFalse(ok)
        self.assertIn('TIMEOUT', detail)

    def test_pass_token_table_end_to_end(self):
        for index, (stdout, code, expected) in enumerate(PASS_TABLE):
            with self.subTest(stdout=stdout, code=code):
                self.suite(f'case{index}.lua', f"echo '{stdout}'; exit {code}\n")
                ok, detail, _ = lua_tests.run_suite(self.luajit, self.root, f'tests/gameplay/case{index}.lua')
                self.assertIs(ok, expected, detail)

    @unittest.skipUnless(os.name == 'posix', 'POSIX process groups')
    def test_timeout_reaps_spawned_children(self):
        self.suite('hang.lua', 'sleep 5 & echo $! > childpid; wait\n')
        child = None
        try:
            ok, detail, seconds = lua_tests.run_suite(self.luajit, self.root, 'tests/gameplay/hang.lua', timeout=0.25)
            child = int((self.root / 'childpid').read_text(encoding='utf-8'))
            self.assertFalse(ok)
            self.assertEqual(detail, 'TIMEOUT after 0.25 s')
            self.assertLess(seconds, 5)
            deadline = time.monotonic() + 1
            while alive(child) and time.monotonic() < deadline:
                time.sleep(0.02)
            self.assertFalse(alive(child), f'suite child {child} survived the timeout')
        finally:
            if child is not None:
                try:
                    os.kill(child, signal.SIGKILL)
                except ProcessLookupError:
                    pass

    def test_only_top_level_lua_files_are_suites(self):
        (self.root / lua_tests.SUITES / 'fixtures').mkdir()
        (self.root / lua_tests.SUITES / 'fixtures/x.lua').write_text('exit 1\n')
        (self.root / lua_tests.SUITES / 'notes.json').write_text('{}')
        self.suite('a.lua', 'echo "PASS a"\n')
        self.assertEqual(lua_tests.discover(self.root), ['tests/gameplay/a.lua'])


if __name__ == '__main__':
    unittest.main()
