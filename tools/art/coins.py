"""Original Rider pickup art. SVG sources and supersampled transparent PNGs; Pillow only."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2] / 'main/gym/assets'

def generate(name, gem=False):
    shapes=[]
    def polygon(points, fill): shapes.append(('polygon', points, fill))
    def ellipse(box, fill): shapes.append(('ellipse', box, fill))
    if gem:
        polygon([(24,1),(43,12),(47,26),(25,49),(3,26),(7,12)], '#39166a')
        polygon([(24,3),(41,13),(45,25),(25,46),(5,25),(9,13)], '#9d3fea')
        polygon([(24,3),(41,13),(33,18),(16,18),(9,13)], '#eeadff')
        polygon([(9,13),(16,18),(13,29),(5,25)], '#ba6bff')
        polygon([(41,13),(45,25),(35,29),(33,18)], '#7134c4')
        polygon([(16,18),(33,18),(35,29),(25,41),(13,29)], '#c956f2')
        polygon([(16,18),(33,18),(25,24),(13,29)], '#e98dff')
        polygon([(13,29),(25,24),(25,41)], '#a532e3')
        polygon([(35,29),(25,41),(25,24)], '#7d28bd')
        polygon([(5,25),(13,29),(25,46)], '#7f3bc6')
        polygon([(45,25),(25,46),(35,29)], '#522299')
        polygon([(14,9),(16,13),(21,15),(16,17),(14,22),(12,17),(8,15),(12,13)], '#fff4ff')
    else:
        ellipse((3,2,47,49),'#743b13')
        ellipse((3,1,47,46),'#e48a12')
        ellipse((5,2,45,43),'#fff09a')
        ellipse((7,5,43,42),'#ffca36')
        ellipse((10,8,40,39),'#d98a13')
        ellipse((11,9,39,37),'#ffdf58')
        polygon([(25,12),(34,23),(30,23),(30,33),(20,33),(20,23),(16,23)],'#b86b16')
        polygon([(25,11),(32,21),(28,21),(28,30),(22,30),(22,21),(18,21)],'#fff3ad')
        polygon([(13,5),(15,10),(20,12),(15,14),(13,19),(11,14),(6,12),(11,10)],'#fffbe5')
    image=Image.new('RGBA',(600,600));draw=ImageDraw.Draw(image)
    svg=['<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 50 50">',f'<title>Rider {"Wonder Gem" if gem else "gold coin"}; original faceted pickup</title>']
    for kind,coords,fill in shapes:
        if kind=='polygon':
            draw.polygon([(round(x*12),round(y*12)) for x,y in coords],fill=fill)
            svg.append(f'<polygon points="{" ".join(f"{x},{y}" for x,y in coords)}" fill="{fill}"/>')
        else:
            draw.ellipse(tuple(round(v*12) for v in coords),fill=fill)
            x,y,x2,y2=coords;svg.append(f'<ellipse cx="{(x+x2)/2}" cy="{(y+y2)/2}" rx="{(x2-x)/2}" ry="{(y2-y)/2}" fill="{fill}"/>')
    svg.append('</svg>')
    (ROOT/f'{name}.svg').write_text('\n'.join(svg)+'\n')
    image.resize((150,150),Image.Resampling.LANCZOS).save(ROOT/f'{name}.png')

if __name__=='__main__':
    generate('coin')
    generate('wonder-gem',True)
