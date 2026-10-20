// Car Feel 3 (#201) visible suspension struts, debug gym case `cf3`.
// Each strut's drawn length equals the mount-to-wheel-centre distance from the bodies (within 1 u) at rest and
// through a landing; toggled off there are no strut objects, and the station report and world counts are identical.
const {configure}=require('./launch.cjs');
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
(async()=>{
 const [root,sha,runId]=process.argv.slice(2),out=path.resolve(root);let browser,page;
 const cases={},errors=[],evidence={};
 function find(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory()){const v=find(p);if(v)return v;}else if(e.name==='index.html')return p;}}
 const web=path.dirname(find(path.resolve(process.argv[6])));
 const server=http.createServer((req,res)=>{const f=path.resolve(web,'.'+new URL(req.url,'http://localhost').pathname);if(!f.startsWith(web+path.sep)||!fs.existsSync(f)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',f.endsWith('.wasm')?'application/wasm':f.endsWith('.js')?'text/javascript':'text/html');fs.createReadStream(f).pipe(res);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+'/index.html';
 try{
  browser=await chromium.launch();page=await browser.newPage({viewport:{width:1280,height:720}});
  await configure(page,runId,process.argv[5]);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(m.text()))errors.push(m.text());});
  const probe=()=>page.evaluate(()=>window.riderStruts);
  async function open(query){
   await page.goto(url+query);
   await page.waitForFunction(({sha,runId})=>window.riderReady?.source_sha===sha&&window.riderReady?.run_id===runId&&window.riderStruts&&window.riderTelemetry?.sequence>2,{sha,runId});
  }
  function drawn(s,label,tol=1){
   for(const [i,e] of s.struts.entries()){
    assert(e.length_error<=tol,`${label}: strut ${i+1} length ${e.length} vs mount-wheel ${e.distance}`);
    assert(e.wheel_error<=tol&&e.mount_error<=tol,`${label}: strut ${i+1} ends off by ${e.wheel_error} / ${e.mount_error} u`);
   }
  }
  async function guiPoint(name){
   return page.evaluate(name=>{const c=document.querySelector('canvas'),r=c.getBoundingClientRect(),p=window.riderHud[name];return {x:r.x+p.x/c.width*r.width,y:r.y+(1-p.y/c.height)*r.height};},name);
  }
  // Hold the press until the game acknowledges it, then release (engine pitfall 5).
  async function clickStruts(enabled){
   if(!await page.evaluate(()=>window.riderHud?.tuning)){await page.keyboard.down('t');await page.waitForFunction(()=>window.riderHud?.tuning);await page.keyboard.up('t');}
   const p=await guiPoint('struts');await page.mouse.move(p.x,p.y);await page.mouse.down();
   await page.waitForFunction(on=>window.riderStruts.enabled===on&&window.riderStruts.live===(on?2:0),enabled);await page.mouse.up();
   await page.waitForFunction(label=>window.riderHud.struts_label===label,enabled?'Struts ON':'Struts OFF');
  }
  async function retry(){
   const n=(await probe()).resets;
   await page.keyboard.down('r');await page.waitForFunction(n=>window.riderStruts.resets===n+1,n);await page.keyboard.up('r');
  }

  // 1. At rest on Straight (no input): both struts drawn mount -> wheel centre; the engine-composed pose agrees.
  await open('?station=straight');
  await page.waitForFunction(()=>window.riderTelemetry.contact1&&window.riderTelemetry.contact2&&Math.abs(window.riderTelemetry.speed)<0.5&&window.riderStruts.stats.frames>90,null,{timeout:20000});
  await page.waitForTimeout(500);
  const rest=await probe();
  assert.equal(rest.enabled,true,'struts default on');assert.equal(await page.evaluate(()=>window.riderHud.struts_label),'Struts ON');assert.equal(rest.live,2);assert.equal(rest.created,2);assert.equal(rest.deleted,0);
  drawn(rest,'rest');
  for(const e of rest.struts){assert(e.world_error<=0.1,'engine world transform matches the composed pose at rest: '+e.world_error);assert(e.length>20&&e.length<36,'rest length '+e.length);}
  const restLength=Math.min(...rest.struts.map(e=>e.length));
  cases.rest={lengths:rest.struts.map(e=>e.length),distances:rest.struts.map(e=>e.distance),max_length_error:Math.max(...rest.struts.map(e=>e.length_error)),
   max_world_error:Math.max(...rest.struts.map(e=>e.world_error))};
  await page.screenshot({path:path.join(out,'struts-rest.png')});

  // 2. Landing: Steps down 0.5 m, authored 5 m/s start, neutral input. Every rendered frame stays within 1 u.
  async function landing(query){
   await open('?station=steps-down&section=0.5'+query);
   await page.waitForFunction(()=>window.riderStationReport?.station==='steps-down'&&window.riderStationReport.section==='0.5');
   return page;
  }
  await landing('');
  // Screenshot while a strut is visibly compressed (at least 5 u shorter than at rest) after the 0.5 m drop.
  const target=restLength-5;
  await page.waitForFunction(t=>{const s=window.riderStruts,r=window.riderStationReport?.records.find(x=>x.id==='0.5');
   return Number.isFinite(r?.obstacle_entry_mps)&&s.drawn===2&&Math.min(s.struts[0].length,s.struts[1].length)<t;},target,{timeout:15000,polling:'raf'});
  await page.screenshot({path:path.join(out,'struts-landing.png')});
  const compressed=await probe();
  drawn(compressed,'landing frame');
  await page.waitForFunction(()=>window.riderStationReport.records.find(r=>r.id==='0.5')?.done,null,{timeout:15000});
  const on=await page.evaluate(()=>({report:window.riderStationReport,struts:window.riderStruts}));
  const record=on.report.records.find(r=>r.id==='0.5');
  assert.equal(record.throttle_max,0);assert.equal(record.lean_max,0);assert(record.compression_m>0.05,'0.5 m drop compresses: '+record.compression_m);
  const st=on.struts.stats;
  assert(st.frames>60,'struts drawn through the drive');
  assert(st.length_error<=1&&st.wheel_error<=1&&st.mount_error<=1,'every frame within 1 u: '+JSON.stringify(st));
  // Compression is joint travel from spring rest (zero translation), where the strut is spring_rest long: the
  // shortest drawn strut shows at least the travel recorded in the obstacle window (1 u slack).
  assert(on.struts.spring_rest-st.min_length>=record.compression_m*100-1,`strut shortening ${on.struts.spring_rest-st.min_length} u from spring rest vs compression ${record.compression_m} m`);
  cases.landing={status:record.status,compression_m:record.compression_m,rest_length:restLength,spring_rest:on.struts.spring_rest,min_length:st.min_length,max_length:st.max_length,frames:st.frames,
   max_length_error:st.length_error,max_wheel_error:st.wheel_error,max_mount_error:st.mount_error,screenshot_lengths:compressed.struts.map(e=>e.length)};

  // 3. URL switch off: no strut objects in that world; identical station report and world counts.
  await landing('&struts=0');
  await page.waitForFunction(()=>window.riderStationReport.records.find(r=>r.id==='0.5')?.done,null,{timeout:15000});
  const off=await page.evaluate(()=>({report:window.riderStationReport,struts:window.riderStruts}));
  assert.equal(off.struts.enabled,false);assert.equal(await page.evaluate(()=>window.riderHud.struts_label),'Struts OFF','URL switch shown in the panel label');assert.equal(off.struts.live,0);assert.equal(off.struts.created,0,'no strut object was ever created');
  assert.deepEqual(off.report,on.report,'station report identical with struts on and off');
  for(const k of ['bodies','joints','shapes'])assert.equal(off.struts[k],on.struts[k],k+' identical with struts on and off');
  cases.off={live:off.struts.live,created:off.struts.created,report_identical:true,bodies:off.struts.bodies,joints:off.struts.joints,shapes:off.struts.shapes};

  // 4. Panel button: off deletes both, Retry keeps the state without creating, on re-creates exactly two,
  //    Retry with struts on creates none (no leak), and a station switch keeps the setting.
  await open('?station=straight');
  await page.waitForFunction(()=>window.riderStruts.live===2);
  await clickStruts(false);
  let s=await probe();assert.equal(s.deleted,2);assert.equal(s.drawn,0);
  await retry();s=await probe();assert.equal(s.live,0);assert.equal(s.created,2);
  await clickStruts(true);s=await probe();assert.equal(s.created,4);
  await retry();await page.waitForTimeout(300);s=await probe();assert.equal(s.live,2);assert.equal(s.created,4);drawn(s,'after retry');
  await clickStruts(false);
  const generation=s.generation;
  await page.keyboard.down('2');await page.waitForFunction(g=>window.riderStruts.generation>g&&window.riderTelemetry.station==='ramps',generation);await page.keyboard.up('2');
  await page.waitForTimeout(300);s=await probe();
  assert.equal(s.enabled,false,'setting survives a station switch');assert.equal(s.live,0);assert.equal(s.created,0);
  await clickStruts(true);s=await probe();assert.equal(s.created,2);
  await page.screenshot({path:path.join(out,'struts-panel.png')});
  cases.toggle={button_off_live:0,retry_no_leak:true,station_switch_keeps_setting:true};

  if(errors.length)throw Error(errors.join('\n'));
  const report={status:'PASS',source_sha:sha,run_id:runId,browser:browser.version(),cases,screenshots:['struts-rest.png','struts-landing.png','struts-panel.png'],real_device:'NOT RUN'};
  fs.writeFileSync(path.join(out,'struts-result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }catch(e){if(page){await page.screenshot({path:path.join(out,'struts-failed.png')}).catch(()=>{});fs.writeFileSync(path.join(out,'struts-failed-state.json'),JSON.stringify({cases,errors,state:await page.evaluate(()=>({struts:window.riderStruts,telemetry:window.riderTelemetry,report:window.riderStationReport})).catch(()=>null)},null,2));}throw e;}
 finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
