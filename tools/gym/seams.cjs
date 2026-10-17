const {configure}=require('./launch.cjs');
const {qualify,peaks}=require('./seam_analysis.cjs');
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
(async()=>{
 const [root,sha,runId,testcase,bundle]=process.argv.slice(2),out=path.resolve(root);let browser,page;
 const results=[],retries=[],poweredControls=[],errors=[];
 function find(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory()){const v=find(p);if(v)return v;}else if(e.name==='index.html')return p;}}
 const web=path.dirname(find(path.resolve(bundle)));
 const server=http.createServer((req,res)=>{const f=path.resolve(web,'.'+new URL(req.url,'http://localhost').pathname);if(!f.startsWith(web+path.sep)||!fs.existsSync(f)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',f.endsWith('.wasm')?'application/wasm':f.endsWith('.js')?'text/javascript':'text/html');fs.createReadStream(f).pipe(res);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+'/index.html';
 try{
  browser=await chromium.launch();page=await browser.newPage({viewport:{width:1280,height:720}});
  await configure(page,runId,testcase);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(m.text()))errors.push(m.text());});
  async function completed(){
   await page.waitForFunction(()=>window.riderStationReport?.done,null,{timeout:45000});
   const r=await page.evaluate(()=>window.riderStationReport);r.reasons=Object.values(r.reasons);
   assert.equal(r.source_sha,sha);assert.equal(r.automated,true);assert.equal(r.seams.length,20);assert(r.trace.length>10);
   assert(['VALID','INVALID / NOT COMPARABLE'].includes(r.status));assert.equal(r.comparable,r.status==='VALID');
   if(r.comparable){assert(qualify(r).comparable,JSON.stringify(qualify(r)));assert.equal(r.reasons.length,0);assert(r.speed_min_mps>=r.nominal_mps*.95);assert(r.speed_max_mps<=r.nominal_mps*1.05);assert(r.seams.every(s=>s.samples>=2&&s.wheel1_crossed&&s.wheel2_crossed));}
   else assert(r.reasons.length>0);
   for(const seam of r.seams){
    const p=peaks(r,seam.x_m);assert.equal(p.samples,seam.samples);
    assert(Math.abs(p.vy-seam.vy_peak_mps)<1e-8);assert(Math.abs(p.dvy-seam.dvy_peak_mps)<1e-8);assert(Math.abs(p.rise-seam.rise_m)<1e-8);
    assert.equal(p.loss1,seam.wheel1_loss_samples);assert.equal(p.loss2,seam.wheel2_loss_samples);
    assert.equal(seam.ghost_bump,p.vy>r.threshold_vy_mps||p.dvy>r.threshold_dvy_mps||p.rise>r.threshold_rise_m);
   }
   return r;
  }
  for(const speed of [5,15,30])for(const station of ['seams-chain','seams-hull']){
   await page.goto(url+`?station=${station}&speed=${speed}`);
   await page.waitForFunction(({sha,runId,station})=>window.riderReady?.source_sha===sha&&window.riderReady.run_id===runId&&window.riderStationReport?.station===station,{sha,runId,station});
   await page.waitForFunction(()=>window.riderTelemetry?.station_distance>=40);
   await page.screenshot({path:path.join(out,`${station}-${speed}.png`)});
   const first=await completed();assert.equal(first.nominal_mps,speed);results.push(first);
   fs.writeFileSync(path.join(out,`${station}-${speed}.json`),JSON.stringify(first,null,2));
   const before=await page.evaluate(()=>window.riderTelemetry);
   await page.keyboard.down('r');await page.waitForFunction(n=>window.riderTelemetry.reset_count===n+1,before.reset_count);await page.keyboard.up('r');
   await page.waitForFunction(()=>!window.riderStationReport.done);
   const repeat=await completed();retries.push(repeat);
   assert.equal(await page.evaluate(()=>window.riderTelemetry.world_loads),before.world_loads);
   assert.equal(repeat.status,first.status);assert.deepEqual(repeat.reasons,first.reasons);
   if(first.comparable){
    assert(Math.abs(first.entry_mps-repeat.entry_mps)<=.02,'repeat entry 0.02 m/s');assert.equal(first.ghost_bumps,repeat.ghost_bumps);
    for(let i=0;i<20;i++){
     assert(Math.abs(first.seams[i].vy_peak_mps-repeat.seams[i].vy_peak_mps)<=.02,'repeat vertical peak 0.02 m/s');
     assert(Math.abs(first.seams[i].rise_m-repeat.seams[i].rise_m)<=.002,'repeat rise 2 mm');
     for(const k of ['wheel1_loss_samples','wheel2_loss_samples','airborne_samples'])assert(Math.abs(first.seams[i][k]-repeat.seams[i][k])<=1,'repeat contact loss one tick');
    }
   }
  }
  // Original powered protocol cannot maintain the high nominal targets.
  // Keep physical off-target controls; never count them as comparison evidence.
  await page.unroute('**/index.html*');await configure(page,runId,'a18powered');
  for(const speed of [5,15])for(const station of ['seams-chain','seams-hull']){
   await page.goto(url+`?station=${station}&speed=${speed}`);const r=await completed();
   if(speed===5){assert.equal(r.comparable,true,'powered 5 m/s must qualify');assert.equal(r.ghost_bumps,0,'powered 5 m/s baseline');}
   else {assert.equal(r.comparable,false);assert(r.reasons.includes('speed outside +/-5% window'));}
   poweredControls.push(r);
  }
  await page.unroute('**/index.html*');await configure(page,runId,testcase);
  const comparison=[5,15,30].map(speed=>{const pair=results.filter(r=>r.nominal_mps===speed);return {mode:'free roll',nominal_mps:speed,status:pair.every(r=>r.comparable)?'COMPARABLE':'NOT COMPARABLE',conditions:pair.map(r=>({station:r.station,status:r.status,entry:r.entry_mps,min:r.speed_min_mps,max:r.speed_max_mps,drift:r.drift_mps,bumps:r.comparable?r.ghost_bumps:null,reasons:r.reasons}))};});
  comparison.push(...[5,15].map(speed=>{const pair=poweredControls.filter(r=>r.nominal_mps===speed);return {mode:'powered control',nominal_mps:speed,status:pair.every(r=>r.comparable)?'COMPARABLE':'NOT COMPARABLE',conditions:pair.map(r=>({station:r.station,status:r.status,entry:r.entry_mps,min:r.speed_min_mps,max:r.speed_max_mps,drift:r.drift_mps,bumps:r.comparable?r.ghost_bumps:null,reasons:r.reasons}))};}));
  assert(results.find(r=>r.station==='seams-chain'&&r.nominal_mps===5).comparable,'5 m/s chain free-roll baseline');
  // Invalid nominal speeds must never qualify, even if the strip is crossed.
  await page.goto(url+'?station=seams-chain&speed=10');const rejected=await completed();assert.equal(rejected.comparable,false);assert(rejected.reasons.includes('unsupported nominal speed'));
  if(errors.length)throw Error(errors.join('\n'));
  const report={status:'PASS',acceptance:comparison.filter(r=>r.mode==='free roll').every(r=>r.status==='COMPARABLE')?'PASS':'BLOCKED',d8:'PROVISIONAL: retain chain; missing valid 15/30 m/s pairs preclude a full confirmation',source_sha:sha,run_id:runId,browser:browser.version(),results,retries,poweredControls,comparison,rejected,real_device:'NOT RUN'};
  fs.writeFileSync(path.join(out,'seams-result.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({status:report.status,comparison}));
 }catch(e){if(page){await page.screenshot({path:path.join(out,'seams-failed.png')}).catch(()=>{});fs.writeFileSync(path.join(out,'seams-failed-state.json'),JSON.stringify({results,errors,state:await page.evaluate(()=>({telemetry:window.riderTelemetry,report:window.riderStationReport})).catch(()=>null)},null,2));}throw e;}
 finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
