#!/usr/bin/env python3
"""Shared project build/verify CLI. This is tooling evidence, not whole-gate approval."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
import uuid
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools/g1'))
from build import build
from protocol import IDS
from run import stop


def execute(test_id,command,output,timeout,require_tests=False):
    log=output/(test_id+'.log')
    start=time.monotonic()
    status,detail='PASS',''
    try:
        with log.open('w',encoding='utf-8') as stream:
            process=subprocess.Popen(command,cwd=ROOT,stdout=stream,stderr=subprocess.STDOUT,start_new_session=os.name!='nt')
            try:
                code=process.wait(timeout=timeout)
            except subprocess.TimeoutExpired:
                status,detail='FAIL',f'Timeout after {timeout}s; process tree terminated'
                code=None
            finally:
                stop(process)
        text=log.read_text(encoding='utf-8',errors='replace')
        if code not in (0,None):
            status='BLOCKED' if 'BLOCKED:' in text else 'FAIL'
            detail=f'Process exit {code}; see {log.name}'
        if code==0 and require_tests:
            found=re.search(r'Ran (\d+) tests?\b',text)
            if not found or int(found[1])==0:
                status,detail='FAIL','No actual unit tests executed'
    except (OSError,subprocess.SubprocessError) as exc:
        status,detail='BLOCKED',str(exc)
    return {'id':test_id,'status':status,'duration_ms':round((time.monotonic()-start)*1000),
            'assertions':1,'detail':detail,'artifacts':[log.name]}


def write_report(output,suite,tests,expected,source_sha,duration_ms=None):
    ids=[test['id'] for test in tests]
    if len(ids)!=len(set(ids)) or set(ids)!=set(expected) or not expected:
        raise RuntimeError('Missing, duplicate or zero test inventory')
    if any(x['status'] not in ('PASS','FAIL','BLOCKED') for x in tests):
        raise RuntimeError('Invalid result status')
    status='FAIL' if any(x['status']=='FAIL' for x in tests) else 'BLOCKED' if any(x['status']=='BLOCKED' for x in tests) else 'PASS'
    elapsed=duration_ms if duration_ms is not None else sum(x['duration_ms'] or 0 for x in tests)
    report={'schema_version':1,'gate':'G2','suite':suite,'commit_sha':source_sha,
            'status':status,'whole_gate_approval':False,'duration_ms':elapsed,'tests':tests}
    (output/'results.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    xml=ET.Element('testsuite',name=suite,tests=str(len(tests)),failures=str(sum(x['status']=='FAIL' for x in tests)),
                   errors=str(sum(x['status']=='BLOCKED' for x in tests)),time=str(elapsed/1000))
    for test in tests:
        case=ET.SubElement(xml,'testcase',classname=suite,name=test['id'])
        if test['duration_ms'] is not None:case.set('time',str(test['duration_ms']/1000))
        if test['status']!='PASS':
            failure=ET.SubElement(case,'error' if test['status']=='BLOCKED' else 'failure',type=test['status'],message=test.get('detail',''))
            failure.text=test.get('detail','')
    ET.ElementTree(xml).write(output/'junit.xml',encoding='utf-8',xml_declaration=True)
    print(json.dumps({'status':status,'suite':suite,'output':str(output)}))
    return 0 if status=='PASS' else 2 if status=='BLOCKED' else 1


def platform_for(target):
    return {'html5':'wasm-web','android':'arm64-android','desktop':'x86_64-win32' if os.name=='nt' else 'x86_64-linux'}[target]


def main(argv=None):
    parser=argparse.ArgumentParser()
    subs=parser.add_subparsers(dest='command',required=True)
    verify=subs.add_parser('verify')
    verify.add_argument('--suite',choices=['bootstrap','physics','bridge'],default='physics')
    verify.add_argument('--target',choices=['desktop','html5'],default='desktop')
    verify.add_argument('--output')
    verify.add_argument('--configuration',choices=['debug','headless'])
    bundle=subs.add_parser('build')
    bundle.add_argument('--target',choices=['desktop','html5','android'],required=True)
    bundle.add_argument('--configuration',choices=['debug','release'],default='debug')
    bundle.add_argument('--output')
    bundle.add_argument('--fixture',choices=['gym','physics','bridge'],default='gym')
    args=parser.parse_args(argv)
    output=Path(args.output or ROOT/'artifacts/g2'/str(uuid.uuid4())).resolve()
    output.mkdir(parents=True,exist_ok=True)
    sha=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
    if args.command=='build':
        start=time.monotonic()
        try:
            if args.fixture=='bridge' and args.target=='html5':raise RuntimeError('BLOCKED: native Bridge fixture is not an HTML5 target')
            fixture_settings='[bootstrap]\nmain_collection = /main/bridge/main.collectionc\n[input]\ngame_binding = /input/bridge.input_bindingc\n[automation_bridge]\napplication_api = 1\n' if args.fixture=='bridge' else '[bootstrap]\nmain_collection = /main/main.collectionc\n' if args.fixture=='physics' else ''
            override_settings=('[project]\ndependencies =\n' if args.target=='html5' else '') + fixture_settings
            config_hash=hashlib.sha256((ROOT/'game.project').read_bytes()+(ROOT/'main/physics.appmanifest').read_bytes()+override_settings.encode()+args.configuration.encode()).hexdigest()
            settings=output/'build.settings'
            settings.write_text(override_settings + f'[rider]\nrun_id = {uuid.uuid4()}\nsource_sha = {sha}\nconfig_hash = {config_hash}\nbridge_mode = {args.configuration}\nrelease_evidence = {output / "release-ready.json"}\n')
            build(platform_for(args.target),output,settings=settings,variant=args.configuration)
            test={'id':'bundle','status':'PASS','detail':'Build only; no runtime or install claim'}
        except Exception as exc:
            test={'id':'bundle','status':'BLOCKED' if 'BLOCKED:' in str(exc) else 'FAIL','detail':str(exc)}
        test.update(duration_ms=round((time.monotonic()-start)*1000),assertions=1,artifacts=['build.log'] if (output/'build.log').exists() else [])
        return write_report(output,'build-'+args.target,[test],['bundle'],sha)
    if args.suite=='bootstrap':
        commands=[('project_contract',[sys.executable,'tools/bootstrap_check.py'],False),
                  ('bootstrap_tests',[sys.executable,'-m','unittest','discover','-s','tests/bootstrap','-v'],True),
                  ('protocol_tests',[sys.executable,'-m','unittest','discover','-s','tests/g1','-v'],True)]
        tests=[execute(name,cmd,output,60,unit) for name,cmd,unit in commands]
        return write_report(output,'bootstrap',tests,[x[0] for x in commands],sha)
    if args.suite=='bridge':
        expected=['debug','release']
        if args.target!='desktop' or args.configuration=='headless' or not sys.platform.startswith('linux'):
            tests=[{'id':key,'status':'BLOCKED','duration_ms':None,'assertions':1,
                    'detail':'Bridge capability smoke currently requires Linux graphics (Xvfb/Mesa)', 'artifacts':[]} for key in expected]
            return write_report(output,'bridge',tests,expected,sha)
        test=execute('bridge',[sys.executable,'tools/g2/bridge_smoke.py',str(output/'bridge')],output,2100)
        tests=[]
        if test['status']=='PASS':
            try:
                report_path=output/'bridge/bridge-results.json'
                report=json.loads(report_path.read_text())
                if report['status']!='PASS' or report['source_sha']!=sha or set(report['cases'])!=set(expected):
                    raise RuntimeError('Invalid Bridge report identity/inventory')
                for key in expected:
                    if report['cases'][key].get('status')!='PASS':raise RuntimeError('Incomplete Bridge case')
                    tests.append({'id':key,'status':'PASS','duration_ms':None,'assertions':1,
                                  'measurements':report['cases'][key],'artifacts':[str(report_path.relative_to(output))]})
            except (OSError,ValueError,KeyError,RuntimeError) as exc:
                test.update(status='FAIL',detail=str(exc))
        if test['status']!='PASS':tests=[dict(test,id=key,duration_ms=None) for key in expected]
        return write_report(output,'bridge',tests,expected,sha,duration_ms=test['duration_ms'])
    test=execute('physics',[sys.executable,'tools/g1/run.py','--platform',platform_for(args.target),
                           '--output',str(output/'physics'),'--variant',args.configuration or ('debug' if args.target=='html5' else 'headless')],output,2100)
    tests=[]
    expected=[f'{config}.{key}' for config in ['scale-0.01-fps-60','scale-0.02-fps-30'] for key in IDS]
    # HTML5 players runs (#215) are additive: same cases on the wasm-web engine Pages serves.
    players=[f'{config}/wasm-web' for config in ['scale-0.01-fps-60','scale-0.02-fps-30']] if args.target=='html5' else []
    expected+=[f'{config.replace("/",".")}.{key}' for config in players for key in IDS]
    if test['status']=='PASS':
        try:
            comparison=json.loads((output/'physics/comparison.json').read_text())
            if comparison['status']!='PASS' or comparison['source_sha']!=sha:raise RuntimeError('Invalid comparison')
            for config in ['scale-0.01-fps-60','scale-0.02-fps-30']+players:
                report_path=output/'physics'/config/'result.json'
                report=json.loads(report_path.read_text())
                if report['status']!='PASS' or report['source_sha']!=sha or set(report['cases'])!=set(IDS):raise RuntimeError('Invalid physics inventory/identity')
                if config in players and (report.get('engine_load',{}).get('wasm')!=['RiderG1.wasm'] or report['engine_load'].get('cross_origin_isolated') is not False):
                    raise RuntimeError(f'Players run {config} did not load the wasm-web engine')
                for key in IDS:
                    if not isinstance(report['cases'][key],dict) or not report['cases'][key]:raise RuntimeError('Invalid physics measurements')
                    tests.append({'id':f'{config.replace("/",".")}.{key}','status':'PASS','duration_ms':None,'assertions':1,
                                  'measurements':report['cases'][key],'artifacts':[str(report_path.relative_to(output))]})
        except (OSError,ValueError,KeyError,RuntimeError) as exc:
            test.update(status='FAIL',detail=str(exc))
    if test['status']!='PASS':
        # Missing cases are explicit failures, never omitted from the report.
        tests=[dict(test,id=key,duration_ms=None) for key in expected]
    return write_report(output,'physics',tests,expected,sha,duration_ms=test['duration_ms'])


if __name__=='__main__':
    raise SystemExit(main())
