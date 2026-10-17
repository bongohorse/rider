const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
(async()=>{
 const [root,sha,runId]=process.argv.slice(2),out=path.resolve(root);let browser,page;
 const results=[],errors=[];
 function find(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory()){const v=find(p);if(v)return v;}else if(e.name==='index.html')return p;}}
 const web=path.dirname(find(out));
 const server=http.createServer((req,res)=>{const f=path.resolve(web,'.'+new URL(req.url,'http://localhost').pathname);if(!f.startsWith(web+path.sep)||!fs.existsSync(f)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',f.endsWith('.wasm')?'application/wasm':f.endsWith('.js')?'text/javascript':'text/html');fs.createReadStream(f).pipe(res);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+'/index.html';
 try{
  browser=await chromium.launch();page=await browser.newPage({viewport:{width:1280,height:720}});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(m.text()))errors.push(m.text());});
  async function trial(station,section){
   await page.goto(url+`?station=${station}&section=${section}`);
   await page.waitForFunction(({sha,runId,station,section})=>window.riderReady?.source_sha===sha&&window.riderReady?.run_id===runId&&window.riderStationReport?.station===station&&window.riderStationReport.section===section,{sha,runId,station,section});
   await page.waitForFunction(id=>window.riderStationReport.records.find(r=>r.id===id)?.done,section,{timeout:15000});
   const report=await page.evaluate(()=>window.riderStationReport),r=report.records.find(x=>x.id===section);
   assert.equal(report.start_speed,5);assert.equal(report.hard_suspension_stop,false);assert.equal(r.independent,true);
   assert.equal(r.throttle_min,station==='steps'?1:0);assert.equal(r.throttle_max,r.throttle_min);assert.equal(r.brake_max,0);assert.equal(r.lean_max,0);
   assert(['CLIMBED','LANDED','STUCK'].includes(r.status));assert(Number.isFinite(r.compression_m)&&r.compression_m>=0);
   assert(Number.isFinite(r.obstacle_entry_mps),'obstacle was reached');
   return {station,section,...r};
  }
  for(const station of ['steps','steps-down'])for(const section of ['0.05','0.1','0.15','0.2','0.25','0.3','0.4','0.5']){
   results.push(await trial(station,section));
   if(section==='0.3')await page.screenshot({path:path.join(out,station+'.png')});
  }
  assert(results.some(r=>r.status==='CLIMBED'));assert(results.some(r=>r.status==='LANDED'));
  // Repeat the greatest measured compression at the exact same authored start.
  const peak=results.reduce((a,b)=>a.compression_m>b.compression_m?a:b),repeated=await trial(peak.station,peak.section);
  assert.equal(repeated.status,peak.status);assert.equal(repeated.underbody_contact,peak.underbody_contact);
  assert(Math.abs(repeated.compression_m-peak.compression_m)<=.005,'compression repeat tolerance 5 mm');
  assert(Math.abs(repeated.obstacle_entry_mps-peak.obstacle_entry_mps)<=.02,'entry speed repeat tolerance 0.02 m/s');
  // R is an in-world retry, preserves speed/section and physically repeats.
  const before=await page.evaluate(()=>window.riderTelemetry);
  await page.keyboard.down('r');await page.waitForFunction(n=>window.riderTelemetry.reset_count===n+1,before.reset_count);await page.keyboard.up('r');
  await page.waitForFunction(id=>window.riderStationReport.records.find(r=>r.id===id)?.done,peak.section,{timeout:15000});
  const retry=await page.evaluate(id=>window.riderStationReport.records.find(r=>r.id===id),peak.section);
  assert(Math.abs(retry.compression_m-peak.compression_m)<=.005);assert.equal(retry.status,peak.status);
  assert.equal(await page.evaluate(()=>window.riderTelemetry.world_loads),before.world_loads);
  await page.goto(url+'?station=steps&section=0.2&speed=3');await page.waitForFunction(()=>window.riderTelemetry?.sequence>2&&window.riderStationReport?.section==='0.2');
  assert.equal(await page.evaluate(()=>window.riderTelemetry.start_speed),3);
  await page.keyboard.down('v');await page.waitForFunction(()=>window.riderStationReport.section==='0.25');await page.keyboard.up('v');
  assert.equal(await page.evaluate(()=>window.riderTelemetry.start_speed),3);
  const report={status:'PASS',source_sha:sha,run_id:runId,browser:browser.version(),results,repeat:{first:peak,repeated,retry},highest_climbed_m:Math.max(...results.filter(r=>r.status==='CLIMBED').map(r=>r.height_m)),real_device:'NOT RUN'};
  if(errors.length)throw Error(errors.join('\n'));
  fs.writeFileSync(path.join(out,'steps-result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }catch(e){if(page){await page.screenshot({path:path.join(out,'steps-failed.png')}).catch(()=>{});fs.writeFileSync(path.join(out,'steps-failed-state.json'),JSON.stringify({results,errors,state:await page.evaluate(()=>({telemetry:window.riderTelemetry,report:window.riderStationReport})).catch(()=>null)},null,2));}throw e;}
 finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
