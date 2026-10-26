"""Add an artifact-only launcher to an ordinary release bundle; no runtime settings override."""
import argparse
import json
from pathlib import Path
import shutil

p = argparse.ArgumentParser()
p.add_argument('bundle', type=Path)
p.add_argument('--output', type=Path, help='External launcher; keep immutable engine bundle unchanged')
p.add_argument('--perspective-profile', action='store_true', help='Explicitly mark derived fixtures for the accepted production profile')
p.add_argument('--terrain-look', action='store_true', help='Label the artifact launcher for the native authoring menu')
a = p.parse_args()
root = Path(__file__).resolve().parents[2]
web = a.output or next(a.bundle.rglob('index.html')).parent
web.mkdir(parents=True, exist_ok=True)
(web / 'courses').mkdir(exist_ok=True)
for name in ('six-anchor', 'long-curves', 'mixed', 'long-over-budget', 'mixed-over-budget'):
    source = root / ('docs/terrain-p5' if name.endswith('over-budget') else 'docs/terrain-p0') / (name + '.json')
    if a.perspective_profile:
        d=json.loads(source.read_text()); d['editor']['road_profile']='perspective-v1'
        (web / 'courses' / (name + '.json')).write_text(json.dumps(d)+'\n')
    else:
        shutil.copyfile(source, web / 'courses' / (name + '.json'))
if a.perspective_profile:
    shutil.copyfile(root/'docs/terrain-p0/long-curves.json', web/'courses/legacy-long-curves.json')
(web / 'terrain-preview.html').write_text('''<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Rider — normal Play depth terrain</title>
<style>body{margin:0;background:#101b20;color:#dceee6;font:13px system-ui;height:100dvh;display:flex;flex-direction:column}header{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:8px 12px}select,a{color:inherit;background:#243f46;border:1px solid #5c8276;border-radius:4px;padding:5px}#state{color:#b4d6c8}iframe{display:block;width:100%;flex:1;min-height:0;border:0}small{display:block;padding:0 12px 8px;color:#b0c5bd}</style>
<header><strong>Terrain meshes · Play / editor</strong><label>Course <select id="course"><option value="six-anchor">Six anchors</option><option value="long-curves">Varied 500 m</option><option value="mixed">Course + objects</option><option value="long-over-budget">660 m</option><option value="mixed-over-budget">660 m + objects</option></select></label><label>Start <select id="view"><option value="start">Run-in</option><option value="tight">Tight bends</option><option value="climb">45° climb</option><option value="crest">Crest</option><option value="descent">45° descent</option><option value="jump">Gap jump</option><option value="landing">Landing</option><option value="valley">Valley</option><option value="reverse">Reverse</option></select></label><a href="index.html?station=straight" target="_blank">Open ordinary Gym</a><a id="fixture-download" download>Fixture JSON</a><span id="state">Loading…</span></header>
<small>Arrows drive/brake/reverse · A/D lean · R retries · E opens the editor. This launcher imports the saved course through normal Play. The 660 m courses retain the normal run-in START; set another valid START in the editor. Phone/GPU evidence pending.</small>
<iframe title="Rider normal Play" src="index.html?station=custom"></iframe>
<script>
const q=new URLSearchParams(location.search),allowed=['six-anchor','long-curves','mixed','long-over-budget','mixed-over-budget'];
const course=allowed.includes(q.get('course'))?q.get('course'):'long-curves';
const starts={tight:[[192,.9],5],climb:[[214,4.9],5],crest:[[236,22.9],0],descent:[[244,18.9],5],jump:[[282,.9],7],landing:[[306,2.0666666666667],0],valley:[[388,-9.1],0],reverse:[[12,.9],0]};
const view=course!=='six-anchor'&&!course.endsWith('over-budget')&&starts[q.get('view')]?q.get('view'):'start';
for(const [key,value] of [['course',course],['view',view]]){const s=document.getElementById(key);s.value=value;s.onchange=()=>{q.set(key,s.value);location.search=q;};}
document.getElementById('view').disabled=course==='six-anchor'||course.endsWith('over-budget');
document.getElementById('fixture-download').href='courses/'+course+'.json';
const sessionKey='rider-terrain-preview',selection=course+'/'+view,resume=sessionStorage.getItem(sessionKey)===selection;
const frame=document.querySelector('iframe'),state=document.getElementById('state'),since=performance.now();let submitted=false,d,before=0;
fetch('courses/'+course+'.json').then(r=>{if(!r.ok)throw Error('Fixture not found');return r.json();}).then(data=>{d=data;if(starts[view]){const [p,s]=starts[view];d.spawn=p;d.start_speed=s;d.editor.start={position:p,speed:s};}}).catch(e=>state.textContent=e.message);
const poll=setInterval(()=>{try{const w=frame.contentWindow;
 if(w.riderEditing===true){clearInterval(poll);state.dataset.resumed='true';state.textContent=resume?'Ready · resumed editor':'Draft preserved · use editor Import for the selected fixture';w.document.querySelector('canvas').focus();return;}
 if(resume&&w.riderTelemetry?.sequence>2){clearInterval(poll);state.dataset.resumed='true';state.textContent='Ready · normal Play';w.document.querySelector('canvas').focus();return;}
 if(performance.now()-since>60000){clearInterval(poll);throw Error('Normal Play did not become ready');}
 if(!submitted&&d&&w.riderCustom&&(w.riderCustom.visible||w.riderTelemetry?.sequence>2)){submitted=true;before=w.riderTelemetry?.session_generation||0;w.riderCustom.open();w.riderCustom.importFile(new w.File([JSON.stringify(d)],course+'.json',{type:'application/json'}));}
 if(submitted&&w.riderCustomStatus==='Saved'&&w.riderTelemetry?.station===d.id&&w.riderTelemetry.sequence>2&&w.riderTelemetry.session_generation>before){clearInterval(poll);sessionStorage.setItem(sessionKey,selection);state.textContent='Ready · normal Play';w.document.querySelector('canvas').focus();}
}catch(e){state.textContent=e.message;clearInterval(poll);}},50);
</script></html>''')
if a.perspective_profile:
    launcher=web/'terrain-preview.html'
    text=launcher.read_text().replace('Terrain meshes · Play / editor','Accepted perspective · normal Play / editor')
    text=text.replace('<option value="six-anchor">','<option value="legacy-long-curves">Legacy fixed Depth (500 m)</option><option value="six-anchor">',1)
    text=text.replace("allowed=['six-anchor'","allowed=['legacy-long-curves','six-anchor'")
    text=text.replace('This launcher imports the saved course through normal Play.', 'Marked fixtures use perspective-v1; the legacy option is the unchanged unmarked file. This launcher imports through normal Play, with no rendering override.')
    launcher.write_text(text)
if a.terrain_look:
    launcher=web/'terrain-preview.html';text=launcher.read_text().replace('Accepted perspective · normal Play / editor','Terrain Look · editor / Play')
    text=text.replace('Arrows drive/brake/reverse · A/D lean · R retries · E opens the editor.', 'Arrows drive · A/D lean · R Retry · E Edit/Play. In Edit choose Terrain Look; Apply saves, Close keeps preview values.')
    launcher.write_text(text)
print(web / 'terrain-preview.html')
