// Bounded #290 UI/projection/resource comparison; no simulation or camera-state injection.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process'),{chromium}=require('playwright'),{configure}=require('../gym/launch.cjs'),pointer=require('../gym/pointer.cjs');
const [bundleArg,launcherArg,outArg]=process.argv.slice(2),bundle=path.resolve(bundleArg),launcher=path.resolve(launcherArg),out=path.resolve(outArg);fs.mkdirSync(out,{recursive:true});
const quick=process.argv.includes('--quick');
const manifest=JSON.parse(fs.readFileSync(path.join(bundle,'bundle.json'))),sha=manifest.source_sha,debug=manifest.variant==='debug';
execFileSync('python',['-c','import json,sys;from pathlib import Path;sys.path.insert(0,"tools/gym");from bundle import inventory;p=Path(sys.argv[1]);d=json.loads((p/"bundle.json").read_text());assert d["comparison"]==290 and d["files"]==inventory(p)',bundle]);
const stats=v=>{const a=[...v].sort((a,b)=>a-b);return {n:a.length,p50:a[Math.ceil(a.length*.5)-1],p95:a[Math.ceil(a.length*.95)-1],max:a.at(-1)};};
function probe(){const p=window.__look={frames:[],uploads:[],buffers:new Map()};
 for(const proto of [window.WebGLRenderingContext?.prototype,window.WebGL2RenderingContext?.prototype].filter(Boolean)){
  const bind=proto.bindBuffer,data=proto.bufferData,del=proto.deleteBuffer,bound=new Map();
  proto.bindBuffer=function(t,b){bound.set(t,b);return bind.call(this,t,b);};
  proto.bufferData=function(t,d,...a){const b=bound.get(t),bytes=typeof d==='number'?d:a.length>=3?a[2]*(d.BYTES_PER_ELEMENT||1):a.length>=2?(d.length-a[1])*(d.BYTES_PER_ELEMENT||1):d?.byteLength||0;p.buffers.set(b,{target:t,bytes});p.uploads.push({at:performance.now(),target:t,bytes});return data.call(this,t,d,...a);};
  proto.deleteBuffer=function(b){p.buffers.delete(b);return del.call(this,b);};
 }
 const raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>raf(t=>{const at=performance.now();try{cb(t);}finally{p.frames.push({at,ms:performance.now()-at});}});
}
(async()=>{let browser,server,page,frame;const r={schema:1,status:'INCOMPLETE',source_sha:sha,variant:manifest.variant,quick,observer_sha256:crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'),trials:[],checks:[],views:[],errors:[],unmeasured:['physical phone/touch/app switching','hardware GPU time/memory','total process memory']};try{
 const web=path.join(bundle,'RiderG1');server=http.createServer((q,res)=>{const p=new URL(q.url,'http://localhost').pathname,root=p==='/perspective.html'||p.startsWith('/courses/')?launcher:web,f=path.resolve(root,'.'+p);if(!f.startsWith(root+path.sep)||!fs.existsSync(f)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',f.endsWith('.wasm')?'application/wasm':f.endsWith('.js')?'text/javascript':f.endsWith('.json')?'application/json':'text/html');fs.createReadStream(f).pipe(res);});await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 browser=await chromium.launch();r.browser=browser.version();
 async function open(course,start='start'){
  if(page)await page.context().close();const context=await browser.newContext({viewport:{width:1280,height:900}});page=await context.newPage();if(debug)await configure(page,'perspective-290','le6');await page.addInitScript(probe);
  page.on('pageerror',e=>r.errors.push(e.message));page.on('console',m=>{if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(m.text()))r.errors.push(m.text());});
  await page.goto('http://127.0.0.1:'+server.address().port+'/perspective.html?course='+course+'&start='+start);await page.waitForFunction(()=>document.querySelector('#status').dataset.ready==='true',null,{timeout:65000});frame=page.frames().find(f=>f.url().includes('/index.html'));await frame.waitForFunction(()=>window.riderRoadLook?.current&&window.riderTelemetry?.sequence>2);
  assert.equal(await frame.evaluate(()=>window.riderReady.source_sha),sha);return frame;
 }
 async function key(k){await frame.locator('canvas').focus();await page.keyboard.down(k);await pointer.frames(page,{n:3});await page.keyboard.up(k);await pointer.frames(page,{n:3});}
 async function snap(){return frame.evaluate(()=>{const p=window.__look;return {at:performance.now(),look:window.riderRoadLook.current,projection:window.riderRoadProjection,resources:window.riderTerrainResources,mesh:window.riderTerrainMesh,editor:window.riderEditor,telemetry:window.riderTelemetry,webgl_bytes:[...p.buffers.values()].reduce((n,b)=>n+b.bytes,0),buffers:p.buffers.size,wasm_bytes:typeof HEAPU8!=='undefined'?HEAPU8.length:null};});}
 async function mode(m){await page.locator('#mode-'+m).click();await frame.waitForFunction(m=>window.riderRoadLook.current.mode===m,m);await pointer.frames(page,{n:4});}
 function coverage(s){if(!debug)return;const p=s.projection;assert.ok(p&&p.stride===48);assert.ok(p.counts.cached<=2);assert.ok(p.counts.allocated<=p.sections);for(const e of p.entries){const a=e.bounds,b=p.view;if(a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1])assert.ok(e.allocated&&e.enabled,'Missing projected '+e.key);}}
 for(const course of quick?['long-curves']:['six-anchor','long-curves','mixed','mixed-over-budget']){
  await open(course);r.identity??=await frame.evaluate(()=>{const gl=document.createElement('canvas').getContext('webgl2'),x=gl.getExtension('WEBGL_debug_renderer_info');return {renderer:x&&gl.getParameter(x.UNMASKED_RENDERER_WEBGL),isolated:crossOriginIsolated,user_agent:navigator.userAgent};});
  const source=JSON.parse(fs.readFileSync(path.join(launcher,'courses',course+'.json'))),shapes=source.chains.reduce((n,c)=>n+c.length-1,0)+(source.hulls||[]).length;
  for(const m of ['fixed','perspective']){
   await mode(m);const before=await frame.evaluate(()=>window.riderTelemetry);await key('r');await frame.waitForFunction(n=>window.riderTelemetry.reset_count>n,before.reset_count);assert.equal((await snap()).telemetry.session_generation,before.session_generation);
   await frame.locator('canvas').focus();await page.keyboard.down('ArrowUp');await page.waitForTimeout(1000);const at=await frame.evaluate(()=>performance.now());await page.waitForTimeout(5000);await page.keyboard.up('ArrowUp');const s=await snap();coverage(s);assert.equal(s.telemetry.terrain_shapes,shapes);
   const work=await frame.evaluate(at=>window.__look.frames.filter(x=>x.at>=at).map(x=>x.ms),at);r.trials.push({course,mode:m,callback_ms:stats(work),state:s});
  }
  await page.screenshot({path:path.join(out,course+'-play.png')});
 }
 if(debug){
  await key('e');await frame.waitForFunction(()=>window.riderEditor?.mode==='edit'&&window.riderEditor.screen);await key('Home');await pointer.frames(page,{n:8});let s=await snap();coverage(s);assert.equal(s.projection.counts.visible,s.projection.sections,'Fit needs all sections');
  const start=await frame.evaluate(()=>({uploads:window.riderRoadProjection.uploads,at:performance.now(),source:JSON.stringify(window.riderEditorDoc)}));
  for(const [k,v] of [['width',1.5],['perspective',.65],['angle',35],['side',4],['shading',.7]]){await page.locator('#'+k+'-number').fill(String(v));await frame.waitForFunction(([k,v])=>window.riderRoadLook.current[k]===v,[k,v]);}
  await page.locator('#width').focus();await page.keyboard.press('ArrowRight');await frame.waitForFunction(()=>window.riderRoadLook.current.width===1.51);await page.locator('#width-number').fill('1.5');await frame.waitForFunction(()=>window.riderRoadLook.current.width===1.5);
  s=await snap();coverage(s);assert.equal(s.projection.uploads,start.uploads,'Uniform edits rebuilt meshes');
  await mode('fixed');await mode('perspective');assert.equal((await snap()).projection.uploads,start.uploads,'Mode switch rebuilt meshes');
  // Ordinary middle-drag around whole-course Fit; stay inside the all-sections view.
  const canvas=await frame.locator('canvas').boundingBox();
  for(const dx of [10,-10,10,-10,10,-10]){await page.mouse.move(canvas.x+canvas.width*.52,canvas.y+canvas.height*.5);await page.mouse.down({button:'middle'});await pointer.frames(page);await page.mouse.move(canvas.x+canvas.width*.52+dx,canvas.y+canvas.height*.5,{steps:4});await pointer.frames(page);await page.mouse.up({button:'middle'});await pointer.frames(page);coverage(await snap());}
  const end=await snap();assert.ok(end.projection.camera.every((v,i)=>Math.abs(v-s.projection.camera[i])<1e-5),'Reverse pan did not return to the same projected view');assert.equal(end.projection.uploads,start.uploads,'Camera pan rebuilt meshes');assert.equal(await frame.evaluate(()=>JSON.stringify(window.riderEditorDoc)),start.source,'Look controls edited source');
  const terrainSizes=new Set(end.projection.entries.map(e=>e.bytes).filter(Boolean));const uploads=await frame.evaluate(at=>window.__look.uploads.filter(x=>x.at>=at&&x.target===34962),start.at);assert.equal(uploads.filter(x=>terrainSizes.has(x.bytes)).length,0,'Camera/uniform controls uploaded terrain VBs');
  r.checks.push({name:'uniform_and_camera_no_rebuild',before:start.uploads,after:end.projection.uploads,observed_array_uploads:uploads,fit:end});
  await page.screenshot({path:path.join(out,'tuned-fit.png')});
  const normal={...end.look};
  for(const [k,v] of [['width',2],['perspective',1],['angle',45],['side',.25],['shading',0]]){await page.locator('#'+k+'-number').fill(String(v));await frame.waitForFunction(([k,v])=>window.riderRoadLook.current[k]===v,[k,v]);}
  for(const size of [{width:1920,height:540},{width:720,height:1280},{width:1280,height:900}]){await page.setViewportSize(size);await pointer.frames(page,{n:8});const x=await snap();coverage(x);r.checks.push({name:'max_settings_resize',size,projection:x.projection});}
  for(const [k] of [['width'],['perspective'],['angle'],['side'],['shading']]){await page.locator('#'+k+'-number').fill(String(normal[k]));await frame.waitForFunction(([k,v])=>window.riderRoadLook.current[k]===v,[k,normal[k]]);}
  // Existing import path must refuse the larger comparison layout before replacing the world/save.
  await key('e');await frame.waitForFunction(()=>window.riderEditor?.mode==='play'&&window.riderTelemetry?.sequence>2);
  const stable=await frame.evaluate(()=>window.riderTelemetry.session_generation),large=require('../gym/levels.cjs').cases().find(c=>c.id==='seg-1521').level;
  await frame.evaluate(body=>{window.riderCustom.open();document.querySelector('#rider-custom-text').value=body;[...document.querySelectorAll('#rider-custom-panel button')].find(b=>b.textContent==='Import text').click();},JSON.stringify(large));
  await frame.waitForFunction(()=>window.riderCustom.message.includes('terrain vertex payload'));
  assert.equal(await frame.evaluate(()=>window.riderTelemetry.session_generation),stable);await frame.evaluate(()=>window.riderCustom.close());r.checks.push({name:'comparison_payload_refusal_preserves_world'});

 }
 const chosen=await frame.evaluate(()=>window.riderRoadLook.current);await page.locator('#apply').click();await page.waitForFunction(()=>document.querySelector('#saved-state').textContent.includes('Retained'));
 await page.locator('#reset').click();await frame.waitForFunction(()=>window.riderRoadLook.current.mode==='fixed'&&window.riderRoadLook.current.width===.9);
 await page.locator('#reapply').click();await frame.waitForFunction(p=>Object.keys(p).every(k=>window.riderRoadLook.current[k]===p[k]),chosen);
 await page.reload();await page.waitForFunction(()=>document.querySelector('#status').dataset.ready==='true');frame=page.frames().find(f=>f.url().includes('/index.html'));await frame.waitForFunction(p=>Object.keys(p).every(k=>window.riderRoadLook.current[k]===p[k]),chosen);r.checks.push({name:'apply_reset_reapply_reload',params:chosen});
 await page.locator('summary').click();await page.locator('#settings').fill(JSON.stringify({...chosen,width:100}));await page.locator('#json-apply').click();await frame.waitForFunction(()=>window.riderRoadLook.status.includes('width must'));assert.deepEqual(await frame.evaluate(()=>window.riderRoadLook.current),chosen);r.checks.push({name:'invalid_params_preserve_current'});
 for(const view of quick?[]:['crest','descent','jump','landing','valley','reverse']){
  await open('long-curves',view);await frame.locator('canvas').focus();await page.keyboard.down(view==='reverse'?'ArrowDown':'ArrowUp');
  if(view==='descent')await frame.waitForFunction(()=>window.riderTelemetry.pitch<-.3&&window.riderTelemetry.station_distance>2);
  else if(view==='jump')await frame.waitForFunction(()=>window.riderTelemetry.station_distance>13&&!window.riderTelemetry.contact1&&!window.riderTelemetry.contact2);
  else if(view==='reverse')await frame.waitForFunction(()=>window.riderTelemetry.velocity_x< -100);
  else await page.waitForTimeout(1500);
  await page.keyboard.up(view==='reverse'?'ArrowDown':'ArrowUp');const s=await snap();coverage(s);r.views.push({view,state:s});await page.screenshot({path:path.join(out,view+'.png')});const n=s.telemetry.reset_count;await key('r');await frame.waitForFunction(n=>window.riderTelemetry.reset_count>n,n);assert.equal((await snap()).telemetry.session_generation,s.telemetry.session_generation);
 }
 assert.equal(r.trials.length,quick?2:8);assert.equal(r.views.length,quick?0:6);assert.deepEqual(r.errors,[]);r.status='PASS';
}catch(e){r.status='FAIL';r.failure=e.stack;if(frame)r.failure_state=await frame.evaluate(()=>({look:window.riderRoadLook,editor:window.riderEditor,telemetry:window.riderTelemetry})).catch(()=>null);if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw e;}finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(r,null,2)+'\n');if(browser)await browser.close();server?.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
