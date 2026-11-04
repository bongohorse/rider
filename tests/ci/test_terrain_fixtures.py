"""Retained terrain tools consume repository-owned fixtures, never retired report inputs."""
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
FIXTURES = ROOT / 'tests/gameplay/level-fixtures'
NAMES = ('six-anchor', 'long-curves', 'mixed', 'long-over-budget', 'mixed-over-budget')


class TerrainFixtures(unittest.TestCase):
    def test_both_preview_preparers_copy_exact_current_fixtures(self):
        for folder in ('terrain_play', 'terrain_perspective'):
            with self.subTest(folder=folder), tempfile.TemporaryDirectory() as tmp:
                base = Path(tmp)
                bundle = base / 'bundle'
                bundle.mkdir()
                (bundle / 'index.html').write_text('<html></html>')
                output = base / 'output'
                result = subprocess.run([sys.executable, str(ROOT / 'tools' / folder / 'prepare_preview.py'),
                                         str(bundle), '--output', str(output)], cwd=base,
                                        capture_output=True, text=True, timeout=20)
                self.assertEqual(result.returncode, 0, result.stderr)
                for name in NAMES:
                    phase = 'terrain-p5' if name.endswith('over-budget') else 'terrain-p0'
                    expected = (FIXTURES / phase / (name + '.json')).read_bytes()
                    self.assertEqual((output / 'courses' / (name + '.json')).read_bytes(), expected)

    def test_active_terrain_tools_do_not_read_retired_report_inputs(self):
        violations = []
        for folder in ('terrain_play', 'terrain_perspective', 'terrain_compare'):
            for script in (ROOT / 'tools' / folder).iterdir():
                if script.suffix not in ('.py', '.cjs'):
                    continue
                for line, text in enumerate(script.read_text().splitlines(), 1):
                    if not text.lstrip().startswith(('#', '//')) and 'docs/reports/' in text:
                        violations.append(f'{script.relative_to(ROOT)}:{line}')
        self.assertEqual(violations, [], 'Executable references to retired terrain fixtures')

    def test_browser_fixture_preflight_is_independent_of_cwd(self):
        helper = ROOT / 'tools/terrain_play/fixtures.cjs'
        with tempfile.TemporaryDirectory() as cwd:
            result = subprocess.run(['node', '-e',
                'const f=require(process.argv[1]).loadFixtures(JSON.parse(process.argv[2]));'
                'console.log(JSON.stringify(Object.fromEntries(Object.entries(f).map(([k,v])=>[k,JSON.parse(v).id]))));',
                str(helper), json.dumps(NAMES)], cwd=cwd, capture_output=True, text=True, timeout=20)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(set(json.loads(result.stdout)), set(NAMES))

    def test_missing_browser_fixture_fails_with_its_name(self):
        result = subprocess.run(['node', '-e',
            'require(process.argv[1]).loadFixtures(["missing-507-fixture"]);',
            str(ROOT / 'tools/terrain_play/fixtures.cjs')],
            capture_output=True, text=True, timeout=20)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Terrain fixture missing-507-fixture is unavailable:', result.stderr)

    def test_every_browser_entry_preflights_before_loading_playwright(self):
        # Isolated copies retain the real entry/helper code but have neither fixtures nor Playwright.
        # Removing an entry's preflight would reach MODULE_NOT_FOUND instead of the named input error.
        entries = {
            'terrain_compare/measure.cjs': 'six-anchor',
            'terrain_play/check_lifecycle.cjs': 'six-anchor',
            'terrain_play/check_far_course.cjs': 'mixed-over-budget',
            'terrain_play/observe_resources.cjs': 'six-anchor',
            'terrain_perspective/check_gym_menu.cjs': 'mixed-over-budget',
            'terrain_perspective/check_menu.cjs': 'long-curves',
            'terrain_perspective/check_menu_release.cjs': 'long-curves',
            'terrain_perspective/check_production.cjs': 'long-curves',
        }
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            for relative in (*entries, 'terrain_play/fixtures.cjs'):
                target = base / 'tools' / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(ROOT / 'tools' / relative, target)
            for relative, missing in entries.items():
                with self.subTest(entry=relative):
                    result = subprocess.run(['node', str(base / 'tools' / relative), 'unused', 'unused'],
                                            cwd=base, capture_output=True, text=True, timeout=20)
                    self.assertNotEqual(result.returncode, 0)
                    self.assertIn(f'Terrain fixture {missing} is unavailable:', result.stderr)
                    self.assertNotIn('MODULE_NOT_FOUND', result.stderr)


if __name__ == '__main__':
    unittest.main()
