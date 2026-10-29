"""Selecting a local Extender must never become an implicit public build."""
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tools/g1'))
import build as builder


class BuildServerTest(unittest.TestCase):
    def test_default_and_explicit_local_selection(self):
        with mock.patch.dict(os.environ, {}, clear=True):
            self.assertEqual(builder.build_server(), builder.LOCK['engine']['extender'])
        for address in ('http://127.0.0.1:9000', 'http://localhost:9000/', 'http://[::1]:9000'):
            with mock.patch.dict(os.environ, RIDER_BUILD_SERVER=address):
                self.assertEqual(builder.build_server(), address.rstrip('/'))

    def test_invalid_override_blocks_instead_of_falling_back(self):
        for address in ('', 'https://build.defold.com', 'http://0.0.0.0:9000', 'http://localhost',
                        'http://localhost:0', 'http://localhost:99999', 'http://localhost:abc',
                        'http://secret@localhost:9000', 'http://localhost:9000?token=secret',
                        'http://localhost:9000/path', 'http://localhost:9000#fragment'):
            with self.subTest(address=address), mock.patch.dict(os.environ, RIDER_BUILD_SERVER=address):
                with self.assertRaisesRegex(RuntimeError, 'BLOCKED: RIDER_BUILD_SERVER'):
                    builder.build_server()

    def test_bob_receives_local_url_and_connection_failure_is_not_retried_publicly(self):
        java = mock.Mock(returncode=0, stdout=builder.JDK_BUILD + ' (build)', stderr='')
        process = mock.Mock()
        process.wait.return_value = 1
        with tempfile.TemporaryDirectory() as directory, \
                mock.patch.object(builder, 'ROOT', Path(directory)), \
                mock.patch.dict(os.environ, RIDER_BUILD_SERVER='http://127.0.0.1:9000'), \
                mock.patch.object(builder, 'bob_jar', return_value=Path('verified-bob.jar')), \
                mock.patch.object(builder, 'validate_cache', return_value=[]), \
                mock.patch.object(builder, 'build_started', return_value=0), \
                mock.patch('shutil.which', return_value='java'), \
                mock.patch('subprocess.run', return_value=java), \
                mock.patch('subprocess.Popen', return_value=process) as launch:
            (Path(directory) / 'game.project').write_text('[project]\ntitle = Fixture\n')
            with self.assertRaisesRegex(RuntimeError, 'Bob build failed'):
                builder.build('wasm-web', Path(directory) / 'output')
            self.assertEqual(launch.call_count, 1)
            command = launch.call_args.args[0]
            self.assertEqual(command[command.index('--build-server') + 1], 'http://127.0.0.1:9000')
            self.assertNotIn(builder.LOCK['engine']['extender'], command)


if __name__ == '__main__':
    unittest.main()
