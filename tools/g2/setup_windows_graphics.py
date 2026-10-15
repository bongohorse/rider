"""Provision verified per-process Mesa software OpenGL, without system changes."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import urllib.request

ROOT=Path(__file__).resolve().parents[2]
lock=json.loads((ROOT/'tools/ci-graphics-lock.json').read_text())
cache=ROOT/'.cache/ci-graphics';cache.mkdir(parents=True,exist_ok=True)
archive=cache/'mesa.7z'
if not archive.exists():
    with urllib.request.urlopen(lock['url'],timeout=120) as source,archive.open('wb') as output:
        shutil.copyfileobj(source,output)
with archive.open('rb') as source:
    if hashlib.file_digest(source,'sha256').hexdigest()!=lock['sha256']:raise RuntimeError('Mesa archive SHA-256 mismatch')
extractor=shutil.which('7z') or r'C:\Program Files\7-Zip\7z.exe'
subprocess.run([extractor,'x','-y',str(archive),'-o'+str(cache/'package')],check=True,timeout=120)
candidates=[x.parent for x in (cache/'package').rglob('opengl32.dll') if 'x64' in x.parts]
if len(candidates)!=1:raise RuntimeError(f'Expected x64 software OpenGL, found {candidates}')
with Path(os.environ['GITHUB_ENV']).open('a') as env:
    env.write('RIDER_MESA_DIR='+str(candidates[0])+'\n')
print(json.dumps(dict(lock,directory=str(candidates[0]))))
