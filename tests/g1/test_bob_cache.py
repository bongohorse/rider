"""Bob's extender cache must never hand an unusable result to the next build (#209)."""
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tools/g1'))
import build as builder
from build import ANDROID_ABIS, invalidate_after_guard, platform_archs, read_cache_index, remove_inside, validate_cache

KEY = 'a' * 64


def java_key(path):
    """Escape a path the way java.util.Properties.store writes keys."""
    return ''.join('\\' + c if c in '\\:= #!' else c for c in str(path))


class BobCacheTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name) / 'root'
        self.cache = self.root / '.internal/cache'
        self.cache.mkdir(parents=True)
        (self.root / 'game.project').write_text('[project]\ntitle = RiderG1\n')

    def tearDown(self):
        self.temporary.cleanup()

    def result(self, arch, files=None, raw=None):
        path = self.cache / arch / 'build.zip'
        path.parent.mkdir(parents=True, exist_ok=True)
        if raw is not None:
            path.write_bytes(raw)
        else:
            with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as archive:
                for name, data in (files or {'dmengine.wasm': b'engine', 'dmengine.js': b'js', 'log.txt': b'log'}).items():
                    archive.writestr(name, data)
        return path

    def index(self, *paths, extra=''):
        lines = ['#Tue Oct 20 07:30:46 CEST 2026'] + [f'{java_key(p)}={KEY}' for p in paths]
        (self.cache / '.buildcache').write_text('\n'.join(lines) + '\n' + extra)

    def test_valid_results_are_kept(self):
        paths = [self.result('wasm-web'), self.result('wasm_pthread-web')]
        self.index(*paths)
        self.assertEqual(validate_cache(self.root), [])
        self.assertTrue(all(p.is_file() for p in paths))
        self.assertEqual(sorted(read_cache_index(self.cache / '.buildcache')), sorted(map(str, paths)))

    def assert_invalidated(self, problem, reason):
        good = self.result('wasm-web')
        self.index(good, problem)
        found = validate_cache(self.root)
        self.assertEqual([item['path'] for item in found], ['.internal/cache/wasm_pthread-web'])
        self.assertRegex(found[0]['reason'], reason)
        self.assertFalse(problem.parent.exists())
        self.assertTrue(good.is_file())
        self.assertEqual(list(read_cache_index(self.cache / '.buildcache')), [str(good)])

    def test_corrupt_zips_are_removed(self):
        for raw in [b'', b'<html>not a zip</html>']:
            with self.subTest(raw=raw):
                self.tearDown();self.setUp()
                self.assert_invalidated(self.result('wasm_pthread-web', raw=raw), 'not a readable zip')
        self.tearDown();self.setUp()
        whole = self.result('wasm_pthread-web').read_bytes()
        self.assert_invalidated(self.result('wasm_pthread-web', raw=whole[:len(whole) // 2]), 'not a readable zip')
        self.tearDown();self.setUp()
        damaged = bytearray(self.result('wasm_pthread-web', {'dmengine.wasm': b'x' * 4000, 'log.txt': b'log'}).read_bytes())
        damaged[60:70] = b'\xff' * 10
        self.assert_invalidated(self.result('wasm_pthread-web', raw=bytes(damaged)), 'corrupt zip entry|not a readable zip')

    def test_zip_without_engine_is_removed(self):
        self.assert_invalidated(self.result('wasm_pthread-web', {'log.txt': b'log', 'engine_template.html': b't'}), 'no engine binary')

    def test_missing_or_empty_log_is_removed(self):
        for files in [{'dmengine.wasm': b'engine', 'log.txt': b''}, {'dmengine.wasm': b'engine'}]:
            with self.subTest(files=sorted(files)):
                self.tearDown();self.setUp()
                self.assert_invalidated(self.result('wasm_pthread-web', files), 'missing or empty log.txt')

    def test_unreadable_index_clears_the_whole_cache(self):
        for extra in ['no separator here\n', f'{java_key(self.cache / "x/build.zip")}=not-a-key\n']:
            with self.subTest(extra=extra):
                self.tearDown();self.setUp()
                self.index(self.result('wasm-web'), extra=extra)
                found = validate_cache(self.root)
                self.assertEqual([item['path'] for item in found], ['.internal/cache'])
                self.assertRegex(found[0]['reason'], 'unreadable .buildcache')
                self.assertFalse(self.cache.exists())

    def test_unknown_layout_clears_the_whole_cache(self):
        self.result('wasm-web')
        (self.cache / 'wasm-web/other.bin').write_bytes(b'?')
        self.assertRegex(validate_cache(self.root)[0]['reason'], 'unknown cache layout at wasm-web')
        self.assertFalse(self.cache.exists())

    def test_windows_style_escaped_index_keys_are_read(self):
        (self.cache / '.buildcache').write_text(f'D\\:\\\\a\\\\rider\\\\.internal\\\\cache\\\\wasm-web\\\\build.zip={KEY}\n')
        self.assertEqual(list(read_cache_index(self.cache / '.buildcache')), ['D:\\a\\rider\\.internal\\cache\\wasm-web\\build.zip'])

    def test_index_rewrite_keeps_foreign_lines_byte_for_byte(self):
        foreign = f'D\\:\\\\a\\\\rider\\\\.internal\\\\cache\\\\x86_64-win32\\\\build.zip={KEY}'
        bad = self.result('wasm_pthread-web', raw=b'')
        self.index(self.result('wasm-web'), bad, extra=foreign + '\n')
        self.assertEqual([item['path'] for item in validate_cache(self.root)], ['.internal/cache/wasm_pthread-web'])
        lines = (self.cache / '.buildcache').read_text().splitlines()
        self.assertIn(foreign, lines)
        self.assertEqual(len(lines), 2)
        self.assertEqual(sorted(p.name for p in self.cache.iterdir()), ['.buildcache', 'wasm-web'])

    def test_leftover_index_temporary_is_removed_without_clearing_the_cache(self):
        good = self.result('wasm-web')
        self.index(good)
        (self.cache / '.buildcache.rider-4242.tmp').write_text('partial')
        self.assertEqual(validate_cache(self.root), [])
        self.assertTrue(good.is_file())
        self.assertFalse((self.cache / '.buildcache.rider-4242.tmp').exists())

    def guard_failure_tree(self):
        kept = self.result('x86_64-linux')
        self.index(self.result('wasm-web'), self.result('wasm_pthread-web'), kept)
        for arch in ['wasm-web', 'wasm_pthread-web', 'x86_64-linux']:
            (self.root / 'build' / arch).mkdir(parents=True)
            (self.root / 'build' / arch / 'log.txt').write_text('log')
        return kept

    def test_guard_failure_removes_cached_and_unpacked_results_of_the_platform(self):
        kept = self.guard_failure_tree()
        found, errors = invalidate_after_guard(self.root, 'wasm-web', RuntimeError('ENGINE GUARD: wasm_pthread-web: no extender engine'))
        self.assertEqual(errors, [])
        self.assertEqual(sorted(item['path'] for item in found), ['.internal/cache/wasm-web', '.internal/cache/wasm_pthread-web',
                                                                   'build/wasm-web', 'build/wasm_pthread-web'])
        self.assertTrue(all('engine guard failed: ENGINE GUARD: wasm_pthread-web' in item['reason'] for item in found))
        self.assertTrue(kept.is_file() and (self.root / 'build/x86_64-linux/log.txt').is_file())
        self.assertEqual(list(read_cache_index(self.cache / '.buildcache')), [str(kept)])

    def test_android_guard_failure_covers_every_android_abi(self):
        self.assertEqual(platform_archs('arm64-android'), tuple(sorted(set(ANDROID_ABIS.values()))))
        for arch in ANDROID_ABIS.values():
            (self.root / 'build' / arch).mkdir(parents=True)
        found, errors = invalidate_after_guard(self.root, 'arm64-android', RuntimeError('ENGINE GUARD'))
        self.assertEqual(sorted(item['path'] for item in found), sorted(f'build/{arch}' for arch in ANDROID_ABIS.values()))
        self.assertIn('build/x86_64-android', [item['path'] for item in found])

    def test_a_failed_removal_is_recorded_and_the_others_still_run(self):
        self.guard_failure_tree()
        real = builder.remove_inside
        def flaky(path, base, root):
            if Path(path).name == 'wasm-web' and Path(path).parent.name == 'build':
                raise PermissionError('file is locked')
            return real(path, base, root)
        with mock.patch.object(builder, 'remove_inside', side_effect=flaky):
            found, errors = invalidate_after_guard(self.root, 'wasm-web', RuntimeError('ENGINE GUARD'))
        self.assertEqual(errors, ['build/wasm-web: PermissionError: file is locked'])
        self.assertEqual(sorted(item['path'] for item in found), ['.internal/cache/wasm-web', '.internal/cache/wasm_pthread-web',
                                                                   'build/wasm_pthread-web'])

    def test_deletion_never_leaves_the_repository(self):
        outside = Path(self.temporary.name) / 'outside'
        outside.mkdir()
        (outside / 'keep.txt').write_text('keep')
        with self.assertRaisesRegex(RuntimeError, 'refusing to delete outside the repository'):
            remove_inside(outside, self.root, self.root)
        with self.assertRaisesRegex(RuntimeError, 'refusing to delete outside the repository'):
            remove_inside(outside, outside, self.root)
        with self.assertRaisesRegex(RuntimeError, 'refusing to delete .* not inside'):
            remove_inside(outside, self.cache, self.root)
        with self.assertRaisesRegex(RuntimeError, 'refusing to delete .* not inside'):
            remove_inside(self.cache / '../../outside', self.cache, self.root)
        self.assertTrue((outside / 'keep.txt').is_file())

    def symlink(self, target, link):
        try:
            os.symlink(target, link, target_is_directory=True)
        except OSError:
            self.skipTest('this OS user cannot create symlinks; the non-symlink path checks run in the other tests')

    def test_symlinks_are_unlinked_never_followed(self):
        outside = Path(self.temporary.name) / 'outside'
        outside.mkdir()
        (outside / 'keep.txt').write_text('keep')
        inside = self.result('wasm-web').parent
        self.symlink(outside, self.cache / 'wasm_pthread-web')
        self.symlink(inside, self.cache / 'x86_64-linux')
        remove_inside(self.cache / 'wasm_pthread-web', self.cache, self.root)
        remove_inside(self.cache / 'x86_64-linux', self.cache, self.root)
        self.assertFalse((self.cache / 'wasm_pthread-web').is_symlink() or (self.cache / 'x86_64-linux').is_symlink())
        self.assertTrue((outside / 'keep.txt').is_file())
        self.assertTrue((inside / 'build.zip').is_file())
        self.symlink(outside, self.cache / 'wasm_pthread-web')
        self.assertEqual(validate_cache(self.root)[0]['reason'], 'unknown cache layout at wasm_pthread-web')
        self.assertTrue((outside / 'keep.txt').is_file())

    def failing_build(self, *patches):
        output = Path(self.temporary.name) / 'output'
        process = mock.Mock(pid=os.getpid())
        process.wait.return_value = 0
        java = mock.Mock(stdout=f'OpenJDK Runtime Environment {builder.JDK_BUILD} (build x)', stderr='')
        with mock.patch.object(builder, 'ROOT', self.root), mock.patch.object(builder, 'bob_jar', return_value=Path('bob.jar')), \
                mock.patch('shutil.which', return_value='java'), mock.patch('subprocess.run', return_value=java), \
                mock.patch('subprocess.Popen', return_value=process):
            for patch in patches:
                patch.start()
            try:
                with self.assertRaisesRegex(RuntimeError, 'ENGINE GUARD: wasm-web: bundle directory'):
                    builder.build('wasm-web', output)
            finally:
                for patch in patches:
                    patch.stop()
        return (output / 'build.log').read_text(), json.loads((output / 'engines.json').read_text())

    def test_build_logs_invalidations_and_cleans_up_after_a_guard_failure(self):
        self.index(self.result('wasm_pthread-web', raw=b''))
        (self.root / 'build/wasm-web').mkdir(parents=True)
        log, report = self.failing_build()
        self.assertIn('RIDER CACHE INVALIDATED .internal/cache/wasm_pthread-web: not a readable zip', log)
        self.assertIn('RIDER CACHE INVALIDATED build/wasm-web: engine guard failed', log)
        self.assertEqual(report['status'], 'FAIL')
        self.assertEqual([item['path'] for item in report['cache_invalidations']], ['.internal/cache/wasm_pthread-web', 'build/wasm-web'])
        self.assertEqual(report['cache_cleanup_errors'], [])
        self.assertFalse((self.root / 'build/wasm-web').exists())

    def test_cleanup_failure_never_hides_the_guard_failure(self):
        (self.root / 'build/wasm-web').mkdir(parents=True)
        log, report = self.failing_build(mock.patch.object(builder, 'invalidate_after_guard', side_effect=OSError('disk gone')))
        self.assertIn('RIDER CACHE CLEANUP FAILED OSError: disk gone', log)
        self.assertEqual(report['status'], 'FAIL')
        self.assertRegex(report['error'], 'ENGINE GUARD: wasm-web: bundle directory')
        self.assertEqual(report['cache_cleanup_errors'], ['OSError: disk gone'])

if __name__ == '__main__':
    unittest.main()
