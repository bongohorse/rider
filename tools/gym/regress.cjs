// A22 regression traces (#37), debug gym case `a22`. Check mode (CI): every stored trace replays through the shared
// A21 player at 1.0x and 60 Hz and must PASS the frozen check (tools/gym/regress_spec.cjs); one trace again at a
// 30 FPS render rate; a perturbed trace and a perturbed preset value must FAIL; a malformed trace is refused.
// Record mode (`--record`, deliberate regeneration only): records every trace with its station protocol driver,
// rewrites tests/regress/, prints old -> new outcomes, then runs the full check on the new files.
const {configure}=require('./launch.cjs');
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const S=require('./regress_spec.cjs');
const RECORD=process.argv.includes('--record');
// Regeneration is a deliberate local step: CI must only check the stored traces, never re-record and check itself.
if(RECORD&&process.env.CI){console.error('a22 --record is refused in CI (CI is set): regenerate locally and review the diff');process.exit(2);}
const args=process.argv.slice(2).filter(a=>a!=='--record');
(async()=>{
 const [root,sha,runId,testcase,bundle]=args;const out=path.resolve(root);let browser,page;
 const errors=[],cases=[],results={};
 function find(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory()){const v=find(p);if(v)return v;}else if(e.name==='index.html')return p;}}
 const web=path.dirname(find(path.resolve(bundle)));
 const server=http.createServer((req,res)=>{const f=path.resolve(web,'.'+new URL(req.url,'http://localhost').pathname);if(!f.startsWith(web+path.sep)||!fs.existsSync(f)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',f.endsWith('.wasm')?'application/wasm':f.endsWith('.js')?'text/javascript':'text/html');fs.createReadStream(f).pipe(res);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+'/index.html';
 // Interval polling: Playwright's default requestAnimationFrame polling stalls under the half-rate frame skip.
 const wait=(fn,arg,options={})=>page.waitForFunction(fn,arg,{polling:50,...options});
 // One fresh page (fresh engine and Lua state) per run. half: the A21 test-page render-rate control (every other
 // animation frame skipped: 30 FPS render, 60 Hz physics with two ticks per frame). The game is unchanged.
 async function run(def,{spec,trace=null,debug={},half=false,query=def.query}){
  if(page)await page.close();
  page=await browser.newPage({viewport:{width:1280,height:720}});
  await page.addInitScript(({spec,trace,debug,half})=>{
   window.riderRegressSpec=spec;window.riderRegressTrace=trace;window.riderReplayDebug=debug;window.riderHalfRate=half;
   const raf=window.requestAnimationFrame.bind(window);let n=0;
   window.requestAnimationFrame=cb=>raf(function tick(t){if(window.riderHalfRate&&(n++%2===0))return raf(tick);cb(t);});
  },{spec,trace,debug,half});
  await configure(page,runId,testcase);
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(m.text()))errors.push(m.text());});
  await page.goto(url+query);
  await wait(({sha,runId})=>window.riderReady?.source_sha===sha&&window.riderReady?.run_id===runId,{sha,runId});
  let start=null;
  if(spec.mode==='check'){
   await wait(()=>window.riderRegress&&window.riderRegress.phase!=='waiting',null,{timeout:30000});
   start=await page.evaluate(()=>({frames:window.riderReplay?.frames,ticks:window.riderReplay?.ticks}));
  }
  await wait(()=>window.riderRegressResult,null,{timeout:60000});
  const state=await page.evaluate(()=>({result:window.riderRegressResult,replay:window.riderReplay,recording:window.riderRegressRecording||null,telemetry:window.riderTelemetry}));
  assert.equal(state.replay.station,def.station);assert.equal(state.replay.section,def.section);
  if(start&&state.result.phase==='replayed'){
   const ticks=state.replay.ticks-start.ticks;
   state.frames_per_tick=+((state.replay.frames-start.frames)/ticks).toFixed(3);
  }
  return state;
 }
 // One replay of a trace object; returns the measured outcomes and the frozen check's failures.
 async function replay(def,trace,label,options={}){
  const expected=S.readExpected().traces[def.name];
  const s=await run(def,{spec:{mode:'check',...(options.tune?{tune:options.tune}:{})},trace,half:options.half});
  assert.equal(s.result.phase,'replayed',label+': '+s.result.error);
  assert.equal(s.replay.factor,1);
  // #211: preset A has no air pitch damping; the vehicle's own counter proves it was never applied.
  assert.equal(s.result.preset,'a',label+': preset');assert.equal(s.result.damped_ticks,0,label+': air pitch damping applied on preset A');
  const measured=S.outcomes(def,s.result),play=s.replay.play;
  const failures=S.check(def,expected.outcomes,measured,play);
  const r={label,trace:def.name,verdict:play.verdict,max_position_m:play.max_position_m,max_angle_rad:play.max_angle_rad,
   applied:play.applied,mismatches:play.mismatches,scaled_ticks:play.scaled_ticks,frames_per_tick:s.frames_per_tick,measured,
   expected:expected.outcomes,failures,tune:s.result.tune,preset:s.result.preset,modified:s.result.modified,damped_ticks:s.result.damped_ticks,pass:failures.length===0};
  results[label]=r;
  console.log(label+': '+(r.pass?'PASS':'FAIL '+failures.map(f=>f.check).join(','))+' '+JSON.stringify({verdict:r.verdict,max_position_m:r.max_position_m,measured}));
  return r;
 }
 function stored(def){
  const trace=S.readTrace(def.name),A=S.presetA();
  // Every stored trace is the measurement baseline: preset A, unmodified, its exact values and identity.
  assert.equal(trace.preset,'a',def.name+': preset');assert.equal(trace.modified,false,def.name+': modified');
  assert.deepEqual(trace.tuning,A.values,def.name+': tuning is preset A');assert.equal(trace.identity,A.identity,def.name+': identity');
  assert.equal(trace.ticks,def.ticks);assert.equal(trace.station,def.station);assert.equal(trace.section,def.section);assert.equal(trace.start_speed,def.start_speed);
  return trace;
 }
 async function checkAll(){
  // 1. Every trace at 60 FPS render: MATCH and every outcome within the frozen tolerances.
  for(const def of S.TRACES){
   const r=await replay(def,stored(def),'trace '+def.name);
   assert(r.pass,def.name+' regression: '+JSON.stringify(r.failures));
   assert(r.frames_per_tick>0.85&&r.frames_per_tick<1.15,'60 FPS render: '+r.frames_per_tick);
   cases.push('trace_'+def.name);
  }
  // 2. The jump trace again at a 30 FPS render rate (60 Hz physics unchanged).
  const gaps=S.TRACES.find(d=>d.name==='gaps-3');
  const half=await replay(gaps,stored(gaps),'render 30 FPS gaps-3',{half:true});
  assert(half.pass,'30 FPS: '+JSON.stringify(half.failures));
  assert(half.frames_per_tick>0.4&&half.frames_per_tick<0.6,'30 FPS render: '+half.frames_per_tick);
  cases.push('render_30fps');
  // 3. Perturbed trace: throttle released on the declared ticks; poses and expectations unchanged. Must FAIL.
  const pt=S.PERTURB.trace,ptDef=S.TRACES.find(d=>d.name===pt.name),bad=stored(ptDef);
  for(let k=pt.throttle_zero[0];k<=pt.throttle_zero[1];k++)bad.throttle[k-1]=0;
  const p1=await replay(ptDef,bad,'perturbed trace '+pt.name);
  assert(!p1.pass,'perturbed trace passed');assert.equal(p1.verdict,'DIVERGED');
  for(const c of pt.must_fail)assert(p1.failures.some(f=>f.check===c),'perturbed trace did not fail '+c);
  cases.push('perturbed_trace_fails');
  // 4. Perturbed preset value (debug only, live-tuning path before the replay). Must FAIL on the outcome.
  const pp=S.PERTURB.preset,ppDef=S.TRACES.find(d=>d.name===pp.name);
  const p2=await replay(ppDef,stored(ppDef),'perturbed preset '+pp.name,{tune:pp.tune});
  assert.equal(p2.tune.applied,true,'perturbation applied');assert.equal(p2.modified,true);assert.equal(p2.verdict,'COMPARED');
  assert(!p2.pass,'perturbed preset passed');
  for(const c of pp.must_fail)assert(p2.failures.some(f=>f.check===c),'perturbed preset did not fail '+c);
  cases.push('perturbed_preset_fails');
  // 5. A malformed trace (one command array a tick short) is refused visibly; nothing replays.
  const short=stored(gaps);short.lean.pop();
  const m=await run(gaps,{spec:{mode:'check'},trace:short});
  assert.equal(m.result.phase,'refused');assert.match(m.result.error,/lean length/);assert.equal(m.replay.play,false);
  // A trace that is not preset A unmodified is refused too.
  const other=stored(gaps);other.modified=true;
  const o=await run(gaps,{spec:{mode:'check'},trace:other});
  assert.equal(o.result.phase,'refused');assert.match(o.result.error,/not preset A unmodified/);assert.equal(o.replay.play,false);
  results.refused={malformed:m.result.error,modified:o.result.error};
  cases.push('malformed_trace_refused');
 }
 async function record(){
  const old=fs.existsSync(S.EXPECTED)?S.readExpected():{traces:{}};
  const expected={schema:1,preset:'a',note:'Measured outcomes of tests/regress/traces/*.json, written by `smoke.py --case a22 --record` only. Tolerances: tools/gym/regress_spec.cjs.',
   recorded:{source_sha:sha,browser:'chromium '+browser.version(),platform:'HTML5 debug (wasm-web), Playwright Chromium, headless',physics_hz:60,render_fps:60,time_factor:1},traces:{}};
  const table=[];
  fs.mkdirSync(path.join(S.DIR,'traces'),{recursive:true});
  for(const def of S.TRACES){
   const s=await run(def,{spec:{mode:'record',program:def.program},debug:{cap:def.ticks},query:def.query+(def.record_query||'')});
   assert.equal(s.result.phase,'recorded',def.name+': '+s.result.error);
   const rec=s.recording;
   assert.equal(rec.ticks,def.ticks);assert.equal(rec.ended,'full');assert.equal(rec.error,false);assert.equal(rec.scaled_ticks,0);assert.equal(rec.trailing,true);
   assert.equal(rec.preset,'a');assert.equal(rec.modified,false);assert.equal(rec.tuning_changed,false);assert.equal(rec.source_sha,sha);
   const measured=S.outcomes(def,s.result);
   assert.equal(measured.complete,true,def.name+': outcome not complete within the trace');
   const text=S.traceText(def,rec,{browser:'chromium '+browser.version(),program:def.program,query:def.query+(def.record_query||'')});
   fs.writeFileSync(S.file(def.name),text);
   expected.traces[def.name]={file:'traces/'+def.name+'.json',sha256:S.sha256(text),ticks:def.ticks,outcomes:measured};
   for(const [k,v] of Object.entries(measured))table.push({trace:def.name,outcome:k,old:old.traces[def.name]?.outcomes?.[k]??null,new:v});
  }
  fs.writeFileSync(S.EXPECTED,JSON.stringify(expected,null,1)+'\n');
  console.log('A22 regenerated outcomes (old -> new):');
  for(const r of table)console.log(`| ${r.trace} | ${r.outcome} | ${r.old} | ${r.new} |`);
  results.regenerated=table;
  cases.push('recorded');
 }
 try{
  browser=await chromium.launch();
  if(RECORD)await record();
  await checkAll();
  if(errors.length)throw Error(errors.join('\n'));
  const report={status:'PASS',source_sha:sha,run_id:runId,browser:browser.version(),mode:RECORD?'record':'check',tolerance:S.TOLERANCE,cases,results,
   limits:'HTML5 debug build in headless Playwright Chromium only; 60 Hz physics at time factor 1.0; render checked at 60 and 30 FPS. No cross-platform, native, Android or device determinism claim.',real_device:'NOT RUN'};
  fs.writeFileSync(path.join(out,'regress-result.json'),JSON.stringify(report,null,1));
  console.log(JSON.stringify({status:report.status,cases}));
 }catch(e){
  console.error(e);
  try{if(page){await page.screenshot({path:path.join(out,'regress-failure.png')});console.error(JSON.stringify(await page.evaluate(()=>({regress:window.riderRegress,result:window.riderRegressResult,play:window.riderReplay?.play}))));}}catch{}
  fs.writeFileSync(path.join(out,'regress-failed.json'),JSON.stringify({cases,results,errors},null,1));
  process.exitCode=1;
 }finally{await browser?.close();server.close();}
})();
