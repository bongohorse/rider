"""Build the isolated P1 preview with the normal pinned engine/provenance guard."""
import argparse
from pathlib import Path
import subprocess
import sys
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools/g1'))
from build import build
p=argparse.ArgumentParser()
p.add_argument('--output',required=True)
p.add_argument('--configuration',choices=['debug','release'],default='release')
a=p.parse_args()
out=Path(a.output).resolve();out.mkdir(parents=True,exist_ok=True)
sha=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
resources='/main/gym/budget.json,/main/gym/stations,/main/gym/presets,/main/gym/feedback.js,/main/gym/custom.js,/main/gym/mobile.js,/main/gym/tilt.js,/main/terrain_compare/courses,/main/terrain_compare/compare.js'
settings=out/'comparison.settings'
settings.write_text(f'[project]\ndependencies =\ncustom_resources = {resources}\n[bootstrap]\nmain_collection = /main/terrain_compare/boot.collectionc\n[rider]\nterrain_compare = 1\nsource_sha = {sha}\nrun_id = terrain-p1\ngym_test = '+('le1b' if a.configuration=='debug' else '')+'\n')
build('wasm-web',out,settings,variant=a.configuration)
