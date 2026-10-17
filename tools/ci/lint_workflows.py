#!/usr/bin/env python3
"""Run the hash-verified actionlint binary on Linux x86_64 CI runners."""
import hashlib
import io
import json
from pathlib import Path
import subprocess
import tarfile
import urllib.request

ROOT = Path(__file__).resolve().parents[2]


def main():
    lock = json.loads(Path(__file__).with_name('actionlint-lock.json').read_text())
    request = urllib.request.Request(lock['url'], headers={'User-Agent': 'Rider-CI'})
    with urllib.request.urlopen(request, timeout=60) as response:
        archive = response.read()
    if hashlib.sha256(archive).hexdigest() != lock['sha256']:
        raise RuntimeError('actionlint archive SHA-256 mismatch')
    target = ROOT / '.cache/ci/actionlint'
    target.parent.mkdir(parents=True, exist_ok=True)
    with tarfile.open(fileobj=io.BytesIO(archive), mode='r:gz') as bundle:
        member = bundle.getmember('actionlint')
        if not member.isfile():
            raise RuntimeError('actionlint must be a regular archive member')
        target.write_bytes(bundle.extractfile(member).read())
    target.chmod(0o755)
    # Keep optional shellcheck/pyflakes installations from changing the lint contract.
    return subprocess.run([str(target), '-shellcheck=', '-pyflakes='], cwd=ROOT).returncode


if __name__ == '__main__':
    raise SystemExit(main())
