// #370: real keyboard reverse on the existing Straight station; debug-only camera observer.
// A/B pages receive independently timed key events: report per-mode facts, NOT paired physics gains.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {configure}=require('./launch.cjs');
const HEIGHTS=[{width:1280,height:720},{width:1080,height:486}];
const FLOOR={left:-40.96,right:81.92}; // Existing stations/straight.json chain endpoints, metres.
const round=x=>Math.round(x*1e6)/1e6;
const mean=xs=>xs.reduce((a,b)=>a+b,0)/xs.length;

function analyze(physics,trace,canvas,identity){
 assert(Array.isArray(physics)&&physics.length>=90&&Array.isArray(trace)&&trace.length>=50,
  'Camera370 reverse: missing real fixed/render observations');
 assert(canvas&&canvas.width>0&&canvas.height>0,'Camera370 reverse: missing actual canvas');
 let prev=null;
 const engine=new Map();
 for(const s of physics){
  assert(s.source_sha===identity.sha&&s.station==='straight'&&s.mode===identity.mode,
   'Camera370 reverse: foreign fixed-owner source/station');
  assert(s.resets===0&&s.generation===1,'Camera370 reverse: unexpected Retry');
  assert(Number.isSafeInteger(s.tick)&&Number.isSafeInteger(s.engine_tick)&&
   Number.isFinite(s.x)&&Number.isFinite(s.y)&&Number.isFinite(s.vx)&&
   Number.isFinite(s.vy)&&Number.isFinite(s.dt)&&Math.abs(s.dt-1/60)<1e-6,
   'Camera370 reverse: invalid 60Hz fixed owner');
  assert(typeof s.rear==='boolean'&&typeof s.front==='boolean'&&
   typeof s.reverse_engaged==='boolean'&&typeof s.allow_reverse==='boolean'&&
   [s.throttle,s.brake_reverse].every(Number.isFinite),
   'Camera370 reverse: missing real command/latch observations');
  if(prev)assert(s.tick===prev.tick+1&&s.engine_tick===prev.engine_tick+1,
   'Camera370 reverse: missing fixed tick');
  assert(!engine.has(s.engine_tick),'Camera370 reverse: duplicate engine tick');
  engine.set(s.engine_tick,s.tick);
  prev=s;
 }
 const first=(fn,after=0)=>physics.find(s=>s.tick>after&&fn(s));
 const accelerated=first(s=>s.vx*.01>=1.5&&s.throttle===1);
 const brake=first(s=>s.brake_reverse===1&&s.throttle===0&&s.allow_reverse===true,
  accelerated?.tick||0);
 const latched=first(s=>s.reverse_engaged&&s.brake_reverse===1,brake?.tick||0);
 const reversed=first(s=>s.vx*.01<=-0.3&&s.reverse_engaged&&s.brake_reverse===1,
  latched?.tick||0);
 assert(accelerated&&brake&&latched&&reversed,
  'Camera370 reverse INCONCLUSIVE: real throttle/brake/latch/negative-speed sequence absent');
 assert(reversed.tick-brake.tick>=12,'Camera370 reverse: missing delayed brake-to-reverse phase');
 const renders=new Map();
 for(const s of trace){
  assert(s.source_sha===identity.sha&&s.station==='straight'&&s.mode===identity.mode&&
   s.resets===0&&s.generation===1,'Camera370 reverse: foreign render/reset');
  for(const k of ['x','y','vx','vy','cx','cy','m00','m11','scale','zoom','tick','dir']){
   assert(Number.isFinite(s[k]),'Camera370 reverse: invalid projection '+k);
  }
  assert(s.m00>0&&s.m11>0&&Math.abs(s.scale-.01)<1e-7&&
   (s.dir===1||s.dir===-1),'Camera370 reverse: invalid real projection/direction');
  const tick=engine.get(s.tick);
  if(tick===undefined||renders.has(tick))continue;
  const x=s.x*s.scale,cx=s.cx*s.scale,half=s.scale/s.m00;
  const direction=s.vx<0?-1:1;
  const boundary=direction<0?Math.max(FLOOR.left,cx-half):Math.min(FLOOR.right,cx+half);
  const ahead=Math.max(0,(boundary-x)*direction);
  renders.set(tick,{
   tick,dir:s.dir,vehicle_x_m:x,lead_x_m:cx-x,
   screen_x_px:(x-cx)/half*canvas.width/2,
   screen_y_px:(s.y-s.cy)*s.m11*canvas.height/2,
   camera_y_m:s.cy*s.scale,vehicle_y_m:s.y*s.scale,
   bottom_margin_px:canvas.height/2+(s.y-s.cy)*s.m11*canvas.height/2,
   ahead_m:ahead,ahead_s:Math.abs(s.vx*s.scale)>=.3?ahead/Math.abs(s.vx*s.scale):null,
   m00:s.m00,m11:s.m11,zoom:s.zoom
  });
 }
 const after=[...renders.values()].filter(s=>s.tick>=reversed.tick).sort((a,b)=>a.tick-b.tick);
 const flipped=after.find(s=>s.dir===-1);
 assert(after.length>=15&&flipped,'Camera370 reverse INCONCLUSIVE: no observed leftward camera reframe');
 assert(flipped.tick-reversed.tick<=120,'Camera370 reverse: direction not switched within two seconds');
 const untilFlip=after.filter(s=>s.tick<=flipped.tick);
 const settled=after.filter(s=>s.tick>=flipped.tick&&s.tick<=flipped.tick+60);
 assert(settled.length>=10,'Camera370 reverse INCONCLUSIVE: no settled reverse window');
 const firstRender=[...renders.values()].find(s=>s.tick>=brake.tick);
 assert(firstRender,'Camera370 reverse: brake projection missing');
 const phase=after.filter(s=>s.tick<=reversed.tick+90);
 return {
  status:'MEASURED',source_sha:identity.sha,mode:identity.mode,viewport:identity.viewport,
  fixed_dt_s:physics[0].dt,first_fixed_tick:physics[0].tick,last_fixed_tick:physics.at(-1).tick,
  accelerated_tick:accelerated.tick,brake_tick:brake.tick,reverse_latch_tick:latched.tick,
  reverse_motion_tick:reversed.tick,dir_flip_tick:flipped.tick,
  brake_to_reverse_s:round((reversed.tick-brake.tick)/60),
  reverse_to_camera_flip_s:round((flipped.tick-reversed.tick)/60),
  max_wrong_side_lead_m:round(Math.max(0,...untilFlip.map(s=>s.lead_x_m))),
  reverse_after_flip_mean_screen_x_px:round(mean(settled.map(s=>s.screen_x_px))),
  reverse_after_flip_mean_ahead_m:round(mean(settled.map(s=>s.ahead_m))),
  reverse_after_flip_mean_ahead_s:round(mean(settled.map(s=>s.ahead_s).filter(Number.isFinite))),
  reverse_min_bottom_margin_px:round(Math.min(...phase.map(s=>s.bottom_margin_px))),
  reverse_max_abs_camera_vehicle_y_offset_m:round(Math.max(...phase.map(s=>Math.abs(s.camera_y_m-s.vehicle_y_m)))),
  reverse_camera_y_excursion_m:round(Math.max(...phase.map(s=>Math.abs(s.camera_y_m-firstRender.camera_y_m)))),
  first_projection:{m00:firstRender.m00,m11:firstRender.m11,zoom:firstRender.zoom},
  samples_after_reverse:after.length,
  samples:after
 };
}
function negativeControls(){
 const fixed=Array.from({length:120},(_,i)=>({source_sha:'sha',station:'straight',mode:'a',
  tick:i+1,engine_tick:i+5,resets:0,generation:1,dt:1/60,x:100+i,y:170,
  vx:i<30?200:i<60?40:-70,vy:0,rear:true,front:true,
  throttle:i<30?1:0,brake_reverse:i>=30?1:0,allow_reverse:i>=30,
  reverse_engaged:i>=52}));
 const render=fixed.map(s=>({source_sha:'sha',station:'straight',mode:'a',resets:0,generation:1,
  tick:s.engine_tick,x:s.x,y:s.y,vx:s.vx,vy:s.vy,cx:s.x+20,cy:200,
  m00:.002,m11:.003,scale:.01,zoom:1,dir:s.tick>=70?-1:1}));
 const id={sha:'sha',mode:'a',viewport:{width:1280,height:720}},canvas={width:1280,height:720};
 const measured=analyze(fixed,render,canvas,id);
 assert.equal(measured.status,'MEASURED');
 // Actual orthographic projection: engine-unit delta times m00/m11, no
 // second physics.scale factor after converting world positions to metres.
 assert(Math.abs(measured.samples[0].screen_x_px-(-25.6))<1e-9,
  'Camera370 reverse screen X must use actual projection');
 assert(Math.abs(measured.samples[0].screen_y_px-(-32.4))<1e-9,
  'Camera370 reverse screen Y must use actual projection');
 assert(Math.abs(measured.samples[0].bottom_margin_px-327.6)<1e-9,
  'Camera370 reverse bottom margin must use actual projection');
 assert(Number.isFinite(measured.reverse_max_abs_camera_vehicle_y_offset_m)&&
  !('reverse_max_vertical_camera_lag_m' in measured),
  'Absolute vertical offset must not be labeled temporal lag');
 assert.throws(()=>analyze(fixed.map(s=>s.tick===45?{...s,engine_tick:999}:s),render,canvas,id),
  /missing fixed tick/);
 assert.throws(()=>analyze(fixed.map(s=>s.tick===60?{...s,reverse_engaged:false}:s),
  render.map(s=>({...s,source_sha:'wrong'})),canvas,id),/foreign render/);
 assert.throws(()=>analyze(fixed.map(s=>({...s,reverse_engaged:false})),render,canvas,id),
  /INCONCLUSIVE/);
}
async function run({browser,url,sha,runId,out,preset,errors}){
 negativeControls();
 const results={};
 for(const viewport of HEIGHTS)for(const mode of ['a','b']){
  const label=viewport.width+'x'+viewport.height+'-'+mode;
  const context=await browser.newContext({viewport}),p=await context.newPage();
  let stage='load';
  try{
   await configure(p,runId,'camera370');
   p.on('pageerror',e=>errors.push(label+': '+e.message));
   p.on('console',m=>{if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(m.text()))errors.push(label+': '+m.text());});
   await p.goto(url+'?station=straight&camera352='+mode+preset.query);
   await p.waitForFunction(({sha,runId})=>window.riderReady?.source_sha===sha&&
    window.riderReady?.run_id===runId&&window.riderTelemetry?.station==='straight'&&
    window.riderCamera352PhysicsTrace?.length>=15,{sha,runId},{timeout:20000,polling:50});
   stage='real throttle';
   await p.keyboard.down('ArrowUp');
   await p.waitForFunction(()=>window.riderCamera352PhysicsTrace?.at(-1)?.vx>=150,
    null,{timeout:15000,polling:50});
   await p.keyboard.up('ArrowUp');
   stage='real held brake and reverse';
   await p.keyboard.down('ArrowDown');
   await p.waitForFunction(()=>{const s=window.riderCamera352PhysicsTrace?.at(-1);
    return s?.vx<=-30&&s?.reverse_engaged===true;},null,{timeout:20000,polling:50});
   const reverseTick=await p.evaluate(()=>window.riderCamera352PhysicsTrace.at(-1).tick);
   stage='reverse reframe';
   await p.waitForFunction(t=>window.riderCamera352PhysicsTrace?.at(-1)?.tick>=t+90,
    reverseTick,{timeout:12000,polling:50});
   await p.keyboard.up('ArrowDown');
   const state=await p.evaluate(()=>({physics:window.riderCamera352PhysicsTrace?.slice(),
    trace:window.riderCamera352Trace?.slice(),ready:window.riderReady,
    canvas:(()=>{const c=document.querySelector('canvas'),r=c.getBoundingClientRect();
     return {width:r.width,height:r.height,buffer_width:c.width,buffer_height:c.height};})()}));
   assert(state.ready?.source_sha===sha&&state.ready?.run_id===runId,
    'Camera370 reverse: wrong build/run identity');
   const analysis=analyze(state.physics,state.trace,state.canvas,{sha,mode,viewport});
   results[label]={analysis,canvas:state.canvas,physics:state.physics,trace:state.trace,
    input:'Real Playwright keyboard ArrowUp then held ArrowDown; no scripted Gym driver'};
   fs.writeFileSync(path.join(out,'camera370-reverse-'+label+'.json'),JSON.stringify(results[label],null,2));
   await p.screenshot({path:path.join(out,'camera370-reverse-'+label+'.png')});
  }catch(e){
   fs.writeFileSync(path.join(out,'camera370-reverse-failed-'+label+'.json'),JSON.stringify({
    stage,error:String(e),state:await p.evaluate(()=>({ready:window.riderReady,
     telemetry:window.riderTelemetry,physics:window.riderCamera352PhysicsTrace?.slice(-20),
     frames:window.riderCamera352Trace?.length})).catch(()=>null)},null,2));
   await p.screenshot({path:path.join(out,'camera370-reverse-failed-'+label+'.png')}).catch(()=>{});
   throw e;
  }finally{await p.keyboard.up('ArrowUp').catch(()=>{});await p.keyboard.up('ArrowDown').catch(()=>{});
   await context.close();}
 }
 if(errors.length)throw Error(errors.join('\n'));
 const report={status:'MEASURED',source_sha:sha,run_id:runId,station:'existing authored straight',
  mode:'debug camera A/B; production default A',real_phone:'NOT RUN',
  physics_pairing:'NOT CLAIMED: real keyboard edges occur on independently sampled fixed ticks; metrics are per-mode, not paired A/B gains',
  viewports:Object.fromEntries(HEIGHTS.map(v=>{const name=v.width+'x'+v.height;
   return [name,{a:results[name+'-a'].analysis,b:results[name+'-b'].analysis}];}))};
 fs.writeFileSync(path.join(out,'camera370-reverse-result.json'),JSON.stringify(report,null,2));
 console.log('CAMERA370_REVERSE '+JSON.stringify({status:report.status,source_sha:sha,
  viewports:Object.fromEntries(Object.entries(report.viewports).map(([k,v])=>[k,{
   a_flip_s:v.a.reverse_to_camera_flip_s,b_flip_s:v.b.reverse_to_camera_flip_s,
   a_ahead_m:v.a.reverse_after_flip_mean_ahead_m,b_ahead_m:v.b.reverse_after_flip_mean_ahead_m}]))}));
 return report;
}
module.exports={run,analyze,negativeControls};
