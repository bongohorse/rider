// LE1b: custom level size, performance and world-switch measurement in the debug HTML5 gym.
// Uses the unchanged LE1a import path (pasted text) and never bypasses validation limits.
const {configure}=require('./launch.cjs');
const {cases,text}=require('./levels.cjs');
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const REPEATS=Number(process.env.LE1B_REPEATS||5),WARMUP_MS=1000,SAMPLE_MS=Number(process.env.LE1B_SAMPLE_MS||6000);
// Page-side probes, installed before the engine starts. They only observe:
// riderReady is written by the world in the same engine frame that makes the vehicle drive-ready;
// riderMobile.poll runs once per world update with (dt, Box2D step profile); rAF wraps the engine frame callback.
function probes(){
 const p=window.__le1b={ready:[],polls:[],frames:[],world:[]};
 for(const [name,list] of [['riderReady',p.ready],['riderWorld',p.world]]){
  let value;Object.defineProperty(window,name,{configurable:true,get:()=>value,set:v=>{value=v;list.push({at:performance.now(),data:v});}});
 }
 const raf=window.requestAnimationFrame.bind(window);
 window.requestAnimationFrame=cb=>raf(ts=>{
  const mobile=window.riderMobile;
  if(mobile&&!mobile.__le1b){const poll=mobile.poll;mobile.poll=(dt,physics)=>{p.polled=true;p.polls.push({at:performance.now(),dt:dt*1000,physics});return poll(dt,physics);};mobile.__le1b=true;}
  p.polled=false;const start=performance.now();
  try{cb(ts);}finally{if(p.polled)p.frames.push({start,work:performance.now()-start});}
 });
}
function stats(values){
 if(!values.length)return null;
 const s=[...values].sort((a,b)=>a-b),q=f=>s[Math.min(s.length-1,Math.ceil(s.length*f)-1)];
 return {n:s.length,mean:values.reduce((a,b)=>a+b,0)/values.length,p50:q(.5),p95:q(.95),p99:q(.99),max:s.at(-1)};
}
// Smallest step between distinct values: an observed resolution, not a promise of the clock.
function step(values){
 const u=[...new Set(values.filter(v=>v>0))].sort((a,b)=>a-b);let d=Infinity;
 for(let i=1;i<u.length;i++)d=Math.min(d,u[i]-u[i-1]);
 return {smallest_nonzero:u[0]??null,smallest_difference:Number.isFinite(d)?d:null,zero:values.filter(v=>v===0).length};
}
(async()=>{
 const [root,sha,runId]=process.argv.slice(2);const out=path.resolve(root);let browser;
 function find(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory()){const v=find(p);if(v)return v;}else if(e.name==='index.html')return p;}}
 const web=path.dirname(find(path.resolve(process.argv[6]))),errors=[],results=[];
 const server=http.createServer((req,res)=>{const file=path.resolve(web,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(web+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',file.endsWith('.wasm')?'application/wasm':file.endsWith('.js')?'text/javascript':'text/html');fs.createReadStream(file).pipe(res);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const started=Date.now();
 try{
  browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1280,height:720}});
  await configure(page,runId,process.argv[5]);await page.addInitScript(probes);
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{const t=m.text();if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(t))errors.push(t);});
  await page.goto('http://127.0.0.1:'+server.address().port+'/index.html?station=custom');
  await page.waitForFunction(()=>window.riderCustom?.visible&&window.riderStationError?.includes('No saved custom level'));
  const state=()=>page.evaluate(()=>window.riderTelemetry);
  let loads=1;
  // Trigger = the Import text click, timed in the same page task; drive-ready = the world's riderReady write.
  async function trigger(value){
   if(!await page.evaluate(()=>window.riderCustom.visible))await page.evaluate(()=>window.riderCustom.open());
   return page.evaluate(value=>{
    const field=document.querySelector('#rider-custom-text'),button=[...document.querySelectorAll('#rider-custom-panel button')].find(x=>x.textContent==='Import text');
    field.value=value;const before=window.__le1b.ready.length,at=performance.now();button.click();return {at,before};
   },value);
  }
  async function until(check,ms){
   const end=Date.now()+ms;
   for(;;){const v=await check();if(v)return v;if(Date.now()>end)throw Error('Timed out waiting for drive-ready or a page error');await new Promise(r=>setTimeout(r,50));}
  }
  // A validated level can still fail when the vehicle is placed: record the engine error as the outcome
  // (only the reset-pose guards; any other page error stays fatal) and let the next import prove recovery.
  const PLACEMENT=/vehicle\.lua:\d+: (Noncanonical reset pose|Reset velocity survived)/;
  async function load(c,value){
   const mark=errors.length,t=await trigger(value);loads++;
   const outcome=await until(async()=>errors.length>mark?'error':await page.evaluate(n=>window.__le1b.ready.length>n,t.before)&&'ready',60000);
   if(outcome==='error'){
    const error=errors.slice(mark).join('\n');
    if(!PLACEMENT.test(error))throw Error(error);
    errors.splice(mark);
    await page.waitForTimeout(3000);
    return {failed:error.match(PLACEMENT)[0],status:await page.evaluate(()=>window.riderCustomStatus),switch_ms:null};
   }
   await page.waitForFunction(({id,loads})=>window.riderTelemetry?.station===id&&window.riderTelemetry.world_loads===loads&&window.riderTelemetry.sequence>2&&window.riderCustomStatus==='Saved',{id:c.id,loads},{timeout:60000});
   return page.evaluate(({t})=>{
    const p=window.__le1b,ready=p.ready[t.before].at,tm=window.riderTelemetry,in_window=p.frames.filter(f=>f.start>=t.at&&f.start<=ready);
    return {switch_ms:ready-t.at,longest_frame_ms:Math.max(0,...in_window.map(f=>f.work)),frames:in_window.length,
     lua:{switch_ms:tm.switch_ms??null,parse_ms:tm.parse_ms??null,build_ms:tm.build_ms??null,decorate_ms:tm.decorate_ms??null},
     counts:{terrain_shapes:tm.terrain_shapes,decor_sprites:tm.decor_sprites,decor_labels:tm.decor_labels,custom_snapshots:tm.custom_snapshots}};
   },{t});
  }
  const identity=await page.evaluate(()=>{
   const gl=document.createElement('canvas').getContext('webgl2'),info=gl?.getExtension('WEBGL_debug_renderer_info');
   let a=performance.now(),b=a;while(b===a)b=performance.now();
   return {user_agent:navigator.userAgent,viewport:window.riderViewport,dpr:devicePixelRatio,cross_origin_isolated:window.crossOriginIsolated,
    performance_now_step_ms:b-a,gl_renderer:info?gl.getParameter(info.UNMASKED_RENDERER_WEBGL):null,gl_vendor:info?gl.getParameter(info.UNMASKED_VENDOR_WEBGL):null};
  });
  const all=cases();
  for(const c of all.filter(c=>c.expect==='accepted')){
   const body=text(c.level),first=await load(c,body),repeats=[];
   if(first.failed){
    results.push({id:c.id,dimension:c.dimension,length_m:c.length_m,start_m:c.level.spawn[0],segments:c.segments,chains:c.chains,hulls:c.hulls,render_objects:c.objects,
     text_bytes:Buffer.byteLength(body),outcome:'placement_failed',error:first.failed,save_status_after:first.status});
    console.log(c.id+': vehicle placement failed ('+first.failed+'); save status '+first.status);
    continue;
   }
   for(let i=0;i<REPEATS;i++)repeats.push(await load(c,body));
   const counts=repeats[0].counts;
   for(const r of [first,...repeats])assert.deepEqual(r.counts,counts,c.id+': counts changed between identical imports');
   assert.equal(counts.terrain_shapes,c.segments+c.hulls,c.id+': terrain shapes');
   assert.equal(counts.decor_sprites,c.objects,c.id+': decoration sprites');
   assert.equal(counts.custom_snapshots,1);
   // Fixed full-throttle window after a warm-up; samples come from the probes, not from wall-clock guesses.
   await page.locator('canvas').focus();await page.keyboard.down('ArrowUp');
   let window_;
   try{
    await page.waitForTimeout(WARMUP_MS);
    const from=await page.evaluate(()=>performance.now());
    await page.waitForTimeout(SAMPLE_MS);
    window_=await page.evaluate(from=>{
     const p=window.__le1b,to=performance.now(),polls=p.polls.filter(x=>x.at>=from&&x.at<=to),frames=p.frames.filter(x=>x.start>=from&&x.start<=to);
     return {from,to,intervals:polls.slice(1).map((x,i)=>x.at-polls[i].at),dt:polls.map(x=>x.dt),physics:polls.map(x=>x.physics),work:frames.map(x=>x.work),
      world:p.world.filter(x=>x.at>=from&&x.at<=to).map(x=>x.data),telemetry:window.riderTelemetry};
    },from);
   }finally{await page.keyboard.up('ArrowUp');}
   const memory=await page.evaluate(()=>{
    const slots={};
    for(const name of ['custom-level-a','custom-level-b']){try{const s=FS.stat('/data/.rider/'+name);slots[name]={bytes:s.size,mtime:+s.mtime};}catch(e){slots[name]=null;}}
    // Chrome's performance.memory is bucketed without extra flags, so the JS heap stays unknown.
    return {slots,wasm_bytes:typeof HEAPU8!=='undefined'?HEAPU8.length:null};
   });
   const newest=Object.values(memory.slots).filter(Boolean).sort((a,b)=>b.mtime-a.mtime)[0];
   const w=window_.world,last=w.at(-1)||{},physics=window_.physics,tm=window_.telemetry;
   const switches=repeats.map(r=>r.switch_ms);
   results.push({id:c.id,dimension:c.dimension,outcome:'drive_ready',length_m:c.length_m,start_m:c.level.spawn[0],segments:c.segments,chains:c.chains,hulls:c.hulls,render_objects:c.objects,text_bytes:Buffer.byteLength(body),
    save_bytes:newest?.bytes??null,counts,
    switch:{first_ms:first.switch_ms,repeats_ms:switches,median_ms:stats(switches).p50,worst_ms:stats(switches).max,longest_frame_ms:Math.max(...repeats.map(r=>r.longest_frame_ms)),
     lua:repeats.map(r=>r.lua)},
    frame:{interval_ms:stats(window_.intervals),work_ms:stats(window_.work),dt_ms:stats(window_.dt),over_25ms:window_.intervals.filter(v=>v>25).length,over_33ms:window_.intervals.filter(v=>v>100/3).length},
    physics:{step_ms:stats(physics),resolution:step(physics),pairs_ms:stats(w.map(x=>x.pairs_ms)),collide_ms:stats(w.map(x=>x.collide_ms)),solve_ms:stats(w.map(x=>x.solve_ms)),sensors_ms:stats(w.map(x=>x.sensors_ms)),
     contacts:stats(w.map(x=>x.contacts)),shapes:last.shapes??null,static_tree_height:last.static_tree_height??null},
    memory:{box2d_bytes:last.bytes??null,lua_kib:last.lua_kib??null,wasm_bytes:memory.wasm_bytes,js_heap:'unknown'},
    drive:{distance_m:tm.station_distance,top_speed_mps:tm.station_top_speed,resets:tm.reset_count,preset:tm.preset}});
   console.log(c.id+': switch median '+stats(switches).p50.toFixed(1)+' ms, worst '+stats(switches).max.toFixed(1)+' ms; frame p95 '+stats(window_.intervals)?.p95?.toFixed(2)+' ms; physics p95 '+stats(physics)?.p95?.toFixed(3)+' ms');
  }
  // Rejected limit cases: the running level, its world and its save stay unchanged.
  const before=await state();
  for(const c of all.filter(c=>c.expect==='rejected')){
   await page.evaluate(()=>{const e=document.querySelector('#rider-custom-error');if(e)e.textContent='';});
   await trigger(text(c.level));
   await page.waitForFunction(()=>document.querySelector('#rider-custom-error')?.textContent,null,{timeout:30000});
   const message=await page.locator('#rider-custom-error').textContent(),t=await state();
   if(c.reason)assert.equal(message,'Import failed: '+c.reason+'. The current level and its save are unchanged.');
   else assert.equal(message,'The level file is larger than 256 KiB. The current level and its save are unchanged.');
   assert.equal(t.station,before.station);assert.equal(t.world_loads,before.world_loads);
   results.push({id:c.id,dimension:c.dimension,expect:'rejected',render_objects:c.objects,text_bytes:Buffer.byteLength(text(c.level)),message,physics:'unknown (rejected before build)'});
  }
  const lua=results.flatMap(r=>r.switch?.lua||[]).flatMap(x=>[x.switch_ms,x.parse_ms,x.build_ms,x.decorate_ms]).filter(v=>v!==null);
  const report={source_sha:sha,run_id:runId,status:'PASS',browser:browser.version(),identity,preset:results[0].drive.preset,
   protocol:{repeats:REPEATS,warmup_ms:WARMUP_MS,sample_ms:SAMPLE_MS,trigger:'Import text click (pasted JSON), LE1a path',drive_ready:'riderReady write in the vehicle attach frame',
    input:'ArrowUp held from the end of the last repeat',lua_clock_values_whole_ms:lua.every(v=>Math.abs(v-Math.round(v))<1e-3)},
   elapsed_s:(Date.now()-started)/1000,results};
  if(errors.length)throw Error(errors.join('\n'));
  fs.writeFileSync(path.join(out,'sizes-result.json'),JSON.stringify(report,null,1));
  console.log(JSON.stringify({status:'PASS',levels:results.length,elapsed_s:report.elapsed_s}));
 }catch(e){
  if(errors.length)console.error('Page errors:\n'+errors.join('\n'));
  if(browser)for(const context of browser.contexts())for(const page of context.pages()){
   console.error('State: '+JSON.stringify(await page.evaluate(()=>({station:window.riderTelemetry?.station,world_loads:window.riderTelemetry?.world_loads,
    custom:window.riderCustom&&{visible:window.riderCustom.visible,state:window.riderCustom.state,message:window.riderCustom.message},status:window.riderCustomStatus,error:window.riderStationError})).catch(()=>null)));
   await page.screenshot({path:path.join(out,'sizes-failed.png')}).catch(()=>{});
  }
  throw e;
 }
 finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
