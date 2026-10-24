// #272: bounded, local-only cost observation using the existing le6/le1b probes.
// No runtime edits, limits overrides, injected physics or CI registration.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {chromium}=require('playwright');
const {configure}=require('./launch.cjs'),pointer=require('./pointer.cjs'),ui=require('./editor_ui_target.cjs');
const [bundleArg,outArg]=process.argv.slice(2),bundle=path.resolve(bundleArg),out=path.resolve(outArg);
fs.mkdirSync(out,{recursive:true});
const deadline=setTimeout(()=>{console.error('Terrain observation exceeded 240 s');process.exit(1);},240000);
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
execFileSync('python',['-c','import sys;sys.path.insert(0,"tools/gym");from bundle import verify_bundle;verify_bundle(sys.argv[1],sys.argv[2])',bundle,sha]);
function find(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory()){const v=find(p);if(v)return v;}else if(e.name==='index.html')return p;}}
const web=path.dirname(find(bundle));
const stats=v=>{if(!v.length)return null;const s=[...v].sort((a,b)=>a-b),q=f=>s[Math.ceil(s.length*f)-1];return {n:s.length,p50:q(.5),p95:q(.95),p99:q(.99),max:s.at(-1)};};
function auto(pts){return pts.map((p,i)=>{const a=pts[i-1]||p,b=pts[i+1]||p,k=(i===0||i===pts.length-1)?2:1,t=[(b[0]-a[0])*k/6,(b[1]-a[1])*k/6];return {p,in:i===0?[0,0]:t.map(x=>-x),out:i===pts.length-1?[0,0]:t,mode:'smooth'};});}
function lua(v){return Array.isArray(v)?'{'+v.map(lua).join(',')+'}':v&&typeof v==='object'?'{'+Object.entries(v).map(([k,x])=>'['+JSON.stringify(k)+']='+lua(x)).join(',')+'}':JSON.stringify(v);}
function fixture(id,mixed=false){
 const six=id==='six-anchor',curves=six?[[[0,0],[66,4],[132,-2],[198,5],[264,0],[330,3]]]:[0,120,240].map(x=>[[x,0],[x+24,2],[x+48,-2],[x+72,2],[x+96,-2],[x+120,0]]);
 const objects=curves.map((pts,i)=>({id:'o'+(i+1),type:'curve',anchors:auto(pts)})),connections=curves.slice(1).map((_,i)=>({from:'o'+(i+1),to:'o'+(i+2)}));
 if(mixed){for(let i=0;i<12;i++){const x=20+i*27,y=-6;objects.push({id:'o'+(objects.length+1),type:'hull',vertices:[[x,y],[x+2,y],[x+2,y+1],[x,y+1]]});}for(let i=0;i<6;i++)objects.push({id:'o'+(objects.length+1),type:'label',text:'P0 prop '+i,position:[20+i*54,5]});}
 return {schema:1,units:'metres',id:'p0-'+id,name:'P0 '+id,spawn:[2,2],start_speed:0,run_in:0,run_out:0,bounds:[-10,400,-20,30],chains:[[[10,0],[0,0]]],hulls:[],labels:[],checkpoints:[],editor:{editor_version:7,compiler_version:7,revision:1,next_id:objects.length+1,sampling:{tolerance:.005,max_segment:.5},objects,connections,start:{position:[2,2],speed:0},finish:{position:[six?325:355,six?3:0],direction:1}}};
}
// The same observation boundaries as sizes.cjs, plus the existing editor publication.
function probes(){
 const p=window.__p0={frames:[],polls:[],ready:[],world:[],editor:[],telemetry:[],editorCount:0};
 for(const [name,list] of [['riderReady',p.ready],['riderWorld',p.world],['riderEditor',p.editor],['riderTelemetry',p.telemetry]]){let value;Object.defineProperty(window,name,{configurable:true,get:()=>value,set:v=>{value=v;if(name==='riderEditor')p.editorCount++;list.push({at:performance.now(),data:v});if(list.length>3000)list.shift();}});}
 const raf=window.requestAnimationFrame.bind(window);
 window.requestAnimationFrame=cb=>raf(ts=>{const m=window.riderMobile;if(m&&!m.__p0){const poll=m.poll;m.poll=(dt,physics)=>{p.polled=true;p.polls.push({at:performance.now(),dt:dt*1000,physics});return poll(dt,physics);};m.__p0=true;}p.polled=false;const start=performance.now(),before=p.editorCount;try{cb(ts);}finally{p.frames.push({at:start,work:performance.now()-start,polled:p.polled,engine_edit:p.editorCount!==before});}});
}
(async()=>{
 const server=http.createServer((req,res)=>{const file=path.resolve(web,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(web+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',file.endsWith('.wasm')?'application/wasm':file.endsWith('.js')?'text/javascript':'text/html');fs.createReadStream(file).pipe(res);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 const report={schema:1,source_sha:sha,run_id:'terrain-p0-'+Date.now(),status:'INCOMPLETE',fixtures:[],errors:[],protocol:{repeats:5,warmup_ms:1000,sample_ms:6000,viewport:[1280,720],dpr:1},unmeasured:['phone','isolated sampler CPU','GPU time','draw calls','total process/GPU memory','engine-wide GameObject pool census']};
 try{
  browser=await chromium.launch();report.browser=browser.version();
  async function pageFor(testcase){const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});const page=await context.newPage();await configure(page,report.run_id,testcase);await page.addInitScript(probes);page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(m.text()))report.errors.push(m.text());});return page;}
  let page=await pageFor('le6');
  await page.goto('http://127.0.0.1:'+server.address().port+'/index.html?station=straight');
  await page.waitForFunction(()=>window.riderTelemetry?.sequence>2);
  report.identity=await page.evaluate(()=>{const gl=document.createElement('canvas').getContext('webgl2'),info=gl?.getExtension('WEBGL_debug_renderer_info');let a=performance.now(),b=a;while(a===b)b=performance.now();return {user_agent:navigator.userAgent,renderer:info&&gl.getParameter(info.UNMASKED_RENDERER_WEBGL),cross_origin_isolated:crossOriginIsolated,clock_step_ms:b-a,viewport:window.riderViewport};});
  const ed=()=>page.evaluate(()=>window.riderEditor);
  const canvas=(x,y)=>page.evaluate(([x,y])=>{const c=document.querySelector('canvas'),r=c.getBoundingClientRect();return {x:r.x+x/c.width*r.width,y:r.y+(1-y/c.height)*r.height};},[x,y]);
  async function key(k){await page.keyboard.down(k);await pointer.frames(page);await page.keyboard.up(k);await pointer.frames(page);}
  async function button(name){await ui.reveal(page,name);const e=await ed();assert.ok(e.visible.includes(name),name+' not visible');await pointer.tap(page,await canvas(e.buttons[name].x,e.buttons[name].y));}
  async function editReady(){await page.waitForFunction(()=>window.riderEditor?.mode==='edit'&&window.riderEditor.view&&window.riderEditor.screen);}
  async function playReady(){await page.waitForFunction(()=>window.riderEditor?.mode==='play'&&window.riderTelemetry?.sequence>2&&window.riderTelemetry.session_generation===window.riderLoad?.generation);}
  async function measureAction(action,ready,kind){const t=await page.evaluate(()=>({at:performance.now(),generation:window.riderEditor.view.generation,reset:window.riderTelemetry.reset_count}));await action();await ready();return page.evaluate(({t,kind})=>{const p=window.__p0,event=kind==='play'?p.ready.find(x=>x.at>=t.at):kind==='edit'?p.editor.find(x=>x.at>=t.at&&x.data.mode==='edit'&&x.data.view?.generation>t.generation):p.telemetry.find(x=>x.at>=t.at&&x.data.reset_count>t.reset);if(!event)throw Error('Missing '+kind+' endpoint');const f=p.frames.filter(x=>x.at>=t.at&&x.at<=event.at);return {event_ms:event.at-t.at,observer_upper_ms:performance.now()-t.at,callback_max_ms:Math.max(0,...f.map(x=>x.work))};},{t,kind});}
  await page.locator('canvas').focus();await key('e');await editReady();
  for(const id of ['six-anchor','long-curves','mixed']){
   const source=fixture(id,id==='mixed');fs.writeFileSync(path.join(out,id+'-source.json'),JSON.stringify(source,null,2)+'\n');fs.writeFileSync(path.join(out,id+'-source.lua'),'return '+lua(source)+'\n');
   await button('import');await page.waitForFunction(()=>window.riderCustom.visible);
   await page.locator('#rider-custom-file').setInputFiles({name:id+'.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(source))});await page.waitForFunction(()=>!window.riderCustom.visible);await page.waitForTimeout(1100);await editReady();
   const e=await ed();assert.equal(e.conflict,false);assert.equal(e.errors.length,0,JSON.stringify(e.errors));
   const geometry=await page.evaluate(()=>({doc:window.riderEditorDoc,paths:window.riderEditorPaths,view:window.riderEditor.view,overlay:window.riderEditor.overlay}));
   const downloadPromise=page.waitForEvent('download');await button('export');const download=await downloadPromise,compiled=JSON.parse(fs.readFileSync(await download.path(),'utf8'));await page.getByRole('button',{name:'Close export',exact:true}).click();await page.waitForTimeout(1100);
   fs.writeFileSync(path.join(out,id+'.json'),JSON.stringify(compiled)+'\n');
   const r={id,source_bytes:Buffer.byteLength(JSON.stringify(source)),export_bytes:Buffer.byteLength(JSON.stringify(compiled)),anchors:source.editor.objects.reduce((n,o)=>n+(o.anchors?.length||0),0),objects:source.editor.objects.length,segments:compiled.chains.reduce((n,c)=>n+c.length-1,0),chain_vertices:compiled.chains.reduce((n,c)=>n+c.length,0),chains:compiled.chains.length,hulls:compiled.hulls.length,hull_vertices:compiled.hulls.reduce((n,h)=>n+h.vertices.length,0),labels:compiled.labels.length,geometry,edit_to_play:[],play_to_edit:[],retry:[],drag:[]};report.fixtures.push(r);
   await page.screenshot({path:path.join(out,id+'-edit.png')});
   for(let i=0;i<5;i++){
    r.edit_to_play.push(await measureAction(()=>key('e'),playReady,'play'));assert.equal((await page.evaluate(()=>window.riderTelemetry)).station,compiled.id);
    r.runtime=await page.evaluate(()=>window.riderEditorRuntime);
    const before=await page.evaluate(()=>window.riderTelemetry.reset_count);r.retry.push(await measureAction(()=>key('r'),()=>page.waitForFunction(n=>window.riderTelemetry.reset_count>n,before),'retry'));
    r.play_to_edit.push(await measureAction(()=>key('e'),editReady,'edit'));
   }
   // Select and centre the first curve through real UI, then drag its visible anchor.
   await button('object_select_o1');await button('view_centre');await pointer.frames(page);
   for(let i=0;i<5;i++){
    const e=await ed(),h=e.handles.find(h=>/^a\d+$/.test(h.name));assert.ok(h,'curve anchor handle');
    const a=await canvas(e.screen.ox+h.p[0]*e.screen.ppm_x,e.screen.oy+h.p[1]*e.screen.ppm_y);await page.mouse.move(a.x,a.y);await pointer.frames(page);await page.mouse.down();await pointer.frames(page);
    const from=await page.evaluate(()=>performance.now()),rev=(await ed()).revision;
    for(let step=1;step<=12;step++){await page.mouse.move(a.x,a.y-8*step/12);await pointer.frames(page,{n:1});}await page.mouse.up();await page.waitForFunction(n=>window.riderEditor.revision>n,rev);await editReady();
    r.drag.push(await page.evaluate(({from,rev})=>({observed_ms:performance.now()-from,first_preview_ms:window.__p0.editor.find(x=>x.at>=from&&/^anchor \d+:/.test(x.data.readout))?.at-from,commit_observed_ms:window.__p0.editor.find(x=>x.at>=from&&x.data.revision>rev).at-from,frames:window.__p0.frames.filter(f=>f.at>=from&&f.engine_edit).map(f=>({at:f.at-from,work:f.work})),view:window.riderEditor.view}),{from,rev}));
    await page.keyboard.down('Control');await pointer.frames(page);await key('z');await page.keyboard.up('Control');await pointer.frames(page);await editReady();assert.deepEqual(await page.evaluate(()=>window.riderEditorDoc.objects),geometry.doc.objects,'Undo restores the benchmark source');
   }
   r.edited_frames=stats(r.drag.flatMap(d=>d.frames.map(f=>f.work)));console.log(id+': '+r.segments+' segments, Edit/Play and drag captured');
  }
  await page.context().close();
  page=await pageFor('le1b');await page.goto('http://127.0.0.1:'+server.address().port+'/index.html?station=custom');await page.waitForFunction(()=>window.riderCustom?.visible);
  for(const r of report.fixtures){
   const body=fs.readFileSync(path.join(out,r.id+'.json'),'utf8');r.imports=[];
   for(let i=0;i<6;i++){
    if(!await page.evaluate(()=>window.riderCustom.visible))await page.evaluate(()=>window.riderCustom.open());
    const t=await page.evaluate(body=>{const p=window.__p0,before=p.ready.length,at=performance.now();document.querySelector('#rider-custom-text').value=body;[...document.querySelectorAll('#rider-custom-panel button')].find(x=>x.textContent==='Import text').click();return {at,before};},body);
    await page.waitForFunction(n=>window.__p0.ready.length>n,t.before);await page.waitForFunction(()=>window.riderCustomStatus==='Saved'&&window.riderLoad?.generation===window.riderTelemetry?.session_generation&&window.riderTelemetry.sequence>2);await page.waitForFunction(()=>window.riderCustom.syncState()!=='syncing');
    r.imports.push(await page.evaluate(t=>({ready_ms:window.__p0.ready[t.before].at-t.at,callback_max_ms:Math.max(...window.__p0.frames.filter(f=>f.at>=t.at&&f.at<=window.__p0.ready[t.before].at).map(f=>f.work)),lua:window.riderLoad,counts:{shapes:window.riderTelemetry.terrain_shapes,sprites:window.riderTelemetry.decor_sprites,labels:window.riderTelemetry.decor_labels}}),t));
   }
   assert.ok(r.imports.every(x=>x.counts.shapes===r.segments+r.hulls),'shape count');for(const x of r.imports)assert.deepEqual(x.counts,r.imports[0].counts,'stable repeated allocation');assert.equal(r.imports[0].counts.sprites,r.segments+r.hull_vertices+1);assert.equal(r.imports[0].counts.labels,r.labels+1);
   await page.locator('canvas').focus();await page.keyboard.down('ArrowUp');await page.waitForTimeout(1000);const from=await page.evaluate(()=>performance.now());await page.waitForTimeout(6000);await page.keyboard.up('ArrowUp');
   r.drive=await page.evaluate(from=>{const p=window.__p0,polls=p.polls.filter(x=>x.at>=from),frames=p.frames.filter(x=>x.at>=from&&x.polled),world=p.world.filter(x=>x.at>=from);return {polls:polls.map(x=>({...x,at:x.at-from})),frames:frames.map(x=>({...x,at:x.at-from})),world:world.map(x=>({...x,at:x.at-from})),telemetry:window.riderTelemetry,wasm_bytes:typeof HEAPU8!=='undefined'?HEAPU8.length:null};},from);
   const cdp=await page.context().newCDPSession(page);await cdp.send('Performance.enable');r.js_heap_metrics=(await cdp.send('Performance.getMetrics')).metrics.filter(m=>/^JSHeap/.test(m.name));await cdp.detach();
   r.summary={import_ms:stats(r.imports.slice(1).map(x=>x.ready_ms)),interval_ms:stats(r.drive.polls.slice(1).map((p,i)=>p.at-r.drive.polls[i].at)),callback_ms:stats(r.drive.frames.map(x=>x.work)),physics_ms:stats(r.drive.polls.map(x=>x.physics)),over25:r.drive.polls.slice(1).filter((p,i)=>p.at-r.drive.polls[i].at>25).length};
   await page.screenshot({path:path.join(out,r.id+'-drive.png')});console.log(r.id+': '+JSON.stringify(r.summary));
  }
  report.camera=[];
  for(const c of [{id:'descent',query:'ramps&section=down-30',key:'ArrowUp',condition:()=>window.riderTelemetry?.pitch<-.3},{id:'jump',query:'air&section=big',key:'ArrowUp',condition:()=>window.riderTelemetry?.station_distance>7&&!window.riderTelemetry.contact1&&!window.riderTelemetry.contact2},{id:'reverse',query:'straight',key:'ArrowDown',condition:()=>window.riderTelemetry?.velocity_x< -100}]){
   await page.goto('http://127.0.0.1:'+server.address().port+'/index.html?station='+c.query);await page.waitForFunction(()=>window.riderTelemetry?.sequence>2);await page.locator('canvas').focus();await page.keyboard.down(c.key);try{await page.waitForFunction(c.condition,null,{timeout:15000});await page.screenshot({path:path.join(out,'camera-'+c.id+'.png')});report.camera.push({id:c.id,query:c.query,telemetry:await page.evaluate(()=>window.riderTelemetry)});}finally{await page.keyboard.up(c.key);}
  }
  assert.deepEqual(report.errors,[]);assert.equal(report.fixtures.length,3);report.status='PASS';
 }catch(e){report.status='FAIL';report.failure=e.stack;throw e;}finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2)+'\n');if(browser)await browser.close();server.close();clearTimeout(deadline);}
})().catch(e=>{console.error(e);process.exitCode=1;});
