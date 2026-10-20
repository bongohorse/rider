// A19b Bumps station in the debug HTML5 gym: geometry reproduced by the editor compiler, URL start and R,
// the wave ladder and crest-dip at the default start speed and at 7 m/s, a crest lift-off speed sweep and
// repeatability. Protocol: main/gym/bump_metrics.lua (M.protocol) and main/gym/README.md#bumps.
const {configure}=require('./launch.cjs');
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const P=require('./preset.cjs').fromArgv(process.argv);
const geometry=require('./bumps_geometry.cjs'),{serve,differing}=require('./bumps_station.cjs'),{plan,cases:planned}=require('./bump_report.cjs');
// Declared before the evidence runs.
const TOL={share:.02,compression_m:.005,pitch_rad:.01,apex_mps:.02};
const SWEEP=[2.5,3,3.5,4,4.5,5,5.5,6,6.5,7],BISECT=3,COMPARE=7;
(async()=>{
 const [root,sha,runId]=process.argv.slice(2),out=path.resolve(root);let browser,page;
 const {base,close}=await serve(process.argv[6]);
 const cases=[],errors=[],ladders={},sweep=[],liftoff={};let repeats,retry,shape;
 // CI runs one part (GYM_PART, tools/gym/bump_report.cjs); without it the full protocol runs.
 const part=process.env.GYM_PART||null,scope=plan(part);
 // Wall-clock seconds per completed case (CI part sizing; not a measurement).
 const timings={},started=Date.now();let lap=started;
 const done=name=>{cases.push(name);timings[name]=(Date.now()-lap)/1000;lap=Date.now();};
 const layout=geometry.layout(),sections=layout.sections.map(s=>s.id),crests=layout.sections.at(-1).features.filter(f=>f.type==='crest').map(f=>f.id);
 try{
  browser=await chromium.launch();
  // 1. The committed station and editor source equal a fresh editor compile of the layout.
  if(scope.ladders){
   const compiled=await geometry.compile(browser,base,crypto.randomUUID());
   assert.deepEqual(differing(compiled),[],'bumps.json / bumps-source.json are stale: run node tools/gym/bumps_station.cjs <bundle>');
   const station=JSON.parse(fs.readFileSync(path.join(__dirname,'../../',geometry.STATION_FILE),'utf8'));
   shape={chain_points:station.chains[0].length,labels:station.labels.length,render_objects:station.chains[0].length-1+station.labels.length};
   assert.ok(shape.render_objects<=800,'station render budget');
   done('geometry_reproduced_by_editor_compiler');
  }

  page=await browser.newPage({viewport:{width:1280,height:720}});
  await configure(page,runId,process.argv[5]);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(m.text()))errors.push(m.text());});
  const report=()=>page.evaluate(()=>window.riderStationReport);
  const record=(r,id)=>r.records.find(x=>x.id===id);
  const brief=r=>({id:r.id,status:r.status,stop_x_m:r.stop_x_m??null,elapsed_s:r.elapsed,features:r.features.map(f=>({id:f.id,type:f.type,height_m:f.height_m,wavelength_m:f.wavelength_m,steps:f.steps,
   loss_share_rear:f.loss_share_rear,loss_share_front:f.loss_share_front,loss_share_any:f.loss_share_any,loss_share_both:f.loss_share_both,
   compression_rear_m:f.compression_rear_m,compression_front_m:f.compression_front_m,compression_max_m:f.compression_max_m,compression_share_max:f.compression_share_max,entry_compression_m:f.entry_compression_m,pitch_min_rad:f.pitch_min_rad,pitch_max_rad:f.pitch_max_rad,
   vx_min_mps:f.vx_min_mps,vx_max_mps:f.vx_max_mps,apex_speed_mps:f.apex_speed_mps??null,lifted:f.lifted,lift_speed_mps:f.lift_speed_mps??null,lift_x_m:f.lift_x_m??null,
   chassis_contact:f.chassis_contact,bottomed:f.bottomed,underbody_x_m:f.underbody_x_m??null}))});
  async function open(query,section){
   await page.goto(base+'?station=bumps'+query+P.query);
   await page.waitForFunction(({sha,runId,section})=>window.riderReady?.source_sha===sha&&window.riderReady?.run_id===runId&&window.riderStationReport?.station==='bumps'&&window.riderStationReport.section===section&&window.riderTelemetry?.sequence>1,{sha,runId,section});
  }
  // Holds a key until the game acknowledges it (pitfall 5).
  async function press(key,acknowledged,arg){await page.keyboard.down(key);await page.waitForFunction(acknowledged,arg);await page.keyboard.up(key);}
  async function finished(id,features){
   await page.waitForFunction(({id,features})=>{const r=window.riderStationReport.records.find(x=>x.id===id);return r?.entered&&(features?r.features.filter(f=>features.includes(f.id)).every(f=>f.done):r.done);},{id,features},{timeout:120000});
   const r=await report();await P.check(page);assert.equal(r.comparable,true);motor=r.tuning_at_start.motor_speed;assert.ok(Number.isFinite(motor)&&motor!==0);return record(r,id);
  }
  // The A18 powered control: throttle = start speed / (|preset motor_speed| x wheel radius 0.22 m).
  let motor;
  const hold=speed=>Math.min(1,Math.max(0,speed/(Math.abs(motor)*.22)));
  const longFresh=async()=>{await open('&section=long-0.3','long-0.3');return finished('long-0.3');};
  function check(r,speed,complete=true){
   assert.equal(r.independent,true,r.id);assert.equal(r.start_speed,speed);
   assert.ok(Math.abs(r.throttle_min-hold(speed))<1e-9&&Math.abs(r.throttle_max-hold(speed))<1e-9,'constant hold throttle '+r.id);
   assert.equal(r.brake_max,0);assert.equal(r.lean_max,0);
   // A stall (1 s below 0.1 m/s, e.g. the chassis grounded on a crest) is a measured outcome, not a failure.
   if(complete)assert.ok(['DONE','STALLED'].includes(r.status),r.id+' '+r.status);
   if(r.status==='STALLED')assert.ok(Number.isFinite(r.stop_x_m));
   for(const f of r.features)if(f.steps>0||(r.status==='DONE'&&(complete||f.done))){
    assert.ok(f.steps>0,f.id);
    for(const k of ['loss_share_rear','loss_share_front','loss_share_any','loss_share_both'])assert.ok(f[k]>=0&&f[k]<=1,k);
    assert.ok(Number.isFinite(f.compression_max_m)&&Number.isFinite(f.pitch_min_rad)&&Number.isFinite(f.pitch_max_rad));
    if(f.type!=='waves'&&f.end_x+1.5<(r.stop_x_m??Infinity))assert.ok(Number.isFinite(f.apex_speed_mps),'apex reached '+f.id);
   }
  }
  if(scope.ladders){
  // 2. ?station=bumps opens the first section directly; R returns to its start without a world reload.
  // A record is independent only when its first observed step is within 0.5 m of the section start.
  const atStart=()=>page.waitForFunction(()=>{const r=window.riderStationReport.records[0];return r.entered&&r.independent&&r.elapsed<1;});
  await open('','long-0.05');await atStart();
  const start=await page.evaluate(()=>window.riderTelemetry);
  assert.equal(start.start_speed,geometry.START_SPEED);assert.deepEqual([start.spawn_x,start.spawn_y],[0,0.9]);
  assert.ok(Math.abs(start.first_tick_speed-geometry.START_SPEED)<.2,'authored start speed');
  await page.waitForFunction(()=>window.riderTelemetry.station_distance>8);
  await press('r',n=>window.riderTelemetry.reset_count===n+1,start.reset_count);
  await atStart();
  assert.equal(await page.evaluate(()=>window.riderTelemetry.world_loads),start.world_loads);
  done('url_opens_station_and_r_returns_to_start');

  // 3. Every section at the default start speed and at 7 m/s; V switches sections in the same world.
  for(const speed of [geometry.START_SPEED,COMPARE]){
   ladders[speed]=[];
   await open(speed===geometry.START_SPEED?'&section='+sections[0]:`&section=${sections[0]}&speed=${speed}`,sections[0]);
   for(let i=0;i<sections.length;i++){
    // crest-dip opens fresh, so its repeat below compares two fresh loads (an in-world reset drifts slightly).
    if(sections[i]==='crest-dip')await open(`&section=crest-dip${speed===geometry.START_SPEED?'':'&speed='+speed}`,'crest-dip');
    else if(i>0){const n=await page.evaluate(()=>window.riderTelemetry.reset_count);await press('v',({id,n})=>window.riderStationReport.section===id&&window.riderTelemetry.reset_count===n+1,{id:sections[i],n});}
    if(speed===geometry.START_SPEED&&sections[i]==='short-0.3'){await page.waitForFunction(()=>window.riderTelemetry.station_distance>7.5,null,{timeout:30000});await page.screenshot({path:path.join(out,'bumps-short-waves.png')});}
    const r=await finished(sections[i]);check(r,speed);ladders[speed].push(r);
   }
   assert.equal(await page.evaluate(()=>window.riderTelemetry.world_loads),1);
  }
  done('ladder_default_and_comparison_speed');
  }

  // 4. Lift-off speed: crest-dip at hold speeds; each crest is lifted or not at its measured apex speed.
  async function crestRun(speed){
   await open(`&section=crest-dip&speed=${speed}`,'crest-dip');
   const r=await finished('crest-dip',crests);check(r,speed,false);
   const run={speed,crests:Object.fromEntries(r.features.filter(f=>crests.includes(f.id)).map(f=>[f.id,{lifted:f.lifted,apex_speed_mps:f.apex_speed_mps,lift_speed_mps:f.lift_speed_mps??null,lift_x_m:f.lift_x_m??null,lift_wheel:f.lift_wheel??null}]))};
   sweep.push(run);return run;
  }
  if(scope.sweep){
  for(const speed of SWEEP)await crestRun(speed);
  // Bisection between the fastest sweep speed without and the slowest with a lift-off, per crest.
  for(const id of crests){
   const runs=()=>sweep.filter(s=>Number.isFinite(s.crests[id]?.apex_speed_mps)),lifted=()=>runs().filter(s=>s.crests[id].lifted),kept=()=>runs().filter(s=>!s.crests[id].lifted);
   if(!lifted().length||!kept().length){liftoff[id]={bracketed:false,lifted_runs:lifted().length,runs:runs().length};continue;}
   for(let k=0;k<BISECT;k++){
    const lo=Math.max(...kept().map(s=>s.speed).filter(v=>v<Math.min(...lifted().map(s=>s.speed)))),hi=Math.min(...lifted().map(s=>s.speed).filter(v=>v>lo));
    if(!Number.isFinite(lo)||!Number.isFinite(hi))break;
    await crestRun(Number(((lo+hi)/2).toFixed(4)));
   }
   const without=Math.max(...kept().map(s=>s.crests[id].apex_speed_mps)),with_=Math.min(...lifted().map(s=>s.crests[id].apex_speed_mps));
   liftoff[id]={bracketed:true,highest_apex_without_mps:without,lowest_apex_with_mps:with_,monotonic:without<with_,
    start_speeds_without:kept().map(s=>s.speed).sort((a,b)=>a-b),start_speeds_with:lifted().map(s=>s.speed).sort((a,b)=>a-b)};
  }
  assert.ok(Object.values(liftoff).some(x=>x.bracketed),'lift-off speed measured over at least one crest');
  done('crest_liftoff_speed_sweep');
  }

  // 5. Fresh loads repeat the measurements within the declared tolerances; R repeats a section in-world.
  function same(a,b){
   assert.equal(a.status,b.status);
   a.features.forEach((f,i)=>{const g=b.features[i];
    for(const k of ['loss_share_rear','loss_share_front','loss_share_any','loss_share_both'])assert.ok(Math.abs(f[k]-g[k])<=TOL.share,`${f.id} ${k} ${f[k]} vs ${g[k]}`);
    assert.ok(Math.abs(f.compression_max_m-g.compression_max_m)<=TOL.compression_m,f.id+' compression');
    assert.ok(Math.abs(f.pitch_min_rad-g.pitch_min_rad)<=TOL.pitch_rad&&Math.abs(f.pitch_max_rad-g.pitch_max_rad)<=TOL.pitch_rad,f.id+' pitch');
    assert.equal(f.lifted,g.lifted,f.id+' lifted');assert.equal(f.bottomed,g.bottomed,f.id+' bottomed');
    if(f.type!=='waves')assert.ok(Math.abs(f.apex_speed_mps-g.apex_speed_mps)<=TOL.apex_mps,f.id+' apex');
   });
  }
  if(scope.ladders){
  // Two fresh loads, asserted on the highest long waves and crest-dip (both must complete). A stalled
  // section (chassis grounded on a crest) is chaotic: its ladder run (reached via V) and a fresh load are
  // recorded, not held to the tolerances.
  repeats=[];
  const firsts={'long-0.3':await longFresh(),'crest-dip':ladders[geometry.START_SPEED].find(r=>r.id==='crest-dip')};
  for(const id of ['long-0.3',...ladders[geometry.START_SPEED].filter(r=>r.status==='STALLED').map(r=>r.id),'crest-dip']){
   await open('&section='+id,id);const again=await finished(id);check(again,geometry.START_SPEED);
   const asserted=Object.hasOwn(firsts,id),first=firsts[id]??ladders[geometry.START_SPEED].find(r=>r.id===id);
   if(asserted){assert.equal(first.status,'DONE',id);check(first,geometry.START_SPEED);same(first,again);}
   repeats.push({id,asserted,first:brief(first),again:brief(again)});
  }
  // R repeats a section in the same world. Asserted on long-0.3 (as A19 on its widest gap); on the 90 m
  // crest-dip an in-world retry drifts slightly from a fresh load towards its end, so its largest
  // differences are recorded instead.
  async function retried(id,shot){
   const before=await page.evaluate(()=>window.riderTelemetry);
   await press('r',n=>window.riderTelemetry.reset_count===n+1,before.reset_count);
   await page.waitForFunction(id=>window.riderStationReport.records.find(r=>r.id===id).status==='RUNNING',id);
   if(shot){await page.waitForFunction(()=>window.riderStationReport.records.find(r=>r.id==='crest-dip').features.find(f=>f.id==='crest-4').steps>0,null,{timeout:60000});await page.screenshot({path:path.join(out,shot)});}
   const again=await finished(id);check(again,geometry.START_SPEED);
   assert.equal(await page.evaluate(()=>window.riderTelemetry.world_loads),before.world_loads);
   return brief(again);
  }
  const crestDip=repeats.at(-1).again,crestRetry=await retried('crest-dip','bumps-crest.png');
  const drift={};
  for(const k of ['loss_share_any','loss_share_both','compression_max_m','pitch_min_rad','pitch_max_rad','apex_speed_mps'])
   drift[k]=Math.max(...crestDip.features.map((f,i)=>Math.abs(f[k]-crestRetry.features[i][k])));
  assert.deepEqual(crestRetry.features.map(f=>[f.lifted,f.bottomed]),crestDip.features.map(f=>[f.lifted,f.bottomed]),'crest-dip retry keeps lift/bottom status');
  const longFirst=brief(await longFresh());
  retry={long:await retried('long-0.3'),crest_dip:{retry:crestRetry,largest_difference:drift}};same(longFirst,retry.long);
  done('repeatable_fresh_load_and_retry');
  }
  assert.deepEqual(cases,planned(scope));
  if(errors.length)throw Error(errors.join('\n'));
  // A part has only its own fields; the merge (bump_report.cjs) combines them.
  const result={status:'PASS',...(part?{part}:{}),...P.report(),source_sha:sha,run_id:runId,browser:browser.version(),cases,timings,tolerances:TOL,protocol:(await report()).protocol,
   geometry:shape??null,ladders:Object.fromEntries(Object.entries(ladders).map(([speed,rs])=>[speed,rs.map(brief)])),liftoff,sweep,repeats,retry,real_device:'NOT RUN'};
  fs.writeFileSync(path.join(out,'bumps-result.json'),JSON.stringify(result,null,2));
  const pct=x=>(100*x).toFixed(0)+'%';
  console.log(JSON.stringify({status:'PASS',part,cases,liftoff,ladder:(result.ladders[geometry.START_SPEED]??[]).flatMap(r=>r.features.filter(f=>f.steps>0).map(f=>`${r.id}/${f.id}: loss R ${pct(f.loss_share_rear)} F ${pct(f.loss_share_front)} both ${pct(f.loss_share_both)} comp ${f.compression_rear_m.toFixed(3)}/${f.compression_front_m.toFixed(3)} pitch ${f.pitch_min_rad.toFixed(3)}..${f.pitch_max_rad.toFixed(3)}${f.type==='waves'?'':` apex ${f.apex_speed_mps.toFixed(2)} lift ${f.lifted} bottom ${f.bottomed}`}`))}));
 }catch(e){if(page){await page.screenshot({path:path.join(out,'bumps-failed.png')}).catch(()=>{});fs.writeFileSync(path.join(out,'bumps-failed-state.json'),JSON.stringify({ladders,sweep,errors,state:await page.evaluate(()=>({telemetry:window.riderTelemetry,report:window.riderStationReport})).catch(()=>null)},null,2));}throw e;}
 finally{if(browser)await browser.close();await close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
