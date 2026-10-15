import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools'))
import bootstrap_check
import doctor


class BootstrapContract(unittest.TestCase):
    def test_actual_bootstrap_is_valid(self):
        self.assertEqual(bootstrap_check.validate(ROOT), [])

    def test_invalid_g1_bootstrap_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            copy = Path(directory)
            for filename in bootstrap_check.REQUIRED + ['package.json']:
                target = copy / filename
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(ROOT / filename, target)
            (copy / 'game.project').write_text('[project]\n')
            self.assertTrue(any('main_collection' in e for e in bootstrap_check.validate(copy)))

    def test_unpinned_action_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            copy = Path(directory)
            for filename in bootstrap_check.REQUIRED + ['package.json']:
                target = copy / filename
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(ROOT / filename, target)
            workflow = copy / '.github/workflows/ci.yml'
            text = workflow.read_text()
            import re
            workflow.write_text(re.sub(r'actions/checkout@[0-9a-f]{40}', 'actions/checkout@main', text))
            self.assertTrue(any('unpinned' in e for e in bootstrap_check.validate(copy)))

    def test_pages_write_permission_requires_main_guard(self):
        with tempfile.TemporaryDirectory() as directory:
            copy = Path(directory)
            for filename in bootstrap_check.REQUIRED + ['package.json']:
                target = copy / filename
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(ROOT / filename, target)
            workflow = copy / '.github/workflows/ci.yml'
            workflow.write_text(workflow.read_text().replace("github.ref == 'refs/heads/main'", 'true'))
            self.assertTrue(any('Pages permission requires main-only guard' in e for e in bootstrap_check.validate(copy)))

    def test_doctor_returns_machine_readable_report_without_runtime_claim(self):
        result = subprocess.run([sys.executable, str(ROOT / 'tools/doctor.py'), '--json'],
                                capture_output=True, text=True, timeout=30, check=True)
        report = json.loads(result.stdout)
        self.assertFalse(report['runtime_verified'])
        self.assertEqual(report['scope'], 'G0_ENVIRONMENT')
        self.assertTrue(all(c['status'] in ('PASS', 'WARN', 'FAIL') for c in report['checks']))

    def test_java_version_parsing(self):
        self.assertEqual(doctor.java_major('openjdk version "25.0.1"'), 25)
        self.assertEqual(doctor.java_major('java version "1.8.0_431"'), 8)
        self.assertIsNone(doctor.java_major('not a version'))


if __name__ == '__main__':
    unittest.main()
