"""The gameplay Lua runner must fail closed (#395)."""
import io
import os
from pathlib import Path
import sys
import tempfile
import unittest
from contextlib import redirect_stdout

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tools/gameplay'))
import lua_tests

# Stand-in interpreter: runs a suite whose body is a shell snippet.
FAKE = '#!/bin/sh\n[ "$1" = "-joff" ] || exit 9\nexec /bin/sh "$2"\n'


@unittest.skipIf(os.name == 'nt', 'POSIX shell stand-in interpreter')
class GameplayLuaRunnerTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        (self.root / lua_tests.SUITES).mkdir(parents=True)
        self.luajit = self.root / 'fake-luajit'
        self.luajit.write_text(FAKE)
        self.luajit.chmod(0o755)

    def tearDown(self):
        self.temporary.cleanup()

    def suite(self, name, body):
        (self.root / lua_tests.SUITES / name).write_text(body)

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

    def test_only_top_level_lua_files_are_suites(self):
        (self.root / lua_tests.SUITES / 'fixtures').mkdir()
        (self.root / lua_tests.SUITES / 'fixtures/x.lua').write_text('exit 1\n')
        (self.root / lua_tests.SUITES / 'notes.json').write_text('{}')
        self.suite('a.lua', 'echo "PASS a"\n')
        self.assertEqual(lua_tests.discover(self.root), ['tests/gameplay/a.lua'])


if __name__ == '__main__':
    unittest.main()
