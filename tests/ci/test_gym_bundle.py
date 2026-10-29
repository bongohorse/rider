"""A shared bundle must never turn stale or modified binaries into current evidence."""
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tools/gym'))
import bundle
from bundle import inventory, verify_bundle


class SharedBundleTest(unittest.TestCase):
    def test_rejects_foreign_source_configuration_and_changed_files(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            asset = root / 'game.wasm'
            asset.write_bytes(b'compiled fixture')
            report = {'source_sha': 'current', 'source_fingerprint': bundle.source_fingerprint(),
                      'platform': 'wasm-web', 'variant': 'debug', 'files': inventory(root)}
            manifest = root / 'bundle.json'
            manifest.write_text(json.dumps(report))
            self.assertEqual(verify_bundle(root, 'current'), root)
            with self.assertRaisesRegex(RuntimeError, 'Foreign'):
                verify_bundle(root, 'old')
            for key, value in [('platform', 'arm64-android'), ('variant', 'release')]:
                manifest.write_text(json.dumps({**report, key: value}))
                with self.assertRaisesRegex(RuntimeError, 'Foreign'):
                    verify_bundle(root, 'current')
            manifest.write_text(json.dumps(report))
            asset.write_bytes(b'changed binary')
            with self.assertRaisesRegex(RuntimeError, 'changed'):
                verify_bundle(root, 'current')
            asset.unlink()
            with self.assertRaisesRegex(RuntimeError, 'changed'):
                verify_bundle(root, 'current')

    def test_rejects_changed_sources_and_old_manifests(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / 'game.wasm').write_bytes(b'fixture')
            report = {'source_sha': 'current', 'source_fingerprint': 'before',
                      'platform': 'wasm-web', 'variant': 'debug', 'files': inventory(root)}
            for fingerprint in ('before', None):
                (root / 'bundle.json').write_text(json.dumps({**report, 'source_fingerprint': fingerprint}))
                with mock.patch.object(bundle, 'source_fingerprint', return_value='after'):
                    with self.assertRaisesRegex(RuntimeError, 'source inputs changed'):
                        verify_bundle(root, 'current')


if __name__ == '__main__':
    unittest.main()
