const {configure}=require('./launch.cjs');
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const station=require('./air_station.cjs');
const P=require('./preset.cjs').fromArgv(process.argv);
// A19c protocol, declared before evidence runs (main/gym/README.md#air-control).
// Repeat tolerances: takeoff speed, airtime (two 60 Hz steps), rotation, landing angle, compression.
const TOL={takeoff_mps:.02,airtime_s:.034,rotation_deg:5,landing_deg:5,compression_m:.005};
const SECTIONS=station.SECTIONS.map(s=>s.id),LEANS=[0,1,-1],DEFAULT_SPEED=7;
(async()=>{
 const [root,sha,runId]=process.argv.slice(2),out=path.resolve(root);let browser,page;
 const results=[],errors=[];
 function find(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory()){const v=find(p);if(v)return v;}else if(e.name==='index.html')return p;}}
 const web=path.dirname(find(path.resolve(process.argv[6])));
 const server=http.createServer((req,res)=>{const f=path.resolve(web,'.'+new URL(req.url,'http://localhost').pathname);if(!f.startsWith(web+path.sep)||!fs.existsSync(f)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',f.endsWith('.wasm')?'application/wasm':f.endsWith('.js')?'text/javascript':'text/html');fs.createReadStream(f).pipe(res);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+'/index.html';
 try{
  // The bundled station is exactly the generator output.
  const bundled=JSON.parse(fs.readFileSync(path.join(__dirname,'../..',station.FILE),'utf8'));
  assert.deepEqual(bundled,station.build(),'stations/air.json is stale (node tools/gym/air_station.cjs)');
  browser=await chromium.launch();page=await browser.newPage({viewport:{width:1280,height:720}});
  await configure(page,runId,process.argv[5]);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(m.text()))errors.push(m.text());});
  const main=(report,section)=>(report.jumps||[]).find(j=>j.from_lip&&j.section===section);
  function check(j,lean){
   assert.equal(j.approach_throttle_min,1,'full throttle to the lip');assert.equal(j.approach_lean_max,0,'no lean before takeoff');
   assert.equal(j.throttle_max,0);assert.equal(j.brake_max,0);
   assert.equal(j.lean_min,lean,'lean held for the whole flight');assert.equal(j.lean_max,lean,'lean held for the whole flight');
   assert(['LANDED','CRASHED'].includes(j.status)&&j.done&&j.complete,'final landing status');assert.equal(j.ground_found,true,'ground under the touchdown');
   assert(j.airtime_s>=.25&&Number.isFinite(j.takeoff_speed_mps)&&Number.isFinite(j.rotation_deg)&&Number.isFinite(j.landing_angle_deg)&&Number.isFinite(j.impact_normal_mps)&&j.peak_compression_m>=0);
   assert.equal(j.flips,Math.floor(Math.abs(j.rotation_deg)/360));
   assert(Math.abs(j.landing_angle_deg)<=180);
  }
  // #211: the optional air pitch damping acts only in neutral flight and never without the preset key (k = 0).
  function damping(report,j,lean){
   const k=report.tuning_at_start.air_pitch_damping;assert(Number.isFinite(k)&&k>=0,'air_pitch_damping in the tuning');
   if(k===0||lean!==0)assert.equal(j.damped_ticks,0,'no air damping with k = 0 or lean held');
   else assert(j.damped_ticks>0,'air damping applied in neutral flight');
  }
  async function trial(section,lean,{speed=DEFAULT_SPEED,shot,query}={}){
   await page.goto(url+(query??`?station=air&section=${section}&lean=${lean}`+(speed===DEFAULT_SPEED?'':`&speed=${speed}`))+P.query);
   await page.waitForFunction(({sha,runId,section})=>window.riderReady?.source_sha===sha&&window.riderReady?.run_id===runId&&window.riderStationReport?.station==='air'&&window.riderStationReport.section===section,{sha,runId,section});
   if(shot){await page.waitForFunction(()=>window.riderStationReport.in_flight?.from_lip&&window.riderStationReport.in_flight.airtime_s>.8,null,{timeout:20000});await page.screenshot({path:path.join(out,shot)});}
   await page.waitForFunction(id=>(window.riderStationReport.jumps||[]).find(j=>j.from_lip&&j.section===id&&j.complete),section,{timeout:20000});
   const report=await page.evaluate(()=>window.riderStationReport),j=main(report,section);await P.check(page);
   assert.equal(report.start_speed,speed);assert.equal(report.comparable,true);assert.equal(report.automated,true);check(j,lean);damping(report,j,lean);
   return {section,lean,speed,...j};
  }
  // Every section with neutral, full backward (+1, A) and full forward (-1, D) lean at the default speed.
  for(const section of SECTIONS)for(const lean of LEANS)
   results.push(await trial(section,lean,{shot:section===SECTIONS[0]&&lean===1?'air-flight.png':null}));
  // The HUD line shows the last jump.
  const hud=await page.evaluate(()=>window.riderTelemetry.station_result);
  assert.match(hud,/^Jump \d+: \d+\.\d\d s \| rot [+-]\d+ deg \(\d+ flips?\) \| land [+-]\d+ deg \| \d+\.\d m\/s (LANDED|CRASHED)/);
  await page.screenshot({path:path.join(out,'air-landing.png')});
  // ?station=air alone opens the first (default) section at the default speed.
  const plain=await trial(SECTIONS[0],0,{query:'?station=air'});
  // Fresh loads repeat the jump within the declared tolerances.
  const same=(a,b)=>{
   assert.equal(b.status,a.status,'repeat status');
   assert(Math.abs(b.takeoff_speed_mps-a.takeoff_speed_mps)<=TOL.takeoff_mps,'repeat takeoff speed');
   assert(Math.abs(b.airtime_s-a.airtime_s)<=TOL.airtime_s,'repeat airtime');
   assert(Math.abs(b.rotation_deg-a.rotation_deg)<=TOL.rotation_deg,'repeat rotation');
   assert(Math.abs(b.landing_angle_deg-a.landing_angle_deg)<=TOL.landing_deg,'repeat landing angle');
   assert(Math.abs(b.peak_compression_m-a.peak_compression_m)<=TOL.compression_m,'repeat compression');
  };
  const pick=(section,lean)=>results.find(r=>r.section===section&&r.lean===lean);
  same(pick(SECTIONS[0],0),plain);
  const repeats=[];
  for(const [section,lean] of [[SECTIONS[0],1],[SECTIONS[0],-1],[SECTIONS.at(-1),0]]){
   const first=pick(section,lean),again=await trial(section,lean);same(first,again);repeats.push({first,again});
  }
  // R is an in-world retry back to the section start and repeats the same jump.
  const base=pick(SECTIONS[0],-1);await trial(SECTIONS[0],-1);
  const before=await page.evaluate(()=>window.riderTelemetry);
  await page.keyboard.down('r');await page.waitForFunction(n=>window.riderTelemetry.reset_count===n+1,before.reset_count);await page.keyboard.up('r');
  const back=await page.evaluate(()=>window.riderTelemetry);
  assert(back.station_distance<2,'R returns to the section start');
  await page.waitForFunction(id=>(window.riderStationReport.jumps||[]).find(j=>j.from_lip&&j.section===id&&j.complete),SECTIONS[0],{timeout:20000});
  const retry=main(await page.evaluate(()=>window.riderStationReport),SECTIONS[0]);
  check(retry,-1);same(base,retry);assert.equal(retry.index,1,'Retry starts a new jump list');
  assert.equal(await page.evaluate(()=>window.riderTelemetry.world_loads),before.world_loads);
  // &speed= compares start speeds on the default section.
  const fast=await trial(SECTIONS[0],1,{speed:9});
  // Slower starts shift the takeoff tick phase at the lip: the lip jump is still recognised and the lean
  // held for the whole flight (from the first step after the lip is confirmed).
  const slow=[];
  for(const speed of [5.6,6.3])slow.push(await trial(SECTIONS[0],1,{speed}));
  // #370: run real camera A/B only on this isolated PR head (or explicit local opt-in).
  // Normal/main A19c CI keeps its original runtime and unchanged jump assertions.
  const camera370Enabled=process.env.GITHUB_HEAD_REF==='agent/camera/issue-370-aligned-evidence'||
   process.env.RIDER_CAMERA370_AIR==='1';
  if(camera370Enabled)await require('./camera370_air.cjs').run({
   browser,url,sha,runId,out,testcase:process.argv[5],preset:P,errors});
  if(errors.length)throw Error(errors.join('\\n'));
  const full=results.filter(r=>r.section===SECTIONS[0]&&r.lean!==0);
  const best=Math.max(...full.map(r=>Math.abs(r.rotation_deg)));
  // Acceptance (#56): at the default start speed, full lean held in flight gives at least one full rotation.
  assert(pick(SECTIONS[0],1).rotation_deg>=360,'full back lean: at least one rotation at the default speed');
  assert(pick(SECTIONS[0],-1).rotation_deg<=-360,'full front lean: at least one rotation at the default speed');
  const report={status:'PASS',...P.report(),source_sha:sha,run_id:runId,browser:browser.version(),tolerances:TOL,default_section:SECTIONS[0],default_speed_mps:DEFAULT_SPEED,
   full_lean_default:{best_rotation_deg:best,full_rotation:best>=360,back_deg:pick(SECTIONS[0],1).rotation_deg,front_deg:pick(SECTIONS[0],-1).rotation_deg},
   results,plain,repeats,retry,fast,slow,real_device:'NOT RUN'};
  fs.writeFileSync(path.join(out,'air-result.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({status:report.status,full_lean_default:report.full_lean_default,
   jumps:[...results,fast,...slow].map(r=>`${r.section} lean ${r.lean} @${r.speed}: ${r.status} air ${r.airtime_s.toFixed(3)} s rot ${r.rotation_deg.toFixed(1)} (${r.flips}) land ${r.landing_angle_deg.toFixed(1)} on ${r.ground_slope_deg.toFixed(1)} vy ${r.touchdown_vy_mps.toFixed(2)} normal ${r.impact_normal_mps.toFixed(2)} lip+${r.lip_confirmed_s.toFixed(3)} comp ${r.peak_compression_m.toFixed(3)}${r.chassis_contact?' chassis':''}`)}));
 }catch(e){if(page){await page.screenshot({path:path.join(out,'air-failed.png')}).catch(()=>{});fs.writeFileSync(path.join(out,'air-failed-state.json'),JSON.stringify({results,errors,state:await page.evaluate(()=>({telemetry:window.riderTelemetry,report:window.riderStationReport})).catch(()=>null)},null,2));}throw e;}
 finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
