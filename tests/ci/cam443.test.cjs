'use strict';
// #443: pure checks of the cam443 Gym runner (the runner itself needs a real Defold debug bundle).
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const vm=require('node:vm');
const {parseArgs,identicalPhysics,renderByTick,cameraDelta,downhillLead,verifyNoDrive,verifyReplay,airZoom,overlap,inside,sameValues,
 SCENARIOS,PHYSICS_KEYS,DEFAULTS,measurementBudget,verifyMeasurementWindow,failurePageState}=require('../../tools/gym/camera443.cjs');
const root=path.resolve(__dirname,'../..');

test('CLI accepts exactly the cam443 case',()=>{
 assert.deepEqual(parseArgs(['out','sha','run','cam443','bundle']),{output:'out',sha:'sha',runId:'run',bundle:'bundle'});
 for(const bad of [[],['out','sha','run','fps444','bundle'],['out','sha','','cam443','bundle'],['out','sha','run','cam443','bundle','--fast']])
  assert.throws(()=>parseArgs(bad),/Usage/);
});

test('defaults and scenarios mirror the game modules',()=>{
 const lua=fs.readFileSync(path.join(root,'main/game/camera_settings.lua'),'utf8');
 assert.match(lua,/M\.DEFAULT_MODE="a"/,'camera A must stay the default');
 for(const [key,value] of Object.entries(DEFAULTS)){
  if(key==='mode')continue;
  assert.match(lua,new RegExp(`key="${key}",[^\\n]*default=${value},`),'default of '+key);
 }
 const drive=fs.readFileSync(path.join(root,'main/gym/camera_drive443.lua'),'utf8');
 for(const s of SCENARIOS){
  const script=/drive443=(\w+)/.exec(s.query)[1];
  assert.match(drive,new RegExp(`\\b${script}=true`),'unknown drive443 script '+script);
  assert(s.ticks<=440&&s.ticks>=300,'window must fit the probe page buffer (480)');
  assert(lua.includes(`key="${s.setting.key}"`),'unknown setting '+s.setting.key);
 }
 assert.deepEqual(SCENARIOS.map(s=>s.station),['ramps-long','air','straight']);
 const probe=fs.readFileSync(path.join(root,'main/gym/camera_probe352.lua'),'utf8');
 for(const k of PHYSICS_KEYS)if(!['resets','generation','dt'].includes(k))assert.match(probe,new RegExp(`\\b${k}=`),'probe lacks '+k);
});

const trace=(n,f=s=>s)=>Array.from({length:n},(_,i)=>f({tick:i+1,engine_tick:i+5,resets:0,generation:1,dt:1/60,x:i*2,y:-i,vx:120,vy:-60,
 angle:i*0.01,omega:0.5,rear_angle:i*0.2,rear_omega:12,front_angle:i*0.2,front_omega:12,rear:true,front:true,throttle:0,brake_reverse:0,allow_reverse:false,reverse_engaged:false,mode:'a'}));

test('physics identity is exact over every compared tick and every field',()=>{
 const a=trace(120),b=trace(120,s=>({...s,engine_tick:s.engine_tick+1,mode:s.tick>20?'b':'a'}));
 const r=identicalPhysics(a,b,120);
 assert.equal(r.max_difference,0);assert.deepEqual(r.modes,{a:{a:120,b:0},b:{a:20,b:100}});
 for(const k of PHYSICS_KEYS){
  const bad=b.map(s=>s.tick===77?{...s,[k]:typeof s[k]==='boolean'?!s[k]:s[k]+1e-9}:s);
  assert.throws(()=>identicalPhysics(a,bad,120),new RegExp(`tick 77: ${k}`),'difference in '+k+' accepted');
 }
 assert.throws(()=>identicalPhysics(a,b.filter(s=>s.tick!==50),120),/missing fixed tick 50/);
 assert.throws(()=>identicalPhysics(a,b.slice(1),120),/does not start at the first drive-ready tick/);
 assert.throws(()=>identicalPhysics(a,b.concat({...b[9],x:5}),120),/conflicting duplicate/);
 assert.throws(()=>identicalPhysics(a,b,59),/too short/);
 assert.throws(()=>identicalPhysics(trace(120,s=>({...s,dt:1/30})),trace(120,s=>({...s,dt:1/30})),120),/fixed 1\/60/);
 assert.throws(()=>identicalPhysics(a,b.map(s=>s.tick===3?{...s,x:NaN}:s),120),/non-finite x/);
});

test('render frames pair by vehicle tick and report the camera change',()=>{
 const pa=trace(60),pb=trace(60,s=>({...s,engine_tick:s.engine_tick+1}));
 const frames=(p,shift,dy)=>p.flatMap(s=>[{tick:s.engine_tick,cx:s.x,cy:s.y+(s.tick>=30?dy:0)+shift,zoom:1,mode:'a'},{tick:s.engine_tick,cx:999,cy:999,zoom:9}]);
 const ra=renderByTick(frames(pa,0,0),pa),rb=renderByTick(frames(pb,0,25),pb);
 assert.equal(ra.size,60,'first render per vehicle tick');assert.equal(ra.get(1).cx,0);
 const before=cameraDelta(ra,rb,{to:29}),after=cameraDelta(ra,rb,{from:30});
 assert.equal(before.max_dcy_u,0);assert.equal(after.max_dcy_u,25);assert.equal(after.paired_ticks,31);assert.equal(after.first_tick,30);
 assert.equal(cameraDelta(ra,rb,{filter:s=>s.mode==='b'}).paired_ticks,0);
 assert.throws(()=>renderByTick([{tick:5,cx:NaN,cy:0,zoom:1}],pa),/non-finite render camera cx/);
});

test('no-drive recordings and replay verdicts',()=>{
 const rec={ended:'stopped',error:false,ticks:90,commands:{throttle:0,brake:0,lean:0}};
 assert.deepEqual(verifyNoDrive(rec,'t'),{ticks:90,commands:rec.commands});
 assert.throws(()=>verifyNoDrive({...rec,commands:{throttle:1,brake:0,lean:0}},'t'),/drive input/);
 assert.throws(()=>verifyNoDrive({...rec,ticks:30},'t'),/too short/);
 assert.throws(()=>verifyNoDrive({...rec,ended:'full'},'t'),/not cleanly stopped/);
 const play={ended:'done',complete:true,verdict:'MATCH',mismatches:0,tuning_changed:false,scaled_ticks:0,ticks:300,max_position_m:0,max_angle_rad:0};
 assert.equal(verifyReplay(play,'r').verdict,'MATCH');
 for(const [k,v,re] of [['verdict','DIVERGED',/verdict/],['mismatches',2,/commands differ/],['tuning_changed',true,/live tuning/],
  ['scaled_ticks',3,/1\.0 step/],['complete',false,/did not complete/],['ended','tick gap',/did not complete/]])
  assert.throws(()=>verifyReplay({...play,[k]:v},'r'),re,k);
});

test('placement helpers and settings comparison',()=>{
 const c={left:0,top:0,right:1280,bottom:720},a={left:10,top:10,right:110,bottom:60};
 assert(inside(a,c)&&!inside({...a,right:1281},c));
 assert(overlap(a,{left:100,top:50,right:200,bottom:90})&&!overlap(a,{left:110,top:0,right:200,bottom:60}),'touching is not overlapping');
 assert(sameValues({...DEFAULTS},DEFAULTS)&&!sameValues({...DEFAULTS,zoom:1.05},DEFAULTS)&&!sameValues({...DEFAULTS,mode:'b'},DEFAULTS));
});

// #486: a brief pre-step glimpse must never stand in for a developed downhill view.
test('downhill lead needs a full B-only window and excludes later height settings',()=>{
 const a=new Map(),b=new Map();
 for(let t=1;t<=180;t++){
  a.set(t,{cx:0,cy:0,zoom:1,descent:0,mode:'a'});
  b.set(t,{cx:0,cy:t>=90?8:2.81,zoom:1,descent:10,mode:'b',cam_seq:t<=120?2:3});
 }
 assert.throws(()=>downhillLead(a,b,2,28,'ramp'),/insufficient B-only vehicle-tick span/);
 assert.equal(downhillLead(a,b,2,120,'ramp').max_dcy_u,8);
 const sparse=new Map([...b].filter(([t])=>t%3===0));
 assert.equal(downhillLead(a,sparse,2,120,'sparse ramp').max_dcy_u,8);
 const noLead=new Map([...b].map(([t,s])=>[t,{...s,cy:t<=120?2.81:100}]));
 assert.throws(()=>downhillLead(a,noLead,2,120,'ramp'),/did not change the view/);
 const noDescent=new Map([...b].map(([t,s])=>[t,{...s,descent:0}]));
 assert.throws(()=>downhillLead(a,noDescent,2,120,'ramp'),/built no downhill lead/);
});

// #499: preserve the post-step window when normal CI UI latency follows the B-only hold.
test('ramp horizon accommodates the observed tick-229 setting completion',()=>{
 const ramp=SCENARIOS.find(s=>s.b_lead);
 const observedStepTick=229; // main run 41833511759, camera job 126587266958
 assert(observedStepTick>ramp.bOnlyUntil,'fixture must follow the fixed B-only measurement');
 assert(observedStepTick<ramp.ticks-90,
  'observed CI taps must leave the unchanged 90-tick post-step measurement window');
 assert(ramp.ticks<=440,'horizon must retain margin inside the 480-entry probe buffer');
});

test('late transitions retain their exact gate and named measurement budget',()=>{
 const ramp=SCENARIOS.find(s=>s.b_lead),budget=measurementBudget(ramp);
 assert.equal(budget.probe_capacity,480);
 const probe=fs.readFileSync(path.join(root,'main/gym/camera_probe352.lua'),'utf8');
 assert.equal((probe.match(/if\(a.length>480\)a.shift\(\)/g)||[]).length,2,'diagnostic capacity must match both probes');
 budget.toggle_tick=59;
 verifyMeasurementWindow(budget,'toggle');
 budget.toggle_tick=60;
 assert.throws(()=>verifyMeasurementWindow(budget,'toggle'),/toggle too late for the B-only window; budget=/);
 budget.toggle_tick=23;budget.hold_tick=121;budget.step_tick=329;
 verifyMeasurementWindow(budget,'step');
 budget.step_tick=330;
 let failure;
 try{verifyMeasurementWindow(budget,'step');}catch(e){failure=e;}
 assert(failure,'the exact 90-tick boundary must still fail');
 const recorded=JSON.parse(failure.message.split('budget=')[1]);
 assert.deepEqual(recorded,{scenario:'ramps-down-30',requested_toggle_tick:2,toggle_tick:23,
  required_hold_until_tick:120,hold_tick:121,step_tick:330,horizon_tick:420,
  required_b_only_span:60,required_post_step_ticks:90,probe_capacity:480});
 assert.throws(()=>verifyMeasurementWindow(budget,'unknown'),/Unknown camera measurement phase/);
});

test('failure capture serializes the available partial traces even before readiness',()=>{
 const capture=window=>JSON.parse(JSON.stringify(vm.runInNewContext('('+failurePageState.toString()+')()', {window})));
 const physics=trace(330),render=[{tick:334,cx:12,cy:8,zoom:1,mode:'b'}];
 const page={riderCamera352PhysicsTrace:physics,riderCamera352Trace:render,
  riderCamera443:{settings_seq:5,mode:'b'},riderCameraOwner:{seq:5},riderReplay:{x:2,recording:null,play:null}};
 const state=capture(page);
 assert.equal(state.ticks,330);assert.equal(JSON.stringify(state.partial_trace),JSON.stringify({physics,render}));
 assert.deepEqual(state.camera,page.riderCamera443);assert.deepEqual(state.owner,page.riderCameraOwner);
 const empty=capture({});
 assert.equal(empty.ticks,null);assert.deepEqual(empty.partial_trace,{physics:[],render:[]});
});

// #671: the auto zoom check on the air-mid camera-A trace.
test('auto zoom: wider in the flight, back after the landing, no jumps',()=>{
 const frames=(zoomAt,{air=[60,120],n=240,mode='a'}={})=>Array.from({length:n},(_,i)=>({mode,dt:1/60,zoom:zoomAt(i),air_from_lip:i>=air[0]&&i<air[1]}));
 // Eases out in the flight and back after it (exponential, 2/s).
 const smooth=i=>{let z=1;for(let k=1;k<=i;k++){const target=k>=60&&k<120?0.8:1;z+=(target-z)*(1-Math.exp(-2/60));}return z;};
 const r=airZoom(frames(smooth),'ok');
 assert(r.air_min_zoom<0.95&&r.ground_zoom===1&&r.last_zoom>0.9&&r.max_zoom_rate_per_s<0.5,JSON.stringify(r));
 assert.throws(()=>airZoom(frames(()=>1),'flat'),/not wider in the air/);
 assert.throws(()=>airZoom(frames(i=>i>=60&&i<120?0.8:1),'snap'),/zoom jumps/);
 assert.throws(()=>airZoom(frames(i=>Math.max(0.8,1-(i-60)*0.004*(i>=60))),'stays'),/did not come back/);
 assert.throws(()=>airZoom(frames(smooth,{air:[300,400]}),'none'),/no lip flight/);
 assert.throws(()=>airZoom(frames(smooth,{n:150}),'short'),/too few frames after the landing/);
 assert.throws(()=>airZoom(frames(smooth,{mode:'b'}),'b only'),/no lip flight/);
 assert.deepEqual(Object.keys(DEFAULTS).filter(k=>/zoom/.test(k)),['zoom','auto_zoom','zoom_near','zoom_air','zoom_rate']);
});
