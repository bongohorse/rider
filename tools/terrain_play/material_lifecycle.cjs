'use strict';
// One variant/route, finite A→B→A cycles. Python owns the mandatory inventory and standard evidence envelope.
const fixture=require('./fixtures.cjs').loadFixtures(['six-anchor'])['six-anchor'];
const {installBufferObserver,bufferSnapshot}=require('./buffer_observer.cjs'),{CYCLES,checkRoute}=require('./material_lifecycle_check.cjs');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{configure}=require('../gym/launch.cjs'),pointer=require('../gym/pointer.cjs');
const [bundleArg,outArg,route,variant]=process.argv.slice(2),bundle=path.resolve(bundleArg),out=path.resolve(outArg);
assert(['legacy','perspective','textured'].includes(route));assert(['debug','release'].includes(variant));
assert(!fs.existsSync(out)||fs.readdirSync(out).length===0,'Output must be fresh');fs.mkdirSync(out,{recursive:true});
const manifest=JSON.parse(fs.readFileSync(path.join(bundle,'bundle.json'))),engine=JSON.parse(fs.readFileSync(path.join(__dirname,'../toolchain-lock.json'))).engine;
assert.equal(manifest.variant,variant);const guards=JSON.parse(fs.readFileSync(path.join(bundle,'engines.json')));assert.equal(guards.status,'PASS');
const indexes=Object.keys(manifest.files).filter(f=>f.endsWith('/index.html')||f==='index.html');assert.equal(indexes.length,1);
const web=path.dirname(path.join(bundle,indexes[0])),prefix=path.posix.dirname(indexes[0]);
const source=id=>{const d=JSON.parse(fixture);d.id='lifecycle-'+id;d.name='Material lifecycle '+id.toUpperCase();
 if(route!=='legacy')d.editor.road_profile='perspective-v1';return JSON.stringify(d);};
const bodies={a:source('a'),b:source('b')},runId='mat515-'+crypto.randomUUID();
(async()=>{let browser,server,page;const ready=[],logs=[],loadPromises=[],loadErrors=[];
 const r={schema_version:1,status:'FAIL',source_sha:manifest.source_sha,source_fingerprint:manifest.source_fingerprint,variant,route,
  engine,backend:engine.backend,platform:'wasm-web',run_id:runId,viewport:{width:1280,height:720},dpr:1,cycles:CYCLES,loads:[],errors:[],loaded_engines:[],
  source_hashes:Object.fromEntries(Object.entries(bodies).map(([k,v])=>[k,crypto.createHash('sha256').update(v).digest('hex')])),
  limits:'Explicit buffer API handles/payloads and ready-world event counts, not physical GPU memory/time. Loader world_loads is private; Retry uses unchanged generation, ready-event count and resource handles as independent reload evidence.'};
 try{
  server=http.createServer((req,res)=>{const f=path.resolve(web,'.'+new URL(req.url,'http://localhost').pathname);
   if(!f.startsWith(web+path.sep)||!fs.existsSync(f)){res.writeHead(404);return res.end();}
   res.setHeader('Content-Type',f.endsWith('.wasm')?'application/wasm':f.endsWith('.js')?'text/javascript':f.endsWith('.html')?'text/html':'application/octet-stream');fs.createReadStream(f).pipe(res);});
  await new Promise((ok,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',ok);});
  browser=await chromium.launch();r.browser=browser.version();page=await browser.newPage({viewport:r.viewport,deviceScaleFactor:1});
  await configure(page,runId,'mat515');await page.addInitScript(installBufferObserver);
  page.on('pageerror',e=>r.errors.push(e.message));page.on('console',m=>{
   const text=m.text();if(logs.length<200)logs.push(text);if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT|ERROR:GUI/.test(text))r.errors.push(text);
   const match=text.match(/RIDER_GYM\s+(\{.*\})/);if(match)try{
    const event=JSON.parse(match[1]);if(event.event==='vehicle_ready'){
     if(event.run_id!==runId||event.source_sha!==manifest.source_sha)r.errors.push('Foreign ready-world event');else ready.push(event);
    }
   }catch(error){r.errors.push(String(error));}
  });
  page.on('response',response=>{const f=new URL(response.url()).pathname.slice(1);if(!f.endsWith('.wasm'))return;
   loadPromises.push(response.body().then(body=>{const sha256=crypto.createHash('sha256').update(body).digest('hex'),relative=path.posix.join(prefix,f);
    assert.equal(sha256,manifest.files[relative]);assert(Object.values(guards.architectures).flat().some(x=>x.bundled===path.basename(f)&&x.sha256===sha256));
    r.loaded_engines.push({file:relative,sha256});}).catch(e=>loadErrors.push(String(e))));});
  await page.goto('http://127.0.0.1:'+server.address().port+'/index.html?station=straight'+(route==='textured'?'&terrain_material=grass':''));
  await page.waitForFunction(()=>window.riderTelemetry?.sequence>2,null,{timeout:30000});
  assert.equal(await page.evaluate(()=>window.riderReady.source_sha),manifest.source_sha);assert.equal(await page.evaluate(()=>devicePixelRatio),1);
  await Promise.all(loadPromises);assert.deepEqual(loadErrors,[]);assert(r.loaded_engines.length);
  async function snapshot(course){
   await pointer.frames(page,{n:5});
   const s=await page.evaluate(()=>({generation:window.riderTelemetry.session_generation,reset_count:window.riderTelemetry.reset_count,
    mesh:window.riderTerrainMesh??null,lifecycle:window.riderTerrainMeshLifecycle??null,projection:window.riderRoadProjection??null}));
   s.webgl=await page.evaluate(bufferSnapshot);s.course=course;s.world_ready_events=ready.length;return s;
  }
  async function load(course){
   const before=await page.evaluate(()=>window.riderTelemetry.session_generation);
   await page.evaluate(text=>{window.riderCustom.open();document.querySelector('#rider-custom-text').value=text;[...document.querySelectorAll('#rider-custom-panel button')].find(b=>b.textContent==='Import text').click();},bodies[course]);
   await page.waitForFunction(n=>window.riderCustomStatus==='Saved'&&window.riderTelemetry?.session_generation>n&&window.riderTelemetry.sequence>2,before,{timeout:30000});
   r.loads.push(await snapshot(course));
  }
  await load('a');for(let i=0;i<CYCLES;i++){await load('b');await load('a');}
  r.retry={before:await snapshot('a')};await page.locator('canvas').focus();await page.keyboard.down('r');
  try{await page.waitForFunction(n=>window.riderTelemetry.reset_count===n+1,r.retry.before.reset_count,{timeout:10000});}finally{await page.keyboard.up('r');}
  r.retry.after=await snapshot('a');r.summary=checkRoute(r);assert.deepEqual(r.errors,[]);r.status='PASS';console.log(JSON.stringify({status:r.status,variant,route,cycles:CYCLES,summary:r.summary}));
 }catch(e){r.failure=e.stack;if(page)await page.screenshot({path:path.join(out,'failed.png'),timeout:5000}).catch(()=>{});throw e;}
 finally{r.console=logs;fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(r,null,2)+'\n');if(browser)await browser.close();if(server)await new Promise(ok=>server.close(ok));}
})().catch(e=>{console.error(e);process.exitCode=1;});
