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

    def physics_report(self,target,players_load=None,players=True):
        """Run the physics verify report over a fake runner output."""
        from unittest import mock
        IDS=cli.IDS
        with tempfile.TemporaryDirectory() as d:
            out=Path(d)
            sha=cli.subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
            def fake(test_id,command,output,timeout,require_tests=False):
                physics=output/'physics';physics.mkdir(parents=True,exist_ok=True)
                (physics/'comparison.json').write_text(json.dumps({'status':'PASS','source_sha':sha}))
                configs=['scale-0.01-fps-60','scale-0.02-fps-30']
                for config in configs+([f'{c}/wasm-web' for c in configs] if players else []):
                    report={'status':'PASS','source_sha':sha,'cases':{k:{'value':1} for k in IDS}}
                    if config.endswith('wasm-web'):report['engine_load']=players_load or {'wasm':['RiderG1.wasm'],'cross_origin_isolated':False}
                    (physics/config).mkdir(parents=True,exist_ok=True);(physics/config/'result.json').write_text(json.dumps(report))
                return {'id':test_id,'status':'PASS','duration_ms':1,'assertions':1,'detail':'','artifacts':[]}
            with mock.patch.object(cli,'execute',side_effect=fake):
                code=cli.main(['verify','--suite','physics','--target',target,'--output',str(out)])
            return code,json.loads((out/'results.json').read_text())

    def test_html5_players_cases_are_additive(self):
        isolated=[f'{c}.{k}' for c in ['scale-0.01-fps-60','scale-0.02-fps-30'] for k in cli.IDS]
        code,native=self.physics_report('desktop',players=False)
        self.assertEqual((code,[t['id'] for t in native['tests']]),(0,isolated))
        code,html5=self.physics_report('html5')
        ids=[t['id'] for t in html5['tests']]
        self.assertEqual(code,0)
        self.assertEqual(ids[:len(isolated)],isolated)
        self.assertEqual(ids[len(isolated):],[f'{c}.wasm-web.{k}' for c in ['scale-0.01-fps-60','scale-0.02-fps-30'] for k in cli.IDS])
        self.assertEqual(html5['tests'][:len(isolated)],native['tests'])

    def test_html5_players_run_must_exist_and_load_wasm_web(self):
        for kwargs in [{'players':False},{'players_load':{'wasm':['RiderG1_pthread.wasm'],'cross_origin_isolated':False}},
                       {'players_load':{'wasm':['RiderG1.wasm'],'cross_origin_isolated':True}}]:
            with self.subTest(**{k:str(v) for k,v in kwargs.items()}):
                code,report=self.physics_report('html5',**kwargs)
                self.assertEqual(code,1)
                self.assertEqual(report['status'],'FAIL')
                self.assertEqual(len(report['tests']),4*len(cli.IDS))
                self.assertTrue(all(t['status']=='FAIL' for t in report['tests']))

    def test_incomplete_inventory_is_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            with self.assertRaises(RuntimeError):cli.write_report(Path(d),'empty',[],['required'],'sha')

if __name__=='__main__':unittest.main()
