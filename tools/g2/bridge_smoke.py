#!/usr/bin/env python3
"""Owned native debug process: identity, state, input effect, screenshot, release absence."""
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
import uuid

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools'))
sys.path.insert(0,str(ROOT/'tools/g1'))
from setup_bridge import install
from build import build
from run import stop


def wait_value(check,timeout=30):
    deadline=time.monotonic()+timeout
    while time.monotonic()<deadline:
        value=check()
        if value:return value
        time.sleep(0.05)
    raise RuntimeError('Timed out waiting for explicit readiness')


def main():
    output=Path(sys.argv[1]).resolve();output.mkdir(parents=True,exist_ok=True)
    wrapper=install();sys.path.insert(0,str(wrapper))
    shutil.copyfile(ROOT/'.cache/g2/wrapper-provenance.json',output/'wrapper-provenance.json')
    from automation_bridge import engine
    from automation_bridge.client import PYTHON_PACKAGE_VERSION
    candidate=json.loads((ROOT/'tools/bridge-candidate.json').read_text())
    if PYTHON_PACKAGE_VERSION!=candidate['python_package_version']:raise RuntimeError('Wrong installed wrapper')
    source=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
    report={'schema_version':1,'source_sha':source,'status':'FAIL','platform':'x86_64-linux','cases':{}}
    try:
        for variant in ['debug','release']:
            folder=output/variant;folder.mkdir(parents=True,exist_ok=True)
            run_id=str(uuid.uuid4())
            settings=folder/'bridge.settings'
            settings.write_text(f'[bootstrap]\nmain_collection = /main/bridge/main.collectionc\n[input]\ngame_binding = /input/bridge.input_bindingc\n[automation_bridge]\napplication_api = 1\n[rider]\nrun_id = {run_id}\nsource_sha = {source}\nbridge_mode = {variant}\nrelease_evidence = {folder / "release-ready.json"}\n')
            build('x86_64-linux',folder,settings=settings,variant=variant)
            executable=next(folder.rglob('RiderG1.x86_64'))
            log_path=folder/'runtime.log'
            client=None
            evidence=folder/'release-ready.json'
            if evidence.exists():evidence.unlink()
            with log_path.open('w') as log:
                environment=dict(os.environ,DM_SERVICE_PORT='dynamic')
                process=subprocess.Popen([str(executable.resolve())],cwd=executable.parent,stdout=log,stderr=subprocess.STDOUT,
                                         env=environment,start_new_session=True)
                try:
                    def log_text():
                        if process.poll() is not None:raise RuntimeError('Engine exited before completion: '+log_path.read_text(errors='replace')[-2000:])
                        text=log_path.read_text(errors='replace')
                        if 'ERROR:SCRIPT:' in text:raise RuntimeError(text)
                        return text
                    if variant=='debug':
                        text=wait_value(lambda:log_text() if 'RIDER_BRIDGE_READY ' in log_text() else None)
                        port=int(re.search(r'Engine service started on port (\d+)',text)[1])
                        client=engine.connect(port,required_capabilities=('scene','elements','application.state','input.key>=2','input.receipts','screenshot'))
                        health=client.health();metadata=client.trace_metadata()
                        (folder/'health.json').write_text(json.dumps(health,indent=2)+'\n')
                        if health['native_version']!=candidate['native_reported_version'] or str(health['version'])!=candidate['api_version']:
                            raise RuntimeError('Native/API version mismatch')
                        identity=health['identity']
                        if identity.get('process_id')!=process.pid or not identity.get('project_identity') or not identity.get('build_identity'):
                            raise RuntimeError('Bridge is not the owned project process')
                        state=client.state('rider.bridge')
                        if state.value['run_id']!=run_id or state.value['source_sha']!=source or state.value['count']!=0:
                            raise RuntimeError('Foreign or uninitialized state')
                        if state.value['engine_sha']!='a81dbb0478e8b73931dc2d671563204f6ac0ef82':raise RuntimeError('Wrong engine SDK')
                        title=client.element(text='Bridge Smoke')
                        before=client.screenshot(after_frames=1,resolution_multiplier=0.5)
                        shutil.copyfile(before.path,folder/'before.png')
                        receipt=client.key('SPACE',wait='released',timeout=10)
                        after_state=client.wait_for_state('rider.bridge.count',1,after_revision=state.revision,timeout=10)
                        if receipt.state!='released' or after_state.value!=1:raise RuntimeError('Input did not affect application state')
                        after=client.screenshot(after_frames=1,resolution_multiplier=0.5)
                        shutil.copyfile(after.path,folder/'after.png')
                        if (folder/'after.png').read_bytes()==(folder/'before.png').read_bytes():raise RuntimeError('Screenshot did not reflect input change')
                        report['cases']['debug']={'status':'PASS','run_id':run_id,'metadata':metadata,'health':health,
                            'input':dict(receipt),'count_before':0,'count_after':1,'title_element':title.raw,
                            'screenshot_sha256':hashlib.sha256((folder/'after.png').read_bytes()).hexdigest()}
                    else:
                        evidence=folder/'release-ready.json'
                        def release_ready():
                            log_text()  # The process must still be running.
                            return json.loads(evidence.read_text()) if evidence.exists() else None
                        data=wait_value(release_ready)
                        text=log_text()
                        if data['run_id']!=run_id or not data['module_absent'] or not data['ready']:raise RuntimeError('Release readiness/module assertion failed')
                        ports=re.findall(r'Engine service started on port (\d+)',text)
                        # Release commonly compiles out the entire service. Prove
                        # the live process owns no listening socket via /proc,
                        # or query its actual advertised port and require 404.
                        if ports:
                            url=f'http://127.0.0.1:{ports[-1]}/automation-bridge/v2/health'
                            try:
                                with urllib.request.urlopen(url,timeout=3) as response:raise RuntimeError('Debug route leaked into release: '+str(response.status))
                            except urllib.error.HTTPError as exc:
                                if exc.code!=404:raise
                            route='404 from running release engine service'
                        else:
                            fd_inodes=[]
                            for fd in Path(f'/proc/{process.pid}/fd').iterdir():
                                try:target=fd.readlink().as_posix()
                                except FileNotFoundError:continue
                                if target.startswith('socket:['):fd_inodes.append(target[8:-1])
                            listeners=[]
                            for table in ['tcp','tcp6']:
                                for row in Path(f'/proc/{process.pid}/net/{table}').read_text().splitlines()[1:]:
                                    fields=row.split()
                                    if fields[3]=='0A' and fields[9] in fd_inodes:listeners.append(row)
                            if listeners:raise RuntimeError('Release unexpectedly owns TCP listeners: '+str(listeners))
                            route='running release process owns no TCP listening sockets'
                        report['cases']['release']={'status':'PASS','run_id':run_id,'module_absent':True,'ready':True,'route_absence':route,'pid':process.pid}
                finally:
                    if client:client.close()
                    stop(process)
            if 'ERROR:SCRIPT:' in log_path.read_text(errors='replace'):raise RuntimeError('Script runtime error')
        if set(report['cases'])!={'debug','release'}:raise RuntimeError('Missing mandatory cases')
        report['status']='PASS'
    except Exception as exc:
        report['error']=str(exc)
    (output/'bridge-results.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report))
    return 0 if report['status']=='PASS' else 1

if __name__=='__main__':raise SystemExit(main())
