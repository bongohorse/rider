// #372 / #356 Stage A2: REAL Defold sys.set_update_frequency debug experiment.
// Existing startup 0/30/60 runner remains unchanged. No browser frame-cap injection.
'use strict';
const assert=require('node:assert/strict');
const ORDER=[30,60,0,30], STEP=1/60;
// Loader only suspends an admitted campaign course on run_focus_lost.
// first-run starts stationary, keeping the four 10s rate windows comparable.
const TEST_STATION='first-run';
function parseArgs(args){
 const usage='Usage: node tools/gym/fps356_runtime.cjs OUT SHA RUN_ID fps356runtime VERIFIED_DEBUG_BUNDLE';
 if(!Array.isArray(args)||args.length!==5||args.some(v=>typeof v!=='string'||!v)||args[3]!=='fps356runtime')throw Error(usage);
 return {output:args[0],sha:args[1],runId:args[2],bundle:args[4]};
}
function classify(windows){
 assert(Array.isArray(windows)&&windows.length===4,'Missing runtime switch windows');
 assert.deepEqual(windows.map(w=>w.requested_hz),ORDER,'Wrong live rate order');
 for(let i=0;i<windows.length;i++){
  const w=windows[i],m=w.measurement;
  assert(w.sequence===i+1,'Runtime request sequence changed');
  assert(Number.isSafeInteger(w.generation)&&w.generation===windows[0].generation,'World generation changed across rates');
  assert(w.reset_count===0,'Rate matrix crossed world Retry/reset');
  assert(w.event==='sys.set_update_frequency','No genuine Defold setter event');
  assert(w.source_sha&&w.run_id&&w.source_sha===windows[0].source_sha&&w.run_id===windows[0].run_id,'Mixed source/run');
  assert(m&&m.source_sha===w.source_sha&&m.run_id===w.run_id,'Measurement source mismatch');
  assert(m.physics_fixed_dt_valid===true&&Math.abs(m.fixed_dt_s-STEP)<1e-8,'Not fixed 1/60 physics');
  assert(m.fixed_tick_wall_hz>=54&&m.fixed_tick_wall_hz<=66,'Fixed wall cadence changed');
  assert(m.elapsed_s>=10,'Short live-rate window');
  assert(Number.isFinite(m.world_update_callback_hz)&&m.world_update_callback_hz>0,'Missing Defold callbacks');
  assert(m.presented_fps===null&&w.presented_fps===null,'False presented FPS claim');
 }
 const cap30=windows.filter(w=>w.requested_hz===30).every(w=>Math.abs(w.measurement.world_update_callback_hz-30)<=6);
 const cap60=Math.abs(windows[1].measurement.world_update_callback_hz-60)<=12;
 return {status:cap30&&cap60?'RUNTIME_CALLBACK_TARGETS_OBSERVED':'BLOCKED_RUNTIME_CAP_UNOBSERVED',
  cap30_callback_observed:cap30,cap60_callback_observed:cap60,
  presented_fps:null,browser_raf_callback_hz:null};
}
// A21's MATCH verdict is necessary but not enough: bind it to this exact
// source, campaign course, full per-tick trace and the declared pose tolerance.
function verifyReplay(recorded,played,{sourceSha,station,tolerance}){
 assert(recorded&&played&&tolerance,'Missing genuine A21 replay evidence');
 assert.equal(recorded.source_sha,sourceSha,'Recorded trace source SHA changed');
 assert.equal(recorded.station,station,'Recorded trace station changed');
 assert(Number.isSafeInteger(recorded.ticks)&&recorded.ticks>90,'Too few recorded fixed ticks');
 assert.equal(recorded.error,false,'Recording error');
 assert.equal(recorded.ended,'stopped','Recording was not explicitly stopped');
 assert.equal(recorded.scaled_ticks,0,'Recording contained scaled physics ticks');
 assert.equal(recorded.tuning_changed,false,'Recording tuning changed');
 assert.equal(recorded.trailing,true,'Recording lacks post-step trailing pose');
 assert.equal(recorded.poses,recorded.ticks+1,'Recording pose count differs from fixed ticks');
 assert.equal(played.ended,'done','Replay did not finish');
 assert.equal(played.verdict,'MATCH','Replay trajectory verdict is not MATCH');
 assert.equal(played.same,true,'Replay used a different physics/preset identity');
 assert.equal(played.complete,true,'Replay did not apply the complete trace');
 assert.equal(played.mismatches,0,'Replay commands differ from recorded commands');
 assert.equal(played.scaled_ticks,0,'Replay contained scaled physics ticks');
 assert.equal(played.tuning_changed,false,'Replay tuning changed');
 assert.equal(played.ticks,recorded.ticks,'Replay trace length differs');
 assert.equal(played.applied,recorded.ticks,'Replay lost fixed-step commands');
 for(const [field,limit] of [['max_position_m','position_m'],['max_angle_rad','angle_rad']]){
  assert(Number.isFinite(tolerance[limit])&&tolerance[limit]>=0,'Missing A21 trajectory tolerance');
  assert(Number.isFinite(played[field])&&played[field]>=0&&played[field]<=tolerance[limit],
   'Replay exceeded '+limit+' trajectory tolerance');
 }
 return {recorded_ticks:recorded.ticks,applied_ticks:played.applied,
  verdict:played.verdict,mismatches:played.mismatches,scaled_ticks:played.scaled_ticks,
  max_position_m:played.max_position_m,max_angle_rad:played.max_angle_rad};
}
module.exports={parseArgs,classify,verifyReplay,ORDER,TEST_STATION};
if(require.main===module){
 const {configure}=require('./launch.cjs');
 const {compare,comparePause}=require('./fps356_verify.cjs');
 const {chromium}=require('playwright');
 const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
 const {output,sha,runId,bundle}=parseArgs(process.argv.slice(2));
 const out=path.resolve(output);fs.mkdirSync(out,{recursive:true});
 fs.rmSync(path.join(out,'fps356-runtime.json'),{force:true});
 const metadata=JSON.parse(fs.readFileSync(path.join(bundle,'bundle.json'),'utf8'));
 assert(metadata.variant==='debug'&&metadata.platform==='wasm-web'&&metadata.source_sha===sha,'Wrong Defold debug bundle');
 function find(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory()){const v=find(p);if(v)return v;}else if(e.name==='index.html')return p;}}
 const index=find(path.resolve(bundle));assert(index,'No genuine Defold index.html in bundle');
 const web=path.dirname(index);
 const server=http.createServer((req,res)=>{
  const file=path.resolve(web,'.'+new URL(req.url,'http://localhost').pathname);
  if(!file.startsWith(web+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',file.endsWith('.wasm')?'application/wasm':file.endsWith('.js')?'text/javascript':file.endsWith('.json')?'application/json':'text/html');
  fs.createReadStream(file).pipe(res);
 });
 (async()=>{
  let browser,context,page,other;const errors=[],windows=[],evidence={};
  try{
   await new Promise(r=>server.listen(0,'127.0.0.1',r));
   browser=await chromium.launch();
   // Explicit BrowserContext: Playwright forbids context.newPage() on browser.newPage()'s owned context.
   context=await browser.newContext({viewport:{width:1280,height:720}});
   page=await context.newPage();
   page.on('pageerror',e=>{if(errors.length<20)errors.push(e.message);});
   page.on('console',m=>{if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(m.text())&&errors.length<20)errors.push(m.text());});
   // Default engine startup is unchanged at 60. No --config display override.
   await configure(page,runId,'fps356runtime');
   await page.goto('http://127.0.0.1:'+server.address().port+'/index.html?station='+encodeURIComponent(TEST_STATION));
   await page.waitForFunction(({sha,runId})=>window.riderReady?.source_sha===sha&&
    window.riderReady?.run_id===runId&&window.riderFps356World?.fixed_ticks>30&&
    window.riderFps356World?.vehicle_ready,{sha,runId},{timeout:30000});
   const snap=()=>page.evaluate(()=>({...window.riderFps356World}));
   const request=()=>page.evaluate(()=>({...window.riderFps356Runtime}));
   const loader=()=>page.evaluate(()=>({...window.riderTimeState}));
   const initial=await snap();
   assert.equal(initial.source_sha,sha);assert.equal(initial.run_id,runId);
   assert.equal(initial.reset_count,0,'New page inherited Retry');
   let previousFixed=initial.fixed_ticks;
   async function holdUntil(key,predicate,arg){
    await page.keyboard.down(key);
    try{await page.waitForFunction(predicate,arg,{polling:50,timeout:15000});}
    finally{await page.keyboard.up(key);}
   }
   async function setRate(hz,key,sequence){
    await holdUntil(key,({hz,sequence,sha,runId})=>{
     const s=window.riderFps356Runtime;
     return s?.kind==='defold_runtime_update_frequency_request'&&s.event==='sys.set_update_frequency'&&
      s.sequence===sequence&&s.requested_hz===hz&&s.source_sha===sha&&s.run_id===runId;
    },{hz,sequence,sha,runId});
    const s=await request();
    assert.equal(s.fixed_config_hz,60,'Debug setter modified physics declaration');
    assert.equal(s.presented_fps,'UNKNOWN','Setter claims presented FPS');
    return s;
   }
   async function measure(seconds=10){
    const a=await snap();
    await page.waitForTimeout(seconds*1000+400);
    await page.waitForFunction(seq=>window.riderFps356World?.sequence>seq,a.sequence,{polling:50,timeout:5000});
    const b=await snap();
    return compare(a,b,{phase:'running',minSeconds:seconds});
   }
   async function transition(paused,after){
    await page.waitForFunction(({paused,after})=>
     (window.riderFps356Transitions||[]).some(s=>s.event==='time_state'&&s.paused===paused&&s.sequence>after),
     {paused,after},{polling:50,timeout:10000});
    return page.evaluate(({paused,after})=>
     (window.riderFps356Transitions||[]).find(s=>s.event==='time_state'&&s.paused===paused&&s.sequence>after),
     {paused,after});
   }
   async function pauseAndResume(label,trigger){
    const before=await snap();
    if(trigger==='keyboard'){
     await holdUntil('Space',seq=>window.riderTimeState?.paused===true&&
      (window.riderFps356Transitions||[]).some(s=>s.event==='time_state'&&s.paused===true&&s.sequence>seq),
      before.sequence);
    }else if(trigger==='background'){
     other=await page.context().newPage();
     await other.goto('about:blank');await other.bringToFront();
     try{
      await page.waitForFunction(()=>document.visibilityState==='hidden',null,{polling:100,timeout:10000});
     }catch(err){
      const visibility=await page.evaluate(()=>({state:document.visibilityState,focus:document.hasFocus()}));
      throw Error('BLOCKED_BACKGROUND_VISIBILITY_UNOBSERVED: real Chromium tab switch did not hide the game page; '+JSON.stringify(visibility));
     }
     await page.waitForFunction(seq=>window.riderTimeState?.paused===true&&
      (window.riderFps356Transitions||[]).some(s=>s.event==='time_state'&&s.paused===true&&s.sequence>seq),
      before.sequence,{polling:100,timeout:10000});
    }else throw Error('Unsupported pause trigger');
    const p=await transition(true,before.sequence),start=await loader();
    const wallStartMs=await page.evaluate(()=>performance.now());
    await page.waitForTimeout(2400);
    const end=await page.evaluate(()=>({loader:{...window.riderTimeState},wallMs:performance.now()}));
    assert.equal(end.loader.paused,true,label+': unexpected resume');
    if(other){await other.close();other=null;await page.bringToFront();}
    assert.equal((await loader()).paused,true,label+': focus auto-resumed without explicit input');
    await holdUntil('Space',seq=>window.riderTimeState?.paused===false&&
     (window.riderFps356Transitions||[]).some(s=>s.event==='time_state'&&s.paused===false&&s.sequence>seq),
     p.sequence);
    const resume=await transition(false,p.sequence);
    const result=comparePause(p,resume,{loaderStart:start,loaderEnd:end.loader,
     wallStartMs,wallEndMs:end.wallMs,minSeconds:2});
    assert.equal(result.fixed_ticks_during_pause,0);
    assert.equal((await snap()).source_sha,sha);
    return result;
   }
   // Four live requests from the REAL Defold on_input() handler, same page/world.
   for(let i=0;i<ORDER.length;i++){
    const hz=ORDER[i],key=hz===30?'j':hz===60?'k':'Home';
    const event=await setRate(hz,key,i+1);
    const m=await measure(10);
    assert.equal((await request()).sequence,event.sequence,'Rate changed during observation');
    const after=await snap();
    assert.equal(after.generation,initial.generation,'World generation changed during live matrix');
    assert.equal(after.reset_count,0,'Rate change unexpectedly reset the world');
    assert(after.fixed_ticks>previousFixed,'Fixed ticks did not progress between rates');
    previousFixed=after.fixed_ticks;
    windows.push({generation:after.generation,reset_count:after.reset_count,
     requested_hz:hz,sequence:event.sequence,event:event.event,
     source_sha:event.source_sha,run_id:event.run_id,presented_fps:null,measurement:m});
    console.log('FPS356_RUNTIME_RATE '+JSON.stringify({requested_hz:hz,
     update_callback_hz:m.world_update_callback_hz,fixed_wall_hz:m.fixed_tick_wall_hz,
     presented_fps:null,source_sha:sha,run_id:runId}));
   }
   const classified=classify(windows);
   evidence.pause=await pauseAndResume('keyboard','keyboard');
   const beforeRetry=(await snap()).reset_count;
   await holdUntil('r',n=>window.riderFps356World?.reset_count===n+1,beforeRetry);
   evidence.retry=await measure(10);
   assert.equal(evidence.retry.reset_count,beforeRetry+1,'Retry reset identity lost');
   assert.equal((await request()).sequence,4,'Rate request changed during keyboard pause/Retry');
   // Record at 30 Hz then replay identical fixed-tick commands after switching to 60.
   const beforeRecord=await page.evaluate(()=>window.riderReplay?.resets);
   assert(Number.isSafeInteger(beforeRecord),'Missing genuine A21 replay observer');
   await holdUntil('b',n=>window.riderReplay?.recording?.active&&window.riderReplay?.resets===n+1,beforeRecord);
   await page.keyboard.down('ArrowUp');
   await page.waitForFunction(()=>window.riderReplay?.command?.throttle===1,null,{polling:50,timeout:10000});
   await page.waitForTimeout(1800);
   await page.keyboard.up('ArrowUp');
   await page.waitForFunction(()=>window.riderReplay?.command?.throttle===0,null,{polling:50,timeout:10000});
   await holdUntil('b',()=>window.riderReplay?.recording?.active===false);
   // A21 captures the post-step trailing pose on the next genuine fixed tick.
   // Wait for that evidence, never synthesize a trace or add a timing sleep.
   await page.waitForFunction(()=>window.riderReplay?.recording?.trailing===true,
    null,{polling:50,timeout:10000});
   const recorded=await page.evaluate(()=>window.riderReplay?.recording);
   await setRate(60,'k',5);
   const beforePlay=await page.evaluate(()=>window.riderReplay?.resets);
   await holdUntil('g',n=>window.riderReplay?.play?.active&&window.riderReplay?.resets===n+1,beforePlay);
   await page.waitForFunction(()=>window.riderReplay?.play?.ended==='done',null,{polling:50,timeout:30000});
   const played=await page.evaluate(()=>window.riderReplay?.play);
   const tolerance=await page.evaluate(()=>window.riderReplay?.tolerance);
   evidence.replay=verifyReplay(recorded,played,{sourceSha:sha,station:TEST_STATION,tolerance});
   // Headless Chromium can keep every page 'visible' even after a real tab switch.
   // Run Replay first so its genuine engine verdict is preserved if background visibility is unsupported.
   // Never synthesize a JS blur/visibility event or report background PASS without loader pause ACK.
   evidence.background=await pauseAndResume('background','background');
   assert.equal((await request()).sequence,5,'Rate request changed during background/focus');
   assert.equal(errors.length,0,'Defold errors: '+errors.join('; '));
   const report={...classified,source_sha:sha,build_source_fingerprint:metadata.source_fingerprint,
    run_id:runId,platform:'real-debug-defold-html5-chromium',
    experiment:'sys.set_update_frequency from Defold on_input, 30->60->Auto->30, no reload',
    default_project_update_hz:60,fixed_config_hz:60,fixed_dt_s:STEP,
    requested_runtime_hz:ORDER,observed:windows,evidence,
    browser_raf_callback_hz:null,presented_fps:null,
    not_run:['Android_device','confirmed_presented_frames','native_refresh_rate'],
    limitations:'HTML5 scheduling is browser/platform owned. Callback counts are not delivered frames.'};
   fs.writeFileSync(path.join(out,'fps356-runtime.json'),JSON.stringify(report,null,2)+'\n');
   console.log('FPS356_RUNTIME_RESULT '+JSON.stringify({status:report.status,source_sha:sha,
    run_id:runId,cap30:classified.cap30_callback_observed,
    cap60:classified.cap60_callback_observed,pause_ticks:evidence.pause.fixed_ticks_during_pause,
    background_pause_ticks:evidence.background.fixed_ticks_during_pause,replay:evidence.replay.verdict,
    presented_fps:null}));
   if(classified.status!=='RUNTIME_CALLBACK_TARGETS_OBSERVED')throw Error('BLOCKED: Defold runtime target not observed; no FPS UI permitted');
  }catch(e){
   const diag={status:'FAILED_OR_BLOCKED',source_sha:sha,run_id:runId,
    error:String(e),completed_windows:windows,browser_errors:errors,evidence};
   if(page){
    diag.state=await page.evaluate(()=>({ready:window.riderReady??null,
     runtime:window.riderFps356Runtime??null,world:window.riderFps356World??null,
     loader:window.riderTimeState??null,replay:window.riderReplay??null,
     transitions:(window.riderFps356Transitions||[]).slice(-12)})).catch(err=>({capture_error:String(err)}));
    try{await page.screenshot({path:path.join(out,'fps356-runtime-failed.png'),timeout:5000});}
    catch(err){diag.screenshot_error=String(err);}
   }
   fs.writeFileSync(path.join(out,'fps356-runtime-failed.json'),JSON.stringify(diag,null,2)+'\n');
   console.error('FPS356_RUNTIME_FAIL '+JSON.stringify({error:diag.error,source_sha:sha,run_id:runId}));
   throw e;
  }finally{
   if(other)await other.close().catch(()=>{});
   if(page)await page.close().catch(()=>{});
   if(context)await context.close().catch(()=>{});
   if(browser)await browser.close().catch(()=>{});
   await new Promise(resolve=>server.close(resolve));
  }
 })().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
}
