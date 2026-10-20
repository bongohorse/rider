// A19d Balance station: slow skill driver with recorded/replayed trace, full throttle, seesaw tip/settle
// repeats, retries (R, V, mid-tip R) and an A -> B -> A world reload. Protocol: main/gym/README.md "Balance".
const {configure}=require('./launch.cjs');
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const P=require('./preset.cjs').fromArgv(process.argv);
// Repeat tolerances declared before runs (A19d).
const TOL={stop_x_m:.05,time_s:.1,tip_s:.05,angle_rad:.01};
const SECTIONS=['beam-2','beam-1.5','beam-1.2','beam-1.05','up','down','seesaw'];
(async()=>{
 const [root,sha,runId]=process.argv.slice(2),out=path.resolve(root);let browser,page;
 const errors=[],cases=[],skill={},replay={},full={},seesaw={};
 function find(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory()){const v=find(p);if(v)return v;}else if(e.name==='index.html')return p;}}
 const web=path.dirname(find(path.resolve(process.argv[6])));
 const server=http.createServer((req,res)=>{const f=path.resolve(web,'.'+new URL(req.url,'http://localhost').pathname);if(!f.startsWith(web+path.sep)||!fs.existsSync(f)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',f.endsWith('.wasm')?'application/wasm':f.endsWith('.js')?'text/javascript':'text/html');fs.createReadStream(f).pipe(res);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+'/index.html';
 const report=()=>page.evaluate(()=>window.riderStationReport);
 async function open(section,extra=''){
  await page.goto(url+`?station=balance&section=${section}`+extra+P.query);
  await page.waitForFunction(({sha,runId,section})=>window.riderReady?.source_sha===sha&&window.riderReady?.run_id===runId&&window.riderStationReport?.station==='balance'&&window.riderStationReport.section===section&&window.riderTelemetry?.sequence>2,{sha,runId,section});
 }
 // Edge-triggered R: hold until the game acknowledges the reset, then release (engine pitfall #5).
 async function retry(){
  const n=await page.evaluate(()=>window.riderTelemetry.reset_count);
  await page.keyboard.down('r');await page.waitForFunction(n=>window.riderTelemetry.reset_count===n+1,n);await page.keyboard.up('r');
  // Let the engine sample the release before any next press: an up/down pair inside one frame is no new press.
  const q=await page.evaluate(()=>window.riderTelemetry.sequence);await page.waitForFunction(q=>window.riderTelemetry.sequence>q+1,q);
 }
 // One attempt from an in-world reset with the given driver; waits for the verdict (and the plank).
 async function attempt(mode,trace){
  await page.evaluate(spec=>{window.riderBalanceTrial=spec;},{mode,trace});
  const before=(await report()).generation;await retry();
  // The attempt is the first generation after this R; a stray reset in between is a clear error.
  await page.waitForFunction(b=>window.riderStationReport.generation>b,before);
  const started=await report(),gen=started.generation,label=`${mode} attempt (generation ${gen})`;
  if(gen!==before+1||started.reset_reason!=='manual')throw Error(`${label}: expected one manual reset after generation ${before}, got ${started.reset_reason} to generation ${gen}`);
  // Every wait ends on its condition, on a later reset (a bounds or other reset starts a new generation and a new
  // attempt), or on a wall-clock timeout, each with a clear error; it never waits on a record that no longer runs.
  async function until(fn,timeout,what){
   try{await page.waitForFunction(fn,gen,{timeout});}
   catch(e){const s=await report().catch(()=>null);throw Error(`${label}: ${what} within ${timeout/1000} s (now generation ${s?.generation}, status ${s?.record?.status}, elapsed ${s?.record?.elapsed?.toFixed?.(2)} s): ${e.message}`);}
  }
  await until(g=>{const r=window.riderStationReport;return r.generation>g||(r.generation===g&&r.trial?.generation===g&&r.trial.mode!=='idle'&&r.record.done);},45000,'no verdict');
  let r=await report();
  if(r.generation!==gen)throw Error(`${label} was reset (now generation ${r.generation}) before its verdict`);
  if(r.record.type==='seesaw'&&r.record.seesaw.tip_at!==undefined){
   // The plank pose after the verdict counts too: wait until it is calm, 8 s pass, or a later reset ends the
   // attempt (e.g. a bounds reset after a fall: then the final plank pose stays unmeasured).
   await until(g=>{const r=window.riderStationReport;return r.generation!==g||r.record.seesaw.final_at!==undefined||r.record.elapsed>r.record.time_s+8;},20000,'plank neither calm nor 8 s past the verdict');
   const later=await report();
   if(later.generation===gen)r=later;
   else{
    const q=r.record.seesaw;q.final_unmeasured=`${later.reset_reason} reset to generation ${later.generation} before the plank was calm`;
    // Plank extremes up to that reset come from the next generation's report; after two resets they are lost.
    if(later.previous?.generation===q.generation){q.limit_reached=later.previous.limit_reached;q.max_abs_angle=later.previous.max_abs_angle;}
    else q.limit_unmeasured_after_verdict=true;
   }
  }
  await P.check(page);assert.equal(r.trial.mode,mode);assert.equal(r.comparable,true);assert.equal(r.start_speed,0);
  return r;
 }
 // The first n ticks of a run-length trace [[ticks, throttle, brake], ...].
 function trim(trace,n){const out=[];let left=n;for(const [k,t,b] of trace){if(left<=0)break;out.push([Math.min(k,left),t,b]);left-=k;}assert.equal(left<=0,true,'trace shorter than the verdict');return out;}
 function summary(r){const x=r.record;return {status:x.status,reason:x.reason,time_s:x.time_s,chassis_x:x.chassis_x,margin_rear_m:x.margin_rear_m,margin_front_m:x.margin_front_m,
  max_speed_mps:x.max_speed_mps,throttle_s:x.throttle_s,brake_s:x.brake_s,input_changes:x.input_changes,pitch_min:x.pitch_min,pitch_max:x.pitch_max,seesaw:x.seesaw};}
 try{
  browser=await chromium.launch();page=await browser.newPage({viewport:{width:1280,height:720}});
  await configure(page,runId,process.argv[5]);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(m.text()))errors.push(m.text());});
  // 1. ?station=balance opens directly at its first section from rest; the plank rests on the start deck.
  await page.goto(url+'?station=balance'+P.query);
  await page.waitForFunction(()=>window.riderStationReport?.station==='balance'&&window.riderStationReport.record.elapsed>1.5);
  let r=await report();const t=await page.evaluate(()=>window.riderTelemetry);
  assert.equal(r.section,'beam-2');assert.equal(t.start_speed,0);assert(Math.abs(t.first_tick_speed)<.05,'start from rest');assert.equal(t.section_count,SECTIONS.length);
  assert.equal(r.seesaw.joint_valid,true);assert.equal(r.seesaw.plank_joints,1);assert(Math.abs(r.seesaw.mass-20)<.01);
  assert(Math.abs(r.record.seesaw.rest_angle-r.record.seesaw.rest_target)<.02,'plank rests on the start deck: '+r.record.seesaw.rest_angle);
  assert.equal(r.record.seesaw.limit_reached,false);
  const counts={bodies:r.bodies,joints:r.joints,world_loads:t.world_loads,terrain_shapes:t.terrain_shapes};
  // Vehicle 3 bodies + terrain + plank (+ rider visuals have no body); 2 wheel joints + 1 seesaw joint.
  assert.equal(r.joints,3);
  await page.screenshot({path:path.join(out,'balance-start.png')});
  cases.push('direct_url_rest_start_plank_on_deck');
  // 2. Skill driver per section, then its recorded trace replayed open-loop with the same outcome.
  for(const section of SECTIONS){
   await open(section);
   const a=await attempt('skill');skill[section]={...summary(a),trace:a.trial.trace,ticks:a.trial.ticks};
   assert.equal(a.record.status,'COMPLETED',section+' skill: '+a.record.reason);
   assert.equal(a.record.throttle_s+a.record.brake_s>0,true);assert.equal(a.record.lean_max,0);
   if(section==='seesaw')await page.screenshot({path:path.join(out,'balance-seesaw-skill.png')});
   const b=await attempt('replay',a.trial.trace);replay[section]={...summary(b),trace:b.trial.trace};
   assert.equal(b.record.status,a.record.status,section+' replay status');
   assert(Math.abs(b.record.chassis_x-a.record.chassis_x)<=TOL.stop_x_m,section+' replay stop x');
   assert(Math.abs(b.record.time_s-a.record.time_s)<=TOL.time_s,section+' replay time');
   // The replay applied the same per-tick commands up to the verdict tick. Traces are captured at different
   // moments after the verdict, so only that prefix is compared.
   const ticks=Math.round(a.record.time_s*60);
   assert(trim(b.trial.trace,ticks).length>0);assert.deepEqual(trim(b.trial.trace,ticks),trim(a.trial.trace,ticks),section+' replay commands');
   if(section==='seesaw')for(const key of ['tip_at','settled_at','settled_angle','rest_angle'])
    assert(Math.abs(b.record.seesaw[key]-a.record.seesaw[key])<=(key.endsWith('_at')?TOL.tip_s:TOL.angle_rad),'seesaw replay '+key);
  }
  cases.push('skill_completes_every_section','recorded_trace_replays_same_outcome');
  // 3. Full throttle from rest: at least one section must be missed.
  for(const section of SECTIONS){await open(section);full[section]=summary(await attempt('full'));}
  assert(Object.values(full).some(r=>r.status==='MISSED'),'full throttle must fail at least one section');
  cases.push('full_throttle_misses');
  // 4. Seesaw: tip and settle repeat on further in-world retries; the safety limit is never reached.
  await open('seesaw');
  const runs=[skill.seesaw.seesaw];
  for(let i=0;i<2;i++){const a=await attempt('skill');assert.equal(a.record.status,'COMPLETED');runs.push(a.record.seesaw);}
  function same(q,p,label){
   for(const key of ['tip_at','settled_at'])assert(Number.isFinite(q[key])&&Math.abs(q[key]-p[key])<=TOL.tip_s,label+' '+key);
   for(const key of ['settled_angle','final_angle','rest_angle'])assert(Number.isFinite(q[key])&&Math.abs(q[key]-p[key])<=TOL.angle_rad,label+' '+key);
  }
  // Tipped and settled means the right tip rests on the exit deck: the mirror of the geometric rest angle
  // (station data, derived from the plank geometry), not merely below level.
  for(const q of runs){same(q,runs[0],'seesaw repeat');assert.equal(q.limit_reached,false);
   assert(Math.abs(q.settled_angle+q.rest_target)<.02,'plank settled on the exit deck: '+q.settled_angle);
   assert(Math.abs(q.rest_angle-q.rest_target)<.02,'plank rested on the start deck: '+q.rest_angle);}
  for(const r of [...Object.values(skill),...Object.values(replay),...Object.values(full)])if(r.seesaw)assert.equal(r.seesaw.limit_reached,false,'joint limit reached');
  seesaw.repeats=runs;cases.push('seesaw_tips_and_settles_reproducibly','joint_limit_never_reached');
  // 5. R while the plank is still swinging: canonical pose and velocity, a fresh joint, no stale handle.
  // Reports arrive every 0.25 s, so a short swing (about 0.15 s under preset C) can fall between two samples:
  // press R at the first sample after the tip, swinging or already tipped onto the exit deck. The reset records
  // the pose and angular velocity it replaced (before_angle, before_omega).
  // Preset A keeps main's rule: R only while a report shows the plank swinging (|omega| > 0.2 rad/s), asserted
  // below. Other presets (exemption for #204/#200 comparisons) press R at the first report after the tip.
  // A report can show the swing just before it ends (A swings about 0.22 s), so R may land as the plank
  // reaches the exit deck: preset A repeats the attempt (at most 3 times) until R replaced a swinging plank.
  const presetA=(await report()).preset==='a',midTries=[];
  let g,swinging,reset;
  for(let i=0;i<3;i++){
   await page.evaluate(()=>{window.riderBalanceTrial={mode:'skill'};});
   g=(await report()).generation;await retry();
   try{await page.waitForFunction(({g,a})=>{const r=window.riderStationReport;return r.generation>g&&r.record.seesaw.tip_at!==undefined&&(Math.abs(r.seesaw.omega)>.2||!a);},{g,a:presetA},{timeout:20000});}
   catch(e){const s=await report();throw Error(`mid-tip R: no ${presetA?'swinging ':''}tipped plank within 20 s (generation ${s.generation}, status ${s.record.status}, angle ${s.seesaw.angle}, omega ${s.seesaw.omega}): ${e.message}`);}
   swinging=(await report()).seesaw;
   g=(await report()).generation;await page.evaluate(()=>{window.riderBalanceTrial={mode:'idle'};});await retry();
   await page.waitForFunction(g=>window.riderStationReport.generation>g,g);
   r=await report();reset=r.seesaw.reset;
   assert.equal(reset.old_joint_valid,false);assert.equal(reset.joint_valid,true);assert.equal(reset.joints,1);assert.equal(reset.generation,swinging.generation+1);
   assert(Math.abs(reset.angle-r.record.seesaw.rest_target)<.005&&reset.omega===0&&reset.speed===0,'canonical plank after R');
   assert.equal(r.joints,3);assert.equal(r.bodies,counts.bodies);
   midTries.push(reset.before_omega);
   if(!presetA||Math.abs(reset.before_omega)>.2)break;
  }
  const after=await attempt('skill');same(after.record.seesaw,runs[0],'after mid-tip R');assert.equal(after.record.status,'COMPLETED');
  if(presetA)assert(Math.abs(reset.before_omega)>.2,'preset A: no R replaced a swinging plank in 3 tries, omegas '+midTries.join(', '));
  seesaw.mid_tip_retry={preset_a_rule:presetA,tries:midTries,swinging,reset,swinging_at_reset:Math.abs(reset.before_omega)>.2,after:after.record.seesaw};cases.push('mid_tip_retry_restores_plank_and_joint');
  // 5b. Retry canonicality (#217): the plank's first 60 ticks after R are bit-identical whatever came before it.
  // Histories: a fresh load (reference), R while the plank swings, R after it rested (asleep) and R after a full
  // attempt. Before the fix a resting plank kept its Box2D sleep timer through the reset and froze within one tick.
  {
   const traceOf=async g=>{await page.waitForFunction(g=>{const r=window.riderStationReport;return r.generation===g&&r.record.seesaw.trace.length>=60;},g,{timeout:10000});return (await report()).record.seesaw.trace;};
   async function idleRetry(){
    await page.evaluate(()=>{window.riderBalanceTrial={mode:'idle'};});
    const g=(await report()).generation;await retry();
    await page.waitForFunction(g=>window.riderStationReport.generation>g,g);
    const r=await report();assert.equal(r.generation,g+1);assert.equal(r.reset_reason,'manual');
    return traceOf(g+1);
   }
   await open('seesaw');const histories={load:await traceOf((await report()).generation)};
   // Resting: idle for 2 s more, so the plank has been calm (and asleep) well past Box2D's 0.5 s sleep time.
   await page.waitForFunction(()=>window.riderStationReport.record.elapsed>2.5);
   histories.after_rest=await idleRetry();
   await page.evaluate(()=>{window.riderBalanceTrial={mode:'skill'};});
   let g=(await report()).generation;await retry();
   await page.waitForFunction(g=>{const r=window.riderStationReport;return r.generation>g&&r.record.seesaw.tip_at!==undefined;},g,{timeout:20000});
   histories.mid_tip=await idleRetry();
   await attempt('full');
   histories.after_full=await idleRetry();
   // The trigger of #217: R while the plank is still awake but slow after the previous reset (its Box2D sleep
   // timer part-used; it sleeps about 0.5 s after a reset). The second R follows the acknowledged first one after
   // three animation frames (the engine samples input once per frame, so the release is seen), i.e. within about
   // 0.3 s of the first reset; repeat until a reset replaced an awake, slow plank.
   let trigger=null;
   for(let i=0;i<5&&!trigger;i++){
    await page.evaluate(()=>{window.riderBalanceTrial={mode:'idle'};});
    const n=await page.evaluate(()=>window.riderTelemetry.reset_count),g=(await report()).generation;
    await page.keyboard.down('r');await page.waitForFunction(n=>window.riderTelemetry.reset_count===n+1,n);await page.keyboard.up('r');
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(r)))));
    await page.keyboard.down('r');await page.waitForFunction(n=>window.riderTelemetry.reset_count===n+2,n);await page.keyboard.up('r');
    await page.waitForFunction(g=>window.riderStationReport.generation===g+2,g);
    const r=await report(),t=await traceOf(g+2);
    if(r.seesaw.reset.before_awake&&Math.abs(r.seesaw.reset.before_omega)>0&&Math.abs(r.seesaw.reset.before_omega)<0.025)trigger={attempt:i+1,before:r.seesaw.reset,trace:t};
    const s=await page.evaluate(()=>window.riderTelemetry.sequence);await page.waitForFunction(s=>window.riderTelemetry.sequence>s+1,s);
   }
   if(!trigger)throw Error('#217 trigger not reached: no R replaced an awake, slow plank in 5 back-to-back tries (last reset replaced '+JSON.stringify((await report()).seesaw.reset)+')');
   histories.back_to_back=trigger.trace;
   seesaw.retry_trigger={attempt:trigger.attempt,before_angle:trigger.before.before_angle,before_omega:trigger.before.before_omega};
   await page.waitForFunction(()=>window.riderStationReport.record.elapsed>2.5);
   histories.after_rest_again=await idleRetry();
   const ref=histories.load,differ=[];
   for(const [name,t] of Object.entries(histories)){
    const i=t.findIndex((v,k)=>v[0]!==ref[k][0]||v[1]!==ref[k][1]);
    if(i>=0)differ.push(`${name}: tick ${i+1} angle ${t[i][0]} omega ${t[i][1]} vs ${ref[i][0]} ${ref[i][1]}; tick 60 angle ${t[59][0]} vs ${ref[59][0]}`);
   }
   seesaw.retry_histories={ticks:60,reference:'load',final_angles:Object.fromEntries(Object.entries(histories).map(([k,t])=>[k,t[59][0]])),differ};
   assert.deepEqual(differ,[],'seesaw retry depends on history:\n'+differ.join('\n'));
   cases.push('seesaw_retry_history_independent');
  }
  // 6. V (section switch) keeps the world and terrain; the plank joint is recreated on the same terrain body.
  await open('down');let before=await page.evaluate(()=>window.riderTelemetry);const gen=(await report()).seesaw.generation;
  await page.keyboard.down('v');await page.waitForFunction(n=>window.riderStationReport.section==='seesaw'&&window.riderTelemetry.reset_count===n+1,before.reset_count);await page.keyboard.up('v');
  r=await report();const now=await page.evaluate(()=>window.riderTelemetry);
  assert.equal(now.world_loads,before.world_loads);assert.equal(now.terrain_shapes,before.terrain_shapes);
  assert.equal(r.seesaw.generation,gen+1);assert.equal(r.seesaw.joint_valid,true);assert.equal(r.joints,3);
  cases.push('section_switch_keeps_terrain_recreates_joint');
  // 7. A -> B -> A world reload: the new session owns a new plank and joint; counts return to the same values.
  await page.goto(url+'?station=balance&touch=1'+P.query);await page.waitForFunction(()=>window.riderStationReport?.station==='balance'&&window.riderTelemetry?.sequence>2);
  const first=await page.evaluate(()=>({loads:window.riderTelemetry.world_loads}));
  await page.keyboard.down('9');await page.waitForFunction(()=>window.riderTelemetry?.station==='gaps-landing');await page.keyboard.up('9');
  for(let i=0;i<6;i++){
   if(await page.evaluate(()=>window.riderTelemetry?.station==='balance'))break;
   const s=await page.evaluate(()=>window.riderTelemetry.station);
   await page.getByRole('button',{name:'Next station',exact:true}).click();await page.waitForFunction(s=>window.riderTelemetry?.station!==s&&window.riderTelemetry.sequence>2,s);
  }
  await page.waitForFunction(()=>window.riderStationReport?.station==='balance'&&window.riderStationReport.record.elapsed>1.5);
  r=await report();const loads=await page.evaluate(()=>window.riderTelemetry.world_loads);
  assert(loads>=first.loads+2,'two world reloads');assert.equal(r.bodies,counts.bodies);assert.equal(r.joints,3);
  assert.equal(r.seesaw.generation,2);assert.equal(r.seesaw.plank_joints,1);assert(Math.abs(r.record.seesaw.rest_angle-r.record.seesaw.rest_target)<.02);
  seesaw.world_reload={loads_before:first.loads,loads_after:loads,bodies:r.bodies,joints:r.joints};cases.push('a_b_a_world_reload_counts');
  if(errors.length)throw Error(errors.join('\n'));
  const result={status:'PASS',...P.report(),source_sha:sha,run_id:runId,browser:browser.version(),tolerances:TOL,cases,counts,skill,replay,full,seesaw,real_device:'NOT RUN'};
  fs.writeFileSync(path.join(out,'balance-result.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify({status:result.status,cases,sections:Object.fromEntries(SECTIONS.map(s=>[s,{skill:skill[s].status,stop_x:+skill[s].chassis_x.toFixed(3),margins:[+skill[s].margin_rear_m.toFixed(3),+skill[s].margin_front_m.toFixed(3)],time_s:+skill[s].time_s.toFixed(2),full:full[s].status+' ('+full[s].reason+')'}])),
   seesaw:{tip_at:runs[0].tip_at,settled_at:runs[0].settled_at,settled_angle:runs[0].settled_angle,final_angle:runs[0].final_angle,rest_angle:runs[0].rest_angle,max_abs_angle:Math.max(...runs.map(q=>q.max_abs_angle))}}));
 }catch(e){if(page){await page.screenshot({path:path.join(out,'balance-failed.png')}).catch(()=>{});fs.writeFileSync(path.join(out,'balance-failed-state.json'),JSON.stringify({skill,replay,full,errors,state:await page.evaluate(()=>({telemetry:window.riderTelemetry,report:window.riderStationReport})).catch(()=>null)},null,2));}throw e;}
 finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
