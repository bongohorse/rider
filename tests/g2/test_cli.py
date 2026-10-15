import importlib.util
import json
import os
import signal
from pathlib import Path
import sys
import tempfile
import unittest
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('project_cli',ROOT/'tools/project.py')
cli=importlib.util.module_from_spec(spec);spec.loader.exec_module(cli)

class CliTests(unittest.TestCase):
    def test_nonzero_process_is_failure_in_json_and_junit(self):
        with tempfile.TemporaryDirectory() as d:
            out=Path(d)
            test=cli.execute('broken',[sys.executable,'-c','raise SystemExit(7)'],out,10)
            self.assertEqual(cli.write_report(out,'negative',[test],['broken'],'sha'),1)
            self.assertEqual(json.loads((out/'results.json').read_text())['status'],'FAIL')
            self.assertIsNotNone(ET.parse(out/'junit.xml').find('.//failure'))

    def test_zero_discovered_unit_tests_is_failure(self):
        with tempfile.TemporaryDirectory() as d:
            test=cli.execute('empty',[sys.executable,'-c','print("Ran 0 tests")'],Path(d),10,True)
            self.assertEqual(test['status'],'FAIL')

    def test_timeout_does_not_pass(self):
        with tempfile.TemporaryDirectory() as d:
            test=cli.execute('timeout',[sys.executable,'-c','import time; time.sleep(30)'],Path(d),0.1)
            self.assertEqual(test['status'],'FAIL')
            self.assertIn('process tree terminated',test['detail'])

    @unittest.skipUnless(sys.platform.startswith('linux'),'Linux process-tree regression')
    def test_timeout_terminates_child_with_own_session(self):
        with tempfile.TemporaryDirectory() as d:
            out=Path(d);pidfile=out/'child.pid'
            child="import os,time,json; from pathlib import Path; Path("+repr(str(pidfile))+").write_text(json.dumps(dict(pid=os.getpid(),proc=os.readlink('/proc/self')))); time.sleep(30)"
            parent="import subprocess,sys,time; subprocess.Popen([sys.executable,'-c',"+repr(child)+"],start_new_session=True); time.sleep(30)"
            result=cli.execute('tree',[sys.executable,'-c',parent],out,2)
            self.assertEqual(result['status'],'FAIL')
            self.assertTrue(pidfile.exists(),'Child process did not reach the test fixture')
            child_info=json.loads(pidfile.read_text());pid=child_info['pid']
            try:
                stat=Path('/proc')/child_info['proc']/'stat'
                self.assertTrue(not stat.exists() or stat.read_text().split()[2]=='Z','Detached child survived watchdog cleanup')
            finally:
                try:os.kill(pid,signal.SIGKILL)
                except ProcessLookupError:pass

    def test_incomplete_inventory_is_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            with self.assertRaises(RuntimeError):cli.write_report(Path(d),'empty',[],['required'],'sha')

if __name__=='__main__':unittest.main()
