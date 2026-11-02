// #356 Stage-A REAL Defold debug Gym startup 0/30/60 matrix; no game defaults changed.
// Run after a verified tools/gym/bundle.py debug HTML5 build. No DOM writes to game state.
'use strict';
// Strict CLI contract: the required CI may opt into a single real 60-Hz run.
function parseRates(argv){
 const usage='Usage: node tools/gym/fps356.cjs OUT SHA RUN_ID fps356 VERIFIED_DEBUG_BUNDLE [--rates=60]';
 if(!Array.isArray(argv)||(argv.length!==5&&argv.length!==6)||
    argv.slice(0,5).some(x=>typeof x!=='string'||x.length===0)||
    argv[3]!=='fps356')throw Error(usage);
 if(argv.length===5)return {rates:[0,30,60],mode:'startup-matrix'};
 if(argv[5]!=='--rates=60')throw Error('Unsupported FPS356 rate selection; only --rates=60 is accepted. '+usage);
 return {rates:[60],mode:'single-60'};
}
module.exports={parseRates};
if(require.main===module){
const {configure}=require('./launch.cjs');
const {compare,comparePause}=require('./fps356_verify.cjs');
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const argv=process.argv.slice(2);
const {rates,mode}=parseRates(argv);
const [output,sha,runId,testcase,bundle]=argv;
const out=path.resolve(output);fs.mkdirSync(out,{recursive:true});
// Never leave stale three-rate PASS artifacts when an output directory is reused,
// including a single-rate failure. Only remove this runner's known result files.
for(const name of ['fps356-startup-matrix.json','fps356-hz0.json','fps356-hz30.json',
                   'fps356-hz60.json','fps356-baseline.json']){
 fs.rmSync(path.join(out,name),{force:true});
}
const metadata=JSON.parse(fs.readFileSync(path.join(bundle,'bundle.json'),'utf8'));
assert(metadata.variant==='debug'&&metadata.platform==='wasm-web'&&metadata.source_sha===sha,'Wrong debug bundle');
function find(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory()){const v=find(p);if(v)return v;}else if(e.name==='index.html')return p;}}
const web=path.dirname(find(path.resolve(bundle)));
const server=http.createServer((req,res)=>{
 const file=path.resolve(web,'.'+new URL(req.url,'http://localhost').pathname);
 if(!file.startsWith(web+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',file.endsWith('.wasm')?'application/wasm':file.endsWith('.js')?'text/javascript':file.endsWith('.json')?'application/json':'text/html');
 fs.createReadStream(file).pipe(res);
});
(async()=>{
 let browser,page,activeRate=null,activeRunId=null;
 const errors=[],matrix=[];
 try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  browser=await chromium.launch();
  // browser.newPage creates a new isolated browser context on every iteration.
  // Every selected start uses the SAME verified debug bundle and source fingerprint.
  for(const rate of rates){
   activeRate=rate;
   activeRunId=runId+'-hz'+rate;
   errors.length=0;
   page=await browser.newPage({viewport:{width:1280,height:720}});
   page.on('pageerror',e=>{if(errors.length<20)errors.push(e.message);});
   page.on('console',m=>{if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(m.text())&&errors.length<20)errors.push(m.text());});
   // Inject a supported Defold ENGINE STARTUP config before engine-start.
   // This is not sys.set_update_frequency and does not change game.project.
   await configure(page,activeRunId,'fps356',rate);
   await page.goto('http://127.0.0.1:'+server.address().port+'/index.html?station=straight');
   await page.waitForFunction(({sha,runId})=>window.riderReady?.source_sha===sha&&
    window.riderReady?.run_id===runId&&window.riderFps356World?.fixed_ticks>30&&
    window.riderFps356World?.vehicle_ready,{sha,runId:activeRunId},{timeout:30000});
   const snapshot=()=>page.evaluate(()=>({...window.riderFps356World}));
   const initial=await snapshot();
   assert.equal(initial.source_sha,sha,'World snapshot does not match debug build');
   assert.equal(initial.run_id,activeRunId,'World snapshot does not match fresh page');
   assert.equal(initial.reset_count,0,'New page inherited a Retry');
   async function measure(seconds,phase){
    const a=await snapshot();
    await page.waitForTimeout(seconds*1000+400);
    await page.waitForFunction(seq=>window.riderFps356World?.sequence>seq,a.sequence);
    const b=await snapshot();
    return compare(a,b,{phase,minSeconds:seconds});
   }
   async function transition(paused,afterSequence,expectedTimeSeq=null){
    const key={paused,afterSequence,expectedTimeSeq};
    await page.waitForFunction(({paused,afterSequence,expectedTimeSeq})=>
     (window.riderFps356Transitions||[]).some(s=>s.event==='time_state'&&s.paused===paused&&
      s.sequence>afterSequence&&(expectedTimeSeq===null||s.time_seq===expectedTimeSeq)),
     key,{timeout:10000});
    return page.evaluate(({paused,afterSequence,expectedTimeSeq})=>
     (window.riderFps356Transitions||[]).find(s=>s.event==='time_state'&&s.paused===paused&&
      s.sequence>afterSequence&&(expectedTimeSeq===null||s.time_seq===expectedTimeSeq)),key);
   }
   // Defold samples input on frames: hold until genuine game acknowledgment.
   async function holdUntil(key,until,arg){
    await page.keyboard.down(key);
    try{await page.waitForFunction(until,arg,{timeout:30000});}
    finally{await page.keyboard.up(key);}
   }
   // Real Defold keyboard bindings, never DOM/game-state mutation.
   await page.keyboard.down('ArrowUp');
   await page.waitForFunction(()=>window.riderTelemetry?.command?.throttle===1);
   await page.keyboard.up('ArrowUp');
   await page.waitForFunction(()=>window.riderTelemetry?.command?.throttle===0);
   const running=await measure(10,'running');
   const beforePause=await snapshot();
   await holdUntil('Space',({on,seq})=>window.riderTimeState?.paused===on&&
    (window.riderFps356Transitions||[]).some(t=>t.event==='time_state'&&t.paused===on&&t.sequence>seq),
    {on:true,seq:beforePause.sequence});
   const loaderStart=await page.evaluate(()=>({...window.riderTimeState}));
   const pauseMarker=await transition(true,beforePause.sequence);
   // Factor-zero worlds may stop update(): measure independent wall time and
   // compare genuine world pause/resume boundaries, with exactly ZERO fixed ticks.
   const wallStartMs=await page.evaluate(()=>performance.now());
   await page.waitForTimeout(2400);
   const pausedEnd=await page.evaluate(()=>({loader:{...window.riderTimeState},wallMs:performance.now()}));
   assert.equal(pausedEnd.loader.paused,true,'Loader unexpectedly resumed during pause window');
   await holdUntil('Space',({on,seq})=>window.riderTimeState?.paused===on&&
    (window.riderFps356Transitions||[]).some(t=>t.event==='time_state'&&t.paused===on&&t.sequence>seq),
    {on:false,seq:pauseMarker.sequence});
   const resumeMarker=await transition(false,pauseMarker.sequence,pauseMarker.time_seq+1);
   const paused=comparePause(pauseMarker,resumeMarker,{
    loaderStart,loaderEnd:pausedEnd.loader,wallStartMs,wallEndMs:pausedEnd.wallMs,minSeconds:2
   });
   const before=(await snapshot()).reset_count;
   await holdUntil('r',n=>window.riderFps356World?.reset_count===n+1,before);
   const retry=await measure(10,'running');
   assert.equal(retry.reset_count,before+1,'Retry identity did not advance');
   assert.equal(errors.length,0,'Defold browser errors: '+errors.join('; '));
   const report={
    status:'STARTUP_RATE_MEASURED',source_sha:sha,
    ...(mode==='single-60'?{execution_mode:'SINGLE_STARTUP_RATE_60'}:{}),
    build_source_fingerprint:metadata.source_fingerprint,run_id:activeRunId,
    matrix_run_id:runId,platform:'debug-html5-chromium',
    default_project_update_hz:60,startup_requested_hz:rate,
    startup_engine_argument:'--config=display.update_frequency='+rate,
    requested_runtime_hz:'NOT_SET',
    measurements:{running,paused,retry},
    browser_raf_callback_hz:null,presented_fps:null,
    not_run:['runtime_sys_set_update_frequency','background_foreground','replay_identity','Android_device','confirmed_presented_frames'],
    reason:'HTML5 may ignore requested update cap; Defold world update callbacks are NOT delivered/presented FPS'
   };
   matrix.push(report);
   fs.writeFileSync(path.join(out,'fps356-hz'+rate+'.json'),JSON.stringify(report,null,2)+'\n');
   if(rate===60)fs.writeFileSync(path.join(out,'fps356-baseline.json'),JSON.stringify(report,null,2)+'\n');
   console.log('FPS356_RATE '+JSON.stringify({
    startup_requested_hz:rate,source_sha:sha,run_id:activeRunId,
    running_fixed_wall_hz:running.fixed_tick_wall_hz,
    running_update_callback_hz:running.world_update_callback_hz,
    paused_fixed_ticks:paused.fixed_ticks_during_pause,
    retry_fixed_wall_hz:retry.fixed_tick_wall_hz,
    retry_update_callback_hz:retry.world_update_callback_hz,
    presented_fps:null
   }));
   await page.close();
   page=null;
  }
  assert.deepEqual(matrix.map(m=>m.startup_requested_hz),rates,'Incomplete selected startup rates');
  assert(matrix.every(m=>m.source_sha===sha&&m.build_source_fingerprint===metadata.source_fingerprint),
   'Startup runs mixed engine sources');
  if(mode==='startup-matrix'){
   fs.writeFileSync(path.join(out,'fps356-startup-matrix.json'),JSON.stringify({
    status:'STARTUP_MATRIX_VERIFIED',source_sha:sha,
    build_source_fingerprint:metadata.source_fingerprint,matrix_run_id:runId,
    platform:'debug-html5-chromium',startup_requested_hz:[0,30,60],
    physics_fixed_hz:60,presented_fps:null,results:matrix
   },null,2)+'\n');
   console.log('FPS356 startup 0/30/60 real Defold callback/fixed-tick matrix PASS; presented FPS UNKNOWN');
  }else{
   assert.deepEqual(rates,[60],'Single-rate mode must only measure 60 Hz');
   console.log('FPS356 startup 60-only real Defold fixed-tick baseline PASS; full matrix NOT RUN; presented FPS UNKNOWN');
  }
 }catch(e){
  // Fail closed. Preserve source, request and genuine game state for exact CI diagnostics.
  const diagnostic={source_sha:sha,matrix_run_id:runId,run_id:activeRunId,
   startup_requested_hz:activeRate,error:String(e),browser_errors:errors.slice(-20),
   completed_rates:matrix.map(m=>m.startup_requested_hz),state:null};
  if(page){
   diagnostic.state=await page.evaluate(()=>({
    ready:window.riderReady??null,time:window.riderTime??null,
    loader_time:window.riderTimeState??null,world:window.riderFps356World??null,
    transitions:(window.riderFps356Transitions||[]).slice(-16),
    command:window.riderTelemetry?.command??null
   })).catch(err=>({capture_error:String(err)}));
   try{await page.screenshot({path:path.join(out,'fps356-failed-hz'+activeRate+'.png'),timeout:5000});}
   catch(err){diagnostic.screenshot_error=String(err);}
  }
  fs.writeFileSync(path.join(out,'fps356-failed-hz'+activeRate+'.json'),JSON.stringify(diagnostic,null,2)+'\n');
  console.error('FPS356_FAIL_STATE '+JSON.stringify(diagnostic));
  throw e;
 }finally{
  if(page)await page.close();
  if(browser)await browser.close();
  await new Promise(r=>server.close(r));
 }
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});

}
