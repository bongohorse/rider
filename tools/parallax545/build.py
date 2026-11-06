"""Build #545's isolated debug fixture with the pinned engine and provenance guards."""
import argparse
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/g1'))
from build import build
sys.path.insert(0, str(ROOT / 'tools/gym'))
from bundle import source_fingerprint, inventory

p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--output', required=True, type=Path)
a = p.parse_args()
out = a.output.resolve()
out.mkdir(parents=True, exist_ok=False)
sha = subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True, cwd=ROOT).strip()
fingerprint = source_fingerprint()
settings = out / 'experiment.settings'
settings.write_text(f'[project]\ndependencies =\n[bootstrap]\nmain_collection = /main/parallax545/boot.collectionc\n[rider]\nsource_sha = {sha}\nrun_id = parallax545\ngym_test =\n')
build('wasm-web', out, settings, variant='debug')
assert source_fingerprint() == fingerprint, 'Sources changed during build'
(out / 'bundle.json').write_text(json.dumps(dict(source_sha=sha, source_fingerprint=fingerprint,
    platform='wasm-web', variant='debug', files=inventory(out)), indent=2) + '\n')
