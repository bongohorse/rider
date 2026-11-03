'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {parseArgs,classify,verifyReplay,verifyFocusEvent,ORDER,TEST_STATION}=require('../../tools/gym/fps356_runtime.cjs');
const fs=require('node:fs'),path=require('node:path');
const STEP=1/60;
const args=['out','sha-123','run-abc','fps356runtime','debug-bundle'];
const windows=()=>ORDER.map((rate,i)=>({
 requested_hz:rate,sequence:i+1,event:'sys.set_update_frequency',generation:1,reset_count:0,
 source_sha:'sha-123',run_id:'run-abc',presented_fps:null,
 measurement:{source_sha:'sha-123',run_id:'run-abc',physics_fixed_dt_valid:true,
  fixed_dt_s:STEP,fixed_tick_wall_hz:60,elapsed_s:10.4,
  world_update_callback_hz:rate===0?60:rate,presented_fps:null}
}));
test('runtime runner accepts only exact debug Gym identity',()=>{
 assert.deepEqual(parseArgs(args),{output:'out',sha:'sha-123',runId:'run-abc',bundle:'debug-bundle'});
});
for(const bad of [
 [],args.slice(0,4),[...args,'--rates=60'],['',...args.slice(1)],
 ['out','sha','run','fps356','bundle'],[...args.slice(0,4),''],
 ['out','sha','run','fps356runtime','bundle','--fake-raf']
])test('reject malformed runner arguments '+JSON.stringify(bad),()=>assert.throws(()=>parseArgs(bad),/Usage/));
test('real Defold callback classification separates requests from presented frames',()=>{
 const c=classify(windows());assert.equal(c.status,'RUNTIME_CALLBACK_TARGETS_OBSERVED');
 assert.equal(c.presented_fps,null);assert.equal(c.browser_raf_callback_hz,null);
});
test('30 request with 60 callbacks is BLOCKED, not a fake 30fps pass',()=>{
 const w=windows();w[0].measurement.world_update_callback_hz=60;
 const c=classify(w);assert.equal(c.status,'BLOCKED_RUNTIME_CAP_UNOBSERVED');
 assert.equal(c.cap30_callback_observed,false);
});
test('60 request with 30 callbacks is BLOCKED',()=>{
 const w=windows();w[1].measurement.world_update_callback_hz=30;
 assert.equal(classify(w).status,'BLOCKED_RUNTIME_CAP_UNOBSERVED');
});
for(const [name,mutate,reason] of [
 ['wrong rate order',w=>{w[2].requested_hz=60;},/Wrong live rate order/],
 ['missing setter event',w=>{w[0].event='browser_raf';},/genuine Defold setter/],
 ['repeated request sequence',w=>{w[1].sequence=1;},/request sequence/],
 ['world generation changed',w=>{w[2].generation=2;},/World generation/],
 ['unexpected world Retry',w=>{w[2].reset_count=1;},/crossed world Retry/],
 ['mixed source',w=>{w[2].source_sha='other';},/Mixed source/],
 ['mixed run',w=>{w[2].run_id='other';},/Mixed source/],
 ['world source mismatch',w=>{w[0].measurement.source_sha='other';},/Measurement source/],
 ['bad fixed dt',w=>{w[0].measurement.fixed_dt_s=1/30;},/fixed 1\/60/],
 ['bad fixed dt flag',w=>{w[0].measurement.physics_fixed_dt_valid=false;},/fixed 1\/60/],
 ['stalled physics',w=>{w[1].measurement.fixed_tick_wall_hz=1;},/Fixed wall cadence/],
 ['doubled physics',w=>{w[1].measurement.fixed_tick_wall_hz=120;},/Fixed wall cadence/],
 ['short window',w=>{w[1].measurement.elapsed_s=2;},/Short live-rate/],
 ['no callbacks',w=>{w[1].measurement.world_update_callback_hz=0;},/Missing Defold callbacks/],
 ['false presented fps',w=>{w[1].measurement.presented_fps=60;},/False presented FPS/],
 ['false request presented fps',w=>{w[1].presented_fps=60;},/False presented FPS/]
])test('runtime verifier rejects '+name,()=>{const w=windows();mutate(w);assert.throws(()=>classify(w),reason);});

// Regression: the runtime probe drives a real campaign course, and the loader's actual focus-suspend
// admission (every playable station in Play mode since #365) still pauses it.
// Keep this tied to the actual loader admission condition, not a mock of pause.
test('background pause uses a real campaign course and the loader focus-suspend admission',()=>{
 const root=path.resolve(__dirname,'../..');
 const catalog=fs.readFileSync(path.join(root,'main/game/course_catalog.lua'),'utf8');
 const match=catalog.match(/M=\{ids=\{([^}]+)\}\}/);
 assert(match,'Cannot read the actual campaign course IDs');
 const admitted=[...match[1].matchAll(/'([^']+)'/g)].map(m=>m[1]);
 assert(admitted.includes(TEST_STATION),'Runtime probe station is not a real campaign course');
 assert.notEqual(TEST_STATION,'straight','Runtime probe must drive a campaign course, not the Gym straight');
 const loader=fs.readFileSync(path.join(root,'main/game/boot.script'),'utf8');
 // Since #359/#365 the loader suspends every playable station in Play mode (no course restriction).
 assert.match(loader,/id==hash\("run_focus_lost"\) and not self\.loading and editor\.mode=="play" then\n\s*msg\.post\("#script","time_control",\{action="suspend"\}\)/,
  'Loader focus admission contract changed; revalidate runtime pause');
 const runner=fs.readFileSync(path.join(root,'tools/gym/fps356_runtime.cjs'),'utf8');
 assert.match(runner,/encodeURIComponent\(TEST_STATION\)/,'Runner no longer uses the admitted course');
});

const replayFixture=()=>({
 recorded:{source_sha:'sha-123',station:TEST_STATION,ticks:121,error:false,
  ended:'stopped',scaled_ticks:0,tuning_changed:false,trailing:true,poses:122},
 played:{ended:'done',verdict:'MATCH',same:true,complete:true,mismatches:0,
  scaled_ticks:0,tuning_changed:false,ticks:121,applied:121,max_position_m:0.012,max_angle_rad:0.008},
 options:{sourceSha:'sha-123',station:TEST_STATION,tolerance:{position_m:0.05,angle_rad:0.05}}
});
test('genuine A21 replay evidence binds source, trailing pose and full fixed-tick trajectory',()=>{
 const {recorded,played,options}=replayFixture();
 const v=verifyReplay(recorded,played,options);
 assert.deepEqual(v,{recorded_ticks:121,applied_ticks:121,verdict:'MATCH',
  mismatches:0,scaled_ticks:0,max_position_m:0.012,max_angle_rad:0.008});
});
for(const [name,mutate,reason] of [
 ['wrong source SHA',x=>{x.recorded.source_sha='other';},/source SHA/],
 ['wrong campaign station',x=>{x.recorded.station='straight';},/station changed/],
 ['short recording',x=>{x.recorded.ticks=60;},/Too few/],
 ['recording error',x=>{x.recorded.error='tick gap';},/Recording error/],
 ['unexpected recording end',x=>{x.recorded.ended='full';},/explicitly stopped/],
 ['scaled recording',x=>{x.recorded.scaled_ticks=1;},/scaled physics/],
 ['changed tuning',x=>{x.recorded.tuning_changed=true;},/tuning changed/],
 ['missing trailing pose',x=>{x.recorded.trailing=false;},/trailing pose/],
 ['incomplete pose count',x=>{x.recorded.poses=121;},/pose count/],
 ['incomplete playback',x=>{x.played.complete=false;},/complete trace/],
 ['different preset',x=>{x.played.same=false;},/preset identity/],
 ['diverged verdict',x=>{x.played.verdict='DIVERGED';},/trajectory verdict/],
 ['replayed command mismatch',x=>{x.played.mismatches=1;},/commands differ/],
 ['scaled playback',x=>{x.played.scaled_ticks=1;},/scaled physics/],
 ['changed replay tuning',x=>{x.played.tuning_changed=true;},/Replay tuning changed/],
 ['lost fixed command',x=>{x.played.applied=120;},/fixed-step commands/],
 ['wrong replay length',x=>{x.played.ticks=120;},/trace length/],
 ['position drift',x=>{x.played.max_position_m=0.06;},/position_m trajectory tolerance/],
 ['angular drift',x=>{x.played.max_angle_rad=0.06;},/angle_rad trajectory tolerance/],
 ['invalid position',x=>{x.played.max_position_m=NaN;},/position_m trajectory tolerance/],
 ['missing tolerance',x=>{x.options.tolerance=null;},/Missing genuine/]
])test('A21 replay verifier rejects '+name,()=>{
 const x=replayFixture();mutate(x);
 assert.throws(()=>verifyReplay(x.recorded,x.played,x.options),reason);
});

test('real Chromium focus lifecycle is valid even when inactive tab stays visible',()=>{
 const events=[
  {type:'focus',focus:true,visibility:'visible',monotonic_ms:1},
  {type:'blur',focus:false,visibility:'visible',monotonic_ms:2},
  {type:'focus',focus:true,visibility:'visible',monotonic_ms:3}
 ];
 assert.deepEqual(verifyFocusEvent(events,1,'blur',false),events[1]);
 assert.deepEqual(verifyFocusEvent(events,2,'focus',true),events[2]);
});
for(const [name,events,start,type,focus] of [
 ['missing blur',[],0,'blur',false],
 ['prior blur not new',[{type:'blur',focus:false,visibility:'visible',monotonic_ms:1}],1,'blur',false],
 ['still focused',[{type:'blur',focus:true,visibility:'visible',monotonic_ms:1}],0,'blur',false],
 ['missing focus return',[{type:'blur',focus:false,visibility:'visible',monotonic_ms:1}],0,'focus',true],
 ['invalid event clock',[{type:'blur',focus:false,visibility:'visible',monotonic_ms:NaN}],0,'blur',false],
 ['invented visibility',[{type:'blur',focus:false,visibility:'synthetic',monotonic_ms:1}],0,'blur',false]
])test('reject unsupported browser lifecycle '+name,()=>{
 assert.throws(()=>verifyFocusEvent(events,start,type,focus),/BLOCKED_BACKGROUND_FOCUS_EVENT_UNOBSERVED/);
});
test('reject missing or invalid lifecycle source',()=>{
 assert.throws(()=>verifyFocusEvent(null,0,'blur',false),/Missing genuine browser lifecycle/);
 assert.throws(()=>verifyFocusEvent([], -1,'blur',false),/Missing genuine browser lifecycle/);
});

test('real focus-loss probe owns an explicit BrowserContext and disables Playwright focus emulation',()=>{
 const runner=fs.readFileSync(path.resolve(__dirname,'../../tools/gym/fps356_runtime.cjs'),'utf8');
 for(const required of [
  'context=await browser.newContext({viewport:',
  'page=await context.newPage()',
  "focusCDP.send('Emulation.setFocusEmulationEnabled',{enabled:false})",
  'other=await page.context().newPage()',
  'await context.close().catch',
  'await other.bringToFront()',
  "e.type==='blur'&&e.focus===false",
  "e.type==='focus'&&e.focus===true",
  'window.riderTimeState?.paused===true',
  'comparePause(p,resume,'
 ])assert(runner.includes(required),'Missing real focus/context contract: '+required);
 for(const forbidden of [
  'page=await browser.newPage(',
  'window.riderTimeState={',
  'window.riderTimeState = {'
 ])assert(!runner.includes(forbidden),'Unsafe API-owned context or fake pause: '+forbidden);
});

test('real tab focus emulation is disabled on BOTH CDP targets after navigation',()=>{
 const runner=fs.readFileSync(path.resolve(__dirname,'../../tools/gym/fps356_runtime.cjs'),'utf8');
 const gameNav=runner.indexOf("await page.goto('http://127.0.0.1:'");
 const gameReassert=runner.indexOf("await focusCDP.send('Emulation.setFocusEmulationEnabled',{enabled:false});",gameNav);
 const focusStart=runner.indexOf('const focusStart=await page.evaluate(');
 const otherNav=runner.indexOf("await other.goto('about:blank');");
 const otherCDP=runner.indexOf('const otherFocusCDP=await context.newCDPSession(other);');
 const otherDisable=runner.indexOf("await otherFocusCDP.send('Emulation.setFocusEmulationEnabled',{enabled:false});");
 const otherFront=runner.indexOf('await other.bringToFront();');
 assert(gameNav>=0&&gameNav<gameReassert&&gameReassert<focusStart,
  'Game focus emulation must be disabled again after actual navigation');
 assert(focusStart<otherNav&&otherNav<otherCDP&&otherCDP<otherDisable&&otherDisable<otherFront,
  'Second tab must disable its own Playwright focus override before activation');
 for(const forbidden of [
  "Emulation.setFocusEmulationEnabled',{enabled:true}",
  'Emulation.setPageVisibilityState',
  "dispatchEvent(new Event('blur'))",
  'document.visibilityState =',
  'window.riderTimeState={'
 ])assert(!runner.includes(forbidden),'Synthetic focus/visibility or pause state: '+forbidden);
});

test('focus-loss verification remains fail-closed after independent real replay proof',()=>{
 const runner=fs.readFileSync(path.resolve(__dirname,'../../tools/gym/fps356_runtime.cjs'),'utf8');
 const replay=runner.indexOf('evidence.replay=verifyReplay(');
 const background=runner.indexOf("evidence.background=await pauseAndResume('background','background')");
 assert(replay>=0&&background>replay,'Replay must be independently verified before browser focus gate');
 assert(runner.includes('BLOCKED_BACKGROUND_FOCUS_UNOBSERVED:'),
  'Unobserved real blur must remain a hard blocker');
 assert(runner.includes('visibility_hidden_observed:'),
  'Visibility must be recorded honestly, not inferred from focus loss');
 assert(runner.includes('comparePause(p,resume,'),
  'Background pause must retain the exact zero-fixed-tick gate');
 for(const forbidden of [
  "dispatchEvent(new Event('blur'))",
  'document.visibilityState =',
  'window.riderTimeState={'
 ])assert(!runner.includes(forbidden),'Fake background/pause signal: '+forbidden);
});

test('headed Chromium focus lifecycle uses real X11 and never fabricates visibility',()=>{
 const runner=fs.readFileSync(path.resolve(__dirname,'../../tools/gym/fps356_runtime.cjs'),'utf8');
 for(const required of [
  "chromium.launch({headless:false})",
  "spawnSync('xvfb-run'",
  "FPS356_XVFB_CHILD",
  "BLOCKED_BACKGROUND_DISPLAY_UNAVAILABLE",
  "await page.addInitScript(()=>{",
  "document.addEventListener('visibilitychange'",
  "window.addEventListener('blur'",
  "window.addEventListener('focus'",
  "focusCDP.send('Emulation.setFocusEmulationEnabled',{enabled:false})",
  "document.hasFocus()",
  "visibility_hidden_observed:",
  "BLOCKED_BACKGROUND_FOCUS_UNOBSERVED:",
  "lifecycle:(window.riderFps356Lifecycle||[]).slice(-24)",
  "comparePause(p,resume,"
 ])assert(runner.includes(required),'Missing headed lifecycle or fixed-tick gate: '+required);
 for(const forbidden of [
  'chromium.launch();',
  'chromium.launch({headless:true})',
  "dispatchEvent(new Event('blur'))",
  'Emulation.setPageVisibilityState',
  'document.visibilityState =',
  'window.riderTimeState={'
 ])assert(!runner.includes(forbidden),'Synthetic or headless background proof: '+forbidden);
});
