"""Original geometric gym placeholder; head geometry matches rider.lua."""
from pathlib import Path
from PIL import Image, ImageDraw
root=Path(__file__).resolve().parents[2]
im=Image.new('RGBA',(40,64))
d=ImageDraw.Draw(im)
d.rounded_rectangle((11,25,29,55),radius=5,fill='#65aaba')
d.line((15,52,31,61),fill='#27434b',width=7)
d.line((26,30,36,43),fill='#e5be9b',width=5)
d.ellipse((8,0,31,23),fill='#e5be9b',outline='#ebf4ed',width=2)
d.rectangle((10,6,30,12),fill='#527b8d')
im.save(root/'main/gym/assets/rider.png')
