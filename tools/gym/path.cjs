// LE5c: Corner/Smooth points on existing terrain and Convert prefab to editable path in the debug HTML5 gym (level-editor contract R1, R4, R8, R16, R17).
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

  const chainOf=f=>JSON.stringify(f.chains);
  // 1. A triangular hill drawn with straight segments: Smooth at its peak rounds it through the same point
  // (a curve with the same id; every other point a corner); Corner restores the straight geometry exactly.
  await page.goto(base+'?station=straight');
  await page.waitForFunction(()=>window.riderTelemetry?.station==='straight'&&window.riderTelemetry.sequence>2);
  await page.locator('canvas').focus();await key('e');let e=await edit();
  await button('new');await page.waitForFunction(()=>window.riderEditor.id==='my-level-1');e=await saved();
  let d=await doc();assert.equal(d.editor_version,8);
  await frame();
  const hill=[[0,0],[5,0],[10,3],[15,0],[20,0]];
  await key('d');let r=(await ed()).revision;for(const p of hill)await at(p);await key('Enter');e=await revision(r+1);
  await key('s');await at([2.5,0]);await page.waitForFunction(()=>window.riderEditor.selection==='o1');
  const straightFile=JSON.parse(await exportFile());
  await at([10,3]);await page.waitForFunction(()=>window.riderEditor.vertex&&window.riderEditor.vertex.index===3);
  e=await ed();assert.ok(e.visible.includes('smooth'),e.visible.join(','));r=e.revision;
  await button('smooth');e=await revision(r+1);d=await doc();
  let o=obj(d,'o1');assert.equal(o.type,'curve');assert.deepEqual(o.anchors.map(a=>a.p),hill);
  assert.deepEqual(o.anchors.map(a=>a.mode),['corner','corner','smooth','corner','corner']);
  const l=Math.hypot(5,3)/3;assert.ok(nearPoint(o.anchors[2].in,[-l,0])&&nearPoint(o.anchors[2].out,[l,0]),JSON.stringify(o.anchors[2]));
  let pts=(await paths()).o1;
  assert.deepEqual(pts.slice(0,2),[[0,0],[5,0]]);assert.deepEqual(pts.slice(-2),[[15,0],[20,0]]);assert.ok(pts.some(p=>p[0]===10&&p[1]===3));
  const dense=[];for(let i=1;i<3;i++)for(let k=0;k<=200;k++)dense.push(bez(o.anchors[i],o.anchors[i+1],k/200));
  measurements.peak=checkSampling(pts.slice(1,-1),dense);
  assert.deepEqual(e.rows,['Anchor 3 tangents: smooth  (click)']);
  // Its tangent handle reshapes the rounding (the in tangent stays on one line).
  const oh=e.handles.find(h=>h.name==='o3').p;await drag(oh,[oh[0]+0.5,oh[1]-0.5]);e=await revision(r+2);o=obj(await doc(),'o1');
  const u=v=>{const n=Math.hypot(v[0],v[1]);return [v[0]/n,v[1]/n];};assert.ok(nearPoint(u(o.anchors[2].in),u(o.anchors[2].out).map(x=>-x)));
  const rounded=await doc();
  await key('z',['Control']);await revision(r+3);await key('y',['Control']);await revision(r+4);assert.equal(shape(await doc()),shape(rounded));
  // Undo/Redo drop the picked anchor: pick the peak again, then Make corner.
  await at([10,3]);await page.waitForFunction(()=>window.riderEditor.visible.includes('smooth'));
  await button('smooth');e=await revision(r+5);o=obj(await doc(),'o1');
  assert.deepEqual(o.anchors.map(a=>a.mode),Array(5).fill('corner'));assert.deepEqual((await paths()).o1,hill);
  assert.equal(chainOf(JSON.parse(await exportFile())),chainOf(straightFile));
  await key('z',['Control']);await revision(r+6);assert.equal(shape(await doc()),shape(rounded));
  // A double-click on a straight chord between two corners inserts a corner where it was clicked (within the
  // 1.5 px the mouse position is quantised to; evaluating the chord as a cubic would put it about 0.33 m off).
  await key('Escape');await at([2.5,0]);await page.waitForFunction(()=>window.riderEditor.selection==='o1');
  await hover([2.5,0]);for(let i=0;i<3;i++){await page.mouse.wheel(0,-120);await page.waitForTimeout(80);}
  await dblclick([1.2,0]);e=await revision(r+7);o=obj(await doc(),'o1');
  assert.equal(o.anchors.length,6);assert.equal(o.anchors[1].mode,'corner');
  assert.ok(o.anchors[1].p[1]===0&&near(o.anchors[1].p[0],1.2,1.5/e.screen.ppm_x),JSON.stringify([o.anchors[1],e.screen.ppm_x]));
  await hover([2.5,0]);for(let i=0;i<3;i++){await page.mouse.wheel(0,120);await page.waitForTimeout(80);}
  await key('z',['Control']);await revision(r+8);assert.equal(shape(await doc()),shape(rounded));
  done('triangle_hill_smooth_and_corner');

  // 2. A joint between two drawn lines: Smooth gives the upstream line the in tangent and the downstream line
  // the out tangent (both curves, same ids, connection kept). Dragging one tangent turns the other with it;
  // Corner restores both straight lines exactly.
  await key('Escape');await key('Escape');await key('d');r=(await ed()).revision;
  await at([20,6]);await at([25,9]);await at([25,9]);await revision(r+1);
  await at([25,9]);await at([30,6]);await at([30,6]);await revision(r+2);
  d=await doc();assert.deepEqual(d.connections,[{from:'o2',to:'o3'}]);
  await key('s');await at([25,9]);await page.waitForFunction(()=>window.riderEditor.selection==='o2');
  e=await ed();assert.equal(e.vertex.id,'o2');await button('smooth');e=await revision(r+3);d=await doc();
  const A=obj(d,'o2'),B=obj(d,'o3');assert.equal(A.type,'curve');assert.equal(B.type,'curve');assert.deepEqual(d.connections,[{from:'o2',to:'o3'}]);
  assert.equal(A.anchors[1].mode,'smooth');assert.equal(B.anchors[0].mode,'smooth');
  assert.ok(nearPoint(u(A.anchors[1].in),u(B.anchors[0].out).map(x=>-x)));
  await key('Escape');await at([27.5,7.5]);await page.waitForFunction(()=>window.riderEditor.selection==='o3');
  const bo=(await ed()).handles.find(h=>h.name==='o1').p;await drag(bo,[bo[0],bo[1]+0.5]);e=await revision(r+4);d=await doc();
  assert.ok(nearPoint(u(obj(d,'o2').anchors[1].in),u(obj(d,'o3').anchors[0].out).map(x=>-x)),'joint tangents stay on one line');
  await key('z',['Control']);await revision(r+5);
  await key('Escape');await at([22.5,7.5]);await page.waitForFunction(()=>window.riderEditor.selection==='o2');
  await at([25,9]);await page.waitForFunction(()=>window.riderEditor.visible.includes('smooth'));await button('smooth');e=await revision(r+6);
  pts=await paths();assert.deepEqual(pts.o2,[[20,6],[25,9]]);assert.deepEqual(pts.o3,[[25,9],[30,6]]);
  await key('z',['Control']);await revision(r+7);
  done('joint_smooth_and_corner');

  // 3. Corner/Smooth points survive save/reload, export -> import, copy/paste and Mirror.
  e=await saved();const course=await doc();
  await page.goto(base+'?station=custom');e=await edit();assert.equal(shape(await doc()),shape(course));
  const text=await exportFile();assert.equal(shape(JSON.parse(text).editor),shape(course));
  e=await importText(text,'paths.json');assert.equal(e.conflict,false);assert.equal(shape(await doc()),shape(course));
  await frame();await at([2.5,0]);await page.waitForFunction(()=>window.riderEditor.selection==='o1');
  r=(await ed()).revision;await key('c',['Control']);await hover([5,10]);await key('v',['Control']);e=await revision(r+1);d=await doc();
  const copy=obj(d,e.selected[0]);assert.deepEqual(copy.anchors.map(a=>a.mode),obj(course,'o1').anchors.map(a=>a.mode));
  await key('z',['Control']);await revision(r+2);
  await key('Escape');await at([2.5,0]);await page.waitForFunction(()=>window.riderEditor.selection==='o1');
  await button('mirror_right');e=await revision(r+3);d=await doc();
  const m=obj(d,e.selected[0]);assert.deepEqual(m.anchors.map(a=>a.mode),[...obj(course,'o1').anchors].reverse().map(a=>a.mode));
  await key('z',['Control']);await revision(r+4);
  done('persistence_copy_paste_mirror');

  // 4. Prefabs convert only after confirmation, keep shape and connections and lose their fields. A joint to a
  // prefab cannot be smoothed until that prefab is converted too. A Kicker + landing converts into two lines and
  // keeps its open gap; a Bump/wave keeps its samples. Undo restores the prefab.
  await key('Escape');await key('p');await key('2');await place([40,0]);
  const last=async()=>(await doc()).objects.at(-1).id;
  const ramp=await last();await key('1');await place([44.1,1.17],ramp);const flat=await last();
  await key('5');let x=(await paths())[flat].at(-1);await place([x[0]+0.1,x[1]+0.1],flat);const kicker=await last();
  await key('7');x=(await paths())[kicker].at(-1);await place([x[0]+0.1,x[1]+0.1],kicker);const wave=await last();
  await key('s');const prefabs=await doc(),before=await paths();e=await ed();const chains=e.chains;
  await at([42,0.5]);await page.waitForFunction(id=>window.riderEditor.selection===id,ramp);
  r=(await ed()).revision;await button('convert');e=await ed();assert.ok(e.message.includes("parameter fields and handles; its shape and connections stay"),e.message);
  assert.equal(e.revision,r);assert.equal(obj(await doc(),ramp).type,'prefab');
  await button('convert');e=await revision(r+1);d=await doc();
  assert.deepEqual(canon(obj(d,ramp)),canon({id:ramp,type:'line',points:before[ramp]}));assert.deepEqual(d.connections,prefabs.connections);assert.deepEqual(e.rows,[]);
  const j=before[ramp].at(-1);await at(j);await page.waitForFunction(()=>window.riderEditor.visible.includes('smooth'));
  await button('smooth');e=await ed();assert.ok(e.message.includes('Flat '+flat+' is a prefab: convert it to an editable path first'),e.message);assert.equal(e.revision,r+1);
  await key('Escape');await at([48,before[flat][0][1]]);await page.waitForFunction(id=>window.riderEditor.selection===id,flat);
  await button('convert');await button('convert');await revision(r+2);
  await at(j);await page.waitForFunction(()=>window.riderEditor.visible.includes('smooth'));await button('smooth');e=await revision(r+3);
  assert.equal(obj(await doc(),ramp).anchors.at(-1).mode,'smooth');
  const k=before[kicker];await key('Escape');await at([(k[0][0]+k[1][0])/2,(k[0][1]+k[1][1])/2]);await page.waitForFunction(id=>window.riderEditor.selection===id,kicker);
  await button('convert');await button('convert');e=await revision(r+4);d=await doc();
  const landing=d.objects.find(q=>q.id!==kicker&&q.type==='line'&&JSON.stringify(q.points)===JSON.stringify(k.slice(3)));
  assert.ok(landing,'landing line');assert.deepEqual(obj(d,kicker).points,k.slice(0,3));
  assert.ok(d.connections.some(c=>c.from===landing.id&&c.to===wave),JSON.stringify(d.connections));assert.equal(e.chains,chains);
  const w=before[wave];await key('Escape');await at(w[Math.floor(w.length/4)]);await page.waitForFunction(id=>window.riderEditor.selection===id,wave);
  // LE5d (Claudio, 2026-10-20: "a single smooth hill becomes a polyline with 65 editable anchors ... The desired
  // result is three curve anchors: start, peak and end"): a Bump/wave converts to a curve with the same id and
  // an anchor at each end, crest and trough (2 x count + 1), horizontal tangents, within 5 mm of its samples.
  await button('convert');await button('convert');e=await revision(r+5);d=await doc();
  const wc=obj(d,wave),w0=w[0],tl=0.364*4;
  assert.equal(wc.type,'curve');assert.deepEqual(wc.anchors.map(a=>a.p),[w0,[w0[0]+4,w0[1]+1],[w0[0]+8,w0[1]]]);
  assert.ok(wc.anchors.every((a,i)=>a.mode==='smooth'&&nearPoint(a.in,[i?-tl:0,0])&&nearPoint(a.out,[i<2?tl:0,0])),JSON.stringify(wc.anchors));
  let wdev=0;for(const q of curveDense(wc))wdev=Math.max(wdev,polyDist(q,w));assert.ok(wdev<=TOL,'wave deviation '+wdev);
  assert.deepEqual(d.connections.filter(c=>c.from===wave||c.to===wave),prefabs.connections.filter(c=>c.from===wave||c.to===wave).map(c=>c.from===kicker?{from:landing.id,to:wave}:c));
  for(let i=0;i<5;i++)await key('z',['Control']);await revision(r+10);assert.equal(shape(await doc()),shape(prefabs));
  measurements.convert={kicker_lines:2,chains,wave_samples:w.length,wave_anchors:3,wave_max_deviation_m:wdev};
  done('convert_prefab_to_path');

  await page.screenshot({path:path.join(out,'path-course.png')});
  fs.writeFileSync(path.join(out,'path-result.json'),JSON.stringify({source_sha:sha,run_id:runId,browser:browser.version(),status:'PASS',cases,measurements},null,2));
  console.log(JSON.stringify({status:'PASS',cases,measurements}));
 }catch(e){
  if(errors.length)console.error('Page errors:\n'+errors.join('\n'));
  console.error('Last console lines:\n'+logs.join('\n'));
  if(browser)for(const context of browser.contexts())for(const page of context.pages()){
   console.error('State: '+JSON.stringify(await page.evaluate(()=>({editor:window.riderEditor&&{...window.riderEditor,buttons:undefined,library:undefined},doc:window.riderEditorDoc&&{objects:window.riderEditorDoc.objects?.slice(0,12),connections:window.riderEditorDoc.connections?.slice(0,12)},
    track:window.riderTrack,telemetry:window.riderTelemetry&&{finish_done:window.riderTelemetry.finish_done,finish_time:window.riderTelemetry.finish_time,reset_count:window.riderTelemetry.reset_count}})).catch(()=>null)));
   await page.screenshot({path:path.join(out,'path-failed.png')}).catch(()=>{});
  }
  throw e;
 }
 finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
