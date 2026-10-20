const {configure}=require('./launch.cjs');
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const P=require('./preset.cjs').fromArgv(process.argv);
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
  for(const station of ['ramps','ramps-long']){
   for(const section of ['5','10','15','20','25','30','35','40','45','60','90']){
    await page.goto(url+`?station=${station}&section=${section}`+P.query);
    await page.waitForFunction(({sha,runId,station,section})=>window.riderReady?.source_sha===sha&&window.riderReady?.run_id===runId&&window.riderStationReport?.station===station&&window.riderStationReport.section===section,{sha,runId,station,section});
    if(section==='30'){await page.waitForFunction(()=>window.riderTelemetry?.station_distance>=2.5);await page.screenshot({path:path.join(out,station+'-30-approach.png')});}
    await page.waitForFunction(id=>window.riderStationReport?.records.find(r=>r.id===id)?.done,section,{timeout:15000});
    const report=await page.evaluate(()=>window.riderStationReport),r=report.records.find(x=>x.id===section);await P.check(page);
    assert.equal(report.start_speed,8);assert.equal(r.throttle_min,1);assert.equal(r.throttle_max,1);assert.equal(r.brake_max,0);assert.equal(r.lean_max,0);
    assert(['CLIMBED','FAILED'].includes(r.status));assert(Number.isFinite(r.peak_launch_m)&&r.peak_launch_m>=0);
    results.push({station,section,...r});
    if(section==='30')await page.screenshot({path:path.join(out,station+'-30.png')});
   }
  }
  for(const section of ['down-10','down-20','down-30']){
   await page.goto(url+`?station=ramps-long&section=${section}`+P.query);
   await page.waitForFunction(id=>window.riderStationReport?.section===id,section);
   await page.waitForFunction(id=>window.riderStationReport?.records.find(r=>r.id===id)?.done,section,{timeout:15000});
   const report=await page.evaluate(()=>window.riderStationReport),r=report.records.find(x=>x.id===section);await P.check(page);
   assert.equal(report.start_speed,1);assert.equal(r.throttle_max,0);assert.equal(r.brake_max,0);assert.equal(r.lean_max,0);
   assert(Number.isFinite(r.speed_gain_mps));results.push({station:'ramps-long',section,...r});
  }
  for(const station of ['ramps','ramps-long']){
   const ladder=results.filter(r=>r.station===station&&r.mode==='up');
   assert(ladder.some(r=>r.status==='CLIMBED'));assert.equal(ladder.find(r=>r.section==='90').status,'FAILED','12 m wall must exceed this 8 m/s protocol');
  }
  // Section jump/retry retain the terrain/world; actual keyboard input path.
  await page.goto(url+'?station=ramps&section=20&speed=5'+P.query);
  await page.waitForFunction(()=>window.riderTelemetry?.sequence>2&&window.riderStationReport?.section==='20');
  let t=await page.evaluate(()=>window.riderTelemetry);assert.equal(t.start_speed,5);
  const n=t.reset_count,loads=t.world_loads;
  await page.keyboard.down('v');await page.waitForFunction(n=>window.riderTelemetry.reset_count===n+1,n);await page.keyboard.up('v');
  await page.waitForFunction(()=>window.riderStationReport.section==='25');
  t=await page.evaluate(()=>window.riderTelemetry);assert.equal(t.world_loads,loads);assert.equal(t.start_speed,5);
  await page.keyboard.down('r');await page.waitForFunction(n=>window.riderTelemetry.reset_count===n+2,n);await page.keyboard.up('r');
  assert.equal(await page.evaluate(()=>window.riderStationReport.section),'25');
  assert((await page.evaluate(()=>window.riderFeedback.text)).includes('Station result:'));
  // Authored station defaults are not silently turned into a URL speed override.
  await page.goto(url+'?station=ramps'+P.query);
  await page.waitForFunction(()=>window.riderTelemetry?.sequence>2&&window.riderStationReport?.section==='5');
  await page.keyboard.down('1');await page.waitForFunction(()=>window.riderTelemetry.station==='straight');await page.keyboard.up('1');
  await page.keyboard.down('2');await page.waitForFunction(()=>window.riderTelemetry.station==='ramps'&&window.riderStationReport?.section==='5');await page.keyboard.up('2');
  for(let i=0;i<11;i++){
   const resets=await page.evaluate(()=>window.riderTelemetry.reset_count);
   await page.keyboard.down('v');await page.waitForFunction(n=>window.riderTelemetry.reset_count===n+1,resets);await page.keyboard.up('v');
   // Down/up can land between engine input samples: await a fresh release window.
   const releasedSequence=await page.evaluate(()=>window.riderTelemetry.sequence);
   await page.waitForFunction(n=>window.riderTelemetry.sequence>n+1,releasedSequence);
  }
  await page.waitForFunction(()=>window.riderStationReport.section==='down-10'&&window.riderTelemetry.start_speed===1);
  // Synthetic mobile selection (not a physical device driving result).
  const ctx=await browser.newContext({viewport:{width:1080,height:486},isMobile:true,hasTouch:true});const phone=await ctx.newPage();
  phone.on('pageerror',e=>errors.push(e.message));await phone.goto(url+'?station=ramps&touch=1'+P.query);
  await phone.waitForFunction(()=>window.riderTelemetry?.sequence>2&&window.riderStationReport?.section==='5');
  await phone.getByRole('button',{name:'Next section',exact:true}).click();await phone.waitForFunction(()=>window.riderStationReport.section==='10');
  await phone.screenshot({path:path.join(out,'ramps-phone.png')});await ctx.close();
  if(errors.length)throw Error(errors.join('\n'));
  const report={source_sha:sha,run_id:runId,browser:browser.version(),status:'PASS',...P.report(),protocol:'Debug normal-owner tick commands, up throttle=1 / brake=0 / lean=0; independent authored 8 m/s starts; 6 s observation. Down neutral from 1 m/s.',results,
   summary:['ramps','ramps-long'].map(station=>({station,highest_climbed_degrees:Math.max(0,...results.filter(r=>r.station===station&&r.status==='CLIMBED').map(r=>r.angle))}))};
  fs.writeFileSync(path.join(out,'ramps-result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }catch(e){if(page){await page.screenshot({path:path.join(out,'ramps-failed.png')}).catch(()=>{});fs.writeFileSync(path.join(out,'ramps-failed-state.json'),JSON.stringify({results,errors,state:await page.evaluate(()=>({telemetry:window.riderTelemetry,report:window.riderStationReport})).catch(()=>null)},null,2));}throw e;}
 finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
