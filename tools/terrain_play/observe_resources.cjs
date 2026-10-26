// Bounded #276 comparison using ordinary import, input, telemetry and WebGL calls.
// No physics mutation, debug command endpoint, new CI group or device/GPU-time claim.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process'),{chromium}=require('playwright'),{configure}=require('../gym/launch.cjs'),pointer=require('../gym/pointer.cjs');
const [bundleArg,outArg]=process.argv.slice(2),bundle=path.resolve(bundleArg),out=path.resolve(outArg),baseline=process.argv.includes('--baseline'),perspectiveProfile=process.argv.includes('--perspective-profile')||process.argv.includes('--authored-look'),large=process.argv.includes('--large'),authored=process.argv.includes('--authored-look');fs.mkdirSync(out,{recursive:true});
const sha=JSON.parse(fs.readFileSync(path.join(bundle,'bundle.json'))).source_sha;
execFileSync('python',['-c','import sys;sys.path.insert(0,"tools/gym");from bundle import verify_bundle;verify_bundle(sys.argv[1],sys.argv[2])',bundle,sha]);
function find(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory()){const f=find(p);if(f)return f;}else if(e.name==='index.html')return p;}}
function probe(){
 const p=window.__terrain={events:[],frames:[],uploads:[],live:new Map(),created:0,deleted:0};
 for(const proto of [window.WebGLRenderingContext?.prototype,window.WebGL2RenderingContext?.prototype].filter(Boolean)){
  const bound=new Map(),create=proto.createBuffer,del=proto.deleteBuffer,bind=proto.bindBuffer,data=proto.bufferData;
  proto.createBuffer=function(...a){const b=create.apply(this,a);p.created++;p.live.set(b,0);return b;};
  proto.deleteBuffer=function(b){if(p.live.delete(b))p.deleted++;return del.call(this,b);};
  proto.bindBuffer=function(t,b){bound.set(t,b);return bind.call(this,t,b);};
  proto.bufferData=function(t,d,...a){const b=bound.get(t);const bytes=typeof d==='number'?d:a.length>=3?a[2]*(d.BYTES_PER_ELEMENT||1):a.length>=2?(d.length-a[1])*(d.BYTES_PER_ELEMENT||1):d?.byteLength||0;if(b)p.live.set(b,bytes);p.uploads.push({at:performance.now(),target:t,bytes});return data.call(this,t,d,...a);};
 }
 for(const name of ['riderTerrainResources','riderReady']){let value;Object.defineProperty(window,name,{configurable:true,get:()=>value,set:v=>{value=v;p.events.push({name,at:performance.now(),data:v,owned:window.riderTerrainMeshLifecycle?.owned});}});}
 const raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>raf(t=>{const start=performance.now();try{cb(t);}finally{p.frames.push({at:start,ms:performance.now()-start});}});
}
(async()=>{let browser,server,page;const r={schema:1,status:'INCOMPLETE',source_sha:sha,observer_sha256:crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'),baseline,perspective_profile:perspectiveProfile,authored,large,viewport:[1280,720],dpr:1,loads:[],pan:[],camera:[],errors:[],unmeasured:['phone','physical GPU memory','GPU time']};try{
 const web=path.dirname(find(bundle));server=http.createServer((q,res)=>{const f=path.resolve(web,'.'+new URL(q.url,'http://localhost').pathname);if(!f.startsWith(web+path.sep)||!fs.existsSync(f)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',f.endsWith('.wasm')?'application/wasm':f.endsWith('.js')?'text/javascript':'text/html');fs.createReadStream(f).pipe(res);});await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 browser=await chromium.launch();r.browser=browser.version();page=await browser.newPage({viewport:{width:1280,height:720}});await configure(page,'terrain-residency','le6');await page.addInitScript(probe);
 page.on('pageerror',e=>r.errors.push(e.message));page.on('console',m=>{if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(m.text()))r.errors.push(m.text());});
 await page.goto('http://127.0.0.1:'+server.address().port+'/index.html?station=straight');await page.waitForFunction(()=>window.riderTelemetry?.sequence>2);assert.equal(await page.evaluate(()=>window.riderReady.source_sha),sha);
 r.identity=await page.evaluate(()=>{const gl=document.createElement('canvas').getContext('webgl2'),e=gl.getExtension('WEBGL_debug_renderer_info');return {renderer:e&&gl.getParameter(e.UNMASKED_RENDERER_WEBGL),isolated:crossOriginIsolated,user_agent:navigator.userAgent};});
 async function key(k){await page.keyboard.down(k);await pointer.frames(page);await page.keyboard.up(k);await pointer.frames(page);}
 async function snapshot(){return page.evaluate(()=>{const p=window.__terrain,h={},canvas=document.querySelector('canvas');for(const n of p.live.values())h[n]=(h[n]||0)+1;return {at:performance.now(),canvas:[canvas.width,canvas.height],projection:window.riderRoadProjection,terrain:window.riderTerrainResources,mesh:window.riderTerrainMesh,lifecycle:window.riderTerrainMeshLifecycle,telemetry:window.riderTelemetry,editor:window.riderEditor,webgl:{created:p.created,deleted:p.deleted,live:p.live.size,bytes:[...p.live.values()].reduce((a,b)=>a+b,0),histogram:h},wasm_bytes:typeof HEAPU8!=='undefined'?HEAPU8.length:null};});}
 async function load(d,label){
  const before=await page.evaluate(()=>({generation:window.riderTelemetry.session_generation,at:performance.now()}));
  await page.evaluate(body=>{window.riderCustom.open();document.querySelector('#rider-custom-text').value=body;[...document.querySelectorAll('#rider-custom-panel button')].find(x=>x.textContent==='Import text').click();},JSON.stringify(d));
  await page.waitForFunction(n=>window.riderCustomStatus==='Saved'&&window.riderTelemetry?.session_generation>n&&window.riderTelemetry.sequence>2,before.generation);await pointer.frames(page,{n:8});
  const s=await snapshot();const timing=await page.evaluate(t=>{const p=window.__terrain,event=p.events.find(x=>x.name==='riderReady'&&x.at>=t);return {ready_ms:event.at-t,frames:p.frames.filter(x=>x.at>=t&&x.at<=event.at)};},before.at);
  assert.equal(s.telemetry.terrain_shapes,d.chains.reduce((n,c)=>n+c.length-1,0)+(d.hulls||[]).length);assert.equal(s.mesh.budget.stride,perspectiveProfile?48:36);assert.equal(s.projection?.mode||null,perspectiveProfile?'perspective':null);assert.equal(await page.evaluate(()=>typeof window.riderRoadLook),'undefined');r.loads.push({label,...s,timing});return s;
 }
 const names=['six-anchor','long-curves','mixed',...(large?['mixed-over-budget']:[])];
 const sources=Object.fromEntries(names.map(n=>{const d=JSON.parse(fs.readFileSync('docs/'+(n.endsWith('over-budget')?'terrain-p5':'terrain-p0')+'/'+n+'.json'));if(perspectiveProfile)d.editor.road_profile='perspective-v1';if(authored){d.editor.road_profile='authored-v1';d.editor.road_look={version:1,params:{version:1,mode:'perspective',width:.9,perspective:.35,angle:Math.atan(.55)*180/Math.PI,side:64,shading:1}};d.editor.objects.filter(o=>['line','curve','prefab'].includes(o.type)).forEach((o,i)=>o.road_look={version:1,width:i%2?2:.25,side:i%2?.25:64,shading:i%2?0:1});}return [n,d];}));
 for(const [name,d] of Object.entries(sources)){
  for(let i=0;i<5;i++)await load(d,name+'-'+i);
  await page.locator('canvas').focus();await page.keyboard.down('ArrowUp');await page.waitForTimeout(8000);await page.keyboard.up('ArrowUp');r.camera.push({label:name+'-drive',...await snapshot()});
  const before=await page.evaluate(()=>window.riderTelemetry);await key('r');await page.waitForFunction(n=>window.riderTelemetry.reset_count>n,before.reset_count);const after=await snapshot();assert.equal(after.telemetry.session_generation,before.session_generation);r.camera.push({label:name+'-retry',...after});
  await key('e');await page.waitForFunction(()=>window.riderEditor?.mode==='edit'&&window.riderEditor.screen);await key('Home');await pointer.frames(page,{n:8});r.pan.push({label:name+'-fit',...await snapshot()});
  await page.mouse.move(650,200);await pointer.frames(page);const fit=await snapshot(),at=await page.evaluate(()=>performance.now());
  for(const dx of [10,-10]){await page.mouse.move(650,200);await page.mouse.down({button:'middle'});await pointer.frames(page);await page.mouse.move(650+dx,200,{steps:4});await pointer.frames(page);await page.mouse.up({button:'middle'});await pointer.frames(page);}
  await key('Home');const still=await snapshot();assert.equal(still.editor.view.meshes,fit.editor.view.meshes);
  if(perspectiveProfile)assert.equal(still.projection.uploads,fit.projection.uploads);
  {const sizes=new Set(fit.terrain.entries.filter(e=>e.allocated).map(e=>e.bytes));assert.ok(sizes.size>0);for(const size of sizes)assert.ok(fit.webgl.histogram[size]>0,'No actual terrain VB of charged size');const uploads=await page.evaluate(at=>window.__terrain.uploads.filter(x=>x.at>=at&&x.target===34962),at);assert.equal(uploads.filter(x=>sizes.has(x.bytes)).length,0,'Ordinary pan uploaded terrain buffers');assert.equal(fit.terrain.counts.visible,fit.terrain.entries.length);}
  r.pan.push({label:name+'-no-rebuild-fit',...still});
  await page.mouse.move(650,360);for(let i=0;i<12;i++){await page.mouse.wheel(0,-120);await pointer.frames(page);}
  r.pan.push({label:name+'-zoom-in',...await snapshot()});
  for(const [dx,dy] of [...Array.from({length:12},()=>[-280,0]),[-280,-150],[-280,150],...Array.from({length:24},()=>[280,0]),[280,150],[280,-150],...Array.from({length:12},()=>[-280,0])]){
   await page.mouse.move(650,360);await page.mouse.down({button:'middle'});await pointer.frames(page);
   for(let i=1;i<=8;i++){await page.mouse.move(650+dx*i/8,360+dy*i/8);await pointer.frames(page,{n:1});}
   await page.mouse.up({button:'middle'});await pointer.frames(page,{n:5});r.pan.push({label:name+'-pan-'+dx+','+dy,...await snapshot()});
  }
  await page.screenshot({path:path.join(out,name+'-pan.png')});await key('Home');await pointer.frames(page,{n:8});r.pan.push({label:name+'-reset-fit',...await snapshot()});
  for(const size of [{width:1920,height:480},{width:720,height:1280},{width:1280,height:720}]){await page.setViewportSize(size);await pointer.frames(page,{n:8});r.pan.push({label:name+'-resize-'+size.width,...await snapshot()});}
  await page.screenshot({path:path.join(out,name+'-fit.png')});await key('e');await page.waitForFunction(()=>window.riderEditor.mode==='play'&&window.riderTelemetry.sequence>2);
 }
 for(const c of [{name:'descent',spawn:[244,18.9],speed:5,key:'ArrowUp',condition:()=>window.riderTelemetry.pitch<-.3&&window.riderTelemetry.station_distance>2},{name:'jump',spawn:[282,.9],speed:7,key:'ArrowUp',condition:()=>window.riderTelemetry.station_distance>13&&!window.riderTelemetry.contact1&&!window.riderTelemetry.contact2},{name:'reverse',spawn:[12,.9],speed:0,key:'ArrowDown',condition:()=>window.riderTelemetry.velocity_x< -100}]){
  const d=structuredClone(sources['long-curves']);d.spawn=c.spawn;d.start_speed=c.speed;d.editor.start={position:c.spawn,speed:c.speed};await load(d,c.name);
  await page.locator('canvas').focus();await page.keyboard.down(c.key);try{await page.waitForFunction(c.condition,null,{timeout:15000});await page.screenshot({path:path.join(out,c.name+'.png')});r.camera.push({label:c.name,...await snapshot()});}finally{await page.keyboard.up(c.key);}
 }
 r.events=await page.evaluate(()=>window.__terrain.events);r.frames=await page.evaluate(()=>window.__terrain.frames);
 if(!baseline){
  const events=r.events.filter(x=>x.name==='riderTerrainResources');assert.ok(events.length>20,'No residency transition evidence');
  for(const x of events){const s=x.data,c=s.counts,allocated=s.entries.filter(e=>e.allocated);assert.equal(c.allocated,allocated.length);assert.equal(x.owned,c.allocated);assert.ok(c.cached<=2);assert.equal(c.bytes,allocated.reduce((n,e)=>n+e.bytes,0));
   for(const e of s.entries){const a=e.bounds,b=s.view;if(a[0]<=b[2]+.005&&a[2]>=b[0]-.005&&a[1]<=b[3]+.005&&a[3]>=b[1]-.005)assert.ok(e.allocated&&e.enabled,'Missing incoming '+e.key);}
  }
  // Validate against the editor's actual projected pixel mapping too, independently of our view math.
  for(const x of r.pan){const s=x.editor.screen,[w,h]=x.canvas,b=[-s.ox/s.ppm_x,-s.oy/s.ppm_y,(w-s.ox)/s.ppm_x,(h-s.oy)/s.ppm_y];
   for(const e of (x.projection?.entries||x.terrain.entries)){const a=e.bounds;if(a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1])assert.ok(e.allocated&&e.enabled,'Actual projected viewport is missing '+e.key+' at '+x.label);}
  }
 }
 for(const x of [...r.pan,...r.camera,...r.loads])if(x.projection){const p=x.projection,c=p.counts;assert.equal(c.allocated,p.entries.filter(e=>e.allocated).length);assert.ok(c.cached<=2);for(const e of p.entries){const a=e.bounds,b=p.view;if(a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1])assert.ok(e.allocated&&e.enabled,'Current projected viewport missing '+e.key+' at '+x.label);}}
 assert.deepEqual(r.errors,[]);r.status='PASS';
}catch(e){r.status='FAIL';r.failure=e.stack;if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw e;}finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(r,null,2)+'\n');if(browser)await browser.close();server?.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
