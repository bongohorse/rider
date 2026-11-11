// #443 in-game camera A/B toggle with live camera settings, debug Gym case `cam443` (real Defold HTML5 debug build,
// real mouse and CDP touch taps on the play bar's camera button and menu (#678), the real controller camera owner).
// While driving a scripted, input-independent command per fixed tick (main/gym/camera_drive443.lua) on ramps-long
// down-30, air/mid (lean -1) and a Straight reverse, at 1280x720:
// - a camera-A run and a run that taps Cam A -> Cam B and steps a camera setting live have IDENTICAL fixed-tick
//   physics (position, velocity, wheel support, command and reverse latch on every vehicle tick: the #374 paired-tick
//   method, here exact) and identical station results; the render camera really changes (B's downhill lead on the
//   ramp, the stepped setting everywhere);
// - an A21 recording made on camera B replays with camera A (switched back to B and re-tuned mid-replay) as MATCH
//   with no command mismatch;
// - the choice and the settings survive a reload (and the camera owner applies them), Reset returns to camera A with
//   every default and that survives a reload too;
// - taps on the control and the panel (mouse at 1280x720, touch at 1080x486 with touch controls) record no drive
//   command on any tick and the car stays at rest;
// - the camera button and the open menu stay inside the view and clear of the FPS counter, the drive zones and
//   every other control; the menu buttons are not covered.
'use strict';
const assert=require('node:assert/strict');
const DESKTOP={width:1280,height:720},PHONE={width:1080,height:486};
// toggleAt: the vehicle tick after which the camera is switched; ticks: the compared window (vehicle ticks from the
// first drive-ready tick; under the probe's 480-entry page buffer); setting: the live step after the switch.
const SCENARIOS=[
 {name:'ramps-down-30',station:'ramps-long',query:'station=ramps-long&section=down-30&drive443=ramp',ticks:420,toggleAt:2,
  // #499: leave the same post-step coverage after the fixed B-only hold, even with CI UI latency.
  setting:{key:'offset',dir:1,taps:3},effect:'cy',b_lead:true,bOnlyUntil:120},
 {name:'air-mid',station:'air',query:'station=air&section=mid&lean=-1&drive443=air',ticks:420,toggleAt:20,
  setting:{key:'zoom',dir:1,taps:3},effect:'zoom',air:true},
 {name:'straight-reverse',station:'straight',query:'station=straight&drive443=reverse',ticks:420,toggleAt:20,
  setting:{key:'look',dir:-1,taps:4},effect:'cx',reverse:true},
];
// Every fixed-owner field that must not depend on the camera (rotation included: chassis and wheel angle, rad, and
// angular velocity, rad/s) (engine_tick may start one step apart per page; mode
// is the camera itself).
const PHYSICS_KEYS=['resets','generation','dt','x','y','vx','vy','angle','omega','rear_angle','rear_omega','front_angle','front_omega',
 'rear','front','throttle','brake_reverse','allow_reverse','reverse_engaged'];
const DEFAULTS={mode:'a',follow:1,look:1,zoom:1,offset:0,descent_response:0,descent_rise_limit:240,
 auto_zoom:1,zoom_near:1.1,zoom_air:0.8,zoom_rate:2};
// Keep the measurement gates and their failure evidence together; these are vehicle ticks, not wall time.
function measurementBudget(scn){
 return {scenario:scn.name,requested_toggle_tick:scn.toggleAt,toggle_tick:null,
  required_hold_until_tick:scn.bOnlyUntil??null,hold_tick:null,step_tick:null,
  horizon_tick:scn.ticks,required_b_only_span:scn.b_lead?60:null,required_post_step_ticks:90,probe_capacity:480};
}
function verifyMeasurementWindow(budget,phase){
 if(phase==='toggle')assert(budget.toggle_tick<budget.required_hold_until_tick-60,
  budget.scenario+': toggle too late for the B-only window; budget='+JSON.stringify(budget));
 else if(phase==='step')assert(budget.step_tick<budget.horizon_tick-90,
  budget.scenario+': taps took too long to leave a measured window ('+budget.step_tick+'); budget='+JSON.stringify(budget));
 else throw Error('Unknown camera measurement phase: '+phase);
}
// Evaluate in the page only on failure. Preserve all available bounded probe samples, including incomplete runs.
function failurePageState(){
 return {camera:window.riderCamera443??null,owner:window.riderCameraOwner??null,
  replay:window.riderReplay?{recording:window.riderReplay.recording,play:window.riderReplay.play,x:window.riderReplay.x}:null,
  ticks:window.riderCamera352PhysicsTrace?.at(-1)?.tick??null,
  partial_trace:{physics:window.riderCamera352PhysicsTrace?.slice()??[],render:window.riderCamera352Trace?.slice()??[]}};
}
function parseArgs(args){
 const usage='Usage: node tools/gym/camera443.cjs OUT SHA RUN_ID cam443 VERIFIED_DEBUG_BUNDLE';
 if(!Array.isArray(args)||args.length!==5||args.some(v=>typeof v!=='string'||!v)||args[3]!=='cam443')throw Error(usage);
 return {output:args[0],sha:args[1],runId:args[2],bundle:args[4]};
}
// Vehicle tick -> fixed-owner sample; continuous from tick 1, a repeated tick must be identical.
function byTick(trace,label){
 assert(Array.isArray(trace)&&trace.length,label+': empty fixed-owner trace');
 const out=new Map();
 for(const s of trace){
  assert(Number.isSafeInteger(s.tick)&&s.tick>=1,label+': invalid vehicle tick');
  for(const k of ['x','y','vx','vy','angle','omega','rear_angle','rear_omega','front_angle','front_omega'])assert(Number.isFinite(s[k]),label+': non-finite '+k+' at tick '+s.tick);
  if(out.has(s.tick)){
   const prior=out.get(s.tick);
   assert(PHYSICS_KEYS.every(k=>Object.is(prior[k],s[k])),label+': conflicting duplicate fixed tick '+s.tick);
  }else out.set(s.tick,s);
 }
 assert(out.has(1),label+': trace does not start at the first drive-ready tick');
 return out;
}
// Exact A/B identity of the fixed-tick physics over vehicle ticks 1..n (no tolerance: the camera must not touch it).
function identicalPhysics(a,b,n,{label='A/B'}={}){
 assert(Number.isSafeInteger(n)&&n>=60,label+': compared window too short');
 const A=byTick(a,label+' A'),B=byTick(b,label+' B');
 const modes={a:{a:0,b:0},b:{a:0,b:0}};
 for(let t=1;t<=n;t++){
  const x=A.get(t),y=B.get(t);
  assert(x&&y,label+': missing fixed tick '+t);
  assert(Math.abs(x.dt-1/60)<1e-6&&Math.abs(y.dt-1/60)<1e-6,label+': tick '+t+' not at the fixed 1/60 s step');
  for(const k of PHYSICS_KEYS)assert(Object.is(x[k],y[k]),`${label}: camera changed physics at tick ${t}: ${k} ${x[k]} != ${y[k]}`);
  modes.a[x.mode]=(modes.a[x.mode]||0)+1;modes.b[y.mode]=(modes.b[y.mode]||0)+1;
 }
 return {ticks:n,first:1,last:n,keys:PHYSICS_KEYS,max_difference:0,modes};
}
// First render sample per vehicle tick (render frames carry the engine tick; the fixed trace maps it).
function renderByTick(render,physics){
 const engine=new Map();
 for(const p of physics)if(Number.isSafeInteger(p.engine_tick))engine.set(p.engine_tick,p.tick);
 const out=new Map();
 for(const s of render||[]){
  const t=engine.get(s.tick);
  if(t===undefined||out.has(t))continue;
  for(const k of ['cx','cy','zoom'])assert(Number.isFinite(s[k]),'non-finite render camera '+k);
  out.set(t,s);
 }
 return out;
}
// Largest render-camera differences between two runs at the same vehicle ticks (from `from` on), in engine units.
function cameraDelta(a,b,{from=1,to=Infinity,filter=()=>true}={}){
 let n=0,cx=0,cy=0,zoom=0,first=null;
 for(const [t,x] of a){
  const y=b.get(t);
  if(!y||t<from||t>to||!filter(y,x))continue;
  n++;first=first===null?t:Math.min(first,t);
  cx=Math.max(cx,Math.abs(x.cx-y.cx));cy=Math.max(cy,Math.abs(x.cy-y.cy));zoom=Math.max(zoom,Math.abs(x.zoom-y.zoom));
 }
 return {paired_ticks:n,first_tick:first,max_dcx_u:cx,max_dcy_u:cy,max_dzoom:zoom};
}
// Only default B settings in the fixed pre-step window can prove the downhill lead.
function downhillLead(a,b,seq,until,label){
 const samples=[...b].filter(([t,s])=>t<=until&&s.mode==='b'&&s.cam_seq===seq);
 const lead=Math.max(0,...samples.map(([,s])=>s.descent));
 const d=cameraDelta(a,b,{to:until,filter:s=>s.mode==='b'&&s.cam_seq===seq});
 const paired=[...a.keys()].filter(t=>t<=until&&b.get(t)?.mode==='b'&&b.get(t)?.cam_seq===seq);
 const span=paired.length?Math.max(...paired)-Math.min(...paired):0;
 assert(span>=60,label+': insufficient B-only vehicle-tick span: '+JSON.stringify(d));
 assert(lead>5,label+': camera B built no downhill lead before the step: '+lead);
 assert(d.max_dcy_u>3,label+': camera B did not change the view on the downhill: '+JSON.stringify(d));
 assert([...a.values()].every(s=>s.descent===0),label+': camera A has a downhill lead');
 return {frames:samples.length,vehicle_tick_span:span,max_descent_u:lead,...d};
}
// A recording of taps: cleanly stopped and without any drive command.
function verifyNoDrive(recording,label){
 assert(recording&&recording.ended==='stopped'&&recording.error===false,label+': recording not cleanly stopped');
 assert(Number.isSafeInteger(recording.ticks)&&recording.ticks>=60,label+': recording too short');
 assert.deepEqual(recording.commands,{throttle:0,brake:0,lean:0},label+': a camera tap produced drive input');
 return {ticks:recording.ticks,commands:recording.commands};
}
// The A21 replay of a camera-B recording on another camera: complete, same commands, MATCH.
function verifyReplay(play,label){
 assert(play&&play.ended==='done'&&play.complete===true,label+': replay did not complete');
 assert.equal(play.verdict,'MATCH',label+': replay verdict '+play.verdict);
 assert.equal(play.mismatches,0,label+': replayed commands differ from the recording');
 assert.equal(play.tuning_changed,false,label+': a camera setting counted as live tuning');
 assert.equal(play.scaled_ticks,0,label+': replay not at the fixed 1.0 step');
 return {verdict:play.verdict,ticks:play.ticks,max_position_m:play.max_position_m,max_angle_rad:play.max_angle_rad,mismatches:play.mismatches};
}
// #671: Auto zoom (default settings) on the air-mid lip jump of the camera-A run: the view is wider in the flight than
// on the ground just before the take-off, and the zoom changes in small steps (no pumping) through the flight and the
// landing, coming back towards the ground zoom. render: render frames in order (probe trace).
function airZoom(render,label){
 const frames=render.filter(s=>s.mode==='a'&&Number.isFinite(s.zoom));
 const takeoff=frames.findIndex(s=>s.air_from_lip);
 assert(takeoff>0,label+': no lip flight in the render trace');
 const ground=frames[takeoff-1].zoom;
 let end=takeoff;while(end<frames.length&&frames[end].air_from_lip)end++;
 const flight=frames.slice(takeoff,end);
 const air=Math.min(...flight.map(s=>s.zoom));
 assert(air<ground*0.95,label+': the view is not wider in the air: '+JSON.stringify({ground,air}));
 const after=frames.slice(end);
 assert(after.length>=60,label+': too few frames after the landing: '+after.length);
 const last=after.at(-1).zoom;
 assert(last>air+(ground-air)*0.5,label+': the zoom did not come back after the landing: '+JSON.stringify({ground,air,last}));
 // Per second of render time, so a slow CI frame cannot fake a jump; 0.5/s is far below a visible snap.
 let rate=0;
 for(let i=takeoff;i<frames.length;i++){const dt=frames[i].dt;if(dt>0)rate=Math.max(rate,Math.abs(frames[i].zoom-frames[i-1].zoom)/dt);}
 assert(rate<0.5,label+': the zoom jumps: '+rate+' per s');
 return {ground_zoom:ground,air_min_zoom:air,last_zoom:last,flight_frames:flight.length,frames_after_landing:after.length,max_zoom_rate_per_s:rate};
}
const overlap=(a,b,tol=0.5)=>a.left<b.right-tol&&a.right>b.left+tol&&a.top<b.bottom-tol&&a.bottom>b.top+tol;
const inside=(r,c,tol=0.5)=>r.left>=c.left-tol&&r.top>=c.top-tol&&r.right<=c.right+tol&&r.bottom<=c.bottom+tol;
const sameValues=(a,b)=>Object.keys(DEFAULTS).every(k=>a[k]===b[k]);
module.exports={parseArgs,byTick,identicalPhysics,renderByTick,cameraDelta,downhillLead,verifyNoDrive,verifyReplay,airZoom,overlap,inside,sameValues,
 SCENARIOS,PHYSICS_KEYS,DEFAULTS,measurementBudget,verifyMeasurementWindow,failurePageState};

if(require.main===module){
 const {configure}=require('./launch.cjs');
 const pointer=require('./pointer.cjs');
 const storage=require('./storage.cjs');
 const {chromium}=require('playwright');
 const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
 const {output,sha,runId,bundle}=parseArgs(process.argv.slice(2));
 const out=path.resolve(output);fs.mkdirSync(out,{recursive:true});
 fs.rmSync(path.join(out,'cam443-result.json'),{force:true});
 const metadata=JSON.parse(fs.readFileSync(path.join(bundle,'bundle.json'),'utf8'));
 assert(metadata.variant==='debug'&&metadata.platform==='wasm-web'&&metadata.source_sha===sha,'Wrong Defold debug bundle');
 function find(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory()){const v=find(p);if(v)return v;}else if(e.name==='index.html')return p;}}
 const index=find(path.resolve(bundle));assert(index,'No Defold index.html in bundle');
 const web=path.dirname(index);
 const server=http.createServer((req,res)=>{
  const file=path.resolve(web,'.'+new URL(req.url,'http://localhost').pathname);
  if(!file.startsWith(web+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',file.endsWith('.wasm')?'application/wasm':file.endsWith('.js')?'text/javascript':file.endsWith('.json')?'application/json':'text/html');
  fs.createReadStream(file).pipe(res);
 });
 (async()=>{
  let browser,measurement=null;const errors=[],cases={},pages={};
  const FRAMES='window.riderReplay.frames';
  const watch=(p,name)=>{pages[name]=p;p.on('pageerror',e=>{if(errors.length<20)errors.push(name+': '+e.message);});
   p.on('console',m=>{if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT|ERROR:GUI/.test(m.text())&&errors.length<20)errors.push(name+': '+m.text());});};
  try{
   await new Promise(r=>server.listen(0,'127.0.0.1',r));
   const url='http://127.0.0.1:'+server.address().port+'/index.html';
   browser=await chromium.launch();
   async function open(name,query,context={viewport:DESKTOP}){
    const ctx=await browser.newContext(context);const p=await ctx.newPage();watch(p,name);
    await configure(p,runId,'cam443');
    await p.goto(url+'?'+query);await ready(p);
    return {ctx,p};
   }
   async function ready(p){
    await p.waitForFunction(({sha,runId})=>window.riderReady?.source_sha===sha&&window.riderReady?.run_id===runId&&
     window.riderReplay?.frames>10&&(window.riderCamera443?.control||window.riderCamera443?.forced)&&window.riderCameraOwner?.seq>=1&&window.riderCamera352PhysicsTrace?.length>=1,
     {sha,runId},{polling:50,timeout:30000});
    await pointer.frames(p,{counter:FRAMES,n:3,label:'ready'});
   }
   const cam=p=>p.evaluate(()=>({...window.riderCamera443}));
   const owner=p=>p.evaluate(()=>({...window.riderCameraOwner}));
   const values=s=>({mode:s.mode,...s.values});
   // #678: the camera is a play bar button and a kit menu. name: toggle (the other mode), set (the bar button), close,
   // reset; row: {key, which: plus|minus}. Returns the CSS centre and a selector for the element.
   const selectorOf=(name,row)=>row?`#rider-playbar .pb-campanel [data-act="cam:step:${row.key}:${row.which==='plus'?1:-1}"]`
    :{toggle:'#rider-playbar .pb-campanel [data-mode]:not(.on)',set:'#rider-playbar .pb-row [data-act="camera"]',
      close:'#rider-playbar .pb-campanel [data-act="cam:close"]',reset:'#rider-playbar .pb-campanel [data-act="cam:reset"]'}[name];
   const centreOf=(p,name,row)=>p.evaluate(sel=>{
    const e=document.querySelector(sel);if(!e||!e.getClientRects().length)return null;
    const b=e.getBoundingClientRect();return {x:(b.left+b.right)/2,y:(b.top+b.bottom)/2,sel};
   },selectorOf(name,row));
   async function tap(p,name,row,label){
    if(name==='toggle'&&!(await cam(p)).open)await panel(p,true,label+' open menu');
    const pt=await centreOf(p,name,row);assert(pt,label+': no '+name+' on screen');
    const hit=await p.evaluate(({x,y,sel})=>document.elementFromPoint(x,y)?.closest('button')===document.querySelector(sel),pt);
    assert.equal(hit,true,label+': something covers the camera '+(name||row.key));
    await pointer.tap(p,pt,{counter:FRAMES,label});
   }
   // Tap and wait until the loader applied (and stored) the camera command.
   async function command(p,name,row,label,expect){
    const before=await cam(p);
    await tap(p,name,row,label);
    await p.waitForFunction(({seq,expect})=>window.riderCamera443?.settings_seq>seq&&Object.entries(expect||{}).every(([k,v])=>
     (k==='mode'?window.riderCamera443.mode:window.riderCamera443.values[k])===v),{seq:before.settings_seq,expect},{polling:50,timeout:5000})
     .catch(e=>{throw Error(label+': camera command not applied ('+e.message.split('\n')[0]+')');});
    const after=await cam(p);
    // The controller (camera owner) got the same settings.
    await p.waitForFunction(seq=>window.riderCameraOwner?.seq===seq,after.settings_seq,{polling:50,timeout:5000})
     .catch(e=>{throw Error(label+': camera owner did not receive the settings ('+e.message.split('\n')[0]+')');});
    const o=await owner(p);assert(sameValues(o,values(after)),label+': owner settings differ from the HUD');
    return after;
   }
   async function panel(p,openIt,label){
    const s=await cam(p);if(s.open===openIt)return;
    await tap(p,openIt?'set':'close',null,label);
    await p.waitForFunction(o=>window.riderCamera443?.open===o&&!document.querySelector('#rider-playbar .pb-campanel').hidden===o,openIt,{polling:50,timeout:5000});
    await pointer.frames(p,{counter:FRAMES,n:3,label:label+' settle'});
   }
   const tick=p=>p.evaluate(()=>window.riderCamera352PhysicsTrace.at(-1).tick);
   const waitTick=(p,n,timeout=20000)=>p.waitForFunction(n=>(window.riderCamera352PhysicsTrace?.at(-1)?.tick||0)>=n,n,{polling:20,timeout});
   const traces=p=>p.evaluate(()=>({physics:window.riderCamera352PhysicsTrace.slice(),render:window.riderCamera352Trace.slice()}));
   // The station's own result once it is final (ramp record done, air lip jump complete).
   async function result(p,scn){
    if(scn.b_lead)await p.waitForFunction(()=>window.riderStationReport?.records?.find(r=>r.id==='down-30')?.done,null,{polling:50,timeout:20000});
    if(scn.air)await p.waitForFunction(()=>(window.riderStationReport?.jumps||[]).find(j=>j.from_lip&&j.section==='mid'&&j.complete),null,{polling:50,timeout:20000});
    return p.evaluate(()=>window.riderStationReport?JSON.parse(JSON.stringify(window.riderStationReport)):null);
   }
   async function record(p,on){
    if(on){const n=await p.evaluate(()=>window.riderReplay.resets);await p.keyboard.down('b');
     try{await p.waitForFunction(n=>window.riderReplay?.recording?.active&&window.riderReplay.resets===n+1,n,{timeout:5000});}finally{await p.keyboard.up('b');}
     await pointer.frames(p,{counter:FRAMES,label:'record key release'});return;}
    // At least one second of ticks, so a quick tap sequence is still a meaningful no-drive recording.
    await p.waitForFunction(()=>window.riderReplay?.recording?.ticks>=60,null,{polling:50,timeout:10000});
    await p.keyboard.down('b');
    try{await p.waitForFunction(()=>window.riderReplay?.recording?.active===false,null,{timeout:5000});}finally{await p.keyboard.up('b');}
    await pointer.frames(p,{counter:FRAMES,label:'stop key release'});
    return p.evaluate(()=>window.riderReplay.recording);
   }
   // Placement in CSS pixels: the bar's camera button and the open menu inside the view, clear of the FPS counter, the
   // drive zones, level actions and status line; every menu button is the element under its centre.
   const placement=p=>p.evaluate(()=>{
    const c=document.querySelector('canvas'),r=c.getBoundingClientRect(),C=window.riderCamera443,F=window.riderFpsPlace;
    const css=q=>q&&({left:r.x+q.x0/c.width*r.width,right:r.x+q.x1/c.width*r.width,top:r.y+(1-q.y1/c.height)*r.height,bottom:r.y+(1-q.y0/c.height)*r.height});
    const box=e=>{const b=e.getBoundingClientRect();return {left:b.left,top:b.top,right:b.right,bottom:b.bottom};};
    const dom=[];
    for(const [sel,kind] of [['#rider-mobile [data-command]','drive'],['#rider-level-actions button','level'],['#page-tools button','page'],['#rider-mobile .readout','readout'],['#rider-playbar .pb-left > *','left box'],['#rider-playbar .pb-debug','debug group']]){
     for(const e of document.querySelectorAll(sel)){const b=e.getBoundingClientRect();
      if(b.width>0&&b.height>0&&getComputedStyle(e).visibility==='visible')dom.push({name:kind+':'+(e.dataset.command||e.textContent.trim().slice(0,24)),...box(e)});}
    }
    const fps=F&&F.visible&&F.rect?{name:'fps counter',...css(F.rect)}:null;
    const button=document.querySelector('#rider-playbar .pb-row [data-act="camera"]'),menu=document.querySelector('#rider-playbar .pb-campanel');
    const open=!!C.open&&!menu.hidden;
    const covered=open?[...menu.querySelectorAll('button')].filter(e=>{const b=e.getBoundingClientRect();
     return document.elementFromPoint((b.left+b.right)/2,(b.top+b.bottom)/2)?.closest('button')!==e;}).map(e=>e.dataset.act):[];
    return {view:{left:0,top:0,right:innerWidth,bottom:innerHeight},touch:!!window.riderMobile?.enabled,open,
     control:button?box(button):null,row:box(document.querySelector('#rider-playbar .pb-row')),panel:open?box(menu):null,covered,dom,fps,label:C.label};
   });
   async function checkPlacement(p,label){
    const s=await placement(p);
    const others=[...s.dom,...(s.fps?[s.fps]:[])];
    assert(s.control,label+': no camera button in the play bar');
    assert(inside(s.control,s.view),`${label}: camera button ${JSON.stringify(s.control)} leaves the view`);
    for(const o of others)assert(!overlap(s.control,o),`${label}: camera button covers ${o.name} ${JSON.stringify(o)}`);
    const at={control:{left:s.control.left,top:s.control.top,width:s.control.right-s.control.left,height:s.control.bottom-s.control.top}};
    if(s.open){
     assert(inside(s.panel,s.view),`${label}: menu ${JSON.stringify(s.panel)} leaves the view`);
     for(const o of [...others,{name:'play bar row',...s.row}])assert(!overlap(s.panel,o),`${label}: camera menu covers ${o.name} ${JSON.stringify(o)}`);
     assert.deepEqual(s.covered,[],label+': menu buttons covered');
     at.panel={left:s.panel.left,top:s.panel.top,width:s.panel.right-s.panel.left,height:s.panel.bottom-s.panel.top};
    }
    at.avoided=others.map(o=>o.name);
    return at;
   }

   // 1. Each driving scenario: a camera-A run and a live-switched run on identical scripted commands.
   for(const scn of SCENARIOS){
    const label=scn.name;
    measurement=measurementBudget(scn);
    const a=await open(label+'-a',scn.query);
    const fresh=await cam(a.p);
    assert.equal(fresh.mode,'a','Camera A is not the default');assert.equal(fresh.status,'default');
    assert(sameValues(values(fresh),DEFAULTS)&&sameValues(await owner(a.p),DEFAULTS),label+': fresh settings are not the defaults');
    await waitTick(a.p,scn.ticks);const A=await traces(a.p);A.report=await result(a.p,scn);
    await a.p.screenshot({path:path.join(out,`cam443-${label}-a.png`)});await a.ctx.close();
    const t=await open(label+'-switch',scn.query);
    await panel(t.p,true,label+' open menu');
    await waitTick(t.p,scn.toggleAt);
    const toggled=await command(t.p,'toggle',null,label+' Cam A -> B',{mode:'b'});
    const toggleSeq=toggled.settings_seq;
    measurement.toggle_tick=await tick(t.p);
    if(scn.b_lead){
     // #486: a fast host used to step the height after only ~28 B ticks. Give the
     // unmodified B camera a fixed vehicle-tick window to develop its downhill lead.
     // Fail a late toggle instead of silently measuring a shorter interval.
     verifyMeasurementWindow(measurement,'toggle');
     await waitTick(t.p,scn.bOnlyUntil);
     measurement.hold_tick=await tick(t.p);
    }
    await panel(t.p,true,label+' open panel');
    let last;
    for(let i=0;i<scn.setting.taps;i++)last=await command(t.p,null,{key:scn.setting.key,which:scn.setting.dir>0?'plus':'minus'},label+' step '+scn.setting.key);
    const stepped=last.values[scn.setting.key];
    assert.notEqual(stepped,DEFAULTS[scn.setting.key],label+': the setting did not change');
    await panel(t.p,false,label+' close panel');
    const switchedAt=await tick(t.p);
    measurement.step_tick=switchedAt;
    verifyMeasurementWindow(measurement,'step');
    await waitTick(t.p,scn.ticks);const T=await traces(t.p);T.report=await result(t.p,scn);
    await t.p.screenshot({path:path.join(out,`cam443-${label}-switched.png`)});
    // Physics: exact on every vehicle tick 1..ticks, with B in use for most of them.
    const physics=identicalPhysics(A.physics,T.physics,scn.ticks,{label});
    assert.equal(physics.modes.a.b||0,0,label+': the camera-A run used camera B');
    assert(physics.modes.b.b>=scn.ticks-switchedAt,label+': too few compared ticks on camera B: '+JSON.stringify(physics.modes));
    // Camera: B and the stepped setting really move the render camera.
    const ra=renderByTick(A.render,A.physics),rt=renderByTick(T.render,T.physics);
    assert([...ra.values()].every(s=>s.mode==='a'),label+': A run rendered with B');
    const first=[...rt.values()].find(s=>s.mode==='b');assert(first,label+': no render frame on camera B');
    const stepFrame=[...rt].find(([,s])=>s.cam_seq===last.settings_seq);assert(stepFrame,label+': no render frame with the stepped setting');
    const all=cameraDelta(ra,rt,{from:1});
    const afterStep=cameraDelta(ra,rt,{from:stepFrame[0]});
    const summary={toggle_tick:[...rt].find(([,s])=>s.mode==='b')[0],step_tick:stepFrame[0],stepped:{key:scn.setting.key,value:stepped},
     physics,camera_all:all,camera_after_step:afterStep};
    if(scn.effect==='cy')assert(afterStep.max_dcy_u>=15,label+': height setting did not move the camera: '+JSON.stringify(afterStep));
    if(scn.effect==='zoom')assert(afterStep.max_dzoom>=0.05,label+': zoom setting did not zoom: '+JSON.stringify(afterStep));
    if(scn.effect==='cx')assert(afterStep.max_dcx_u>=20,label+': look-ahead setting did not move the camera: '+JSON.stringify(afterStep));
    if(scn.b_lead){
     // Camera B alone (before the setting step): a real downhill lead on the loaded slope, a lower view than A.
     summary.b_only=downhillLead(ra,rt,toggleSeq,scn.bOnlyUntil,label);
     const ra30=A.report?.records?.find(r=>r.id==='down-30'),rt30=T.report?.records?.find(r=>r.id==='down-30');
     assert(ra30&&rt30,label+': no down-30 station record');
     summary.station_result={a:ra30.speed_gain_mps,b:rt30.speed_gain_mps};
     assert.equal(rt30.speed_gain_mps,ra30.speed_gain_mps,label+': station result differs');
    }
    if(scn.air){
     const lip=s=>(s.report?.jumps||[]).find(j=>j.from_lip&&j.section==='mid');
     const ja=lip(A),jt=lip(T);assert(ja&&jt,label+': no lip jump in both runs');
     for(const k of ['status','airtime_s','rotation_deg','touchdown_x','takeoff_speed_mps','landing_angle_deg'])assert.equal(jt[k],ja[k],label+': jump '+k+' differs');
     summary.station_result={a:{status:ja.status,airtime_s:ja.airtime_s,rotation_deg:ja.rotation_deg},b:{status:jt.status,airtime_s:jt.airtime_s,rotation_deg:jt.rotation_deg}};
     assert(T.render.some(s=>s.mode==='b'&&s.air_from_lip),label+': no lip flight on camera B');
     assert(T.render.some(s=>s.mode==='b'&&s.air_landing_age_s>=0),label+': no landing on camera B');
     summary.auto_zoom=airZoom(A.render,label);
    }
    if(scn.reverse){
     const P=byTick(T.physics,label);let rev=null;
     for(let k=1;k<=scn.ticks;k++){const s=P.get(k);if(s.reverse_engaged&&s.vx*0.01<=-0.3){rev=k;break;}}
     assert(rev,label+': the car never reversed in the window');
     assert(rt.get(rev+30)?.dir===-1||[...rt].some(([k,s])=>k>rev&&s.dir===-1),label+': camera did not turn to the reverse direction');
     summary.reverse_tick=rev;
    }
    fs.writeFileSync(path.join(out,`cam443-${label}-traces.json`),JSON.stringify({a:A,switched:T},null,1));
    measurement=null;
    // 2. A21: record on camera B (stepped), replay on camera A, switch back to B and step again mid-replay: MATCH.
    await record(t.p,true);
    await t.p.waitForFunction(n=>window.riderReplay?.recording?.ticks>=n,scn.ticks-60,{polling:50,timeout:20000});
    const rec=await record(t.p,false);
    assert(rec.error===false&&rec.ticks>=scn.ticks-60,label+': recording failed');
    await command(t.p,'toggle',null,label+' Cam B -> A before replay',{mode:'a'});
    await t.p.keyboard.down('g');
    try{await t.p.waitForFunction(()=>window.riderReplay?.play?.active===true,null,{timeout:5000});}finally{await t.p.keyboard.up('g');}
    await command(t.p,'toggle',null,label+' Cam A -> B mid-replay',{mode:'b'});
    await panel(t.p,true,label+' open panel mid-replay');
    await command(t.p,null,{key:scn.setting.key,which:scn.setting.dir>0?'plus':'minus'},label+' step mid-replay');
    await panel(t.p,false,label+' close panel mid-replay');
    await t.p.waitForFunction(()=>window.riderReplay?.play?.ended,null,{polling:50,timeout:30000});
    summary.replay=verifyReplay(await t.p.evaluate(()=>window.riderReplay.play),label);
    summary.replay.recorded_on={mode:'b',[scn.setting.key]:stepped};
    cases[label]=summary;
    // 3. Persistence (on the last scenario's page): the choice and settings survive a reload; Reset to A survives too.
    if(scn===SCENARIOS.at(-1)){
     const before=await cam(t.p);
     assert.equal(before.saved,true,'camera settings not written');
     assert.equal(await storage.durable(t.p,{label:'camera settings'}),'saved');
     await t.p.reload();await ready(t.p);
     let after=await cam(t.p);
     assert.equal(after.status,'ok','stored camera settings not read back');
     assert(sameValues(values(after),values(before)),'camera settings changed across a reload: '+JSON.stringify([values(before),values(after)]));
     assert(sameValues(await owner(t.p),values(before)),'camera owner did not get the stored settings after the reload');
     await waitTick(t.p,30);
     const frame=(await traces(t.p)).render.at(-1);
     assert(frame.mode===before.mode&&frame[`cam_${scn.setting.key}`]===before.values[scn.setting.key],'reloaded camera does not frame with the stored settings');
     cases.persist_reload={stored:values(after),status:after.status,label:after.label};
     await panel(t.p,true,'open panel for Reset');
     const reset=await command(t.p,'reset',null,'Reset',{mode:'a'});
     assert(sameValues(values(reset),DEFAULTS),'Reset did not restore camera A defaults: '+JSON.stringify(values(reset)));
     await panel(t.p,false,'close after Reset');
     assert.equal(await storage.durable(t.p,{label:'camera reset'}),'saved');
     await t.p.reload();await ready(t.p);
     after=await cam(t.p);
     assert(after.status==='ok'&&sameValues(values(after),DEFAULTS)&&sameValues(await owner(t.p),DEFAULTS),'Reset did not survive the reload');
     assert.equal(after.label,'Cam A');
     cases.reset_defaults={after_reload:values(after),status:after.status};
    }
    await t.ctx.close();
   }

   // 4. Desktop taps (mouse, live input on Straight): no drive command; placement closed and open.
   {
    const {ctx,p}=await open('desktop-taps','station=straight');
    cases.desktop_placement={closed:await checkPlacement(p,'desktop closed')};
    // HUD GUI node budget: nodes in use against ui.gui max_nodes (the file and the game agree).
    const nodes=(await cam(p)).nodes,fileMax=Number(/max_nodes: (\d+)/.exec(fs.readFileSync(path.join(__dirname,'../../main/game/ui.gui'),'utf8'))[1]);
    assert(nodes&&Number.isSafeInteger(nodes.used)&&nodes.max===fileMax,'HUD node budget not published: '+JSON.stringify(nodes));
    assert(nodes.used<=nodes.max,'HUD GUI over its node budget: '+JSON.stringify(nodes));
    cases.hud_nodes={used:nodes.used,max:nodes.max,free:nodes.max-nodes.used};
    await record(p,true);
    const x0=await p.evaluate(()=>window.riderReplay.x);
    await command(p,'toggle',null,'desktop toggle',{mode:'b'});
    await panel(p,true,'desktop open');
    cases.desktop_placement.open=await checkPlacement(p,'desktop open');
    await p.screenshot({path:path.join(out,'cam443-desktop-panel.png')});
    // #671 Auto zoom starts on (its maximum): off and on again.
    for(const spec of ['follow','look','zoom','offset','descent_response','descent_rise_limit','auto_zoom','zoom_near','zoom_air','zoom_rate']){
     const first=spec==='auto_zoom'?'minus':'plus',second=first==='plus'?'minus':'plus';
     await command(p,null,{key:spec,which:first},'desktop '+first+' '+spec);
     await command(p,null,{key:spec,which:second},'desktop '+second+' '+spec);
    }
    await command(p,'reset',null,'desktop reset',{mode:'a'});
    // A tap on the panel background and on the control's gap is consumed, never driving.
    await panel(p,false,'desktop close');
    await command(p,'toggle',null,'desktop toggle again',{mode:'b'});
    const rec=await record(p,false);
    const x1=await p.evaluate(()=>window.riderReplay.x);
    cases.mouse_no_drive={...verifyNoDrive(rec,'desktop'),dx_m:x1-x0,taps:(await cam(p)).taps};
    assert(Math.abs(x1-x0)<0.05,'Car moved during camera taps: '+(x1-x0));
    // Keys still drive after the taps (the canvas keeps the focus).
    await p.keyboard.down('ArrowUp');
    try{await p.waitForFunction(x=>window.riderReplay?.command?.throttle===1&&window.riderReplay.x>x+0.2,x1,{polling:50,timeout:5000});}
    finally{await p.keyboard.up('ArrowUp');}
    await ctx.close();
   }
   // 4b. The debug ?camera352 route forces the mode: the HUD control is hidden (it would store an ignored choice).
   {
    const {ctx,p}=await open('camera352-forced','station=straight&camera352=b');
    const c=await cam(p);
    assert.equal(c.forced,'b','?camera352=b not recognised by the HUD');
    assert.equal(c.control,false,'camera control shown although ?camera352 forces the mode');
    assert.equal(await p.evaluate(()=>!!document.querySelector('#rider-playbar [data-act="camera"]')),false,'camera button shown although ?camera352 forces the mode');
    const frame=await p.evaluate(()=>window.riderCamera352Trace.at(-1));
    assert.equal(frame.mode,'b','?camera352=b does not force camera B');
    cases.camera352_forced={forced:c.forced,control:c.control,mode:frame.mode};
    await ctx.close();
   }
   // 5. Phone 1080x486 with touch controls: CDP touch taps, no drive, placement clear of the drive zones.
   {
    const {ctx,p}=await open('phone','station=straight&touch=1',{viewport:PHONE,isMobile:true,hasTouch:true});
    assert.equal(await p.evaluate(()=>window.riderMobile?.enabled),true,'Touch controls not enabled');
    const session=await ctx.newCDPSession(p);
    async function touch(name,row,label,expect){
     const before=await cam(p);const pt=await centreOf(p,name,row);assert(pt,label+': nothing to touch');
     assert.equal(await p.evaluate(({x,y,sel})=>document.elementFromPoint(x,y)?.closest('button')===document.querySelector(sel),pt),true,label+': something covers the target');
     await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:pt.x,y:pt.y,id:1}]});
     try{await pointer.frames(p,{counter:FRAMES,label:label+' press'});}finally{await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
     await pointer.frames(p,{counter:FRAMES,label:label+' release'});
     if(expect)await p.waitForFunction(({seq,expect})=>window.riderCamera443.settings_seq>seq&&Object.entries(expect).every(([k,v])=>(k==='mode'?window.riderCamera443.mode:window.riderCamera443.values[k])===v),
      {seq:before.settings_seq,expect},{polling:50,timeout:5000});
    }
    const closed=await checkPlacement(p,'phone closed');
    await record(p,true);
    const x0=await p.evaluate(()=>window.riderReplay.x);
    await touch('set',null,'phone open');
    await p.waitForFunction(()=>window.riderCamera443.open&&!document.querySelector('#rider-playbar .pb-campanel').hidden,null,{timeout:5000});
    await touch('toggle',null,'phone toggle',{mode:'b'});
    await pointer.frames(p,{counter:FRAMES,n:3,label:'phone panel settle'});
    const opened=await checkPlacement(p,'phone open');
    await p.screenshot({path:path.join(out,'cam443-phone-panel.png')});
    await touch(null,{key:'offset',which:'plus'},'phone + offset',{offset:10});
    await touch('reset',null,'phone reset',{mode:'a',offset:0});
    await touch('close',null,'phone close');
    await p.waitForFunction(()=>window.riderCamera443.open===false,null,{timeout:5000});
    const rec=await record(p,false);
    const x1=await p.evaluate(()=>window.riderReplay.x);
    assert.equal(await p.evaluate(()=>document.querySelectorAll('#rider-mobile [data-command].held').length),0,'A drive zone is held after the taps');
    cases.phone={placement:{closed,open:opened},...verifyNoDrive(rec,'phone'),dx_m:x1-x0};
    assert(Math.abs(x1-x0)<0.05,'Car moved during phone camera taps: '+(x1-x0));
    await ctx.close();
   }

   measurement=null;
   assert.equal(errors.length,0,'Defold errors: '+errors.join('; '));
   const report={status:'PASS',source_sha:sha,build_source_fingerprint:metadata.source_fingerprint,run_id:runId,
    browser:browser.version(),platform:'real-debug-defold-html5-chromium-headless',cases,
    method:'Paired vehicle-ready fixed ticks (#374): a camera-A page and a live-switched page on identical scripted commands; every fixed-owner field compared exactly.',
    not_run:['Android_device','real_touch','camera_feel_judgement'],
    limitations:'Synthetic mouse and CDP touch input in headless Chromium; which camera and values feel best is Claudio\'s drive test.'};
   fs.writeFileSync(path.join(out,'cam443-result.json'),JSON.stringify(report,null,2)+'\n');
   console.log('CAM443_RESULT '+JSON.stringify({status:report.status,source_sha:sha,run_id:runId,cases:Object.keys(cases)}));
  }catch(e){
   const diag={status:'FAIL',source_sha:sha,run_id:runId,error:String(e),measurement_budget:measurement,cases,browser_errors:errors};
   for(const [name,p] of Object.entries(pages)){
    if(p.isClosed())continue;
    diag[name]=await p.evaluate(failurePageState).catch(err=>({capture_error:String(err)}));
    await p.screenshot({path:path.join(out,`cam443-${name}-failed.png`),timeout:5000}).catch(()=>{});
   }
   fs.writeFileSync(path.join(out,'cam443-failed.json'),JSON.stringify(diag,null,2)+'\n');
   console.error('CAM443_FAIL '+JSON.stringify({error:diag.error,source_sha:sha,run_id:runId}));
   throw e;
  }finally{
   if(browser)await browser.close().catch(()=>{});
   await new Promise(resolve=>server.close(resolve));
  }
 })().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
}
