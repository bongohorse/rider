"""The read-only doctor must reject a stale or missing managed wrapper."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import zipfile
import hashlib

ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('setup_bridge_check',ROOT/'tools/setup_bridge.py')
setup=importlib.util.module_from_spec(spec);spec.loader.exec_module(setup)

class WrapperChecks(unittest.TestCase):
    def test_matching_source_is_read_only_and_tampering_fails(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d)
            archive=root/'.cache/g2/bridge.zip';archive.parent.mkdir(parents=True)
            with zipfile.ZipFile(archive,'w') as z:z.writestr('release/automation_bridge/automation-bridge-python/automation_bridge/client.py','PINNED SOURCE')
            lock={'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'commit':'commit','python_package_version':'test'}
            (root/'tools').mkdir();(root/'tools/bridge-candidate.json').write_text(json.dumps(lock))
            wrapper=root/'automation-bridge-python/automation_bridge/client.py';wrapper.parent.mkdir(parents=True);wrapper.write_text('PINNED SOURCE')
            before={str(p.relative_to(root)):p.read_bytes() for p in root.rglob('*') if p.is_file()}
            with patch.object(setup,'ROOT',root):
                self.assertEqual(setup.inspect_installation()['verified_files'],1)
                self.assertEqual(before,{str(p.relative_to(root)):p.read_bytes() for p in root.rglob('*') if p.is_file()})
                wrapper.write_text('STALE SOURCE')
                with self.assertRaisesRegex(RuntimeError,'Wrapper source mismatch'):setup.inspect_installation()
                wrapper.unlink()
                with self.assertRaises(OSError):setup.inspect_installation()

if __name__=='__main__':unittest.main()
