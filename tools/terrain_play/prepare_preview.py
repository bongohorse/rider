"""Add an artifact-only launcher to an ordinary release bundle; no runtime settings override."""
import argparse
from pathlib import Path
import shutil

p = argparse.ArgumentParser()
p.add_argument('bundle', type=Path)
a = p.parse_args()
root = Path(__file__).resolve().parents[2]
web = next(a.bundle.rglob('index.html')).parent
(web / 'courses').mkdir(exist_ok=True)
for name in ('six-anchor', 'long-curves', 'mixed'):
    shutil.copyfile(root / 'docs/terrain-p0' / (name + '.json'), web / 'courses' / (name + '.json'))
(web / 'terrain-preview.html').write_text('''<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Rider — normal Play depth terrain</title>
<style>body{margin:0;background:#101b20;color:#dceee6;font:13px system-ui}header{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:8px 12px}select,a{color:inherit;background:#243f46;border:1px solid #5c8276;border-radius:4px;padding:5px}#state{color:#b4d6c8}iframe{display:block;width:100%;height:calc(100dvh - 80px);border:0}small{display:block;padding:0 12px 8px;color:#b0c5bd}</style>
<header><strong>Normal Play · Depth terrain</strong><label>Course <select id="course"><option value="six-anchor">Six anchors</option><option value="long-curves">Varied 500 m</option><option value="mixed">Course + objects</option></select></label><label>Start <select id="view"><option value="start">Run-in</option><option value="tight">Tight bends</option><option value="climb">45° climb</option><option value="crest">Crest</option><option value="descent">45° descent</option><option value="jump">Gap jump</option><option value="landing">Landing</option><option value="valley">Valley</option><option value="reverse">Reverse</option></select></label><a href="index.html?station=straight" target="_blank">Open ordinary Gym</a><span id="state">Loading…</span></header>
<small>Arrows drive/brake/reverse · A/D lean · R retries · E opens the unchanged editor. This launcher imports the saved P0 fixture through normal Play. Phone/GPU evidence pending.</small>
<iframe title="Rider normal Play" src="index.html?station=custom"></iframe>
<script>
const q=new URLSearchParams(location.search),allowed=['six-anchor','long-curves','mixed'];
const course=allowed.includes(q.get('course'))?q.get('course'):'long-curves';
const starts={tight:[[192,.9],5],climb:[[214,4.9],5],crest:[[236,22.9],0],descent:[[244,18.9],5],jump:[[282,.9],7],landing:[[306,2.0666666666667],0],valley:[[388,-9.1],0],reverse:[[12,.9],0]};
const view=course!=='six-anchor'&&starts[q.get('view')]?q.get('view'):'start';
for(const [key,value] of [['course',course],['view',view]]){const s=document.getElementById(key);s.value=value;s.onchange=()=>{q.set(key,s.value);location.search=q;};}
document.getElementById('view').disabled=course==='six-anchor';
const frame=document.querySelector('iframe'),state=document.getElementById('state'),since=performance.now();let submitted=false,d;
fetch('courses/'+course+'.json').then(r=>{if(!r.ok)throw Error('Fixture not found');return r.json();}).then(data=>{d=data;if(starts[view]){const [p,s]=starts[view];d.spawn=p;d.start_speed=s;d.editor.start={position:p,speed:s};}}).catch(e=>state.textContent=e.message);
const poll=setInterval(()=>{try{const w=frame.contentWindow;if(performance.now()-since>60000){clearInterval(poll);throw Error('Normal Play did not become ready');}
 if(!submitted&&d&&w.riderCustom?.visible){submitted=true;w.riderCustom.importFile(new w.File([JSON.stringify(d)],course+'.json',{type:'application/json'}));}
 if(submitted&&w.riderCustomStatus==='Saved'&&w.riderTelemetry?.station===d.id&&w.riderTelemetry.sequence>2){clearInterval(poll);state.textContent='Ready · normal Play';w.document.querySelector('canvas').focus();}
}catch(e){state.textContent=e.message;clearInterval(poll);}},50);
</script></html>''')
print(web / 'terrain-preview.html')
