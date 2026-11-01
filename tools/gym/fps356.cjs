// #356 Stage-A standalone REAL Defold debug Gym baseline (not wired into CI dispatcher yet).
// Run after a verified tools/gym/bundle.py debug HTML5 build. No DOM writes to game state.
'use strict';
const {configure}=require('./launch.cjs');
const {compare,comparePause}=require('./fps356_verify.cjs');
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const [output,sha,runId,testcase,bundle]=process.argv.slice(2);
if(!output||!sha||!runId||testcase!=='fps356'||!bundle)throw Error('Usage: node tools/gym/fps356.cjs OUT SHA RUN_ID fps356 VERIFIED_DEBUG_BUNDLE');
const out=path.resolve(output);fs.mkdirSync(out,{recursive:true});
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
 let browser;
 try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  browser=await chromium.launch();
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(m.text()))errors.push(m.text());});
  await configure(page,runId,'fps356');
  await page.goto('http://127.0.0.1:'+server.address().port+'/index.html?station=straight');
  await page.waitForFunction(({sha,runId})=>window.riderReady?.source_sha===sha&&window.riderReady?.run_id===runId&&window.riderFps356World?.fixed_ticks>30&&window.riderFps356World?.vehicle_ready,{sha,runId},{timeout:30000});
  const snapshot=()=>page.evaluate(()=>({...window.riderFps356World}));
  async function measure(seconds,phase){
   const a=await snapshot();
   await page.waitForTimeout(seconds*1000+400);
   await page.waitForFunction(seq=>window.riderFps356World?.sequence>seq,a.sequence);
   const b=await snapshot();
   return compare(a,b,{phase,minSeconds:seconds});
  }
  async function transition(paused,afterSequence,expectedTimeSeq=null){
   const key={paused,afterSequence,expectedTimeSeq};
   await page.waitForFunction(({paused,afterSequence,expectedTimeSeq})=>(window.riderFps356Transitions||[]).some(s=>s.event==='time_state'&&s.paused===paused&&s.sequence>afterSequence&&(expectedTimeSeq===null||s.time_seq===expectedTimeSeq)),key,{timeout:10000});
   return page.evaluate(({paused,afterSequence,expectedTimeSeq})=>(window.riderFps356Transitions||[]).find(s=>s.event==='time_state'&&s.paused===paused&&s.sequence>afterSequence&&(expectedTimeSeq===null||s.time_seq===expectedTimeSeq)),key);
  }
  // Actual keyboard input through Defold input bindings, not DOM/game-state injection.
  await page.keyboard.down('ArrowUp');
  await page.waitForFunction(()=>window.riderTelemetry?.command?.throttle===1);
  await page.keyboard.up('ArrowUp');
  await page.waitForFunction(()=>window.riderTelemetry?.command?.throttle===0);
  const running=await measure(10,'running');
  const beforePause=await snapshot();
  await page.keyboard.press('Space');
  await page.waitForFunction(()=>window.riderTimeState?.paused===true);
  const loaderStart=await page.evaluate(()=>({...window.riderTimeState}));
  const pauseMarker=await transition(true,beforePause.sequence);
  // A factor-zero world may stop update() entirely. Loader UI state comes from
  // boot.script; wall time is independent. No paused-world heartbeat is assumed.
  const wallStartMs=await page.evaluate(()=>performance.now());
  await page.waitForTimeout(2400);
  const pausedEnd=await page.evaluate(()=>({loader:{...window.riderTimeState},wallMs:performance.now()}));
  assert.equal(pausedEnd.loader.paused,true,'Loader unexpectedly resumed during pause window');
  await page.keyboard.press('Space');
  await page.waitForFunction(()=>window.riderTimeState?.paused===false);
  const resumeMarker=await transition(false,pauseMarker.sequence,pauseMarker.time_seq+1);
  // The loader applies factor one only after the controller acknowledges
  // resume. Equal real boundary counters prove zero fixed ticks while paused.
  const paused=comparePause(pauseMarker,resumeMarker,{
   loaderStart,loaderEnd:pausedEnd.loader,wallStartMs,wallEndMs:pausedEnd.wallMs,minSeconds:2
  });
  const before=(await snapshot()).reset_count;
  await page.keyboard.press('r');
  await page.waitForFunction(n=>window.riderFps356World?.reset_count===n+1,before);
  const retry=await measure(10,'running');
  assert.equal(errors.length,0,'Defold browser errors: '+errors.join('; '));
  const report={status:'BASELINE_ONLY',source_sha:sha,build_source_fingerprint:metadata.source_fingerprint,run_id:runId,
   platform:'debug-html5-chromium',configured_update_hz:60,requested_runtime_hz:'NOT_SET',
   measurements:{running,paused,retry},
   browser_raf_callback_hz:null,presented_fps:null,
   not_run:['runtime_request_0_30_60','background_foreground','replay_identity','Android_device','confirmed_presented_frames'],
   reason:'Loader boot.script currently owned by #359 PR #365; runtime setter and full Stage-A matrix deferred'};
  fs.writeFileSync(path.join(out,'fps356-baseline.json'),JSON.stringify(report,null,2)+'\n');
  console.log('FPS356 baseline engine callbacks/fixed ticks verified; no presented FPS claim');
 }finally{
  if(browser)await browser.close();
  await new Promise(r=>server.close(r));
 }
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
