#!/usr/bin/env python3
"""Provision the pinned archive and install the complete matching upstream wrapper."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import urllib.request
import zipfile

ROOT=Path(__file__).resolve().parents[1]



def inspect_installation():
    """Read-only source verification; never launches, downloads or updates."""
    lock=json.loads((ROOT/'tools/bridge-candidate.json').read_text())
    archive=ROOT/'.cache/g2/bridge.zip'
    with archive.open('rb') as source:
        if hashlib.file_digest(source,'sha256').hexdigest()!=lock['sha256']:
            raise RuntimeError('Bridge archive SHA-256 mismatch')
    marker='/automation_bridge/automation-bridge-python/'
    checked=0
    with zipfile.ZipFile(archive) as z:
        for item in z.infolist():
            if marker not in item.filename or item.is_dir():continue
            relative=item.filename.split(marker,1)[1]
            if (ROOT/'automation-bridge-python'/relative).read_bytes()!=z.read(item):
                raise RuntimeError('Wrapper source mismatch: '+relative)
            checked+=1
    if checked==0:raise RuntimeError('No matching wrapper files')
    return {'source_commit':lock['commit'],'verified_files':checked,'python_package_version':lock['python_package_version']}


def install():
    lock=json.loads((ROOT/'tools/bridge-candidate.json').read_text())
    archive=ROOT/'.cache/g2/bridge.zip';archive.parent.mkdir(parents=True,exist_ok=True)
    if not archive.exists():
        request=urllib.request.Request(lock['url'],headers={'User-Agent':'Rider-G2'})
        with urllib.request.urlopen(request,timeout=60) as response,archive.open('wb') as output:
            shutil.copyfileobj(response,output)
    with archive.open('rb') as source:
        if hashlib.file_digest(source,'sha256').hexdigest()!=lock['sha256']:
            raise RuntimeError('Bridge archive SHA-256 mismatch')
    if lock['url'] not in (ROOT/'game.project').read_text():
        raise RuntimeError('Project dependency does not match the pinned Bridge source')
    # This is the upstream installer's supported plain archive cache filename.
    # Bob still performs resolve during builds; no editor or Latest lookup is used.
    cached=ROOT/'.internal/lib'/(hashlib.sha1(lock['url'].encode()).hexdigest()+'.zip')
    cached.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(archive,cached)
    extracted=ROOT/'.cache/g2/upstream';extracted.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(archive) as z:
        for item in z.infolist():
            path=Path(item.filename)
            if path.is_absolute() or '..' in path.parts:raise RuntimeError('Unsafe archive path')
        z.extractall(extracted)
        installer=next(extracted.glob('*/automation_bridge/automation-bridge-python/install.py'))
        subprocess.run([sys.executable,str(installer),str(ROOT)],check=True,timeout=60)
        marker='/automation_bridge/automation-bridge-python/'
        checked=0
        for item in z.infolist():
            if marker not in item.filename or item.is_dir():continue
            relative=item.filename.split(marker,1)[1]
            if (ROOT/'automation-bridge-python'/relative).read_bytes()!=z.read(item):
                raise RuntimeError('Installed wrapper differs from the pinned archive: '+relative)
            checked+=1
    if checked==0:raise RuntimeError('No matching wrapper files installed')
    report={'release':lock['release'],'source_commit':lock['commit'],'archive_sha256':lock['sha256'],'verified_wrapper_files':checked,
            'python_package_version':lock['python_package_version'],'license_evidence':lock['license_evidence']}
    (ROOT/'.cache/g2/wrapper-provenance.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report))
    return ROOT/'automation-bridge-python'

if __name__=='__main__':install()
