"""Explicit opt-in comparison bundle; ordinary builds never select this renderer."""
import argparse, hashlib, json, subprocess, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools/gym'))
from bundle import inventory
sys.path.insert(0,str(ROOT/'tools/g1'))
from build import build
p=argparse.ArgumentParser();p.add_argument('--output',type=Path,required=True);p.add_argument('--release',action='store_true');a=p.parse_args()
out=a.output.resolve();out.mkdir(parents=True,exist_ok=True)
if any(out.iterdir()):raise SystemExit('Comparison output must be empty')
sha=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
settings=out/'comparison.settings';settings.write_text('[project]\ndependencies =\n[rider]\nterrain_perspective = 1\nsource_sha = '+sha+'\nrun_id = terrain-perspective\ngym_test =\n')
variant='release' if a.release else 'debug'
build('wasm-web',out,settings,variant=variant)
(out/'bundle.json').write_text(json.dumps({'source_sha':sha,'platform':'wasm-web','variant':variant,'comparison':290,'files':inventory(out)},indent=2)+'\n')
