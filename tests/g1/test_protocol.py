import json
from pathlib import Path
import sys
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'tools/g1'))
from protocol import Collector, IDS, PREFIX
from build import approved_java


class ProtocolTests(unittest.TestCase):
    def collector(self):
        return Collector('current','sha','config')

    def feed(self,c,**data):
        c.feed(PREFIX+json.dumps(dict(run_id='current',**data)))

    def start(self,c):
        self.feed(c,event='suite_start',protocol=1,suite='g1',expected=IDS,source_sha='sha',config_hash='config')

    def cases(self,c):
        for key in IDS:self.feed(c,event='case',id=key,status='PASS',measurements={'value':1})

    def end(self,c):
        self.feed(c,event='suite_end',status='PASS',count=len(IDS),passed=len(IDS))

    def test_exact_jdk_build_is_enforced(self):
        self.assertTrue(approved_java('OpenJDK Runtime Environment Temurin-25.0.4.1+1 (build 25.0.4.1+1-LTS)'))
        for text in ['Temurin-25.0.4.1+10 (build)', 'Temurin-25.0.4.1+1.1 (build)', 'OtherVendor-25.0.4.1+1 (build)', 'Temurin-25.0.5+1 (build)']:
            self.assertFalse(approved_java(text),text)

    def test_complete_inventory_passes(self):
        c=self.collector();self.start(c);self.cases(c);self.end(c)
        self.assertEqual(c.finish()['status'],'PASS')

    def test_empty_and_incomplete_do_not_pass(self):
        for count in [0,1]:
            c=self.collector();self.start(c)
            if count:self.feed(c,event='case',id=IDS[0],status='PASS',measurements={'v':1})
            with self.assertRaises(RuntimeError):self.end(c)
            with self.assertRaises(RuntimeError):c.finish()

    def test_foreign_completion_does_not_complete(self):
        c=self.collector();self.start(c);self.cases(c)
        c.feed(PREFIX+json.dumps({'run_id':'old','event':'suite_end','status':'PASS'}))
        with self.assertRaises(RuntimeError):c.finish()
        self.end(c);self.assertEqual(c.finish()['ignored_foreign'],1)

    def test_duplicates_and_runtime_errors_fail(self):
        for failure in ['start','case','end','script']:
            c=self.collector();self.start(c);self.cases(c)
            with self.assertRaises(RuntimeError):
                if failure=='start':self.start(c)
                elif failure=='case':self.feed(c,event='case',id=IDS[0],status='PASS',measurements={'v':1})
                elif failure=='script':c.feed('ERROR:SCRIPT: failure')
                else:self.end(c);self.end(c)

    def test_source_identity_must_match(self):
        c=self.collector()
        with self.assertRaises(RuntimeError):
            self.feed(c,event='suite_start',protocol=1,suite='g1',expected=IDS,source_sha='wrong',config_hash='config')

    def test_failure_cannot_be_completion(self):
        c=self.collector();self.start(c)
        with self.assertRaises(RuntimeError):self.feed(c,event='suite_end',status='FAIL',error='physics')

if __name__=='__main__':unittest.main()
