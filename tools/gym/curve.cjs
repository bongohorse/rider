// LE5b: Bezier curves, Bump/wave and shared adaptive sampling in the debug HTML5 gym (level-editor contract R1, R4-R9, R16, R17).
const {configure}=require('./launch.cjs');
const pointer=require('./pointer.cjs');
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
// Sampling settings of compiler version 4 (main/gym/editor_sample.lua).
const TOL=0.005,SEG=0.5,MAX_POINTS=2048;
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

  // 1. Curve [C]: anchors placed like Draw points with automatic smooth tangents; starting on the Flat's free
  // exit connects (R5). A Flat placed on the curve's exit continues the run, which compiles into one chain.
  await page.goto(base+'?station=straight');
  await page.waitForFunction(()=>window.riderTelemetry?.station==='straight'&&window.riderTelemetry.sequence>2);
  await page.locator('canvas').focus();await key('e');let e=await edit();
  await button('new');await page.waitForFunction(()=>window.riderEditor.id==='my-level-1');e=await saved();
  let d=await doc();assert.equal(d.editor_version,8);assert.deepEqual(d.sampling,{tolerance:TOL,max_segment:SEG});
  await frame();
  await key('p');await key('1');await place([0,0]);
  await key('c');e=await ed();assert.equal(e.tool,'curve');
  let r=e.revision;
  await hover([10.1,0.1]);e=await ed();assert.ok(e.readout.includes('connects'),e.readout);
  await at([10.1,0.1]);await at([14,2]);await at([18,0]);await at([18,0]);e=await revision(r+1);d=await doc();
  const c0=obj(d,'o2');assert.equal(c0.type,'curve');assert.deepEqual(c0.anchors.map(a=>a.p),[[10,0],[14,2],[18,0]]);
  assert.deepEqual(c0.anchors.map(a=>a.mode),['smooth','smooth','smooth']);assert.deepEqual(d.connections,[{from:'o1',to:'o2'}]);
  await key('p');await key('1');await place([18.1,0.1],'o2');d=await doc();
  assert.deepEqual(d.connections,[{from:'o1',to:'o2'},{from:'o2',to:'o3'}]);assert.deepEqual(obj(d,'o3').at,[18,0]);
  measurements.curve=checkSampling((await paths()).o2,curveDense(c0));
  done('curve_drawn_and_connected');

  // 2. Sampling depends only on the source: an export at another zoom compiles the same chains (R8).
  await key('s');
  const fileA=JSON.parse(await exportFile());
  for(let i=0;i<3;i++){await page.mouse.wheel(0,-120);await page.waitForTimeout(80);}
  const fileB=JSON.parse(await exportFile());
  assert.notEqual((await ed()).camera.zoom,undefined);assert.equal(fileA.chains.length,1);assert.deepEqual(fileB.chains,fileA.chains);
  measurements.zoom={chain_points:fileA.chains[0].length};
  await frame();
  done('sampling_independent_of_zoom');

  // 3. Tangent handles: dragging anchor 2's out tangent keeps a smooth anchor's in tangent on one line (its
  // length kept); Tangents [click] switches to symmetric. Dragging the exit anchor moves the downstream Flat
  // by the same displacement; the upstream Flat stays (R4). Undo/Redo restore exactly.
  await key('Home');await at([14,2]);await page.waitForFunction(()=>window.riderEditor.selection==='o2');
  e=await ed();assert.deepEqual(e.handles.map(h=>h.name),['o1','a2','i2','o2','a3','i3']);
  const before=await doc();r=e.revision;
  const o2h=e.handles.find(h=>h.name==='o2').p;await drag(o2h,[o2h[0]+0.5,o2h[1]+1]);e=await revision(r+1);d=await doc();
  let a2=obj(d,'o2').anchors[1],a20=obj(before,'o2').anchors[1];
  assert.ok(near(a2.out[0],a20.out[0]+0.5,0.06)&&near(a2.out[1],a20.out[1]+1,0.06),JSON.stringify(a2));
  const unit=v=>{const l=Math.hypot(v[0],v[1]);return [v[0]/l,v[1]/l];};
  assert.ok(nearPoint(unit(a2.in),unit(a2.out).map(x=>-x),1e-9),'smooth tangents on one line');assert.ok(near(Math.hypot(...a2.in),Math.hypot(...a20.in),1e-9));
  assert.deepEqual(obj(d,'o3'),obj(before,'o3'));assert.deepEqual(obj(d,'o1'),obj(before,'o1'));
  assert.deepEqual(e.rows,['Anchor 2 tangents: smooth  (click)']);
  await button('param_1');e=await revision(r+2);d=await doc();a2=obj(d,'o2').anchors[1];
  assert.equal(a2.mode,'symmetric');assert.ok(nearPoint(a2.in,a2.out.map(x=>-x)));
  const exit=ending(obj(d,'o2'));const mid=await doc();
  await drag(exit,[exit[0],exit[1]+1]);e=await revision(r+3);d=await doc();
  assert.ok(nearPoint(ending(obj(d,'o2')),[18,1]),JSON.stringify(ending(obj(d,'o2'))));
  assert.deepEqual(obj(d,'o3').at,[18,1]);assert.deepEqual(obj(d,'o3').params,obj(mid,'o3').params);assert.deepEqual(obj(d,'o1'),obj(mid,'o1'));
  const moved=await doc();
  await key('z',['Control']);await revision(r+4);assert.equal(shape(await doc()),shape(mid));
  await key('y',['Control']);await revision(r+5);assert.equal(shape(await doc()),shape(moved));
  for(let i=0;i<3;i++)await key('z',['Control']);await revision(r+8);assert.equal(shape(await doc()),shape(before));
  done('tangents_and_anchor_drag');

  // 4. A double-click inserts an anchor without changing the shape; Delete removes it again; Split [K] at an
  // inner anchor makes two connected curves (one chain); Undo restores.
  // Zoomed in around the curve (and back out by the same steps), so the double-click is clear of its handles.
  r=(await ed()).revision;const pts0=(await paths()).o2;
  await key('Escape');await at([12,1.25]);await page.waitForFunction(()=>window.riderEditor.selection==='o2');
  await hover([14,1]);for(let i=0;i<3;i++){await page.mouse.wheel(0,-120);await page.waitForTimeout(80);}
  const q=pts0.reduce((b,p)=>Math.hypot(p[0]-12,p[1]-1.25)<Math.hypot(b[0]-12,b[1]-1.25)?p:b);await dblclick(q);e=await revision(r+1);d=await doc();
  assert.equal(obj(d,'o2').anchors.length,4);
  for(const p of curveDense(obj(d,'o2')))assert.ok(polyDist(p,curveDense(obj(before,'o2')))<=1e-3,'insert keeps the shape');
  await key('Delete');e=await revision(r+2);assert.equal(obj(await doc(),'o2').anchors.length,3);
  await key('Escape');await at([14,2]);await page.waitForFunction(()=>window.riderEditor.selection==='o2');
  const a2h=(await ed()).handles.find(h=>h.name==='a2').p;await at(a2h);await page.waitForFunction(()=>window.riderEditor.visible.includes('split'));
  await key('k');e=await revision(r+3);d=await doc();
  assert.equal(d.objects.filter(o=>o.type==='curve').length,2);assert.deepEqual(d.connections.find(c=>c.from==='o2'),{from:'o2',to:'o4'});
  assert.equal(e.chains,1);
  await hover([14,1]);for(let i=0;i<3;i++){await page.mouse.wheel(0,120);await page.waitForTimeout(80);}
  await key('z',['Control']);await revision(r+4);await key('z',['Control']);await key('z',['Control']);await revision(r+6);
  assert.deepEqual(obj(await doc(),'o2').anchors,obj(before,'o2').anchors);
  // A picked anchor does not outlive the next pick: anchor 2, then the curve body, then Delete removes the
  // curve (with its connections), not the anchor. Undo restores it.
  await hover([14,1]);for(let i=0;i<3;i++){await page.mouse.wheel(0,-120);await page.waitForTimeout(80);}
  await at(a2h);await page.waitForFunction(()=>window.riderEditor.rows.length===1);
  const body=(await paths()).o2.reduce((b,p)=>Math.hypot(p[0]-16,p[1]-1.25)<Math.hypot(b[0]-16,b[1]-1.25)?p:b);
  await at(body);e=await ed();assert.equal(e.selection,'o2');assert.deepEqual(e.rows,[]);
  r=e.revision;await key('Delete');e=await revision(r+1);d=await doc();assert.equal(obj(d,'o2'),undefined);assert.equal(d.connections.length,0);
  await key('z',['Control']);await revision(r+2);assert.deepEqual(obj(await doc(),'o2').anchors,obj(before,'o2').anchors);
  await hover([14,1]);for(let i=0;i<3;i++){await page.mouse.wheel(0,120);await page.waitForTimeout(80);}
  done('insert_delete_split_anchors');

  // 5. Bump/wave [P, 7]: placed on the Flat's exit (connects); a Flat follows. Its fields edit height,
  // wavelength and count; a non-integer count is refused unchanged; the crest handle sets the height; a longer
  // wavelength moves the downstream Flat by the exit displacement. Samples obey the R8 bounds.
  await key('Escape');await key('p');await key('7');assert.equal((await ed()).prefab_kind,'wave');
  await place([28.1,0.1],'o3');d=await doc();
  const w0=obj(d,'o5');assert.deepEqual(canon(w0),canon({id:'o5',type:'prefab',kind:'wave',at:[28,0],params:{height:1,wavelength:8,count:1}}));
  await key('1');await place([36.1,0.1],'o5');
  e=await ed();assert.equal(e.selection,'o6');
  await key('s');await at([32,1]);await page.waitForFunction(()=>window.riderEditor.selection==='o5');
  e=await ed();assert.deepEqual(e.rows,['Height: 1.00 m','Wavelength: 8.00 m','Count: 1']);r=e.revision;
  e=await field('param_3','2.5');assert.ok(e.message.includes('Count must be a whole number (got 2.5).'),e.message);assert.equal(e.revision,r);await key('Escape');
  await field('param_3','2',r+1);await field('param_1','0.6',r+2);d=await doc();
  assert.deepEqual(obj(d,'o6').at,[44,0]);
  await field('param_2','10',r+3);d=await doc();assert.deepEqual(obj(d,'o6').at,[48,0]);assert.deepEqual(obj(d,'o3').at,[18,0]);
  const crest=(await ed()).handles.find(h=>h.name==='crest').p;assert.ok(nearPoint(crest,[33,0.6]),JSON.stringify(crest));
  // Heights snap to the 0.5 m grid: 0.6 + 0.9 -> 1.5.
  await drag(crest,[crest[0],crest[1]+0.9]);await revision(r+4);d=await doc();assert.equal(obj(d,'o5').params.height,1.5);
  measurements.wave=checkSampling((await paths()).o5,waveDense(obj(d,'o5')));
  await key('z',['Control']);await revision(r+5);
  done('wave_fields_and_handles');

  // 6. Over the sampling budget (a 50 x 100 m wave needs more than 2048 points): Play and Export are blocked
  // with the reason, the source stays as entered and is saved; a reload keeps it. Undo restores.
  r=(await ed()).revision;await field('param_2','100',r+1);await field('param_3','50',r+2);
  e=await saved();const over=e.errors.find(m=>m.includes('needs more than '+MAX_POINTS+' points'));assert.ok(over,JSON.stringify(e.errors));
  await key('e');await page.waitForFunction(()=>window.riderEditor.message.startsWith('Play blocked'));e=await ed();assert.equal(e.mode,'edit');
  await button('export');await page.waitForFunction(()=>window.riderEditor.message.startsWith('Export blocked'));
  const big=await doc();assert.deepEqual(obj(big,'o5').params,{height:0.6,wavelength:100,count:50});
  await page.goto(base+'?station=custom');e=await edit();assert.equal(shape(await doc()),shape(big));assert.ok(e.errors.includes(over));
  measurements.over_budget=over;
  // Undo history does not survive a reload: the fields restore the previous values.
  await frame();await at([32,0.01]);await page.waitForFunction(()=>window.riderEditor.selection==='o5');
  r=(await ed()).revision;await field('param_3','2',r+1);await field('param_2','10',r+2);
  e=await ed();assert.ok(!e.errors.some(m=>m.includes('needs more than')),JSON.stringify(e.errors));
  done('over_budget_blocks_play_keeps_source');

  // 7. Curves and Bump/wave survive reload and export -> import; copy/paste keeps them with new ids and the
  // internal connection; Mirror [>] reflects the curve (anchors reversed, tangents swapped) and its samples.
  e=await saved();const course=await doc();
  await page.goto(base+'?station=custom');e=await edit();assert.equal(shape(await doc()),shape(course));
  const text=await exportFile();const file=JSON.parse(text);assert.equal(file.chains.length,1);assert.equal(shape(file.editor),shape(course));
  e=await importText(text,'curves.json');assert.equal(e.conflict,false);assert.equal(shape(await doc()),shape(course));
  await frame();
  await at([14,2]);await page.waitForFunction(()=>window.riderEditor.selection==='o2');
  const wp=(await paths()).o5.reduce((b,p)=>Math.abs(p[0]-32)<Math.abs(b[0]-32)?p:b);
  await at(wp,['Shift']);await page.waitForFunction(()=>window.riderEditor.selected.length===2);
  await key('c',['Control']);e=await ed();assert.deepEqual(e.clipboard,{objects:2,connections:0});
  await hover([30,8]);r=e.revision;await key('v',['Control']);e=await revision(r+1);d=await doc();
  assert.deepEqual(obj(d,'o7').anchors.map(a=>a.mode),obj(course,'o2').anchors.map(a=>a.mode));assert.deepEqual(obj(d,'o8').params,obj(course,'o5').params);
  await key('z',['Control']);await revision(r+2);
  await key('Escape');await at([14,2]);await page.waitForFunction(()=>window.riderEditor.selection==='o2');
  const pre=await paths();await button('mirror_right');e=await revision(r+3);d=await doc();const post=await paths();
  const xs=pre.o2.map(p=>p[0]),c2=Math.round((Math.min(...xs)+Math.max(...xs))*2)/2,x1=Math.max(...xs),shift=Math.ceil((x1+1-(c2-x1))*2)/2;
  const m=obj(d,e.selected[0]),src=obj(course,'o2');
  m.anchors.forEach((a,i)=>{const b=src.anchors[src.anchors.length-1-i];
   assert.ok(nearPoint(a.p,[c2-b.p[0]+shift,b.p[1]])&&nearPoint(a.in,[-b.out[0],b.out[1]])&&nearPoint(a.out,[-b.in[0],b.in[1]]),JSON.stringify([a,b]));});
  post[m.id].forEach((p,i)=>{const o=pre.o2[pre.o2.length-1-i];assert.ok(nearPoint(p,[c2-o[0]+shift,o[1]],1e-9),JSON.stringify([p,o]));});
  await key('z',['Control']);await revision(r+4);
  done('persistence_copy_paste_mirror');

  // 8. Step (Claudio's LE5a drive test): a riser and a 4 m tread; Mirror puts the riser at the other end.
  // An LE5a (version 3) Step is a bare riser and opens unchanged as tread 0 (no R1 conflict).
  await key('Escape');await key('p');await key('3');const s0=(await paths()).o6.at(-1);await place([s0[0]+0.1,s0[1]+0.1],'o6');
  d=await doc();const step=d.objects.at(-1);assert.deepEqual(step.params,{riser:'start',height:0.5,length:4});
  assert.deepEqual((await paths())[step.id],[s0,[s0[0],s0[1]+0.5],[s0[0]+4,s0[1]+0.5]]);
  const v3={schema:1,units:'metres',id:'le5a-step',name:'LE5a step',spawn:[0,1],start_speed:0,run_in:0,run_out:0,bounds:[-10.68,20,-10,21.68],
   chains:[[[10,0.5],[10,0],[0,0]]],hulls:[],labels:[],checkpoints:[],
   editor:{editor_version:3,compiler_version:3,revision:2,compiled_revision:2,next_id:3,objects:[{id:'o1',type:'prefab',kind:'flat',at:[0,0],params:{length:10}},{id:'o2',type:'prefab',kind:'step',at:[10,0],params:{height:0.5}}],
    connections:[{from:'o1',to:'o2'}],start:{position:[0,1],speed:0}}};
  e=await importText(JSON.stringify(v3),'le5a-step.json');assert.equal(e.conflict,false,e.conflict);d=await doc();
  assert.deepEqual(obj(d,'o2').params,{height:0.5,length:0,riser:'start'});assert.equal(d.editor_version,8);
  // The riser's exit end selects the step (its ends take precedence over its 0.5 m edge).
  await frame();await key('s');await at([10,0.4]);await page.waitForFunction(()=>window.riderEditor.selection==='o2');
  await button('mirror_right');d=await doc();assert.deepEqual(d.objects.at(-1).params,{height:-0.5,length:0,riser:'end'});
  done('step_tread_and_le5a_steps');

  // 8b. Compiler 6 (drive test: a longer six-anchor curve hit the render budget): every chord of a curved segment
  // is the longest that fits 5 mm / 0.5 m, where compilers 4-5 halved segments into power-of-two parts (152
  // chords for this curve). A version 5 file whose compiled data claims its revision opens upgraded without an
  // R1 conflict; its compiled data is out of date and Play compiles it again.
  const auto=pts=>pts.map((p,i)=>{const a=pts[i-1]||p,b=pts[i+1]||p,k=(i===0||i===pts.length-1)?2:1;const t=[(b[0]-a[0])/6*k,(b[1]-a[1])/6*k];
   return {p,in:i===0?[0,0]:[-t[0],-t[1]],out:i===pts.length-1?[0,0]:t,mode:'smooth'};});
  const long={id:'o1',type:'curve',anchors:auto([[0,0],[6,4],[12,-2],[18,5],[24,0],[30,3]])};
  // A nearly flat curve whose two ends meet with a sliver between them (they share the rest), and its mirror
  // image about x = 55 (anchors reversed, tangents swapped with x negated): the samples must mirror exactly.
  const flat={id:'o2',type:'curve',anchors:auto([[40,0],[44,0.1],[50,0]])};
  const mirrored={id:'o3',type:'curve',anchors:flat.anchors.slice().reverse().map(a=>({p:[110-a.p[0],a.p[1]],in:[-a.out[0],a.out[1]],out:[-a.in[0],a.in[1]],mode:a.mode}))};
  const v5={schema:1,units:'metres',id:'le5b-long-curve',name:'Long curve',spawn:[2,6],start_speed:0,run_in:0,run_out:0,bounds:[-10.68,80,-12,25.68],
   chains:[[[30,3],[0,0]]],hulls:[],labels:[],checkpoints:[],
   editor:{editor_version:5,compiler_version:5,sampling:{tolerance:TOL,max_segment:SEG},revision:3,compiled_revision:3,next_id:4,objects:[long,flat,mirrored],connections:[],start:{position:[2,6],speed:0}}};
  e=await importText(JSON.stringify(v5),'le5b-long-curve.json');assert.equal(e.conflict,false,e.conflict);d=await doc();
  assert.equal(d.editor_version,8);assert.equal(d.compiler_version,8);assert.equal(d.compiled_revision,undefined);
  const lp=(await paths()).o1;measurements.long_curve=checkSampling(lp,curveDense(long));
  assert.ok(lp.length-1<=110,'longest-chord sampling: '+(lp.length-1)+' chords');
  const fp=(await paths()).o2,mp=(await paths()).o3;checkSampling(fp,curveDense(flat));
  assert.equal(fp.length,mp.length);fp.forEach((p,i)=>{const q=mp[mp.length-1-i];assert.ok(nearPoint(p,[110-q[0],q[1]],1e-9),JSON.stringify([p,q]));});
  done('compiler6_longest_chords_v5_upgrade');

  // 9. Reference course (protocol): Flat 20 m, Bump/wave 0.4 m x 10 m x 2, curve valley (anchors 40/0, 48/-1.2,
  // 56/0, horizontal tangents 8/3 m, smooth), Flat 24 m, FINISH at x 74; preset A, START 6 m/s, full throttle
  // (a fresh press after each start; coasting would stop the buggy within about 12 m), no brake or lean; Play
  // and two Retries. Window x 19-57 m (both wheels across every compiled point of the hill and valley). Pass:
  // one chain, FINISH every run, full throttle on every window step, no wheel support loss, never both wheels
  // unloaded, |delta vy| per 1/60 s step at most 0.25 m/s, the window crossed in the same number of steps (+/-1;
  // FINISH times also include when the first throttle press lands after a world load). A seam bump would show
  // as a support loss or a step spike (A18 rule, adapted). The hill is gentle on purpose: at about 7 m/s a
  // 0.6 m x 8 m wave (crest radius 5.4 m) needs nearly 1 g and unloaded the rear wheel in a trial run.
  const ref={schema:1,units:'metres',id:'smooth-hill',name:'Smooth hill reference',editor:{editor_version:4,compiler_version:4,sampling:{tolerance:TOL,max_segment:SEG},revision:1,next_id:5,
   objects:[{id:'o1',type:'prefab',kind:'flat',at:[0,0],params:{length:20}},{id:'o2',type:'prefab',kind:'wave',at:[20,0],params:{height:0.4,wavelength:10,count:2}},
    {id:'o3',type:'curve',anchors:[{p:[40,0],in:[0,0],out:[8/3,0],mode:'smooth'},{p:[48,-1.2],in:[-8/3,0],out:[8/3,0],mode:'smooth'},{p:[56,0],in:[-8/3,0],out:[0,0],mode:'smooth'}]},
    {id:'o4',type:'prefab',kind:'flat',at:[56,0],params:{length:24}}],
   connections:[{from:'o1',to:'o2'},{from:'o2',to:'o3'},{from:'o3',to:'o4'}],start:{position:[2,0.9],speed:6},finish:{position:[74,0.5],direction:1}}};
  // A level file without compiled data opens as a source-only copy: compiled fields come from the import.
  e=await importText(JSON.stringify({...ref,spawn:[2,0.9],start_speed:6,run_in:0,run_out:0,bounds:[-10,90,-12,21],chains:[[[80,0],[0,0]]],hulls:[],labels:[],checkpoints:[]}),'smooth-hill.json');
  assert.ok(e.message.startsWith('Imported'),e.message);assert.equal(e.chains,1);
  await page.evaluate(()=>{window.riderTrackWindow=[19,57];});
  const runs=[];
  await key('e');let t=await played('smooth-hill');
  for(let i=0;i<3;i++){
   if(i>0){await page.keyboard.up('ArrowUp');await key('r');}
   await page.waitForTimeout(100);await page.keyboard.down('ArrowUp');
   await page.waitForFunction(i=>window.riderTelemetry?.finish_done&&window.riderTrack?.window?.passed&&window.riderTelemetry.reset_count===i,i,{timeout:20000});
   t=await page.evaluate(()=>({tm:window.riderTelemetry,track:window.riderTrack}));
   const w=t.track.window;
   runs.push({unpowered_ticks:w.unpowered,finish_time:t.tm.finish_time,window_ticks:w.ticks,support_losses:w.losses,airborne:w.airborne,max_dvy_mps:w.dvy,max_vx_drop_mps:w.dvx_drop,vx_min:w.vx_min,vx_max:w.vx_max});
  }
  for(const run of runs){
   assert.equal(run.unpowered_ticks,0,JSON.stringify(runs));
   assert.deepEqual(run.support_losses,[0,0],JSON.stringify(runs));assert.equal(run.airborne,0,JSON.stringify(runs));
   assert.ok(run.max_dvy_mps<=0.25,JSON.stringify(runs));assert.ok(run.window_ticks>60,JSON.stringify(runs));
  }
  assert.ok(Math.max(...runs.map(x=>x.window_ticks))-Math.min(...runs.map(x=>x.window_ticks))<=1,JSON.stringify(runs));
  await page.keyboard.up('ArrowUp');
  const level=await page.evaluate(()=>window.riderSavedLevel);assert.equal(level.chains.length,1);
  measurements.reference={chain_points:level.chains[0].length,runs};
  await key('e');e=await edit();
  done('smooth_hill_reference_drive');

  // 10. Budgets (R7/R16): sprites of the reference course and the editor GUI nodes with a curve selected.
  await frame();await at([48,-1.2]);await page.waitForFunction(()=>window.riderEditor.selection==='o3');e=await ed();
  assert.ok(e.overlay.nodes<=e.overlay.max_nodes&&e.overlay.lines<=64&&e.overlay.handles<=192,JSON.stringify(e.overlay));
  measurements.budget={edit_sprites:e.view.sprites,chain_points:measurements.reference.chain_points,gui_nodes:e.overlay.nodes,max_nodes:e.overlay.max_nodes};
  done('budgets');

  await page.screenshot({path:path.join(out,'curve-reference.png')});
  fs.writeFileSync(path.join(out,'curve-result.json'),JSON.stringify({source_sha:sha,run_id:runId,browser:browser.version(),status:'PASS',cases,measurements},null,2));
  console.log(JSON.stringify({status:'PASS',cases,measurements}));
 }catch(e){
  if(errors.length)console.error('Page errors:\n'+errors.join('\n'));
  console.error('Last console lines:\n'+logs.join('\n'));
  if(browser)for(const context of browser.contexts())for(const page of context.pages()){
   console.error('State: '+JSON.stringify(await page.evaluate(()=>({editor:window.riderEditor&&{...window.riderEditor,buttons:undefined,library:undefined},doc:window.riderEditorDoc&&{objects:window.riderEditorDoc.objects?.slice(0,12),connections:window.riderEditorDoc.connections?.slice(0,12)},
    track:window.riderTrack,telemetry:window.riderTelemetry&&{finish_done:window.riderTelemetry.finish_done,finish_time:window.riderTelemetry.finish_time,reset_count:window.riderTelemetry.reset_count}})).catch(()=>null)));
   await page.screenshot({path:path.join(out,'curve-failed.png')}).catch(()=>{});
  }
  throw e;
 }
 finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
