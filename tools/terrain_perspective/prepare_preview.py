"""Artifact-only author comparison UI; no production/source persistence changes."""
import argparse,json,shutil
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('bundle',type=Path);p.add_argument('--output',type=Path);a=p.parse_args()
root=Path(__file__).resolve().parents[2];web=a.output or next(a.bundle.rglob('index.html')).parent
web.mkdir(parents=True,exist_ok=True)
(web/'courses').mkdir(exist_ok=True)
for n in ['six-anchor','long-curves','mixed']:
 shutil.copyfile(root/'docs/terrain-p0'/(n+'.json'),web/'courses'/(n+'.json'))
for n in ['long-over-budget','mixed-over-budget']:
 shutil.copyfile(root/'docs/terrain-p5'/(n+'.json'),web/'courses'/(n+'.json'))
shutil.copyfile(Path(__file__).with_name('comparison.html'),web/'perspective.html')
print(web/'perspective.html')
