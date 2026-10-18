const {configure}=require('./launch.cjs');
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
// Repeat tolerances declared before runs (A19).
const TOL={jump_m:.05,takeoff_mps:.02,compression_m:.005};
const LADDER=['1','1.5','2','2.5','3','4','5','6','8','10'],LANDINGS=['flat','down','up'];
(async()=>{
 const [root,sha,runId]=process.argv.slice(2),out=path.resolve(root);let browser,page;
 const results=[],errors=[];
 function find(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory()){const v=find(p);if(v)return v;}else if(e.name==='index.html')return p;}}
 const web=path.dirname(find(path.resolve(process.argv[6])));
 const server=http.createServer((req,res)=>{const f=path.resolve(web,'.'+new URL(req.url,'http://localhost').pathname);if(!f.startsWith(web+path.sep)||!fs.existsSync(f)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',f.endsWith('.wasm')?'application/wasm':f.endsWith('.js')?'text/javascript':'text/html');fs.createReadStream(f).pipe(res);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+'/index.html';
 try{
  browser=await chromium.launch();page=await browser.newPage({viewport:{width:1280,height:720}});
  await configure(page,runId,process.argv[5]);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(m.text()))errors.push(m.text());});
  function check(r,speed){
   assert.equal(r.independent,true);assert.equal(r.start_speed,speed);
   assert.equal(r.throttle_min,1);assert.equal(r.throttle_max,1);assert.equal(r.brake_max,0);assert.equal(r.lean_max,0);
   assert(['CLEARED','MISSED'].includes(r.status));assert(Number.isFinite(r.takeoff_speed_mps),'lip was reached');
   if(r.status==='CLEARED'){
    assert(r.landed_on_deck&&Number.isFinite(r.jump_distance_m)&&r.jump_distance_m>=r.gap_m,'cleared jump lands beyond the gap');
    assert(Number.isFinite(r.touchdown_vy_mps)&&Number.isFinite(r.landing_angle_rad)&&r.peak_compression_m>=0&&r.airtime_s>0);
   }
  }
  async function trial(station,section,speed,shot){
   await page.goto(url+`?station=${station}&section=${section}`+(speed===9?'':`&speed=${speed}`));
   await page.waitForFunction(({sha,runId,station,section})=>window.riderReady?.source_sha===sha&&window.riderReady?.run_id===runId&&window.riderStationReport?.station===station&&window.riderStationReport.section===section,{sha,runId,station,section});
   if(shot){await page.waitForFunction(id=>Number.isFinite(window.riderStationReport.records.find(r=>r.id===id)?.airborne_at),section,{timeout:15000});await page.screenshot({path:path.join(out,shot)});}
   await page.waitForFunction(id=>window.riderStationReport.records.find(r=>r.id===id)?.done,section,{timeout:15000});
   const report=await page.evaluate(()=>window.riderStationReport),r=report.records.find(x=>x.id===section);
   assert.equal(report.start_speed,speed);assert.equal(report.comparable,true);check(r,speed);
   return {station,section,speed,...r};
  }
  const ladders={};
  for(const speed of [9,7]){
   ladders[speed]=[];
   for(const section of LADDER)ladders[speed].push(await trial('gaps',section,speed,speed===9&&section==='2'?'gaps-air.png':null));
   results.push(...ladders[speed]);
  }
  const ladder=ladders[9],cleared=ladder.filter(r=>r.status==='CLEARED');
  assert(cleared.length>0,'default ladder must clear at least one gap');
  assert.equal(ladder.at(-1).status,'MISSED','10 m is deliberately too wide');
  const landings=[];
  for(const section of LANDINGS)landings.push(await trial('gaps-landing',section,9,`gaps-landing-${section}.png`));
  results.push(...landings);
  // Same start speed and commands repeat the jump within the declared tolerances.
  const repeats=[];
  const widest=cleared.reduce((a,b)=>a.gap_m>b.gap_m?a:b),firstMiss=ladder.find(r=>r.status==='MISSED');
  for(const first of [widest,firstMiss,landings[0]]){
   const again=await trial(first.station,first.section,9);
   assert.equal(again.status,first.status,'repeat status');
   assert(Math.abs(again.takeoff_speed_mps-first.takeoff_speed_mps)<=TOL.takeoff_mps,'repeat takeoff speed');
   if(Number.isFinite(first.jump_distance_m))assert(Math.abs(again.jump_distance_m-first.jump_distance_m)<=TOL.jump_m,'repeat jump distance');
   assert(Math.abs(again.peak_compression_m-first.peak_compression_m)<=TOL.compression_m,'repeat landing compression');
   repeats.push({first,again});
  }
  // R is an in-world retry back to the section start, repeating the same jump.
  await trial('gaps',widest.section,9);
  const before=await page.evaluate(()=>window.riderTelemetry);
  await page.keyboard.down('r');await page.waitForFunction(n=>window.riderTelemetry.reset_count===n+1,before.reset_count);await page.keyboard.up('r');
  await page.waitForFunction(id=>window.riderStationReport.records.find(r=>r.id===id)?.done,widest.section,{timeout:15000});
  const retry=await page.evaluate(id=>window.riderStationReport.records.find(r=>r.id===id),widest.section);
  assert.equal(retry.status,widest.status);assert(Math.abs(retry.jump_distance_m-widest.jump_distance_m)<=TOL.jump_m);
  assert.equal(await page.evaluate(()=>window.riderTelemetry.world_loads),before.world_loads);
  if(errors.length)throw Error(errors.join('\n'));
  const widestAt=speed=>Math.max(0,...ladders[speed].filter(r=>r.status==='CLEARED').map(r=>r.gap_m));
  const report={status:'PASS',source_sha:sha,run_id:runId,browser:browser.version(),tolerances:TOL,
   widest_cleared_m:{default_9_mps:widestAt(9),cruise_7_mps:widestAt(7)},results,repeats,retry,real_device:'NOT RUN'};
  fs.writeFileSync(path.join(out,'gaps-result.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({status:report.status,widest_cleared_m:report.widest_cleared_m,
   ladder:results.map(r=>`${r.station}/${r.section}@${r.speed}: ${r.status} takeoff ${r.takeoff_speed_mps?.toFixed(2)} jump ${r.jump_distance_m?.toFixed(2)} vy ${r.touchdown_vy_mps?.toFixed(2)} comp ${r.peak_compression_m?.toFixed(3)}`)}));
 }catch(e){if(page){await page.screenshot({path:path.join(out,'gaps-failed.png')}).catch(()=>{});fs.writeFileSync(path.join(out,'gaps-failed-state.json'),JSON.stringify({results,errors,state:await page.evaluate(()=>({telemetry:window.riderTelemetry,report:window.riderStationReport})).catch(()=>null)},null,2));}throw e;}
 finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
