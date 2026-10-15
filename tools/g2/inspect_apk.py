"""Android build-tool inspection; never substitutes for installation/device tests."""
import json
import os
from pathlib import Path
import subprocess
import sys

root=Path(sys.argv[1]).resolve()
report={'schema_version':1,'status':'FAIL','installability':'NOT VERIFIED','device_tests':'NOT RUN'}
try:
    apks=list(root.rglob('*.apk'))
    if len(apks)!=1:raise RuntimeError(f'Expected one APK, found {len(apks)}')
    sdk=Path(os.environ.get('ANDROID_HOME') or os.environ.get('ANDROID_SDK_ROOT') or '/missing-android-sdk')
    candidates=[x for x in (sdk/'build-tools').glob('*') if (x/'apksigner').exists() and (x/'aapt2').exists()]
    if not candidates:raise RuntimeError('BLOCKED: Android build-tools apksigner/aapt2 not available')
    tools=max(candidates,key=lambda x:tuple(int(y) for y in x.name.split('.') if y.isdigit()))
    details={}
    for name,args in [('signature',['apksigner','verify','--verbose',str(apks[0])]),('manifest',['aapt2','dump','badging',str(apks[0])])]:
        run=subprocess.run([str(tools/args[0]),*args[1:]],capture_output=True,text=True,timeout=30)
        (root/(name+'.log')).write_text(run.stdout+run.stderr)
        if run.returncode:raise RuntimeError(f'{name} inspection failed: exit {run.returncode}')
        details[name]=run.stdout
    if 'package:' not in details['manifest']:raise RuntimeError('Manifest package missing')
    report.update(status='PASS',apk=str(apks[0].relative_to(root)),build_tools=tools.name,signature='verified',manifest='parsed')
except Exception as exc:
    report.update(status='BLOCKED' if 'BLOCKED:' in str(exc) else 'FAIL',error=str(exc))
(root/'apk-inspection.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
raise SystemExit(0 if report['status']=='PASS' else 2 if report['status']=='BLOCKED' else 1)
