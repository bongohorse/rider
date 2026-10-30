"""Original Rider fuel-canister SVG and supersampled transparent PNG, no runtime dependency."""
from pathlib import Path
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parents[2]/'main/gym/assets'
SHAPES=[([(11,2),(31,2),(39,10),(41,45),(37,49),(7,49),(3,45),(5,12)],'#243a39'),
 ([(12,4),(29,4),(29,11),(10,11)],'#b3caba'), ([(29,4),(36,10),(31,12)],'#f6ce68'),
 ([(7,14),(33,14),(38,20),(38,44),(8,44),(6,40)],'#ed613d'),
 ([(8,16),(30,16),(34,20),(10,20)],'#ffb879'), ([(33,21),(38,20),(38,44),(33,44)],'#ab3b32'),
 ([(12,24),(30,24),(30,38),(12,38)],'#ffe7ae'),
 ([(23,23),(16,32),(21,32),(19,39),(27,29),(22,29)],'#bf492b'),
 ([(5,8),(12,8),(12,13),(5,13)],'#ced6b2')]
def generate():
 im=Image.new('RGBA',(600,600));draw=ImageDraw.Draw(im)
 svg=['<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 50 50">','<title>Rider fuel canister; original art</title>']
 for points,fill in SHAPES:
  draw.polygon([(x*12,y*12) for x,y in points],fill=fill);svg.append(f'<polygon points="{" ".join(f"{x},{y}" for x,y in points)}" fill="{fill}"/>')
 svg.append('</svg>');(ROOT/'fuel-canister.svg').write_text('\n'.join(svg)+'\n');im.resize((150,150),Image.Resampling.LANCZOS).save(ROOT/'fuel-canister.png')
if __name__=='__main__':generate()
