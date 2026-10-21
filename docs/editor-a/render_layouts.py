#!/usr/bin/env python3
"""Generate the A1a vector mockups; no game assets or runtime code are used."""
from pathlib import Path
from html import escape
import math

OUT = Path(__file__).resolve().parent
BG, PANEL, FIELD, LINE = '#101e26', '#192c36', '#223b47', '#35515f'
TEXT, MUTED, ACCENT, SELECT, LINK = '#edf4f6', '#b0c3cc', '#8de0c5', '#ffc66d', '#72dbe9'


def render(w, h, selected):
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">',
           '<title>Rider Editor A — '+('Selected Ramp' if selected else 'Build / place Ramp')+'</title>',
           '<desc>Static proposal for issue 183; not a game screenshot.</desc>',
           '<style>text{font-family:"DejaVu Sans",sans-serif;font-size:14px;fill:'+TEXT+'} .small{font-size:12px} .title{font-size:18px;font-weight:bold}</style>']
    def rect(x,y,rw,rh,fill=PANEL,stroke=None,r=4):
        out.append(f'<rect x="{x}" y="{y}" width="{rw}" height="{rh}" rx="{r}" fill="{fill}"'+(f' stroke="{stroke}"' if stroke else '')+'/>')
    def text(x,y,s,c=TEXT,cl='',anchor='start'):
        out.append(f'<text x="{x}" y="{y}" fill="{c}" style="fill:{c}" class="{cl}" text-anchor="{anchor}">{escape(str(s))}</text>')
    def path(d,c=TEXT,width=2,dash=False):
        out.append(f'<path d="{d}" fill="none" stroke="{c}" stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round"'+(' stroke-dasharray="7 6"' if dash else '')+'/>')
    def button(x,y,bw,label,active=False):
        rect(x,y,bw,32,ACCENT if active else FIELD)
        text(x+bw/2,y+21,label,BG if active else TEXT,anchor='middle')
    def dot(x,y,c=LINK):
        out.append(f'<circle cx="{x}" cy="{y}" r="6" fill="{BG}" stroke="{c}" stroke-width="2"/>')
    rect(0,0,w,h,BG,r=0)
    # Fixed size shell at both viewports.
    rect(0,0,w,64,PANEL,r=0); text(20,29,'RIDER',ACCENT,'title'); text(100,29,'/  Level editor',MUTED)
    text(20,51,'STATIC LAYOUT PROPOSAL  ·  #183',MUTED,'small')
    text(258,28,'Hillside practice',TEXT,'title');text(258,50,'Draft saved locally',ACCENT,'small')
    button(w-316,16,92,'Undo');button(w-216,16,76,'Redo');button(w-132,16,112,'Play [E]',True)
    for x,bw,label in [(16,60,'New'),(84,68,'Open'),(160,76,'Import'),(244,76,'Export')]: button(x,76,bw,label)
    text(340,97,'Edit mode',ACCENT)
    button(w-284,76,160,'✓  No problems');button(w-116,76,100,'Help [H]')
    # Left palette.
    left, top, bottom, pw = 184, 124, h-80, 280
    rx=w-16-pw; cx=left+32; cw=rx-16-cx
    rect(16,top,left,bottom-top);text(28,150,'TOOLS',MUTED,'small');text(182,150,'‹',MUTED)
    tools=[('Select','S'),('Draw','D'),('Curve','C'),('Prefab','P'),('START',''),('FINISH',''),('Label','L'),('Pan','')]
    for i,(name,key) in enumerate(tools):
        x=28+(i%2)*80; y=164+(i//2)*42
        a=(name=='Select' if selected else name=='Prefab')
        rect(x,y,76,36,ACCENT if a else FIELD)
        text(x+38,y+23,name, BG if a else TEXT,anchor='middle')
        if key: text(x+68,y+10,key,BG if a else MUTED,'small',anchor='end')
    text(28,356,'PREFABS',MUTED,'small');text(182,356,'⌄',MUTED)
    names=['Flat','Ramp','Step','Gap','Kicker','Platform','Wave']
    shapes=['M 0 12 H 42','M 0 20 L 42 0','M 0 20 H 20 V 0 H 42','M 0 0 H 10 M 30 0 H 42','M 0 20 L 16 0 M 28 10 H 42','M 0 20 V 0 H 42 V 20 Z','M 0 12 C 8 -4 13 -4 21 12 S 34 28 42 12']
    for i,(name,d) in enumerate(zip(names,shapes)):
        x=28+i%2*80;y=368+i//2*56
        rect(x,y,76,52,FIELD,SELECT if name=='Ramp' else None)
        out.append(f'<g transform="translate({x+17} {y+6}) scale(.85)">');path(d,SELECT if name=='Ramp' else MUTED);out.append('</g>')
        text(x+38,y+43,name,SELECT if name=='Ramp' else TEXT,'small',anchor='middle')
    # Canvas, clipped independently of the panels.
    out.append(f'<defs><clipPath id="canvas"><rect x="{cx}" y="{top}" width="{cw}" height="{bottom-top}"/></clipPath></defs><g clip-path="url(#canvas)">')
    for gx in range(cx,rx-12,32): path(f'M {gx} {top} V {bottom}', '#1e333e',1)
    for gy in range(top,bottom,32): path(f'M {cx} {gy} H {rx-16}', '#1e333e',1)
    x0=cx+max(144,(cw-256)/2-40); y0=top+(bottom-top)*.65
    x1=x0+256; y1=y0-256*math.tan(math.radians(20))
    path(f'M {cx} {y0} H {x0}',MUTED,3)
    if selected: path(f'M {x1} {y1} H {rx+50}',MUTED,3)
    path(f'M {x0} {y0} L {x1} {y1}',SELECT if selected else ACCENT,4,not selected)
    if selected:
        path(f'M {x0} {y0+30} H {x1}',MUTED,1)
        path(f'M {x0} {y0+24} V {y0+36} M {x1} {y0+24} V {y0+36}',MUTED,1)
        text((x0+x1)/2,y0+52,'8.00 m horizontal',MUTED,'small',anchor='middle')
        for px,py in [(x0,y0),(x1,y1)]: dot(px,py);rect(px-3,py-3,6,6,LINK,r=0)
        rect((x0+x1)/2-5,(y0+y1)/2-5,10,10,SELECT,r=0)
        rect(x0+54,y1-60,184,36,FIELD);text(x0+66,y1-37,'Ramp  ·  20.0 deg',SELECT)
        text(x0-12,y0-18,'Connected',LINK,'small',anchor='end')
        text(x1+12,y1-18,'Connected',LINK,'small')
    else:
        dot(x0,y0);dot(x1,y1,ACCENT)
        rect(x0+28,y1-66,226,52,FIELD)
        text(x0+40,y1-45,'Ramp preview',ACCENT)
        text(x0+40,y1-25,'Click to place · Esc to cancel',MUTED,'small')
        path(f'M {x1+8} {y1+5} l 0 23 6 -7 7 0 Z',TEXT,1)
    # A deliberately schematic vehicle, not imported artwork.
    sx=cx+76
    path(f'M {sx-24} {y0-12} h 48 l -5 -14 h -24 l -8 14',ACCENT,2)
    for dx in [-15,18]:
        out.append(f'<circle cx="{sx+dx}" cy="{y0-7}" r="7" fill="{BG}" stroke="{ACCENT}" stroke-width="2"/>')
    text(sx,y0-42,'START',ACCENT,'small',anchor='middle')
    text(cx+16,top+27,'HILLSIDE PRACTICE',MUTED,'small')
    text(cx+16,top+51,'Select / Ramp' if selected else 'Build / Prefab → Ramp',TEXT)
    path(f'M {cx+20} {bottom-40} h 64 M {cx+20} {bottom-44} v 8 M {cx+84} {bottom-44} v 8',MUTED,1)
    text(cx+20,bottom-50,'2 m',MUTED,'small')
    out.append('</g>')
    # Inspector.
    rect(rx,top,pw,bottom-top)
    text(rx+16,150,'PROPERTIES',MUTED,'small');text(w-32,150,'›',MUTED)
    def field(y,label,value,unit='',step=True):
        text(rx+16,y,label,MUTED,'small');rect(rx+16,y+8,pw-32,32,FIELD)
        text(rx+28,y+29,value);text(rx+165,y+29,unit,MUTED,'small',anchor='end')
        if step:
            path(f'M {rx+184} {y+8} V {y+40}',LINE,1)
            text(rx+200,y+29,'−',TEXT,anchor='middle');text(rx+233,y+29,'+',TEXT,anchor='middle')
    if selected:
        text(rx+16,181,'Ramp',SELECT,'title');text(rx+16,204,'Source o3  ·  2 connections',MUTED,'small')
        text(rx+16,234,'Input mode',MUTED,'small')
        button(rx+16,246,120,'Angle',True);button(rx+144,246,120,'Height')
        field(304,'Horizontal length','8.00','m');field(370,'Angle','20.0','deg')
        text(rx+16,438,'Rise  2.91 m  ·  calculated',MUTED,'small')
        path(f'M {rx+16} 454 H {rx+264}',LINE,1)
        text(rx+16,478,'Entry stays fixed.',TEXT)
        text(rx+16,500,'Connected run moves with exit.',MUTED,'small')
        button(rx+16,518,120,'Mirror <');button(rx+144,518,120,'Mirror >')
        button(rx+16,562,248,'Convert to editable path')
        text(rx+16,618,'Delete [Del]', '#ff9298')
    else:
        text(rx+16,181,'Level',TEXT,'title');text(rx+16,204,'Nothing selected',MUTED,'small')
        field(238,'Name','Hillside practice',step=False);field(304,'START speed','0.0','m/s')
        path(f'M {rx+16} 360 H {rx+264}',LINE,1)
        text(rx+16,386,'Ramp placement',SELECT)
        text(rx+16,412,'Click a free end to connect.',MUTED,'small')
        text(rx+16,436,'Edit parameters after placement.',MUTED,'small')
        text(rx+16,480,'F  Test from cursor',TEXT)
        text(rx+16,504,'Shift+F  Drop from cursor',MUTED,'small')
        text(rx+16,552,'Draft saved locally',ACCENT)
        text(rx+16,576,'Export for a file backup.',MUTED,'small')
    # Two line footer; browser-owned controls have reserved space at right.
    rect(0,h-64,w,64,PANEL,r=0)
    for x,bw,label in [(16,92,'Fit [Home]'),(116,100,'Centre [.]'),(224,68,'START'),(300,92,'Last test'),(400,76,'Bounds'),(484,76,'Ghost')]:button(x,h-56,bw,label)
    text(580,h-35,'Grid 0.5 m [G]',ACCENT,'small');text(708,h-35,'Zoom 100%',MUTED,'small')
    text(w-20,h-35,'High DPI   ·   Fullscreen',MUTED,'small',anchor='end')
    text(16,h-8,'Drag to move · wheel to zoom · Space + drag to pan' if selected else 'Click to place · Esc cancels preview · wheel to zoom',MUTED,'small')
    text(w-20,h-8,'x 8.00 m   y 0.00 m  ·  '+('Ramp selected' if selected else 'Preview only'),MUTED,'small',anchor='end')
    out.append('</svg>')
    return '\n'.join(out)+'\n'


if __name__ == '__main__':
    for w,h in [(1280,720),(1920,1080)]:
        for selected in [False,True]:
            (OUT / f'{"ramp" if selected else "build"}-{w}x{h}.svg').write_text(render(w,h,selected))
