// #370: opt-in, branch-only REAL Defold camera A/B on the existing A19c air/big fixture.
// Camera/projection observation only; the authoritative air protocol remains in air.cjs.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {configure}=require('./launch.cjs');
const C=require('./camera352_math.cjs');
const authored=require('./air_station.cjs');
const mean=xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
const round=v=>v===null?null:Math.round(v*1e6)/1e6;

function landingSegment(){
 const data=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../',authored.FILE),'utf8'));
 assert.deepEqual(data,authored.build(),'Air camera evidence must use the real authored station');
 const section=data.sections.find(s=>s.id==='big'),spec=authored.SECTIONS.find(s=>s.id==='big');
 assert(section&&spec&&spec.slope===45&&spec.drop===3,'Expected existing big 45-degree landing');
 const vertices=data.chains.flat(),startY=section.lip_y-spec.drop;
 const start=vertices.find(p=>Math.abs(p[0]-section.lip_x)<1e-5&&Math.abs(p[1]-startY)<1e-5);
 assert(start,'Missing authored landing-slope start');
 const end=vertices.filter(p=>p[0]>start[0]+0.1&&p[1]<start[1]-0.1&&p[1]>authored.GROUND+0.1)
  .sort((a,b)=>a[0]-b[0])[0];
 assert(end&&end[0]-start[0]>7&&Math.abs((start[1]-end[1])/(end[0]-start[0])-1)<0.01,
  'Expected existing 45-degree straight landing before the rounded transition');
 return {a:{x:start[0],y:start[1]},b:{x:end[0],y:end[1]},section:'big'};
}
function phaseOf(s){
 if(s.air_from_lip===true)return 'airborne';
 if(Number.isFinite(s.air_landing_age_s)&&s.air_landing_age_s>=0&&s.air_landing_age_s<=0.5)return 'landing';
 return null;
}
function pairedPhases(a,b){
 assert(a&&b&&a.mode==='a'&&b.mode==='b'&&a.source_sha===b.source_sha&&a.source_sha,
  'Camera370 A/B mode/source mismatch');
 assert(a.viewport.width===b.viewport.width&&a.viewport.height===b.viewport.height,
  'Camera370 A/B viewport mismatch');
 const index=(trial)=>{
  const engineToVehicle=new Map();
  for(const s of trial.physics){
   assert(s.source_sha===trial.source_sha&&s.station==='air'&&s.section==='big'&&s.mode===trial.mode,
    'Camera370 wrong fixed-owner identity');
   assert(Number.isSafeInteger(s.engine_tick)&&Number.isSafeInteger(s.tick)&&s.tick>0&&!engineToVehicle.has(s.engine_tick),
    'Camera370 invalid/duplicate fixed-owner engine tick');
   engineToVehicle.set(s.engine_tick,s.tick);
  }
  const map=new Map();
  for(const s of trial.samples){
   assert(s.source_sha===trial.source_sha&&s.mode===trial.mode&&s.station==='air'&&s.section==='big',
    'Camera370 wrong render identity');
   const tick=engineToVehicle.get(s.tick),phase=phaseOf(s);
   if(tick===undefined||phase===null)continue;
   assert(Number.isFinite(s.screen_y_px)&&Number.isFinite(s.bottom_margin_px)&&
    Number.isFinite(s.visible_slope_m)&&Number.isFinite(s.m00)&&s.m00>0&&
    Number.isFinite(s.m11)&&s.m11>0,'Camera370 invalid real projection');
   if(!map.has(tick))map.set(tick,{...s,vehicle_tick:tick,phase});
  }
  return map;
 };
 const A=index(a),B=index(b),phases={};
 for(const phase of ['airborne','landing']){
  const ticks=[...A.keys()].filter(t=>B.has(t)&&A.get(t).phase===phase&&B.get(t).phase===phase).sort((x,y)=>x-y);
  assert(ticks.length>=5,'Camera370 INCONCLUSIVE: fewer than five same-step '+phase+' render samples');
  const pairs=ticks.map(t=>({tick:t,
   a_screen_y_px:A.get(t).screen_y_px,b_screen_y_px:B.get(t).screen_y_px,
   a_bottom_px:A.get(t).bottom_margin_px,b_bottom_px:B.get(t).bottom_margin_px,
   a_visible_slope_m:A.get(t).visible_slope_m,b_visible_slope_m:B.get(t).visible_slope_m,
   a_visible_slope_s:A.get(t).visible_slope_s,b_visible_slope_s:B.get(t).visible_slope_s,
   a_m00:A.get(t).m00,b_m00:B.get(t).m00,a_m11:A.get(t).m11,b_m11:B.get(t).m11}));
  const oscillation=key=>Math.max(0,...pairs.slice(1).map((p,i)=>
   pairs[i].tick+1===p.tick?Math.abs(p[key]-pairs[i][key]):0));
  const seconds=(key)=>mean(pairs.map(p=>p[key]).filter(Number.isFinite));
  phases[phase]={paired_vehicle_ticks:ticks.length,first_tick:ticks[0],last_tick:ticks.at(-1),
   a_mean_screen_y_px:round(mean(pairs.map(p=>p.a_screen_y_px))),
   b_mean_screen_y_px:round(mean(pairs.map(p=>p.b_screen_y_px))),
   mean_b_minus_a_screen_y_px:round(mean(pairs.map(p=>p.b_screen_y_px-p.a_screen_y_px))),
   a_mean_bottom_margin_px:round(mean(pairs.map(p=>p.a_bottom_px))),
   b_mean_bottom_margin_px:round(mean(pairs.map(p=>p.b_bottom_px))),
   a_mean_visible_45deg_m:round(mean(pairs.map(p=>p.a_visible_slope_m))),
   b_mean_visible_45deg_m:round(mean(pairs.map(p=>p.b_visible_slope_m))),
   a_mean_visible_45deg_s:round(seconds('a_visible_slope_s')),
   b_mean_visible_45deg_s:round(seconds('b_visible_slope_s')),
   a_max_one_tick_screen_y_change_px:round(oscillation('a_screen_y_px')),
   b_max_one_tick_screen_y_change_px:round(oscillation('b_screen_y_px')),
   a_first_projection:{m00:pairs[0].a_m00,m11:pairs[0].a_m11},
   b_first_projection:{m00:pairs[0].b_m00,m11:pairs[0].b_m11},
   paired_samples:pairs};
 }
 return phases;
}
function negativeControls(){
 const trial=mode=>({mode,source_sha:'source',viewport:{width:1280,height:720},
  physics:Array.from({length:10},(_,i)=>({tick:i+1,engine_tick:i+20,source_sha:'source',station:'air',section:'big',mode})),
  samples:Array.from({length:10},(_,i)=>({tick:i+20,source_sha:'source',station:'air',section:'big',mode,
   air_from_lip:i<5,air_landing_age_s:i>=5?(i-5)/60:-1,screen_y_px:10,bottom_margin_px:20,
   visible_slope_m:3,visible_slope_s:.4,m00:.01,m11:.02}))});
 const a=trial('a'),b=trial('b');
 assert.equal(pairedPhases(a,b).airborne.paired_vehicle_ticks,5);
 assert.equal(pairedPhases(a,b).landing.paired_vehicle_ticks,5);
 b.physics[0].engine_tick=b.physics[1].engine_tick;
 assert.throws(()=>pairedPhases(a,b),/duplicate fixed-owner/);
 b.physics[0].engine_tick=20;b.samples[0].source_sha='wrong';
 assert.throws(()=>pairedPhases(a,b),/wrong render identity/);
 b.samples[0].source_sha='source';b.samples[5].air_landing_age_s=-1;
 assert.throws(()=>pairedPhases(a,b),/INCONCLUSIVE/);
}
async function run({browser,url,sha,runId,out,testcase,preset,errors}){
 assert.equal(testcase,'a19c','Camera370 air evidence requires the real air trial');
 negativeControls();
 const segment=landingSegment(),cases={};
 for(const viewport of [{width:1280,height:720},{width:1080,height:486}]){
  for(const mode of ['a','b']){
   const label=viewport.width+'x'+viewport.height+'-'+mode;
   const context=await browser.newContext({viewport}),p=await context.newPage();
   try{
    await configure(p,runId,testcase);
    p.on('pageerror',e=>errors.push(e.message));
    p.on('console',m=>{if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(m.text()))errors.push(m.text());});
    await p.goto(url+'?station=air&section=big&lean=0&camera352='+mode+preset.query);
    await p.waitForFunction(({sha,runId})=>window.riderReady?.source_sha===sha&&
     window.riderReady?.run_id===runId&&window.riderStationReport?.station==='air'&&
     window.riderStationReport.section==='big'&&window.riderCamera352Trace?.length>0,{sha,runId},{timeout:20000});
    await p.waitForFunction(()=>(window.riderStationReport?.jumps||[]).some(j=>j.from_lip&&j.complete),
     null,{timeout:25000,polling:50});
    const state=await p.evaluate(()=>({trace:window.riderCamera352Trace?.slice(),
     physics:window.riderCamera352PhysicsTrace?.slice(),report:window.riderStationReport,
     canvas:(()=>{const c=document.querySelector('canvas'),r=c.getBoundingClientRect();
      return {width:r.width,height:r.height,buffer_width:c.width,buffer_height:c.height};})()}));
    assert(state.trace?.length>=70&&state.physics?.length>=70,'Camera370 missing real render/fixed traces');
    assert(state.report?.source_sha===sha&&state.report.comparable===true&&state.report.automated===true,
     'Camera370 air report/source invalid');
    const jump=state.report.jumps.find(j=>j.from_lip&&j.complete);
    assert(jump&&jump.airtime_s>=.25&&['LANDED','CRASHED'].includes(jump.status),
     'Camera370 missing actual lip jump and landing');
    const samples=state.trace.map(s=>({...C.measure(s,state.canvas,segment),
     source_sha:s.source_sha,mode:s.mode,station:s.station,section:s.section,
     tick:s.tick,m00:s.m00,m11:s.m11,air_from_lip:s.air_from_lip,
     air_landing_age_s:s.air_landing_age_s}));
    assert(samples.some(s=>s.air_from_lip)&&samples.some(s=>s.air_landing_age_s>=0),
     'Camera370 no observed flight/landing boundaries');
    cases[label]={mode,source_sha:sha,run_id:runId,viewport,canvas:state.canvas,
     jump:{airtime_s:jump.airtime_s,status:jump.status,touchdown_x:jump.touchdown_x,
      ground_slope_deg:jump.ground_slope_deg},physics:state.physics,samples};
    fs.writeFileSync(path.join(out,'camera370-air-'+label+'.json'),JSON.stringify(cases[label],null,2));
    await p.screenshot({path:path.join(out,'camera370-air-'+label+'.png')});
   }catch(e){
    fs.writeFileSync(path.join(out,'camera370-air-failed-'+label+'.json'),
     JSON.stringify({error:String(e),state:await p.evaluate(()=>({ready:window.riderReady,
      report:window.riderStationReport,frames:window.riderCamera352Trace?.length,
      fixed:window.riderCamera352PhysicsTrace?.length})).catch(()=>null)},null,2));
    await p.screenshot({path:path.join(out,'camera370-air-failed-'+label+'.png')}).catch(()=>{});
    throw e;
   }finally{await context.close();}
  }
 }
 const result={status:'PASS',source_sha:sha,run_id:runId,fixture:'existing authored air/big 45-degree landing',
  segment,physical_phone:'NOT RUN',reverse:'NOT RUN',production_default:'A unchanged',
  method:'Actual Defold camera projection, same canonical vehicle-ready fixed steps, first render per step; real lip flight and 0-0.5 s post-touchdown. Segment visibility is fixture-limited, not general obstacle visibility.',
  viewports:{}};
 for(const viewport of [{width:1280,height:720},{width:1080,height:486}]){
  const name=viewport.width+'x'+viewport.height,a=cases[name+'-a'],b=cases[name+'-b'];
  const physics=C.comparePhysics(a.physics,b.physics);
  assert(physics.matched_ticks>=70,'Camera370 insufficient real fixed-step physics overlap');
  assert.equal(physics.max_engine_units,0,'Camera370 A/B changed fixed physics');
  result.viewports[name]={physics,phases:pairedPhases(a,b),a_jump:a.jump,b_jump:b.jump};
 }
 if(errors.length)throw Error(errors.join('\n'));
 fs.writeFileSync(path.join(out,'camera370-air-result.json'),JSON.stringify(result,null,2));
 console.log('CAMERA370_AIR '+JSON.stringify({status:result.status,source_sha:sha,run_id:runId,
  viewports:Object.fromEntries(Object.entries(result.viewports).map(([k,v])=>[k,{
   physics_ticks:v.physics.matched_ticks,airborne:v.phases.airborne.paired_vehicle_ticks,
   landing:v.phases.landing.paired_vehicle_ticks,
   airborne_screen_y_delta_px:v.phases.airborne.mean_b_minus_a_screen_y_px,
   landing_screen_y_delta_px:v.phases.landing.mean_b_minus_a_screen_y_px}]))}));
 return result;
}
module.exports={run,landingSegment,pairedPhases,negativeControls};
