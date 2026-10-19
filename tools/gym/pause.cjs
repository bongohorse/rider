// A20 pause and slow motion: world time (sum of fixed-step dt) against the unscaled engine clock and the wall clock,
// input state across pause/resume, overlay controls and every built-in station. Debug gym case `a20`.
const {configure}=require('./launch.cjs');
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const STEP=1/60;
(async()=>{
 const [root,sha,runId]=process.argv.slice(2);const out=path.resolve(root);let browser;
 function find(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory()){const v=find(p);if(v)return v;}else if(e.name==='index.html')return p;}}
 const web=path.dirname(find(path.resolve(process.argv[6]))),errors=[],cases=[],measurements={stations:{}},timeLog=[];
 const server=http.createServer((req,res)=>{const file=path.resolve(web,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(web+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',file.endsWith('.wasm')?'application/wasm':file.endsWith('.js')?'text/javascript':'text/html');fs.createReadStream(file).pipe(res);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let page;
 try{
  browser=await chromium.launch();page=await browser.newPage({viewport:{width:1280,height:720}});
  await configure(page,runId,process.argv[5]);
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{const t=m.text();if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(t))errors.push(t);if(t.includes('RIDER_TIME '))timeLog.push(JSON.parse(t.split('RIDER_TIME ')[1]));});
  const url='http://127.0.0.1:'+server.address().port+'/index.html';
  const snap=()=>page.evaluate(()=>({t:window.riderTime,c:window.riderClock,s:window.riderTimeState}));
  async function open(query,id){
   await page.goto(url+query);
   await page.waitForFunction(({sha,runId,id})=>window.riderReady?.source_sha===sha&&window.riderReady?.run_id===runId&&window.riderTime?.station===id&&window.riderTime.ticks>30&&window.riderClock,{sha,runId,id});
  }
  // Hold a key until the game acknowledges it, then release (engine pitfall 5).
  async function press(key,until,arg){await page.keyboard.down(key);await page.waitForFunction(until,arg);await page.keyboard.up(key);}
  const sleep=ms=>page.waitForTimeout(ms);
  // One observation window: world time, fixed ticks and position against the engine and wall clocks.
  async function measure(ms){
   const a=await snap();await sleep(ms);const b=await snap();
   assert.equal(a.t.generation,b.t.generation,'window crossed a world switch');
   const world=b.t.world-a.t.world,engine=b.c.engine-a.c.engine,wall=b.c.wall-a.c.wall;
   return {world_s:world,engine_s:engine,wall_s:wall,ticks:b.t.ticks-a.t.ticks,frames:b.c.frames-a.c.frames,dx_m:(b.t.x??0)-(a.t.x??0),
    world_per_engine:world/engine,world_per_wall:world/wall,engine_per_wall:engine/wall,ticks_per_engine_s:(b.t.ticks-a.t.ticks)/engine,a:a.t,b:b.t};
  }
  // Slow motion: world = factor * engine within two fixed steps + 1 %; the callback rate stays 60/s (smaller steps).
  function checkFactor(m,f,label){
   const tol=2*f*STEP+0.01*f*m.engine_s;
   assert(Math.abs(m.world_s-f*m.engine_s)<=tol,`${label}: world ${m.world_s} vs ${f} x engine ${m.engine_s}`);
   assert(Math.abs(m.ticks-60*m.engine_s)<=3,`${label}: ${m.ticks} ticks in ${m.engine_s} s engine time`);
   assert(Math.abs(m.b.dt-f*STEP)<1e-6,`${label}: fixed dt ${m.b.dt}`);
   // Wall clock: the engine clamps a frame at 1/30 s, so world/wall may fall below the factor on a slow runner, never above it.
   assert(m.world_per_wall<=f*1.03+2*f*STEP/m.wall_s&&m.world_per_wall>=f*0.75,`${label}: world/wall ${m.world_per_wall}`);
   return {factor:f,world_s:+m.world_s.toFixed(4),engine_s:+m.engine_s.toFixed(4),wall_s:+m.wall_s.toFixed(4),ticks:m.ticks,
    world_per_engine:+m.world_per_engine.toFixed(4),world_per_wall:+m.world_per_wall.toFixed(4),engine_per_wall:+m.engine_per_wall.toFixed(4),
    ticks_per_engine_s:+m.ticks_per_engine_s.toFixed(2),fixed_dt_s:m.b.dt};
  }
  function checkPaused(m,label){
   assert.equal(m.world_s,0,label+': world time advanced while paused');assert.equal(m.ticks,0,label+': fixed ticks while paused');
   for(const k of ['x','y','vx','vy'])assert.equal(m.b[k],m.a[k],label+': '+k+' changed while paused');
   assert(m.frames>=10&&m.engine_s>0.2,label+': rendering/engine frames stopped while paused');
   return {wall_s:+m.wall_s.toFixed(4),engine_s:+m.engine_s.toFixed(4),frames:m.frames,ticks:m.ticks,world_s:m.world_s};
  }
  // X cycles 1 -> 0.5 -> 0.25 -> 1; each press waits for the owner's acknowledged factor and the new step dt.
  const setStep=async f=>{
   for(let i=0;i<3;i++){const cur=(await snap()).t.factor;if(cur===f)break;await press('x',cur=>window.riderTime.factor!==cur,cur);}
   await page.waitForFunction(f=>window.riderTime.factor===f&&Math.abs(window.riderTime.dt-f/60)<1e-6,f);};
  const pause=async on=>press('Space',on=>window.riderTime.paused===on&&window.riderTimeState?.paused===on,on);

  // 1. Straight at 1.0: the baseline clock relation.
  await open('?station=straight','straight');
  let s=await snap();assert.equal(s.t.factor,1);assert.equal(s.t.paused,false);assert(Math.abs(s.t.dt-STEP)<1e-6);assert.equal(s.t.scaled,0);
  measurements.baseline=checkFactor(await measure(1000),1,'baseline');cases.push('baseline_world_equals_engine_time');

  // 2. Pause while throttle is held: physics, world time and input stop; rendering continues.
  await page.keyboard.down('ArrowUp');await page.waitForFunction(()=>window.riderTime.command?.throttle===1&&window.riderTime.vx>0.5);
  await pause(true);
  s=await snap();assert.equal(s.t.held,0,'held drive keys cleared on pause');assert.equal(s.t.mobile,false);assert.equal(s.s.paused,true);
  measurements.pause=checkPaused(await measure(1200),'pause');
  cases.push('pause_stops_physics_world_time_and_clears_input');
  // Drive, Retry and section presses during the pause reach the owner and are dropped.
  const resets=s.t.resets,ticks=s.t.ticks;
  for(const key of ['r','ArrowDown','v','a']){const n=(await snap()).t.dropped;await press(key,n=>window.riderTime.dropped>n,n);}
  s=await snap();assert.equal(s.t.held,0);assert.equal(s.t.resets,resets);assert.equal(s.t.ticks,ticks);
  measurements.pause.dropped_presses=s.t.dropped;cases.push('input_during_pause_dropped');

  // 3. Resume with ArrowUp still physically held: no stale command for 60 ticks; a new press drives again.
  await pause(false);
  await page.waitForFunction(()=>window.riderTime.since_resume&&window.riderTime.since_resume.ticks>=60);
  s=await snap();assert.equal(s.t.since_resume.driven,0,'a key held through the pause must not drive');assert.equal(s.t.held,0);
  assert.equal(s.t.command.throttle,0);assert.equal(s.t.resets,resets,'Retry pressed while paused must not run');assert(Math.abs(s.t.dt-STEP)<1e-6);assert.equal(s.t.factor,1);
  await page.keyboard.up('ArrowUp');await page.keyboard.down('ArrowUp');await page.waitForFunction(()=>window.riderTime.command?.throttle===1);await page.keyboard.up('ArrowUp');
  await page.waitForFunction(()=>window.riderTime.command?.throttle===0);
  measurements.resume={neutral_ticks:s.t.since_resume.ticks,driven_ticks:s.t.since_resume.driven,factor:s.t.factor};
  cases.push('resume_without_stale_input_factor_1');

  // 4. Slow motion by key: 0.5 and 0.25 scale world time with smaller steps, then back to 1.0.
  measurements.slow={};
  for(const f of [0.5,0.25]){
   await setStep(f);measurements.slow[f]=checkFactor(await measure(1000),f,'slow '+f);
   // Measurement telemetry records the factor it was captured at.
   await page.waitForFunction(f=>window.riderTelemetry.time_factor===f&&window.riderTelemetry.time_scaled_ticks>0,f);
  }
  await setStep(1);s=await snap();assert(Math.abs(s.t.dt-STEP)<1e-6);
  cases.push('slow_motion_0_5_and_0_25_world_vs_engine_and_wall');

  // 5. Throttle from rest for 1 s of world time at each factor (same command, smaller steps: close, not identical).
  measurements.throttle_from_rest={};
  for(const f of [1,0.5,0.25]){
   await setStep(f);const r=(await snap()).t.resets;
   await press('r',r=>window.riderTime.resets===r+1,r);
   await page.keyboard.down('ArrowUp');
   await page.waitForFunction(({r,f})=>window.riderTime.trial&&window.riderTime.trial.resets===r+1&&Math.abs(window.riderTime.trial.factor-f)<1e-4,{r,f},{timeout:30000});
   await page.keyboard.up('ArrowUp');
   measurements.throttle_from_rest[f]=(await snap()).t.trial;
  }
  await setStep(1);
  const base=measurements.throttle_from_rest[1];
  for(const f of [0.5,0.25]){const t=measurements.throttle_from_rest[f];t.dx_vs_1x=+(t.dx_m/base.dx_m-1).toFixed(4);t.vx_vs_1x=+(t.vx_mps/base.vx_mps-1).toFixed(4);}
  cases.push('throttle_from_rest_compared_at_three_factors');

  // 6. Desktop overlay buttons (mouse): Pause/Resume and Speed, same path as the keys.
  async function click(name,until,arg){
   const p=await page.evaluate(name=>{const c=document.querySelector('canvas'),r=c.getBoundingClientRect(),q=window.riderHud[name];return {x:r.x+q.x/c.width*r.width,y:r.y+(1-q.y/c.height)*r.height};},name);
   await page.mouse.move(p.x,p.y);await page.mouse.down();await page.waitForFunction(until,arg);await page.mouse.up();
  }
  await click('pause',()=>window.riderTime.paused&&window.riderTimeState.paused);
  checkPaused(await measure(400),'overlay pause');
  await click('pause',()=>!window.riderTime.paused&&!window.riderTimeState.paused);
  await click('step',()=>window.riderTimeState.step===0.5&&Math.abs(window.riderTime.dt-1/120)<1e-6);
  await page.screenshot({path:path.join(out,'pause-slow.png')});
  await pause(true);await page.screenshot({path:path.join(out,'pause-paused.png')});
  cases.push('overlay_buttons');

  // 7. A station switch while paused at 0.5 starts the new world running at 1.0.
  const g=(await snap()).t.generation;
  await press('2',g=>window.riderTime.generation>g&&window.riderTime.station==='ramps'&&window.riderTime.ticks>10,g);
  s=await snap();assert.equal(s.t.paused,false);assert.equal(s.t.factor,1);assert(Math.abs(s.t.dt-STEP)<1e-6);assert.equal(s.t.scaled,0);
  assert.equal(s.s.paused,false);assert.equal(s.s.step,1);
  checkFactor(await measure(500),1,'after switch');cases.push('switch_resets_to_1x');

  // 8. Edit mode (R15): Space/X are editor input there; the edit world runs at 1.0 and Play returns at 1.0.
  await setStep(0.5);
  await press('e',()=>window.riderEditing===true);
  for(let i=0;i<100&&!timeLog.some(e=>e.edit===true);i++)await sleep(100);
  assert(timeLog.some(e=>e.edit===true&&e.factor===1),'edit world loaded at 1.0');
  await sleep(300);const editLog=timeLog.length;
  for(const key of ['Space','x']){await page.keyboard.down(key);await sleep(150);await page.keyboard.up(key);}
  await sleep(300);
  assert.equal(timeLog.slice(editLog).length,0,'no time change in Edit mode');
  s=await snap();assert.equal(s.s.paused,false);assert.equal(s.s.step,1);
  const ge=s.t.generation;
  await press('e',ge=>window.riderEditing===false&&window.riderTime?.generation>ge&&window.riderTime.ticks>10,ge);
  s=await snap();assert.equal(s.t.factor,1);assert.equal(s.t.paused,false);assert(Math.abs(s.t.dt-STEP)<1e-6);
  cases.push('edit_mode_keeps_space_x_and_runs_1x');

  // 9. Every built-in station: pause, 0.5 and 0.25 against the engine clock.
  const ids=await page.evaluate(()=>window.riderMobile.stations);assert(ids.length>=9);
  for(const id of ids){
   await open('?station='+id,id);
   await pause(true);const p=checkPaused(await measure(400),id+' pause');await pause(false);
   const r={pause_ticks:p.ticks,pause_world_s:p.world_s};
   for(const f of [0.5,0.25]){await setStep(f);r[f]=checkFactor(await measure(700),f,id+' '+f);}
   await setStep(1);r.back_to_1x=true;measurements.stations[id]=r;
  }
  cases.push('every_station_pause_and_slow_motion');

  // 10. Touch toolbar (synthetic clicks in touch mode; not device evidence).
  await open('?station=straight&touch=1','straight');
  const button=name=>page.getByRole('button',{name,exact:true});
  await button('Pause').click();await page.waitForFunction(()=>window.riderTime.paused&&window.riderTimeState.paused);
  checkPaused(await measure(400),'touch pause');
  await button('Resume').click();await page.waitForFunction(()=>!window.riderTime.paused);
  await button('Speed 1x').click();await page.waitForFunction(()=>window.riderTime.factor===0.5);
  await button('Speed 0.5x').click();await page.waitForFunction(()=>window.riderTime.factor===0.25);
  await button('Speed 0.25x').click();await page.waitForFunction(()=>window.riderTime.factor===1&&Math.abs(window.riderTime.dt-1/60)<1e-6);
  cases.push('touch_toolbar_synthetic');

  measurements.time_log_entries=timeLog.length;
  if(errors.length)throw Error(errors.join('\n'));
  fs.writeFileSync(path.join(out,'pause-result.json'),JSON.stringify({source_sha:sha,run_id:runId,browser:browser.version(),status:'PASS',cases,measurements},null,2));
  console.log(JSON.stringify({status:'PASS',cases}));
 }catch(e){if(page)await page.screenshot({path:path.join(out,'pause-failed.png')}).catch(()=>{});if(page)fs.writeFileSync(path.join(out,'pause-failed-state.json'),JSON.stringify(await page.evaluate(()=>({time:window.riderTime,clock:window.riderClock,state:window.riderTimeState})).catch(()=>null),null,2));throw e;}
 finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
