// #479 render interpolation, debug Gym case `interp479` (real Defold HTML5 debug build, real mouse taps and keys).
// Straight, a scripted per-tick drive (main/gym/interp_probe479.lua: full throttle for 240 ticks, then brake) is
// recorded with A21 at cap 60 and replayed at caps 60, 90, 120, 144, Unlimited and 30, switched by real taps on the
// FPS counter. Per window it checks:
// - the fixed-tick physics trace (all three bodies: position, angle, velocities) is identical to the cap-60 replay,
//   and every replay MATCHes;
// - at cap 60 the presented (visual) transforms equal the physics game objects bit for bit in every frame;
// - at every other cap the presentation is interpolated: the presented chassis x never steps backwards while
//   driving forward, and its per-frame step variance is reported next to the raw physics step of the same frames
//   (what the screen showed before #479); where the raw step is irregular, the presented step must be measurably
//   more even. The replay ghost stays with the presented car.
// A last pair of windows (scripted drive after Retry, cap 120) compares interpolation on and off (URL interp479=off)
// on the same physics trace, including the camera.
// Headless Chromium paces requestAnimationFrame at 60 Hz, so caps above 60 run at the browser rate; presented frames
// on a real display are not measured.
'use strict';
const assert=require('node:assert/strict');
const STATION='straight', DEFAULT_CAP=60, THROTTLE_TICKS=240;
// Tap order of the counter from 60 (fps_counter.lua): 90, 120, 144, Unlimited (0), 30, 60.
const CYCLE=[30,60,90,120,144,0];
const nextCap=cap=>CYCLE[(CYCLE.indexOf(cap)+1)%CYCLE.length];
// Analysis window: accelerating under full throttle, after the first half second.
const WINDOW={from:30,to:THROTTLE_TICKS};
// Declared before running. Irregular raw stepping: more than 2 % of the window's frames run another number of
// fixed ticks than the most common one. Then the presented step variance must be at most half the raw one.
const IRREGULAR_SHARE=0.02, SMOOTHER=0.5;
// Ghost and live car are drawn at the same tick fraction; a MATCH replay keeps them within the A21 position
// tolerance (0.05 m = 5 engine units). Without ghost interpolation they part by up to one tick of motion.
const GHOST_GAP_U=5;
const FIELDS=['x','y','a','vx','vy','w','rx','ry','ra','rw','fx','fy','fa','fw'];
// Part 3 emulates a 144 Hz display's frame callbacks (headless Chromium paces requestAnimationFrame at 60 Hz).
const REFRESH_HZ=144;
// Page init script: requestAnimationFrame callbacks fire on a 1/hz s grid (a timer, then a short busy wait to the
// exact time; a late frame fires at once). Only the callback cadence is emulated, not presentation.
function emulateRefresh(hz){
 const period=1000/hz;let queue=[],armed=false,last=performance.now(),target=0,id=0;
 function fire(){
  armed=false;
  while(performance.now()<target){/* wait for the emulated vsync */}
  const t=performance.now();last=target;
  const q=queue;queue=[];
  for(const cb of q){try{cb(t);}catch(e){setTimeout(()=>{throw e;});}}
 }
 function arm(){
  if(armed)return;armed=true;
  const now=performance.now();target=Math.max(last+period,now);
  setTimeout(fire,Math.max(0,target-now-2));
 }
 window.requestAnimationFrame=cb=>{queue.push(cb);arm();return ++id;};
 window.cancelAnimationFrame=()=>{};
}
function parseArgs(args){
 const usage='Usage: node tools/gym/interp479.cjs OUT SHA RUN_ID interp479 VERIFIED_DEBUG_BUNDLE';
 if(!Array.isArray(args)||args.length!==5||args.some(v=>typeof v!=='string'||!v)||args[3]!=='interp479')throw Error(usage);
 return {output:args[0],sha:args[1],runId:args[2],bundle:args[4]};
}
// Fixed-tick traces of one generation each, compared tick by tick on every field (exact).
function compareTraces(a,b,minTicks){
 assert(Array.isArray(a)&&Array.isArray(b),'Missing trace');
 const at=t=>new Map(t.map(s=>[s.tick,s]));
 const A=at(a),B=at(b);
 const ticks=Math.min(a.length,b.length);
 assert(ticks>=minTicks,`Trace too short: ${ticks} < ${minTicks}`);
 let max=0,first=null;
 for(let t=1;t<=ticks;t++){
  const p=A.get(t),q=B.get(t);
  assert(p&&q,'Trace gap at tick '+t);
  for(const f of FIELDS){
   assert(Number.isFinite(p[f])&&Number.isFinite(q[f]),`Missing ${f} at tick ${t}`);
   const d=Math.abs(p[f]-q[f]);
   if(d>max)max=d;
   if(d>0&&!first)first={tick:t,field:f,a:p[f],b:q[f]};
  }
 }
 return {ticks,max_difference:max,first_difference:first};
}
function steps(values){const s=[];for(let i=1;i<values.length;i++)s.push(values[i]-values[i-1]);return s;}
// Variance about the least-squares line over the frame index: the acceleration trend is not judder.
function detrendedVariance(a){
 const n=a.length;assert(n>=3,'Too few steps');
 let sx=0,sy=0,sxx=0,sxy=0;
 a.forEach((y,i)=>{sx+=i;sy+=y;sxx+=i*i;sxy+=i*y;});
 const b=(n*sxy-sx*sy)/(n*sxx-sx*sx),c=(sy-b*sx)/n;
 return a.reduce((v,y,i)=>v+(y-(c+b*i))**2,0)/n;
}
// One window of render frames (one generation, consecutive update() frames).
function analyse(frames,{from=WINDOW.from,to=WINDOW.to}={}){
 const w=frames.filter(f=>f.tick>=from&&f.tick<=to);
 assert(w.length>=30,'Too few frames in the window: '+w.length);
 // Consecutive frames of one generation: tick labels and engine ticks never go back.
 for(let i=1;i<w.length;i++)assert(w[i].gen===w[0].gen&&w[i].tick>=w[i-1].tick&&w[i].engine_tick>=w[i-1].engine_tick,'Frames out of order at '+i);
 const perFrame=steps(w.map(f=>f.engine_tick));
 const histogram={};for(const n of perFrame)histogram[n]=(histogram[n]||0)+1;
 const mode=+Object.entries(histogram).sort((x,y)=>y[1]-x[1])[0][0];
 const irregular=perFrame.filter(n=>n!==mode).length;
 const raw=steps(w.map(f=>f.px)),shown=steps(w.map(f=>f.qx));
 const ghost=w.filter(f=>f.gx!==false).map(f=>Math.abs(f.gx-f.qx));
 return {frames:w.length,ticks_per_frame:histogram,irregular_frames:irregular,irregular_share:irregular/perFrame.length,
  on:w.every(f=>f.on),off:w.every(f=>!f.on),exact_frames:w.filter(f=>f.exact).length,
  raw_step_variance_u2:detrendedVariance(raw),presented_step_variance_u2:detrendedVariance(shown),
  camera_step_variance_u2:detrendedVariance(steps(w.map(f=>f.cx))),
  screen_step_variance_u2:detrendedVariance(steps(w.map(f=>f.qx-f.cx))),
  presented_backward_steps:shown.filter(s=>s<0).length,presented_zero_steps:shown.filter(s=>s===0).length,
  raw_zero_steps:raw.filter(s=>s===0).length,min_presented_step_u:Math.min(...shown),
  u_min:Math.min(...w.map(f=>f.u)),u_max:Math.max(...w.map(f=>f.u)),
  ghost_frames:ghost.length,ghost_gap_max_u:ghost.length?Math.max(...ghost):null};
}
// Verdict for one cap window (a = analyse()).
function verifyWindow(cap,a){
 if(cap===DEFAULT_CAP){
  assert(a.off,'Interpolation ran at cap 60');
  assert.equal(a.exact_frames,a.frames,`Cap 60: ${a.frames-a.exact_frames} frames presented another transform than physics`);
  assert.equal(a.presented_step_variance_u2,a.raw_step_variance_u2,'Cap 60 presentation differs from physics');
  return {...a,verdict:'IDENTICAL'};
 }
 assert(a.on,'Interpolation off at cap '+cap);
 assert(a.u_min>=0&&a.u_max<=1,'Tick fraction outside 0..1');
 assert.equal(a.presented_backward_steps,0,`Cap ${cap}: presented chassis stepped backwards while driving forward`);
 if(a.ghost_frames)assert(a.ghost_gap_max_u<=GHOST_GAP_U,`Cap ${cap}: ghost ${a.ghost_gap_max_u} u away from the presented car`);
 if(a.irregular_share>IRREGULAR_SHARE){
  assert(a.presented_step_variance_u2<=SMOOTHER*a.raw_step_variance_u2,
   `Cap ${cap}: presented step variance ${a.presented_step_variance_u2} not below ${SMOOTHER} x raw ${a.raw_step_variance_u2}`);
  return {...a,verdict:'SMOOTHER'};
 }
 // Regular raw stepping (e.g. cap 30: exactly two ticks every frame): nothing to smooth; it must not get worse.
 assert(a.presented_step_variance_u2<=a.raw_step_variance_u2*1.1+1e-6,`Cap ${cap}: presentation less even than raw`);
 return {...a,verdict:'REGULAR_RAW'};
}
module.exports={parseArgs,compareTraces,detrendedVariance,analyse,verifyWindow,nextCap,emulateRefresh,STATION,WINDOW,THROTTLE_TICKS,GHOST_GAP_U,IRREGULAR_SHARE,SMOOTHER,REFRESH_HZ};
if(require.main===module){
 const {configure}=require('./launch.cjs');
 const pointer=require('./pointer.cjs');
 const {chromium}=require('playwright');
 const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
 const {output,sha,runId,bundle}=parseArgs(process.argv.slice(2));
 const out=path.resolve(output);fs.mkdirSync(out,{recursive:true});
 fs.rmSync(path.join(out,'interp479-result.json'),{force:true});
 const metadata=JSON.parse(fs.readFileSync(path.join(bundle,'bundle.json'),'utf8'));
 assert(metadata.variant==='debug'&&metadata.platform==='wasm-web'&&metadata.source_sha===sha,'Wrong Defold debug bundle');
 function find(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory()){const v=find(p);if(v)return v;}else if(e.name==='index.html')return p;}}
 const index=find(path.resolve(bundle));assert(index,'No Defold index.html in bundle');
 const web=path.dirname(index);
 const server=http.createServer((req,res)=>{
  const file=path.resolve(web,'.'+new URL(req.url,'http://localhost').pathname);
  if(!file.startsWith(web+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',file.endsWith('.wasm')?'application/wasm':file.endsWith('.js')?'text/javascript':file.endsWith('.json')?'application/json':'text/html');
  fs.createReadStream(file).pipe(res);
 });
 (async()=>{
  let browser,page;const errors=[],cases={},windows={},traces={};
  const watch=p=>{p.on('pageerror',e=>{if(errors.length<20)errors.push(e.message);});
   p.on('console',m=>{if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(m.text())&&errors.length<20)errors.push(m.text());});};
  try{
   await new Promise(r=>server.listen(0,'127.0.0.1',r));
   const base='http://127.0.0.1:'+server.address().port+'/index.html?station='+STATION;
   browser=await chromium.launch();
   const context=await browser.newContext({viewport:{width:1280,height:720}});
   page=await context.newPage();watch(page);
   await configure(page,runId,'interp479');
   const state=()=>page.evaluate(()=>({probe:window.riderInterp479??null,replay:window.riderReplay??null,counter:window.riderFpsCounter??null}));
   async function ready(cap){
    await page.waitForFunction(({sha,runId,cap})=>window.riderReady?.source_sha===sha&&window.riderReady?.run_id===runId&&
     window.riderInterp479?.frames>10&&window.riderInterp479.cap===cap&&window.riderReplay?.frames>10&&window.riderFpsCounter?.cap_seq>=1,
     {sha,runId,cap},{polling:100,timeout:30000});
   }
   // Engine pitfall 5: hold a key until the game acknowledges it, then release.
   async function press(key,until,arg){
    await page.keyboard.down(key);
    try{await page.waitForFunction(until,arg,{polling:50,timeout:10000});}
    finally{await page.keyboard.up(key);}
   }
   async function tapTo(cap){
    const before=(await state()).counter;
    await pointer.tap(page,await pointer.hudPoint(page,'fps'),{counter:'window.riderReplay.frames',label:'counter tap '+cap});
    await page.waitForFunction(({seq,cap})=>window.riderFpsCounter?.cap_seq>seq&&window.riderFpsCounter.cap===cap&&window.riderInterp479?.cap===cap,
     {seq:before.cap_seq,cap},{polling:50,timeout:5000});
   }
   const clear=()=>page.evaluate(()=>{window.riderInterp479Frames=[];window.riderInterp479Ticks=[];});
   // Copies one generation's frames and ticks once `ticks` fixed ticks of it have run.
   async function collect(gen,ticks){
    await page.waitForFunction(({gen,ticks})=>window.riderInterp479?.gen===gen&&window.riderInterp479.tick>=ticks,{gen,ticks},{polling:100,timeout:30000});
    return page.evaluate(gen=>({frames:(window.riderInterp479Frames||[]).filter(f=>f.gen===gen),
     ticks:(window.riderInterp479Ticks||[]).filter(t=>t.gen===gen)}),gen);
   }
   function keep(name,cap,data){
    const a=verifyWindow(cap,analyse(data.frames));
    windows[name]={cap,...a};traces[name]=data.ticks;
    fs.writeFileSync(path.join(out,`interp479-${name}-frames.json`),JSON.stringify(data.frames)+'\n');
    console.log('INTERP479_WINDOW '+JSON.stringify({name,cap,verdict:a.verdict,irregular_frames:a.irregular_frames,frames:a.frames,
     raw:a.raw_step_variance_u2,presented:a.presented_step_variance_u2,ghost_gap_max_u:a.ghost_gap_max_u}));
   }

   // 1. Fresh profile: cap 60, interpolation off. Record the scripted drive with A21 (B starts it with a Retry).
   await page.goto(base);await ready(DEFAULT_CAP);
   let s=await state();
   assert.equal(s.counter.cap,DEFAULT_CAP,'Default cap is not 60');assert.equal(s.probe.on,false,'Interpolation on at cap 60');
   await clear();
   await press('b',n=>window.riderReplay?.recording?.active&&window.riderReplay.resets===n+1,s.replay.resets);
   const recGen=(await state()).probe.gen;
   const recorded=await collect(recGen,THROTTLE_TICKS+90);
   await press('b',()=>window.riderReplay?.recording?.active===false);
   await page.waitForFunction(()=>window.riderReplay?.recording?.trailing===true,null,{polling:50,timeout:10000});
   const recording=(await state()).replay.recording;
   assert(recording.error===false&&recording.ticks>=THROTTLE_TICKS+90,'Recording too short or refused: '+JSON.stringify(recording));
   assert(recording.commands.throttle===THROTTLE_TICKS,'Recording is not the scripted drive: '+JSON.stringify(recording.commands));
   keep('record-60',DEFAULT_CAP,recorded);

   // 2. Replay at every cap. Taps switch the cap between replays (never during one).
   let cap=DEFAULT_CAP;
   const order=[60,90,120,144,0,30];
   for(const want of order){
    while(cap!==want){cap=nextCap(cap);await tapTo(cap);}
    s=await state();
    assert.equal(s.probe.on,cap!==DEFAULT_CAP,'Interpolation state does not follow cap '+cap);
    await clear();
    await press('g',n=>window.riderReplay?.play?.active&&window.riderReplay.resets===n+1,s.replay.resets);
    const gen=(await state()).probe.gen;
    await page.waitForFunction(()=>window.riderReplay?.play?.ended==='done',null,{polling:50,timeout:30000});
    const data=await collect(gen,recording.ticks);
    const play=(await state()).replay.play;
    assert.equal(play.verdict,'MATCH',`Replay at cap ${cap}: ${play.verdict}`);
    assert.equal(play.applied,recording.ticks,'Replay did not apply every recorded command');
    const name='replay-'+(cap===0?'unlimited':cap);
    keep(name,cap,data);
    windows[name].replay={verdict:play.verdict,max_position_m:play.max_position_m,max_angle_rad:play.max_angle_rad,mismatches:play.mismatches};
   }
   // Physics: every replay's fixed-tick trace equals the cap-60 replay's, exactly (and the recording's, reported).
   const ticks=recording.ticks;
   cases.physics_trace_vs_cap60={};
   for(const name of Object.keys(traces).filter(n=>n.startsWith('replay-'))){
    const c=compareTraces(traces['replay-60'],traces[name],ticks);
    assert.equal(c.max_difference,0,`${name}: fixed-tick trace differs from cap 60 at ${JSON.stringify(c.first_difference)}`);
    cases.physics_trace_vs_cap60[name]=c;
   }
   cases.record_vs_replay_60=compareTraces(traces['record-60'],traces['replay-60'],THROTTLE_TICKS+90);
   cases.replays=Object.fromEntries(Object.entries(windows).filter(([n])=>n.startsWith('replay-')).map(([n,w])=>[n,w.replay]));

   // 3. Emulated 144 Hz display: a new browser context whose requestAnimationFrame fires every 1/144 s (the engine,
   // its frame pacing, physics and interpolation are unchanged; the compositor still presents at its own rate, not
   // measured). Fresh profile, cap 60. At every cap the scripted drive runs after a Retry; its fixed-tick trace must
   // equal the cap-60 recording run's trace exactly, and the presentation is checked as in part 2.
   await context.close();
   const emulated=await browser.newContext({viewport:{width:1280,height:720}});
   await emulated.addInitScript(emulateRefresh,REFRESH_HZ);
   page=await emulated.newPage();watch(page);
   await configure(page,runId,'interp479');
   await page.goto(base);await ready(DEFAULT_CAP);
   async function scripted(name,expectOn){
    s=await state();assert.equal(s.probe.on,expectOn,'Unexpected interpolation state for '+name);
    await clear();
    await press('r',n=>window.riderReplay?.resets===n+1,s.replay.resets);
    const data=await collect((await state()).probe.gen,THROTTLE_TICKS+90);
    const a=analyse(data.frames);
    // Engine update callbacks per (game) second in the window: the cadence the cap and the emulated display give.
    const w=data.frames.filter(f=>f.tick>=WINDOW.from&&f.tick<=WINDOW.to);
    a.update_hz=(w.length-1)/w.slice(1).reduce((t,f)=>t+f.dt,0);
    const v=expectOn||cap===DEFAULT_CAP?verifyWindow(cap,a):a;
    if(!expectOn)assert.equal(a.exact_frames,a.frames,name+': off but not the physics transform');
    assert.equal(a.presented_backward_steps,0,name+': presented chassis stepped backwards');
    const c=compareTraces(traces['record-60'],data.ticks,THROTTLE_TICKS+90);
    assert.equal(c.max_difference,0,`${name}: fixed-tick trace differs from the cap-60 recording at ${JSON.stringify(c.first_difference)}`);
    windows[name]={cap,...v,physics_vs_record_60:c};
    fs.writeFileSync(path.join(out,`interp479-${name}-frames.json`),JSON.stringify(data.frames)+'\n');
    console.log('INTERP479_WINDOW '+JSON.stringify({name,cap,verdict:v.verdict||null,update_hz:a.update_hz,irregular_frames:a.irregular_frames,frames:a.frames,
     raw:a.raw_step_variance_u2,presented:a.presented_step_variance_u2,camera:a.camera_step_variance_u2,screen:a.screen_step_variance_u2}));
   }
   cap=DEFAULT_CAP;
   for(const want of [60,90,120,144,0,30]){
    while(cap!==want){cap=nextCap(cap);await tapTo(cap);}
    await scripted(`refresh${REFRESH_HZ}-cap-${cap===0?'unlimited':cap}`,cap!==DEFAULT_CAP);
   }
   // Interpolation off (URL interp479=off) at cap 144 on the same emulated display: what every cap drew before #479.
   while(cap!==144){cap=nextCap(cap);await tapTo(cap);}
   await page.screenshot({path:path.join(out,'interp479-144-on.png')});
   await page.goto(base+'&interp479=off');await ready(144);
   await scripted(`refresh${REFRESH_HZ}-cap-144-off`,false);
   const on=windows[`refresh${REFRESH_HZ}-cap-144`],off=windows[`refresh${REFRESH_HZ}-cap-144-off`];
   const pick=w=>({update_hz:w.update_hz,irregular_frames:w.irregular_frames,frames:w.frames,car_step_variance_u2:w.presented_step_variance_u2,
    camera_step_variance_u2:w.camera_step_variance_u2,screen_step_variance_u2:w.screen_step_variance_u2});
   cases.on_off_cap144={on:pick(on),off:pick(off)};
   // Off draws the raw physics step: the car moves unevenly in the world and on screen (against the camera, a damped
   // follower whose own step follows dt either way; its variance is reported, not judged).
   assert(on.presented_step_variance_u2<=SMOOTHER*off.presented_step_variance_u2,'Cap 144: car not smoother with interpolation on');
   assert(on.screen_step_variance_u2<=SMOOTHER*off.screen_step_variance_u2,'Cap 144: car on screen not smoother with interpolation on');
   cases.refresh=Object.fromEntries(Object.entries(windows).filter(([n])=>n.startsWith('refresh')).map(([n,w])=>[n,{cap:w.cap,verdict:w.verdict||null,
    update_hz:w.update_hz,ticks_per_frame:w.ticks_per_frame,raw_step_variance_u2:w.raw_step_variance_u2,presented_step_variance_u2:w.presented_step_variance_u2,
    physics_max_difference:w.physics_vs_record_60.max_difference}]));
   const t=(await state()).probe;
   assert.equal(t.off_inexact,0,'Interpolation off but presented transforms differ from physics');

   assert.equal(errors.length,0,'Defold errors: '+errors.join('; '));
   cases.windows=windows;
   const report={status:'PASS',source_sha:sha,build_source_fingerprint:metadata.source_fingerprint,run_id:runId,
    browser:browser.version(),platform:'real-debug-defold-html5-chromium-headless',station:STATION,cases,
    declared:{window_ticks:WINDOW,irregular_share:IRREGULAR_SHARE,smoother_factor:SMOOTHER,ghost_gap_u:GHOST_GAP_U},
    not_run:['real_display_above_60hz','presented_frames','Android_device','native_desktop'],
    emulated_refresh_hz:REFRESH_HZ,
    limitations:'Headless Chromium paces requestAnimationFrame at 60 Hz: in parts 1-2 caps 90/120/144/Unlimited run at the browser rate. Part 3 emulates the frame-callback cadence of a 144 Hz display in the page; frame steps are engine update callbacks, never presented frames.'};
   fs.writeFileSync(path.join(out,'interp479-result.json'),JSON.stringify(report,null,2)+'\n');
   console.log('INTERP479_RESULT '+JSON.stringify({status:report.status,source_sha:sha,run_id:runId,
    windows:Object.fromEntries(Object.entries(windows).map(([k,w])=>[k,{verdict:w.verdict||null,raw:w.raw_step_variance_u2,presented:w.presented_step_variance_u2,irregular:w.irregular_frames}]))}));
  }catch(e){
   const diag={status:'FAIL',source_sha:sha,run_id:runId,error:String(e),cases,windows,browser_errors:errors};
   if(page){
    diag.state=await page.evaluate(()=>({probe:window.riderInterp479??null,replay:window.riderReplay?{recording:window.riderReplay.recording,play:window.riderReplay.play,resets:window.riderReplay.resets}:null,
     counter:window.riderFpsCounter??null})).catch(err=>({capture_error:String(err)}));
    await page.screenshot({path:path.join(out,'interp479-failed.png'),timeout:5000}).catch(()=>{});
   }
   fs.writeFileSync(path.join(out,'interp479-failed.json'),JSON.stringify(diag,null,2)+'\n');
   console.error('INTERP479_FAIL '+JSON.stringify({error:diag.error,source_sha:sha,run_id:runId}));
   throw e;
  }finally{
   if(browser)await browser.close().catch(()=>{});
   await new Promise(resolve=>server.close(resolve));
  }
 })().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
}
