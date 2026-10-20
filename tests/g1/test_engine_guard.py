"""A bundle must never ship an engine other than this build's extender result (#208)."""
import json
import os
from pathlib import Path
import sys
import tempfile
import time
import unittest
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tools/g1'))
from build import EXTENDER_LINE, verify_engines

STOCK_WASM = b'stock wasm-web engine'


class EngineGuardTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        base = Path(self.temporary.name)
        self.root, self.output = base / 'root', base / 'output'
        self.root.mkdir()
        (self.root / 'game.project').write_text('[bootstrap]\ntitle = Wrong\n[project]\ntitle = RiderG1\n')
        self.bob = base / 'bob.jar'
        with zipfile.ZipFile(self.bob, 'w') as jar:
            jar.writestr('libexec/wasm-web/dmengine.wasm', STOCK_WASM)
            jar.writestr('libexec/wasm-web/dmengine_release.wasm', b'stock release engine')
            jar.writestr('libexec/x86_64-linux/dmengine', b'stock linux engine')
        self.started = time.time()

    def tearDown(self):
        self.temporary.cleanup()

    def extender(self, arch, files):
        directory = self.root / 'build' / arch
        directory.mkdir(parents=True, exist_ok=True)
        for name, data in files.items():
            (directory / name).write_bytes(data)
        (directory / 'log.txt').write_text(f'{arch} extender log\n')
        copied = self.output / 'extender' / arch / 'log.txt'
        copied.parent.mkdir(parents=True, exist_ok=True)
        copied.write_text(f'{arch} extender log\n')

    def html5(self, lines=2):
        web = self.output / 'RiderG1'
        web.mkdir(parents=True)
        (web / 'index.html').write_text('<html></html>')
        engines = {'wasm-web': ('RiderG1', b'v3 wasm', b'v3 js'), 'wasm_pthread-web': ('RiderG1_pthread', b'v3 pthread wasm', b'v3 pthread js')}
        for arch, (stem, wasm, js) in engines.items():
            self.extender(arch, {'dmengine.wasm': wasm, 'dmengine.js': js, 'engine_template.html': b'template'})
            (web / f'{stem}.wasm').write_bytes(wasm)
            (web / f'{stem}_wasm.js').write_bytes(js)
        (self.output / 'build.log').write_text(f'INFO    {EXTENDER_LINE}\n' * lines)
        return web

    def verify(self, platform='wasm-web'):
        return verify_engines(platform, self.output, self.root, self.started, self.bob)

    def test_complete_html5_bundle_passes_and_records_every_engine(self):
        self.html5()
        report = self.verify()
        self.assertEqual(sorted(report['architectures']), ['wasm-web', 'wasm_pthread-web'])
        self.assertEqual([e['extender'] for e in report['architectures']['wasm_pthread-web']], ['dmengine.wasm', 'dmengine.js'])
        self.assertEqual(json.loads((self.output / 'engines.json').read_text()), report)

    def test_missing_extender_engine_fails_for_that_architecture(self):
        self.html5()
        for name in ['dmengine.wasm', 'dmengine.js']:
            (self.root / 'build/wasm_pthread-web' / name).unlink()
        with self.assertRaisesRegex(RuntimeError, r'wasm_pthread-web: no extender engine'):
            self.verify()
        self.assertFalse((self.output / 'engines.json').exists())

    def test_substituted_engine_fails(self):
        web = self.html5()
        (web / 'RiderG1_pthread.wasm').write_bytes(b'stock pthread engine downloaded by Bob')
        with self.assertRaisesRegex(RuntimeError, r'wasm_pthread-web: bundled RiderG1_pthread.wasm .* is not the extender engine'):
            self.verify()

    def test_stock_engine_fails_even_when_build_directory_holds_it(self):
        web = self.html5()
        (web / 'RiderG1.wasm').write_bytes(STOCK_WASM)
        (self.root / 'build/wasm-web/dmengine.wasm').write_bytes(STOCK_WASM)
        with self.assertRaisesRegex(RuntimeError, r'wasm-web: bundled RiderG1.wasm is the stock Defold engine'):
            self.verify()

    def test_missing_or_empty_logs_fail(self):
        for path in ['root/build/wasm_pthread-web/log.txt', 'output/extender/wasm_pthread-web/log.txt']:
            for empty in [False, True]:
                with self.subTest(path=path, empty=empty):
                    self.tearDown();self.setUp();self.html5()
                    target = Path(self.temporary.name) / path
                    target.write_text('') if empty else target.unlink()
                    with self.assertRaisesRegex(RuntimeError, r'wasm_pthread-web: .*log .* is missing or empty'):
                        self.verify()

    def test_extender_line_count_must_match_architectures(self):
        for lines in [0, 1, 3]:
            with self.subTest(lines=lines):
                self.tearDown();self.setUp();self.html5(lines)
                with self.assertRaisesRegex(RuntimeError, rf'wasm-web: Bob logged ".*" {lines} times for 2 architectures'):
                    self.verify()

    def test_stale_extender_results_fail(self):
        self.html5()
        old = self.started - 3600
        for name in ['log.txt', 'dmengine.wasm']:
            path = self.root / 'build/wasm-web' / name
            os.utime(path, (old, old))
            with self.assertRaisesRegex(RuntimeError, r'wasm-web: extender .* older than this build'):
                self.verify()
            os.utime(path, (self.started, self.started))

    def test_bundle_without_platform_engine_fails(self):
        web = self.html5()
        for name in ['RiderG1.wasm', 'RiderG1_wasm.js']:
            (web / name).unlink()
        with self.assertRaisesRegex(RuntimeError, r'wasm-web: no wasm-web engine in the bundle'):
            self.verify()

    def apk(self, libraries):
        self.output.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(self.output / 'RiderG1.apk', 'w') as apk:
            for name, data in libraries.items():
                apk.writestr(name, data)

    def test_android_checks_every_abi_in_the_apk(self):
        self.extender('arm64-android', {'libdmengine.so': b'arm64 v3'})
        self.extender('armv7-android', {'libdmengine.so': b'armv7 v3'})
        self.apk({'lib/arm64-v8a/libRiderG1.so': b'arm64 v3', 'lib/armeabi-v7a/libRiderG1.so': b'armv7 v3',
                  'lib/arm64-v8a/libvkquality.so': b'third party'})
        self.assertEqual(sorted(self.verify('arm64-android')['architectures']), ['arm64-android', 'armv7-android'])
        self.apk({'lib/arm64-v8a/libRiderG1.so': b'arm64 v3', 'lib/armeabi-v7a/libRiderG1.so': b'stock armv7'})
        with self.assertRaisesRegex(RuntimeError, r'armv7-android: bundled RiderG1.apk!lib/armeabi-v7a/libRiderG1.so .* is not the extender engine'):
            self.verify('arm64-android')

    def test_native_debug_bundle_matches_unstripped_extender_engine(self):
        self.extender('x86_64-linux', {'dmengine': b'stripped', 'dmengine_unstripped': b'unstripped'})
        (self.output / 'RiderG1').mkdir(parents=True)
        binary = self.output / 'RiderG1/RiderG1.x86_64'
        binary.write_bytes(b'unstripped')
        self.assertEqual(self.verify('x86_64-linux')['architectures']['x86_64-linux'][0]['extender'], 'dmengine_unstripped')
        binary.write_bytes(b'stock linux engine')
        with self.assertRaisesRegex(RuntimeError, r'x86_64-linux: bundled RiderG1.x86_64 is the stock Defold engine'):
            self.verify('x86_64-linux')


if __name__ == '__main__':
    unittest.main()
