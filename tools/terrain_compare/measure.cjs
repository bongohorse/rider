// Local P1 observation; existing owner, mobile/Box2D telemetry and normal input only.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require('playwright'),pointer=require('../gym/pointer.cjs');
const [bundleArg,outArg]=process.argv.slice(2),out=path.resolve(outArg);fs.mkdirSync(out,{recursive:true});
function find(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory()){const f=find(p);if(f)return f;}else if(e.name==='index.html')return p;}}
const web=path.dirname(find(path.resolve(bundleArg)));
const stats=v=>{assert.ok(v.length,'No observation samples');const a=[...v].sort((x,y)=>x-y),q=f=>a[Math.ceil(a.length*f)-1];return {n:a.length,p50:q(.5),p95:q(.95),p99:q(.99),max:a.at(-1)};};
function probes(){
 const p=window.__terrainObservation={frames:[],polls:[],world:[],draws:0};
 for(const proto of [window.WebGLRenderingContext?.prototype,window.WebGL2RenderingContext?.prototype].filter(Boolean))for(const name of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced']){const fn=proto[name];if(fn)proto[name]=function(...a){p.draws++;return fn.apply(this,a);};}
 let world;Object.defineProperty(window,'riderWorld',{configurable:true,get:()=>world,set:v=>{world=v;p.world.push({at:performance.now(),data:v});}});
 const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>raf(ts=>{const m=window.riderMobile;if(m&&!m.__terrainObservation){const fn=m.poll;m.poll=(dt,physics)=>{p.polled=true;p.polls.push({at:performance.now(),physics,dt});return fn(dt,physics);};m.__terrainObservation=true;}p.polled=false;const at=performance.now(),draws=p.draws;try{cb(ts);}finally{p.frames.push({at,work:performance.now()-at,draws:p.draws-draws,polled:p.polled});}});
}
(async()=>{
 const errors=[],report={schema:1,status:'INCOMPLETE',protocol:{warmup_ms:1000,sample_ms:6000,viewport:[1280,720],dpr:1,physics:'existing 60 Hz owner, default preset A'},results:[],views:[],errors};let browser;
 const server=http.createServer((q,r)=>{const file=path.resolve(web,'.'+new URL(q.url,'http://localhost').pathname);if(!file.startsWith(web+path.sep)||!fs.existsSync(file)){r.writeHead(404);return r.end();}r.setHeader('Content-Type',file.endsWith('.wasm')?'application/wasm':file.endsWith('.js')?'text/javascript':'application/octet-stream');if(file.endsWith('.html'))r.setHeader('Content-Type','text/html');fs.createReadStream(file).pipe(r);});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  browser=await chromium.launch();report.browser=browser.version();const base='http://127.0.0.1:'+server.address().port+'/index.html';
  async function open(query,viewport={width:1280,height:720}){
   const ctx=await browser.newContext({viewport,deviceScaleFactor:1}),page=await ctx.newPage();await page.addInitScript(probes);
   page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(m.text()))errors.push(m.text());});
   await page.goto(base+query);await page.waitForFunction(()=>window.riderTerrainCompare&&window.riderTelemetry?.sequence>2,null,{timeout:30000});
   const initial=await page.evaluate(()=>({stats:window.riderTerrainCompare,telemetry:window.riderTelemetry,load:window.riderLoad,ready:window.riderReady}));
   assert.equal(initial.telemetry.preset,'a');assert.equal(initial.telemetry.modified,false);assert.equal(initial.telemetry.time_factor,1);assert.equal(initial.telemetry.time_scaled_ticks,0);
   return {ctx,page,initial};
  }
  // Alternating old/new order reduces a systematic cold-first advantage; all routes are the saved P0 files.
  for(const [ci,course] of ['six-anchor','long-curves','mixed'].entries())for(const look of ci%2?['depth','sprites','flat']:['sprites','flat','depth']){
   const {ctx,page,initial}=await open('?course='+course+'&look='+look);
   if(!report.source_sha){report.source_sha=initial.telemetry.source_sha||initial.ready.source_sha;report.identity=await page.evaluate(()=>{const g=document.createElement('canvas').getContext('webgl2'),i=g.getExtension('WEBGL_debug_renderer_info');return {user_agent:navigator.userAgent,renderer:i&&g.getParameter(i.UNMASKED_RENDERER_WEBGL),timer_query_available:!!g.getExtension('EXT_disjoint_timer_query_webgl2'),cross_origin_isolated:crossOriginIsolated};});}
   const expected=course==='six-anchor'?670:course==='mixed'?712:700;assert.equal(initial.telemetry.terrain_shapes,expected-4);
   const fixture=JSON.parse(fs.readFileSync(path.join('docs/terrain-p0',course+'.json'),'utf8'));
   assert.equal(initial.telemetry.spawn_x,fixture.spawn[0]);assert.equal(initial.telemetry.spawn_y,fixture.spawn[1]);
   await page.locator('canvas').focus();await page.keyboard.down('ArrowUp');await page.waitForTimeout(1000);const from=await page.evaluate(()=>performance.now());await page.waitForTimeout(6000);await page.keyboard.up('ArrowUp');
   const raw=await page.evaluate(from=>{const p=window.__terrainObservation;return {frames:p.frames.filter(f=>f.at>=from&&f.polled),polls:p.polls.filter(f=>f.at>=from),world:p.world.filter(f=>f.at>=from),telemetry:window.riderTelemetry,stats:window.riderTerrainCompare,wasm_bytes:HEAPU8.length};},from);
   assert.ok(raw.world.length>0);assert.equal(raw.world.at(-1).data.shapes,expected);assert.equal(raw.telemetry.time_scaled_ticks,0);
   const retries=[];
   for(let i=0;i<3;i++){
    const before=await page.evaluate(()=>window.riderTelemetry.reset_count);await page.keyboard.down('r');await page.waitForFunction(n=>window.riderTelemetry.reset_count>n,before);await page.keyboard.up('r');await pointer.frames(page);
    const t=await page.evaluate(()=>({telemetry:window.riderTelemetry,stats:window.riderTerrainCompare}));assert.equal(t.telemetry.session_generation,initial.telemetry.session_generation);assert.equal(t.telemetry.world_loads,initial.telemetry.world_loads);assert.deepEqual(t.stats,initial.stats);retries.push(t.telemetry.reset_count);
   }
   const intervals=raw.polls.slice(1).map((p,i)=>p.at-raw.polls[i].at);
   report.results.push({course,look,initial,summary:{interval_ms:stats(intervals),callback_ms:stats(raw.frames.map(f=>f.work)),webgl_calls:stats(raw.frames.map(f=>f.draws)),physics_ms:stats(raw.polls.map(p=>p.physics)),over25:intervals.filter(v=>v>25).length},last_world:raw.world.at(-1).data,wasm_capacity_bytes:raw.wasm_bytes,retries,collision_input_sha256:crypto.createHash('sha256').update(JSON.stringify({chains:fixture.chains,hulls:fixture.hulls,two_sided:fixture.two_sided||null})).digest('hex'),raw});
   await page.screenshot({path:path.join(out,course+'-'+look+'.png')});await ctx.close();console.log(course+' '+look+' '+JSON.stringify(report.results.at(-1).summary));
  }
  // Inspect difficult views on the same physical course, not a second camera/physics simulation.
  for(const look of ['flat','depth'])for(const view of ['tight','crest','descent','jump','reverse']){
   const {ctx,page,initial}=await open('?course=long-curves&look='+look+'&view='+view);
   await page.locator('canvas').focus();const key=view==='reverse'?'ArrowDown':'ArrowUp';
   if(['descent','jump','reverse'].includes(view)){
    await page.keyboard.down(key);try{
     await page.waitForFunction(view=>{const t=window.riderTelemetry;return view==='jump'?t.station_distance>13&&!t.contact1&&!t.contact2:view==='descent'?t.pitch<-.3&&t.station_distance>2:t.velocity_x< -100;},view,{timeout:15000});
    }finally{await page.keyboard.up(key);}
   }
   await page.screenshot({path:path.join(out,'view-'+view+'-'+look+'.png')});report.views.push({look,view,initial,telemetry:await page.evaluate(()=>window.riderTelemetry)});await ctx.close();
  }
  // Portrait is a browser aspect check, not physical-device evidence.
  for(const look of ['flat','depth']){
   const {ctx,page}=await open('?course=long-curves&look='+look+'&view=descent',{width:486,height:1080});
   await page.screenshot({path:path.join(out,'portrait-'+look+'.png')});assert.ok(await page.getByRole('button',{name:'Flat fill',exact:true}).isVisible());await ctx.close();
  }
  const {ctx,page}=await open('?course=mixed&look=depth&chunk=128');report.chunk128=await page.evaluate(()=>window.riderTerrainCompare);await ctx.close();
  assert.equal(report.results.length,9);assert.equal(report.views.length,10);assert.deepEqual(errors,[]);report.status='PASS';
 }catch(e){report.status='FAIL';report.failure=e.stack;throw e;}finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2)+'\n');if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
