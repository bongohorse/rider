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
  const more=phone.getByRole('button',{name:'More',exact:true});
  await more.tap();
  assert.equal(await more.getAttribute('aria-expanded'),'true','More must open via real touch');
  await phone.locator('#rider-mobile .toolbar-more').getByRole('button',{name:'Next section',exact:true}).tap();
  assert.equal(await more.getAttribute('aria-expanded'),'false','Next section must close More');
  await phone.waitForFunction(()=>window.riderStationReport.section==='10');
  await phone.screenshot({path:path.join(out,'ramps-phone.png')});await ctx.close();
  // #352: same real a16 fixed-owner neutral downhill, debug-only render A/B. The runner
  // reads actual camera.get_projection (not a guessed portrait half-extent) and authored
  // ramps-long chain vertices. This does not weaken the original 25 ramp trials.
  const C=require('./camera352_math.cjs');
  const authored=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../main/gym/stations/ramps-long.json'),'utf8'));
  const slope=C.slope(authored,'down-30');
  assert(Math.abs(slope.b.x-slope.a.x-3.464101615)<1e-5);
  assert.deepEqual(C.clip({x:0,y:0},{x:10,y:-10},{left:2,right:8,bottom:-8,top:-2}),{low:0.2,high:0.8});
  // Focused negative controls run in the real a16 job before the browser A/B probes.
  // A normal Straight station deliberately has NO riderStationReport.
  const ready={sha:'source',runId:'run',station:'straight'};
  const priorWindow=globalThis.window;
  try{
   globalThis.window={riderReady:{source_sha:'source',run_id:'run'},
    riderTelemetry:{station:'straight',sequence:3},riderStationReport:null};
   assert.equal(C.cameraReady(ready),true,'Straight readiness must not require a special report');
   assert.equal(C.cameraReady({...ready,sha:'wrong'}),false,'Wrong build identity accepted');
   assert.equal(C.cameraReady({...ready,station:'ramps-long'}),false,'Wrong station accepted');
   globalThis.window.riderTelemetry.sequence=2;
   assert.equal(C.cameraReady(ready),false,'Unready telemetry accepted');
   globalThis.window.riderTelemetry={station:'ramps-long',sequence:3};
   assert.equal(C.cameraReady({...ready,station:'ramps-long'}),false,'Missing ramp section accepted');
   globalThis.window.riderStationReport={station:'ramps-long',section:'down-20'};
   assert.equal(C.cameraReady({...ready,station:'ramps-long'}),false,'Wrong ramp section accepted');
   globalThis.window.riderStationReport.section='down-30';
   assert.equal(C.cameraReady({...ready,station:'ramps-long'}),true,'Authored ramp readiness rejected');
  }finally{if(priorWindow===undefined)delete globalThis.window;else globalThis.window=priorWindow;}
  const synthetic=Array.from({length:40},(_,i)=>({tick:i+1,resets:0,generation:1,x:i,y:-i,vx:100,vy:-50,rear:true,front:true}));
  const loaded=synthetic.filter(s=>s.tick>=10&&s.tick<=18).map(s=>({tick:s.tick}));
  const exact=()=>C.comparePhysics(synthetic,synthetic.map(s=>({...s})),{downhillA:loaded,downhillB:loaded});
  assert.equal(exact().matched_ticks,9,'Measured downhill ticks were not compared');
  // A real wheel can momentarily lose support between two valid downhill samples.
  // Do not silently omit that fixed tick: compare its physics/contact state in A and B.
  const gapTrace=synthetic.map(s=>s.tick===14?{...s,rear:false,front:false}:s);
  const gapLoaded=loaded.filter(s=>s.tick!==14);
  const gapResult=C.comparePhysics(gapTrace,gapTrace.map(s=>({...s})),{downhillA:gapLoaded,downhillB:gapLoaded});
  assert.equal(gapResult.matched_ticks,9,'A contact gap discarded a real fixed tick');
  assert.equal(gapResult.dual_supported_ticks,8,'False dual-wheel support in contact gap');
  assert.equal(gapResult.compared_contact_gap_ticks,1,'Unloaded contact gap was not accounted for');
  assert.throws(()=>C.comparePhysics(gapTrace,synthetic,{downhillA:gapLoaded,downhillB:gapLoaded}),
   /wheel-support mismatch/,'A/B contact divergence was accepted');
  assert.throws(()=>C.comparePhysics(gapTrace,gapTrace.filter(s=>s.tick!==14),
   {downhillA:gapLoaded,downhillB:gapLoaded}),/Missing\/unmatched fixed tick/,
   'A missing fixed tick inside a contact gap was silently discarded');
  const without=(tick)=>synthetic.filter(s=>s.tick!==tick);
  assert.throws(()=>C.comparePhysics(synthetic,without(14),{downhillA:loaded,downhillB:loaded}),/Missing\/unmatched fixed tick/);
  assert.throws(()=>C.comparePhysics(synthetic,synthetic.map(s=>s.tick===14?{...s,resets:1}:s),{downhillA:loaded,downhillB:loaded}),/reset\/generation mismatch/);
  assert.throws(()=>C.comparePhysics(synthetic,synthetic.map(s=>s.tick===14?{...s,x:s.x+2}:s),{downhillA:loaded,downhillB:loaded}),/altered deterministic physics/);
  assert.throws(()=>C.comparePhysics(synthetic,synthetic,{downhillA:loaded,downhillB:loaded.slice(0,5)}),/Missing dual-supported downhill/);
  assert.throws(()=>C.comparePhysics(synthetic,synthetic,{downhillA:loaded,downhillB:loaded.map(s=>({tick:s.tick+10}))}),/Missing dual-supported downhill/);
  assert.throws(()=>C.comparePhysics(synthetic,synthetic.concat({...synthetic[13],x:999}),{downhillA:loaded,downhillB:loaded}),/conflicting duplicate/);
  assert.throws(()=>C.comparePhysics(synthetic,without(14)),/Missing\/unmatched fixed tick/);
  // Render snapshots can skip fixed ticks; A/B physics must use the separate
  // once-per-Defold-fixed-tick read-only probe instead.
  const cameraCases={};
  async function cameraTrial(mode,viewport,station='ramps-long'){
   const label=station+'-'+mode+'-'+viewport.width+'x'+viewport.height;
   const p=await browser.newPage({viewport});
   p.on('pageerror',e=>errors.push(label+': '+e.message));
   p.on('console',m=>{if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(m.text()))errors.push(label+': '+m.text());});
   try{
    await configure(p,runId,process.argv[5]);
    const section=station==='ramps-long'?'&section=down-30':'&speed=1';
    await p.goto(url+'?station='+station+section+'&camera352='+mode+P.query);
    await p.waitForFunction(C.cameraReady,{sha,runId,station});
    await p.waitForFunction(()=>window.riderCamera352Trace?.length>=140,null,{timeout:20000,polling:50});
    const canvas=await p.evaluate(()=>{const c=document.querySelector('canvas');if(!c)return null;const r=c.getBoundingClientRect();return {width:r.width,height:r.height,buffer_width:c.width,buffer_height:c.height};});
    assert(canvas&&canvas.width>0&&canvas.height>0,label+': no actual canvas dimensions');
    const trace=await p.evaluate(()=>window.riderCamera352Trace.slice());
    assert(trace.length>=140&&trace.every(s=>s.source_sha===sha&&s.mode===mode&&s.station===station),label+': missing live source/section identity');
    assert(trace.every(s=>Number.isFinite(s.m00)&&s.m00>0&&Number.isFinite(s.m11)&&s.m11>0),label+': invalid live projection');
    const physicsTrace=await p.evaluate(()=>window.riderCamera352PhysicsTrace?.slice()||[]);
    assert(physicsTrace.length>=25&&physicsTrace.every(s=>s.source_sha===sha&&s.mode===mode&&s.station===station),
     label+': missing genuine fixed-owner tick trace');
    const scale=trace[0].scale;
    assert(Math.abs(scale-0.01)<1e-7,label+': unexpected world scale');
    const validPhysics=station==='ramps-long'?physicsTrace.filter(s=>s.section==='down-30'&&s.rear&&s.front&&
     s.x*scale>=slope.a.x&&s.x*scale<=slope.b.x&&s.vx*scale>0.2&&s.vy*scale< -0.1):[];
    if(station==='ramps-long')assert(validPhysics.length>=5,label+': INCONCLUSIVE: no real fixed-tick dual-supported downhill window');
    const measured=station==='ramps-long'?trace.map(s=>C.measure(s,canvas,slope)):[];
    const valid=measured.filter(s=>s.on_slope&&s.vx>0.2&&s.vy<-0.1&&s.loaded);
    if(station==='ramps-long')assert(valid.length>=5,label+': INCONCLUSIVE: no loaded real downhill velocity samples on authored 30-degree slope');
    const summary={label,mode,station,viewport,canvas,source_sha:sha,first_projection:{m00:trace[0].m00,m11:trace[0].m11},
     frames:trace.length,ticks:[trace[0].tick,trace.at(-1).tick],valid_downhill:valid.length,
     fixed_ticks:physicsTrace.length,fixed_window:[physicsTrace[0].tick,physicsTrace.at(-1).tick],
     valid_fixed_downhill:validPhysics.length,
     mean_screen_y_px:valid.length?valid.reduce((a,s)=>a+s.screen_y_px,0)/valid.length:null,
     min_bottom_margin_px:valid.length?Math.min(...valid.map(s=>s.bottom_margin_px)):null,
     mean_visible_slope_m:valid.length?valid.reduce((a,s)=>a+s.visible_slope_m,0)/valid.length:null,
     mean_visible_slope_s:valid.length?valid.reduce((a,s)=>a+s.visible_slope_s,0)/valid.length:null,
     fixture_limited:valid.filter(s=>s.fixture_limited).length,
     viewport_truncated:valid.filter(s=>s.viewport_truncated).length,
     max_descent_u:Math.max(...trace.map(s=>s.descent))};
    if(station==='straight')assert(summary.max_descent_u<5,'Flat-road candidate introduced downhill lead');
    cameraCases[label]={summary,trace,measured,valid,physicsTrace,validPhysics};
    fs.writeFileSync(path.join(out,'camera352-'+label+'.json'),JSON.stringify(cameraCases[label],null,2));
    await p.screenshot({path:path.join(out,'camera352-'+label+'.png')});
    if(station==='ramps-long'&&mode==='b'&&viewport.width===1280){
     const resetBefore=trace.at(-1).resets;
     await p.keyboard.down('r');
     await p.waitForFunction(n=>window.riderCamera352Trace?.some(s=>s.resets>n),resetBefore,{timeout:8000,polling:50});
     await p.keyboard.up('r');
     const after=await p.evaluate(n=>window.riderCamera352Trace.find(s=>s.resets>n),resetBefore);
     assert(after&&after.generation>trace[0].generation,'Retry did not recreate camera state');
     assert(Math.abs(after.cx-trace[0].cx)<30&&Math.abs(after.cy-trace[0].cy)<30,'Retry camera failed to restore initial framing');
     summary.retry={resets:after.resets,first_frame_dx_u:after.cx-trace[0].cx,first_frame_dy_u:after.cy-trace[0].cy,descent_u:after.descent};
    }
    return cameraCases[label];
   }catch(e){
    const state=await p.evaluate(()=>({ready:window.riderReady,telemetry:window.riderTelemetry,
     report:window.riderStationReport,trace_frames:window.riderCamera352Trace?.length||0})).catch(()=>null);
    fs.writeFileSync(path.join(out,'camera352-failed-'+label+'.json'),JSON.stringify({error:String(e),state},null,2));
    await p.screenshot({path:path.join(out,'camera352-failed-'+label+'.png')}).catch(()=>{});
    throw e;
   }finally{await p.close();}
  }
  // Landscape-only gameplay: desktop baseline plus compact mobile-landscape viewport.
  // Browser emulation is not a physical-phone acceptance test.
  for(const viewport of [{width:1280,height:720},{width:1080,height:486}]){
   const a=await cameraTrial('a',viewport),b=await cameraTrial('b',viewport);
   const equal=C.comparePhysics(a.physicsTrace,b.physicsTrace,{downhillA:a.validPhysics,downhillB:b.validPhysics});
   const name=viewport.width+'x'+viewport.height;
   cameraCases['physics-'+name]={equal};
  }
  const flatA=await cameraTrial('a',{width:1280,height:720},'straight');
  const flatB=await cameraTrial('b',{width:1280,height:720},'straight');
  cameraCases['flat-physics']={equal:C.comparePhysics(flatA.physicsTrace,flatB.physicsTrace)};
  const cameraReport={source_sha:sha,run_id:runId,status:'PASS',protocol:'Actual Defold fixed-owner a16 neutral 1 m/s downhill, debug HTML5 render-only camera A/B, measured orthographic matrix and canvas, authored slope clipped to viewport. Phone drive and jump/reverse camera acceptance NOT RUN.',
   cases:Object.fromEntries(Object.entries(cameraCases).map(([key,v])=>[key,v.summary||v])),
   human_drive:'REQUIRED BEFORE CAMERA DEFAULT MERGE'};
  fs.writeFileSync(path.join(out,'camera352-result.json'),JSON.stringify(cameraReport,null,2));
  // #114: stock-A 9/11 m/s on the existing downhill; real 60-Hz wheel-spin/slip + Retry evidence.
  // Keep the original a16 ladder, camera A/B and preset-override protocols unchanged.
  if(!P.explicit){
   const wheelCap=await require('./wheel_cap114.cjs').run({browser,url,sha,runId,testcase:process.argv[5],out,errors});
   console.log('WHEELCAP114 '+JSON.stringify(wheelCap));
  }
  if(errors.length)throw Error(errors.join('\n'));
  const report={source_sha:sha,run_id:runId,browser:browser.version(),status:'PASS',...P.report(),protocol:'Debug normal-owner tick commands, up throttle=1 / brake=0 / lean=0; independent authored 8 m/s starts; 6 s observation. Down neutral from 1 m/s.',results,
   summary:['ramps','ramps-long'].map(station=>({station,highest_climbed_degrees:Math.max(0,...results.filter(r=>r.station===station&&r.status==='CLIMBED').map(r=>r.angle))}))};
  fs.writeFileSync(path.join(out,'ramps-result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }catch(e){if(page){await page.screenshot({path:path.join(out,'ramps-failed.png')}).catch(()=>{});fs.writeFileSync(path.join(out,'ramps-failed-state.json'),JSON.stringify({results,errors,state:await page.evaluate(()=>({telemetry:window.riderTelemetry,report:window.riderStationReport})).catch(()=>null)},null,2));}throw e;}
 finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
