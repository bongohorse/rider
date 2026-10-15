#!/usr/bin/env python3
"""Inject an actual Lua build error in an isolated copy, then restore and rebuild."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools/g1'))
import build as builder


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--platform',default='x86_64-linux')
    parser.add_argument('--output',required=True)
    args=parser.parse_args()
    output=Path(args.output).resolve();output.mkdir(parents=True,exist_ok=True)
    before=subprocess.check_output(['git','status','--porcelain'],cwd=ROOT)
    source=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
    bob=builder.bob_jar()
    report={'schema_version':1,'source_sha':source,'status':'FAIL'}
    try:
        with tempfile.TemporaryDirectory(prefix='rider-negative-') as temporary:
            fixture=Path(temporary)/'project'
            shutil.copytree(ROOT,fixture,ignore=shutil.ignore_patterns('.git','.cache','node_modules','build','artifacts','__pycache__'))
            cached=fixture/'.cache/g1/bob.jar';cached.parent.mkdir(parents=True)
            shutil.copyfile(bob,cached)
            builder.ROOT=fixture
            script=fixture/'main/gym/controller.script';original=script.read_bytes()
            script.write_bytes(original+b'\nfunction = invalid_g2_probe\n')
            try:
                builder.build(args.platform,output/'intentional-failure')
            except RuntimeError as exc:
                log=output/'intentional-failure/build.log'
                text=log.read_text(errors='replace') if log.exists() else ''
                if 'Bob build failed:' not in str(exc) or 'main/gym/controller.script' not in text or not re.search('unexpected|expect|syntax',text,re.I):
                    raise RuntimeError('Failure was not the intended Lua build error') from exc
                report['intentional_build_error']='PASS (correctly rejected)'
            else:
                raise RuntimeError('Intentional Lua build error was accepted')
            script.write_bytes(original)
            if script.read_bytes()!=original:raise RuntimeError('Fixture restoration mismatch')
            builder.build(args.platform,output/'restored')
            report.update(status='PASS',restored_build='PASS',restored_script_sha256=hashlib.sha256(original).hexdigest())
    except Exception as exc:
        report['error']=str(exc)
        if 'BLOCKED:' in str(exc):report['status']='BLOCKED'
    finally:
        builder.ROOT=ROOT
        after=subprocess.check_output(['git','status','--porcelain'],cwd=ROOT)
        if before!=after:report.update(status='FAIL',error='Original working tree changed during isolated probe')
        report['original_working_tree_unchanged']=before==after
        (output/'negative-build.json').write_text(json.dumps(report,indent=2)+'\n')
        print(json.dumps(report))
    return 0 if report['status']=='PASS' else 2 if report['status']=='BLOCKED' else 1

if __name__=='__main__':raise SystemExit(main())
