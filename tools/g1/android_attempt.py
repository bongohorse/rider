"""G1 requires an attempt; a recorded build failure remains a mandatory G2 task."""
import json
from pathlib import Path
import subprocess
from build import build, ROOT

output=ROOT/'artifacts/g1/android'
output.mkdir(parents=True,exist_ok=True)
report={'platform':'arm64-android','source_sha':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),
        'device_tests':'NOT RUN','installability':'NOT VERIFIED'}
try:
    build('arm64-android',output,variant='debug')
    apks=list(output.rglob('*.apk'))
    if not apks:raise RuntimeError('No APK produced')
    report.update(build='PASS',apk_paths=[str(x.relative_to(output)) for x in apks])
except Exception as exc:
    report.update(build='FAIL',error=str(exc),follow_up='G2: resolve prerequisites and produce installable debug APK')
(output/'attempt.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
