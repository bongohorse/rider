"""Local bundle identity follows working files, not only the last commit."""
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tools/gym'))
import bundle


class SourceFingerprintTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.git('init', '-q')
        (self.root / '.gitignore').write_text('artifacts/\n')
        (self.root / 'main.lua').write_text('original')
        self.git('add', '.')
        self.git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'fixture')
        self.patch = mock.patch.object(bundle, 'ROOT', self.root)
        self.patch.start()
        self.addCleanup(self.patch.stop)

    def git(self, *args):
        return subprocess.check_output(['git', *args], cwd=self.root, stderr=subprocess.STDOUT)

    def test_edit_stage_new_delete_and_ignored_artifact(self):
        initial = bundle.source_fingerprint()
        (self.root / 'main.lua').write_text('edited')
        edited = bundle.source_fingerprint()
        self.assertNotEqual(initial, edited)
        self.git('add', 'main.lua')
        self.assertEqual(edited, bundle.source_fingerprint())
        (self.root / 'new source.lua').write_text('new')
        added = bundle.source_fingerprint()
        self.assertNotEqual(edited, added)
        (self.root / 'artifacts').mkdir()
        (self.root / 'artifacts/test.log').write_text('generated')
        self.assertEqual(added, bundle.source_fingerprint())
        (self.root / 'main.lua').unlink()
        deleted = bundle.source_fingerprint()
        self.assertNotEqual(added, deleted)
        self.git('rm', '--cached', 'main.lua')
        self.assertNotEqual(deleted, bundle.source_fingerprint())

    def test_source_change_during_build_does_not_publish_bundle(self):
        output = self.root / 'artifacts/bundle'
        def fake_build(*args, **kwargs):
            (output / 'index.html').write_text('fixture')
            (self.root / 'main.lua').write_text('changed during build')
        with mock.patch.object(bundle, 'build', side_effect=fake_build):
            with self.assertRaisesRegex(RuntimeError, 'Sources changed during'):
                bundle.build_bundle(output, 'fixture')
        self.assertFalse((output / 'bundle.json').exists())


if __name__ == '__main__':
    unittest.main()
