// LE5d: multi-point selection, bulk Corner/Smooth on points and whole objects, multi-point drag and prefab
// conversion to the fewest anchors in the debug HTML5 gym (level-editor contract R4, R17, LE3b, LE5c, LE5d).
const {configure}=require('./launch.cjs');
const pointer=require('./pointer.cjs');
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
// Sampling settings of compiler versions 4 and 5 (main/gym/editor_sample.lua).
const TOL=0.005,SEG=0.5;
(async()=>{
 const [root,sha,runId]=process.argv.slice(2);const out=path.resolve(root);let browser;
 function find(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory()){const v=find(p);if(v)return v;}else if(e.name==='index.html')return p;}}
 const web=path.dirname(find(path.resolve(process.argv[6]))),errors=[],logs=[],cases=[],measurements={};
 const server=http.createServer((req,res)=>{const file=path.resolve(web,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(web+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',file.endsWith('.wasm')?'application/wasm':file.endsWith('.js')?'text/javascript':'text/html');fs.createReadStream(file).pipe(res);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1280,height:720},acceptDownloads:true});
  await configure(page,runId,process.argv[5]);
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{const t=m.text();logs.push(t);if(logs.length>60)logs.shift();if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(t))errors.push(t);});
  const base='http://127.0.0.1:'+server.address().port+'/index.html';
  const ed=()=>page.evaluate(()=>window.riderEditor);
  const doc=()=>page.evaluate(()=>window.riderEditorDoc);
  const paths=()=>page.evaluate(()=>window.riderEditorPaths);
  async function key(name,mods=[]){
   for(const m of mods)await page.keyboard.down(m);
   if(mods.length)await page.waitForTimeout(60);
   await page.keyboard.down(name);await page.waitForTimeout(90);await page.keyboard.up(name);
   for(const m of [...mods].reverse())await page.keyboard.up(m);
   await page.waitForTimeout(60);
  }
  const canvas=(x,y)=>page.evaluate(([x,y])=>{const c=document.querySelector('canvas'),r=c.getBoundingClientRect();return {x:r.x+x/c.width*r.width,y:r.y+(1-y/c.height)*r.height};},[x,y]);
  async function world(p){const s=(await ed()).screen;return canvas(s.ox+p[0]*s.ppm_x,s.oy+p[1]*s.ppm_y);}
  async function hover(p){await require('./editor_ui_target.cjs').ensureWorld(page,ed,canvas,p);const a=await world(p);await page.mouse.move(a.x,a.y);await page.waitForTimeout(120);}
  async function click(at,mods=[]){
   for(const m of mods)await page.keyboard.down(m);
   if(mods.length)await page.waitForTimeout(60);
   await pointer.tap(page,at);
   for(const m of mods)await page.keyboard.up(m);
  }
  const at=async(p,mods)=>{await require('./editor_ui_target.cjs').ensureWorld(page,ed,canvas,p);return click(await world(p),mods);};
  async function dblclick(p){await pointer.dblclick(page,await world(p));}
  async function drag(from,to,steps=6){await require('./editor_ui_target.cjs').ensureWorld(page,ed,canvas,from);
   const a=await world(from),b=await world(to);
   await page.mouse.move(a.x,a.y);await pointer.frames(page);await page.mouse.down();await pointer.frames(page);
   for(let i=1;i<=steps;i++){await page.mouse.move(a.x+(b.x-a.x)*i/steps,a.y+(b.y-a.y)*i/steps);await page.waitForTimeout(40);}
   await pointer.frames(page);await page.mouse.up();await pointer.frames(page);
  }
  async function button(name){await require('./editor_ui_target.cjs').reveal(page,name);
   const e=await ed();assert.ok(e.visible.includes(name),name+' not visible: '+e.visible.join(','));
   const b=e.buttons[name];await click(await canvas(b.x,b.y));
  }
  async function edit(){await page.waitForFunction(()=>window.riderEditor?.mode==='edit'&&window.riderEditor.view&&window.riderEditor.screen,null,{timeout:20000});await page.waitForTimeout(150);return ed();}
  async function played(id){
   const after=(await ed())?.view?.generation??0;
   await page.waitForFunction(({id,after})=>window.riderEditor?.mode==='play'&&window.riderTelemetry?.station===id&&window.riderTelemetry.sequence>2&&window.riderTelemetry.session_generation>after,{id,after},{timeout:20000});
   return page.evaluate(()=>window.riderTelemetry);
  }
  async function revision(n){await page.waitForFunction(n=>window.riderEditor.revision===n&&window.riderEditorDoc?.revision===n,n);return ed();}
  async function saved(){
   await page.waitForFunction(()=>window.riderEditor.status==='Saved'&&!window.riderEditor.dirty);
   await page.waitForFunction(()=>window.riderCustom.syncState()!=='syncing');
   return ed();
  }
  const refocused=()=>page.waitForTimeout(1100);
  const canon=v=>Array.isArray(v)?v.map(canon):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canon(v[k])])):v;
  const shape=d=>JSON.stringify(canon({objects:d.objects,connections:d.connections,start:d.start,finish:d.finish??null}));
  const obj=(d,id)=>d.objects.find(o=>o.id===id);
  const near=(a,b,eps=1e-9)=>Math.abs(a-b)<=eps;
  const nearPoint=(p,q,eps=1e-9)=>near(p[0],q[0],eps)&&near(p[1],q[1],eps);
  async function field(row,value,rev){
   await button(row);await page.waitForFunction(()=>window.riderEditor.field_param);
   await page.keyboard.type(String(value),{delay:40});await page.waitForFunction(v=>window.riderEditor.field===v,String(value));await key('Enter');
   if(rev!==undefined)return revision(rev);return ed();
  }
  async function frame(){await require('./editor_ui_target.cjs').frameCourse(page,ed,canvas);}
  async function importText(text,name){
   await button('import');await page.waitForFunction(()=>window.riderCustom.visible&&document.getElementById('rider-custom-file'));
   await page.locator('#rider-custom-file').setInputFiles({name,mimeType:'application/json',buffer:Buffer.from(text)});
   await page.waitForFunction(()=>!window.riderCustom.visible);await refocused();
   return ed();
  }
  async function exportFile(){
   const [download]=await Promise.all([page.waitForEvent('download'),button('export')]);
   const text=fs.readFileSync(await download.path(),'utf8');
   await page.getByRole('button',{name:'Close export',exact:true}).click();await refocused();
   return text;
  }
  async function place(p,expectTarget){
   const r=(await ed()).revision;await hover(p);
   const e=await ed();assert.equal(e.place.target,expectTarget??false,'connect preview '+JSON.stringify(e.place));
   await at(p);return revision(r+1);
  }
  const done=name=>{if(errors.length)throw Error(errors.join('\n'));cases.push(name);};
  // Geometry checks (R8) against a dense evaluation of the source.
  const bez=(a,b,t)=>{const p0=a.p,p1=[a.p[0]+a.out[0],a.p[1]+a.out[1]],p2=[b.p[0]+b.in[0],b.p[1]+b.in[1]],p3=b.p,u=1-t;
   return [0,1].map(k=>u*u*u*p0[k]+3*u*u*t*p1[k]+3*u*t*t*p2[k]+t*t*t*p3[k]);};
  const segDist=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy,t=l>0?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l)):0;return Math.hypot(a[0]+dx*t-p[0],a[1]+dy*t-p[1]);};
  const polyDist=(p,pts)=>{let d=Infinity;for(let i=1;i<pts.length;i++)d=Math.min(d,segDist(p,pts[i-1],pts[i]));return d;};
  function checkSampling(pts,dense){
   let seg=0,dev=0;
   for(let i=1;i<pts.length;i++)seg=Math.max(seg,Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));
   for(const q of dense)dev=Math.max(dev,polyDist(q,pts));
   assert.ok(seg<=SEG+1e-9,'segment '+seg);assert.ok(dev<=TOL+1e-9,'deviation '+dev);
   return {points:pts.length,max_segment_m:seg,max_deviation_m:dev};
  }
  const curveDense=c=>{const q=[];for(let i=0;i+1<c.anchors.length;i++)for(let k=0;k<=200;k++)q.push(bez(c.anchors[i],c.anchors[i+1],k/200));return q;};
  const waveDense=w=>{const q=[],L=w.params.wavelength*w.params.count;for(let k=0;k<=400*w.params.count;k++){const x=L*k/(400*w.params.count);q.push([w.at[0]+x,w.at[1]+w.params.height/2*(1-Math.cos(2*Math.PI*x/w.params.wavelength))]);}return q;};
  const ending=c=>c.anchors.at(-1).p;

  const chainOf=f=>JSON.stringify(f.chains);
  const kids=d=>d.objects.map(o=>o.id);
  const pointsOf=o=>o.type==='line'?o.points:o.type==='curve'?o.anchors.map(a=>a.p):null;
  // Use the actual uncovered area from the approved layout, including collapsed panels.
  async function inView(list){
   const e=await ed(),s=e.screen,u=e.usable;
   for(const p of list){const x=s.ox+p[0]*s.ppm_x,y=s.oy+p[1]*s.ppm_y;assert.ok(x>u.x0&&x<u.x1&&y>u.y0&&y<u.y1,'outside the view: '+JSON.stringify([p,x,y,u]));}
  }
  // The shipped Fit action frames all authored geometry, leaving these box corners in its padding.
  async function fit(){await key('Home');await pointer.frames(page);}
  // A compiled point of o near x (on the object's body, away from its points).
  const bodyAt=async(id,x)=>{const pts=(await paths())[id];return pts.reduce((b,q)=>Math.abs(q[0]-x)<Math.abs(b[0]-x)?q:b);};
  const pointList=e=>e.points.map(p=>p.id+':'+p.i);
  const deviation=(curve,pts)=>{let d=0;for(const q of curveDense(curve))d=Math.max(d,polyDist(q,pts));return d;};

  // 1. A zig-zag line: box-select two inner points, Shift+click an inner point and an open end (and one point
  // twice, which removes it), then Make smooth once. Exactly the selected inner points become smooth, the end
  // is skipped, the result equals Make smooth applied point by point (LE5c), and one Undo restores the line.
  // Make corner on the whole object brings back the original chain.
  await page.goto(base+'?station=straight');
  await page.waitForFunction(()=>window.riderTelemetry?.station==='straight'&&window.riderTelemetry.sequence>2);
  await page.locator('canvas').focus();await key('e');let e=await edit();
  await button('new');await page.waitForFunction(()=>window.riderEditor.id==='my-level-1');e=await saved();
  let d=await doc();assert.equal(d.editor_version,7,'current document format');
  await frame();
  const zig=[[4,0],[8,3],[12,0],[16,3],[20,0],[24,3]];
  await key('d');let r=(await ed()).revision;for(const p of zig)await at(p);await key('Enter');e=await revision(r+1);
  const Z=(await doc()).objects[0].id;const original=await doc();
  await key('s');await at([6,1.5]);await page.waitForFunction(id=>window.riderEditor.selection===id,Z);
  e=await ed();assert.ok(e.visible.includes('smooth_all')&&e.visible.includes('corner_all')&&!e.visible.includes('smooth'),e.visible.join(','));
  const straightFile=JSON.parse(await exportFile());
  await drag([7,-2],[13,3.5]);await page.waitForFunction(()=>window.riderEditor.points.length===2);
  e=await ed();assert.deepEqual(pointList(e),[Z+':2',Z+':3']);assert.deepEqual(e.selected,[Z]);
  await at([20,0],['Shift']);await at([24,3],['Shift']);await at([16,3],['Shift']);
  await page.waitForFunction(()=>window.riderEditor.points.length===5);
  await at([16,3],['Shift']);await page.waitForFunction(()=>window.riderEditor.points.length===4);
  e=await ed();assert.deepEqual(pointList(e),[Z+':2',Z+':3',Z+':5',Z+':6']);assert.equal(e.vertex,false);
  assert.ok(e.visible.includes('smooth_all')&&e.visible.includes('corner_all'),e.visible.join(','));
  r=e.revision;await button('smooth_all');e=await revision(r+1);
  assert.ok(e.message.startsWith('Make smooth: 3 points rounded; skipped: 1 open end'),e.message);
  d=await doc();let o=obj(d,Z);assert.equal(o.type,'curve');assert.deepEqual(o.anchors.map(a=>a.p),zig);
  assert.deepEqual(o.anchors.map(a=>a.mode),['corner','smooth','smooth','corner','smooth','corner']);
  assert.deepEqual(pointList(e),[Z+':2',Z+':3',Z+':5',Z+':6'],'points stay selected');
  const bulk=await doc();
  await key('z',['Control']);e=await revision(r+2);assert.equal(shape(await doc()),shape(original),'one Undo restores the line');
  // The same points one by one with the LE5c button.
  for(const [k,p] of [[2,zig[1]],[3,zig[2]],[5,zig[4]]]){
   await at(p);await page.waitForFunction(k=>window.riderEditor.vertex?.index===k||window.riderEditor.anchor?.i===k,k);
   e=await ed();assert.ok(e.visible.includes('smooth'),e.visible.join(','));const rr=e.revision;await button('smooth');await revision(rr+1);
  }
  assert.equal(shape(await doc()),shape(bulk),'bulk result equals the point-by-point result');
  // Whole object: Make corner sharpens every smooth point; the compiled chain is the original one.
  await key('Escape');await key('Escape');await at(await bodyAt(Z,14));await page.waitForFunction(id=>window.riderEditor.selection===id&&!window.riderEditor.anchor&&!window.riderEditor.vertex,Z);
  r=(await ed()).revision;await button('corner_all');e=await revision(r+1);assert.ok(e.message.startsWith('Make corner: 3 points made sharp'),e.message);
  o=obj(await doc(),Z);assert.deepEqual(o.anchors.map(a=>a.mode),Array(6).fill('corner'));assert.deepEqual((await paths())[Z],zig);
  assert.equal(chainOf(JSON.parse(await exportFile())),chainOf(straightFile));
  measurements.zigzag={selected:4,rounded:3,skipped_ends:1,equal_to_point_by_point:true};
  done('points_box_shift_bulk_smooth_matches_point_by_point');

  // 2. The box rule: with a line selected a box selects its points; a box that catches none of them selects
  // objects as in LE3b (here nothing); after Esc a box selects objects, never points.
  await key('Escape');await at([6,1.5]);await page.waitForFunction(id=>window.riderEditor.selection===id,Z);
  await drag([28,-2],[32,-1]);await page.waitForTimeout(150);e=await ed();assert.deepEqual([e.selected,e.points],[[],[]]);
  await at([6,1.5]);await page.waitForFunction(id=>window.riderEditor.selection===id,Z);
  await drag([7,-2],[13,3.5]);await page.waitForFunction(()=>window.riderEditor.points.length===2);
  await key('Escape');await page.waitForFunction(()=>window.riderEditor.selected.length===0);
  await drag([7,-2],[13,3.5]);await page.waitForTimeout(150);e=await ed();assert.deepEqual([e.selected,e.points],[[Z],[]]);
  // Delete with several points selected is refused (one point at a time) and changes nothing.
  await at([6,1.5]);await page.waitForFunction(id=>window.riderEditor.selection===id,Z);await drag([7,-2],[13,3.5]);await page.waitForFunction(()=>window.riderEditor.points.length===2);
  r=(await ed()).revision;await key('Delete');e=await ed();assert.ok(e.message.startsWith('Delete works on one point at a time'),e.message);assert.equal(e.revision,r);
  done('box_rule_points_then_objects_after_esc');

  // 3. Multi-point drag across a joint: each point moves once; the joint carries the downstream piece along
  // (R4), so its selected point is not moved twice. One Undo step; a click on one point selects only it.
  await key('Escape');await key('d');r=(await ed()).revision;
  for(const p of [[30,0],[34,2],[38,0]])await at(p);await key('Enter');await revision(r+1);
  for(const p of [[38,0],[42,2],[46,0]])await at(p);await key('Enter');e=await revision(r+2);
  d=await doc();const [A,B]=kids(d).slice(-2);assert.deepEqual(d.connections,[{from:A,to:B}]);const twoLines=await doc();
  await key('s');await at([32,1]);await at([44,1],['Shift']);await page.waitForFunction(()=>window.riderEditor.selected.length===2);
  await drag([33,-2],[43,2.5]);await page.waitForFunction(()=>window.riderEditor.points.length===3);
  assert.deepEqual(pointList(await ed()),[A+':2',A+':3',B+':2']);
  r=(await ed()).revision;await drag([34,2],[34,3]);e=await revision(r+1);d=await doc();
  assert.deepEqual(obj(d,A).points,[[30,0],[34,3],[38,1]]);assert.deepEqual(obj(d,B).points,[[38,1],[42,3],[46,1]]);assert.deepEqual(d.connections,[{from:A,to:B}]);
  assert.equal(pointList(e).length,3);
  await at([42,3]);await page.waitForFunction(()=>window.riderEditor.points.length===0&&window.riderEditor.vertex);
  e=await ed();assert.deepEqual(e.vertex,{id:B,index:2});assert.equal(e.revision,r+1);
  await key('z',['Control']);await revision(r+2);assert.equal(shape(await doc()),shape(twoLines),'one Undo restores both lines');
  // A point that cannot be smoothed (its neighbours coincide) is refused and counted; its line stays
  // unchanged (still a line) while the other selected line is smoothed in the same Undo step.
  await key('Escape');await key('d');r=(await ed()).revision;
  for(const p of [[50,0],[52,2],[50,0]])await at(p);await key('Enter');await revision(r+1);
  const C=kids(await doc()).at(-1);assert.deepEqual(obj(await doc(),C).points,[[50,0],[52,2],[50,0]]);
  await key('s');await key('Escape');await at([32,1]);await at([51,1],['Shift']);await page.waitForFunction(()=>window.riderEditor.selected.length===2);
  await button('smooth_all');e=await revision(r+2);d=await doc();
  assert.ok(e.message.startsWith('Make smooth: 1 point rounded; skipped: 1 point refused (The neighbouring points coincide'),e.message);
  assert.equal(obj(d,A).type,'curve');assert.deepEqual(obj(d,C),{id:C,type:'line',points:[[50,0],[52,2],[50,0]]});
  await key('z',['Control']);await revision(r+3);await key('z',['Control']);await revision(r+4);assert.equal(shape(await doc()),shape(twoLines));
  measurements.multi_drag={points:3,delta:[0,1],downstream_point_moved_once:true};
  done('multi_point_drag_moves_each_point_once');

  // 4. Whole objects with every prefab type: Make smooth asks first, then converts each to the fewest
  // anchors that keep its shape (a polyline prefab keeps its corners; a Bump/wave gets anchors at its ends,
  // crests and troughs) and smooths them in one Undo step; the Platform is skipped and named. Make corner
  // never converts.
  const sampling={tolerance:TOL,max_segment:SEG};
  const blank={schema:1,units:'metres',spawn:[-6,0.9],start_speed:0,run_in:0,run_out:0,bounds:[-20,60,-12,21],chains:[[[50,-2],[-10,-2]]],hulls:[],labels:[],checkpoints:[]};
  const types={...blank,id:'le5d-types',name:'LE5d prefab types',editor:{editor_version:5,compiler_version:5,sampling,revision:1,next_id:8,objects:[
   {id:'o1',type:'prefab',kind:'flat',at:[0,0],params:{length:4}},{id:'o2',type:'prefab',kind:'ramp',at:[6,0],params:{mode:'angle',length:4,angle:15}},
   {id:'o3',type:'prefab',kind:'step',at:[12,0],params:{riser:'start',height:0.5,length:2}},{id:'o4',type:'prefab',kind:'gap',at:[16,0],params:{width:2,depth:1}},
   {id:'o5',type:'prefab',kind:'kicker',at:[20,0],params:{facing:'right',angle:15,lip:1,gap:2,landing:'flat',landing_length:3,landing_angle:15}},
   {id:'o6',type:'prefab',kind:'wave',at:[30,0],params:{height:0.5,wavelength:4,count:2}},{id:'o7',type:'prefab',kind:'platform',at:[40,0],params:{width:2,height:1}}],
   connections:[],start:{position:[-6,0.9],speed:0}}};
  e=await importText(JSON.stringify(types),'le5d-types.json');assert.ok(e.message.startsWith('Imported'),e.message);
  const typesDoc=await doc(),typePaths=await paths();
  await key('s');await fit(-1,43,0);await inView([[-1,-2],[43,2],[0,0],[42,1]]);
  await drag([-1,-2],[43,2]);await page.waitForFunction(()=>window.riderEditor.selected.length===7);
  r=(await ed()).revision;await button('smooth_all');e=await ed();
  assert.ok(e.confirm_bulk&&e.revision===r,JSON.stringify([e.confirm_bulk,e.revision]));
  assert.ok(e.message.startsWith('Make smooth converts Flat o1, Ramp o2, Step o3 and 3 more to editable paths first'),e.message);
  const typesMm=Number(/at most ([\d.]+) mm/.exec(e.message)[1]);assert.ok(typesMm<=5,e.message);
  await button('smooth_all');e=await revision(r+1);d=await doc();
  assert.ok(/Converted Flat o1, Ramp o2, Step o3 and 3 more to paths/.test(e.message)&&e.message.includes('Platform o7 (no path)'),e.message);
  const counts={};for(const id of ['o1','o2','o3','o4','o5','o6'])counts[id]=pointsOf(obj(d,id)).length;
  const landing=d.objects.find(x=>!typesDoc.objects.some(y=>y.id===x.id));counts.landing=pointsOf(landing).length;
  assert.deepEqual(counts,{o1:2,o2:2,o3:3,o4:4,o5:3,o6:5,landing:2},JSON.stringify(counts));
  assert.equal(obj(d,'o7').type,'prefab');assert.ok(e.selected.includes(landing.id),'the landing joins the selection');
  for(const id of ['o1','o2','o3','o4'])assert.deepEqual(pointsOf(obj(d,id)),typePaths[id],id+' keeps its points');
  assert.deepEqual(pointsOf(obj(d,'o5')).concat(pointsOf(landing)),typePaths.o5,'Kicker + landing keeps its points and its gap');
  assert.deepEqual(obj(d,'o6').anchors.map(a=>a.p),[[30,0],[32,0.5],[34,0],[36,0.5],[38,0]]);
  measurements.anchor_counts={flat:2,ramp:2,step:3,gap:4,kicker:'3 + 2 (landing)',wave_2_count:5,platform:'not converted'};
  await key('z',['Control']);await revision(r+2);assert.equal(shape(await doc()),shape(typesDoc),'one Undo restores every prefab');
  e=await ed();assert.equal(e.selected.length,7);r=e.revision;
  await button('corner_all');e=await ed();assert.ok(e.message.startsWith('Nothing to make sharp'),e.message);assert.equal(e.revision,r);
  done('whole_prefabs_convert_to_fewest_anchors');

  // 5. A course: a drawn line hill, a curve with a corner, a gentle ramp and a flat (prefabs), then a two-wave
  // Bump and a run-out. The line, the curve, the ramp and the flat are selected as whole objects and smoothed
  // in one action (the prefabs converted after the confirmation): every inner point and the joints between
  // them, never the joint to the unselected wave. One Undo restores the original including the prefabs;
  // Redo, autosave/reload and export -> import keep the result. The wave is then converted (LE5c button) into
  // a five-anchor curve within 5 mm of its samples, and the course drives as one chain without a wheel
  // support loss (preset A, START 6 m/s, full throttle; LE5b observer).
  const course={...blank,id:'le5d-course',name:'LE5d course',spawn:[2,0.9],start_speed:6,bounds:[-10,90,-12,21],chains:[[[80,0],[0,0]]],
   editor:{editor_version:5,compiler_version:5,sampling,revision:1,next_id:7,objects:[
    {id:'o1',type:'line',points:[[0,0],[10,0],[16,0.4],[22,0]]},
    {id:'o2',type:'curve',anchors:[{p:[22,0],in:[0,0],out:[5/3,0],mode:'smooth'},{p:[27,-0.4],in:[0,0],out:[0,0],mode:'corner'},{p:[32,0],in:[-5/3,0],out:[0,0],mode:'smooth'}]},
    {id:'o3',type:'prefab',kind:'ramp',at:[32,0],params:{mode:'height',length:6,height:0.4}},{id:'o4',type:'prefab',kind:'flat',at:[38,0.4],params:{length:8}},
    {id:'o5',type:'prefab',kind:'wave',at:[46,0.4],params:{height:0.3,wavelength:8,count:2}},{id:'o6',type:'prefab',kind:'flat',at:[62,0.4],params:{length:14}}],
    connections:[{from:'o1',to:'o2'},{from:'o2',to:'o3'},{from:'o3',to:'o4'},{from:'o4',to:'o5'},{from:'o5',to:'o6'}],start:{position:[2,0.9],speed:6},finish:{position:[72,0.9],direction:1}}};
  e=await importText(JSON.stringify(course),'le5d-course.json');assert.ok(e.message.startsWith('Imported'),e.message);assert.equal(e.chains,1);
  const courseDoc=await doc(),coursePaths=await paths();
  await key('s');await fit(0,49,0);await inView([[0,0],[46,0.4],[48,0.6]]);
  await at([5,0]);await page.waitForFunction(()=>window.riderEditor.selection==='o1');
  await at(await bodyAt('o2',24.5),['Shift']);await at([35,0.2],['Shift']);await at([42,0.4],['Shift']);
  await page.waitForFunction(()=>window.riderEditor.selected.length===4);assert.deepEqual((await ed()).selected,['o1','o2','o3','o4']);
  r=(await ed()).revision;await button('smooth_all');e=await ed();
  assert.ok(e.message.startsWith('Make smooth converts Ramp o3, Flat o4 to editable paths first')&&e.revision===r,e.message);
  await button('smooth_all');e=await revision(r+1);d=await doc();
  assert.ok(e.message.startsWith('Make smooth: 6 points rounded.')&&e.message.includes('Converted Ramp o3, Flat o4'),e.message);
  const modes=id=>obj(d,id).anchors.map(a=>a.mode);
  assert.deepEqual([modes('o1'),modes('o2'),modes('o3'),modes('o4')],[['corner','smooth','smooth','smooth'],['smooth','smooth','smooth'],['smooth','smooth'],['smooth','corner']]);
  for(const id of ['o1','o2','o3','o4'])assert.deepEqual(pointsOf(obj(d,id)),id==='o2'?courseDoc.objects[1].anchors.map(a=>a.p):coursePaths[id],id+' keeps its points');
  assert.equal(obj(d,'o5').type,'prefab');assert.deepEqual(d.connections,courseDoc.connections);assert.equal(e.chains,1);
  const smoothed=await doc();
  await key('z',['Control']);await revision(r+2);assert.equal(shape(await doc()),shape(courseDoc),'one Undo restores the course and its prefabs');
  await key('y',['Control']);await revision(r+3);assert.equal(shape(await doc()),shape(smoothed));
  // The wave: Convert asks first and states the largest distance from its current shape.
  await key('Escape');const wy=0.4+0.15*(1-Math.cos(2*Math.PI*2/8));await at([48,wy]);await page.waitForFunction(()=>window.riderEditor.selection==='o5');
  await button('convert');e=await ed();const waveMm=Number(/at most ([\d.]+) mm from its shape/.exec(e.message)[1]);assert.ok(waveMm<=5,e.message);
  await button('convert');e=await revision(r+4);d=await doc();const wave=obj(d,'o5');
  assert.equal(wave.type,'curve');const crest=0.4+0.3;assert.deepEqual(wave.anchors.map(a=>a.p),[[46,0.4],[50,crest],[54,0.4],[58,crest],[62,0.4]]);
  const tl=0.364*4;assert.ok(wave.anchors.every((a,i)=>nearPoint(a.in,[i?-tl:0,0])&&nearPoint(a.out,[i<4?tl:0,0])&&a.mode==='smooth'),JSON.stringify(wave.anchors));
  const waveDev=deviation(wave,coursePaths.o5);assert.ok(waveDev<=TOL,'wave deviation '+waveDev);assert.deepEqual(d.connections,courseDoc.connections);assert.equal(e.chains,1);
  measurements.wave_convert={anchors:5,max_deviation_from_samples_m:waveDev,confirm_message_mm:waveMm,samples_before:coursePaths.o5.length};
  e=await saved();const finalCourse=await doc();
  await page.goto(base+'?station=custom');e=await edit();assert.equal(shape(await doc()),shape(finalCourse),'reload keeps the result');
  const text=await exportFile();assert.equal(shape(JSON.parse(text).editor),shape(finalCourse));
  e=await importText(text,'le5d-course-export.json');assert.equal(e.conflict,false);assert.equal(shape(await doc()),shape(finalCourse),'export -> import keeps the result');
  await page.evaluate(()=>{window.riderTrackWindow=[9,63];});
  const runs=[];
  await key('e');let t=await played('le5d-course');
  for(let i=0;i<2;i++){
   if(i>0){await page.keyboard.up('ArrowUp');await key('r');}
   await page.waitForTimeout(100);await page.keyboard.down('ArrowUp');
   await page.waitForFunction(i=>window.riderTelemetry?.finish_done&&window.riderTrack?.window?.passed&&window.riderTelemetry.reset_count===i,i,{timeout:30000});
   t=await page.evaluate(()=>({tm:window.riderTelemetry,track:window.riderTrack}));
   const w=t.track.window;
   runs.push({unpowered_ticks:w.unpowered,finish_time:t.tm.finish_time,window_ticks:w.ticks,support_losses:w.losses,airborne:w.airborne,max_dvy_mps:w.dvy,max_vx_drop_mps:w.dvx_drop,vx_min:w.vx_min,vx_max:w.vx_max});
  }
  await page.keyboard.up('ArrowUp');
  for(const run of runs){
   assert.equal(run.unpowered_ticks,0,JSON.stringify(runs));assert.deepEqual(run.support_losses,[0,0],JSON.stringify(runs));
   assert.equal(run.airborne,0,JSON.stringify(runs));assert.ok(run.window_ticks>60,JSON.stringify(runs));
   assert.ok(run.max_dvy_mps<=0.25,JSON.stringify(runs)); // the LE5b reference-drive bound
  }
  const level=await page.evaluate(()=>window.riderSavedLevel);assert.equal(level.chains.length,1);
  measurements.course={chain_points:level.chains[0].length,runs};
  await key('e');e=await edit();
  done('whole_objects_smooth_course_persists_and_drives');

  await page.screenshot({path:path.join(out,'points-course.png')});
  fs.writeFileSync(path.join(out,'points-result.json'),JSON.stringify({source_sha:sha,run_id:runId,browser:browser.version(),status:'PASS',cases,measurements},null,2));
  console.log(JSON.stringify({status:'PASS',cases,measurements}));
 }catch(e){
  if(errors.length)console.error('Page errors:\n'+errors.join('\n'));
  console.error('Last console lines:\n'+logs.join('\n'));
  if(browser)for(const context of browser.contexts())for(const page of context.pages()){
   console.error('State: '+JSON.stringify(await page.evaluate(()=>({editor:window.riderEditor&&{...window.riderEditor,buttons:undefined,library:undefined},doc:window.riderEditorDoc&&{objects:window.riderEditorDoc.objects?.slice(0,12),connections:window.riderEditorDoc.connections?.slice(0,12)},
    track:window.riderTrack,telemetry:window.riderTelemetry&&{finish_done:window.riderTelemetry.finish_done,finish_time:window.riderTelemetry.finish_time,reset_count:window.riderTelemetry.reset_count}})).catch(()=>null)));
   await page.screenshot({path:path.join(out,'points-failed.png')}).catch(()=>{});
  }
  throw e;
 }
 finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
