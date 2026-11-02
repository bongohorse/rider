// #352: measured camera/authoring geometry math, no synthetic projection assumptions.
const assert=require('node:assert/strict');
function slope(station,id){
 const section=station.sections.find(s=>s.id===id);
 assert(section&&section.mode==='down','Expected an authored downhill section');
 const vertices=station.chains.flat();
 const at=x=>vertices.find(p=>Math.abs(p[0]-x)<1e-5);
 const a=at(section.ramp_start),b=at(section.top_x);
 assert(a&&b&&a[0]<b[0]&&a[1]>b[1],'Authored downhill endpoints unavailable');
 return {a:{x:a[0],y:a[1]},b:{x:b[0],y:b[1]},section:id};
}
// Liang-Barsky clipping to the *actual* projection's world rectangle.
function clip(a,b,box){
 let low=0,high=1;
 const dx=b.x-a.x,dy=b.y-a.y;
 for(const [p,q] of [[-dx,a.x-box.left],[dx,box.right-a.x],[-dy,a.y-box.bottom],[dy,box.top-a.y]]){
  if(Math.abs(p)<1e-12){if(q<0)return null;continue;}
  const t=q/p;
  if(p<0)low=Math.max(low,t);else high=Math.min(high,t);
  if(low>high)return null;
 }
 return {low,high};
}
function measure(s,canvas,segment){
 for(const k of ['x','y','vx','vy','cx','cy','m00','m11','scale','zoom','tick'])assert(Number.isFinite(s[k]),'Non-finite camera '+k);
 assert(s.m00>0&&s.m11>0&&s.scale>0&&canvas.width>0&&canvas.height>0,'Invalid actual projection/canvas');
 const halfX=s.scale/s.m00,halfY=s.scale/s.m11;
 const cx=s.cx*s.scale,cy=s.cy*s.scale,x=s.x*s.scale,y=s.y*s.scale;
 const box={left:cx-halfX,right:cx+halfX,bottom:cy-halfY,top:cy+halfY};
 const visible=clip(segment.a,segment.b,box);
 const dx=segment.b.x-segment.a.x,dy=segment.b.y-segment.a.y;
 const start=visible?Math.max(x,segment.a.x+visible.low*dx):0;
 const end=visible?Math.min(segment.b.x,segment.a.x+visible.high*dx):0;
 const horizontal=Math.max(0,end-start);
 const groundDistance=horizontal*Math.hypot(dx,dy)/dx;
 const forward=s.vx*s.scale;
 return {
  tick:s.tick,time:s.sim_time,x,y,vx:forward,vy:s.vy*s.scale,
  screen_x_px:(x-cx)/halfX*canvas.width/2,
  screen_y_px:(y-cy)/halfY*canvas.height/2,
  bottom_margin_px:canvas.height/2+(y-cy)/halfY*canvas.height/2,
  top_margin_px:canvas.height/2-(y-cy)/halfY*canvas.height/2,
  visible_slope_m:groundDistance,
  visible_slope_s:forward>0.1?horizontal/forward:null,
  fixture_limited:!!visible&&visible.high>0.99999,
  viewport_truncated:!!visible&&visible.high<0.99999,
  on_slope:x>=segment.a.x&&x<=segment.b.x,
  loaded:!!s.rear&&!!s.front,mode:s.mode,descent:s.descent,
  projection:{m00:s.m00,m11:s.m11,half_x_m:halfX,half_y_m:halfY},
 };
}
// Used directly by Playwright's browser-side waitForFunction and by the Node negative controls.
// Straight has no riderStationReport; only special ramps-long carries a section report.
function cameraReady({sha,runId,station}){
 const w=globalThis.window||{};
 return w.riderReady?.source_sha===sha&&w.riderReady?.run_id===runId&&
  w.riderTelemetry?.station===station&&w.riderTelemetry.sequence>2&&
  (station!=='ramps-long'||(w.riderStationReport?.station===station&&w.riderStationReport.section==='down-30'));
}
// Fail closed: the fixed-owner trace, not render snapshots, covers EVERY tick between
// the first and last real dual-supported downhill observations. Short loss of wheel
// support is a measured contact gap, not a missing physics tick: compare those ticks
// too, require identical contact states, and reject any A/B support-window mismatch.
// A partial early flat overlap cannot substitute for downhill evidence.
function comparePhysics(a,b,{downhillA,downhillB}={}){
 const downhill=downhillA!==undefined||downhillB!==undefined;
 assert(Array.isArray(a)&&Array.isArray(b)&&a.length&&b.length,'Empty camera A/B traces');
 if(downhill)assert(Array.isArray(downhillA)&&Array.isArray(downhillB)&&downhillA.length>=5&&downhillB.length>=5,
  'No measured dual-supported downhill window in both A/B');
 function index(trace,label){
  const result=new Map();
  // Live traces carry both the vehicle-ready tick (canonical comparison key)
  // and the raw engine tick (which may start one step earlier on another page).
  // Reject missing steps or an inconsistent epoch; synthetic negative controls
  // without engine_tick still exercise the strict legacy tick comparator.
  const hasEngineTick=trace.some(s=>s.engine_tick!==undefined);
  if(hasEngineTick){
   assert(trace[0].tick===1,label+': missing first vehicle-ready fixed step');
   let previous=null;
   for(const s of trace){
    assert(Number.isSafeInteger(s.engine_tick)&&s.engine_tick>=s.tick,
     label+': invalid global engine tick/vehicle epoch');
    if(previous&&s.resets===previous.resets&&s.generation===previous.generation){
     assert(s.tick===previous.tick+1&&s.engine_tick===previous.engine_tick+1,
      label+': noncontinuous vehicle-ready fixed tick epoch');
    }
    previous=s;
   }
  }
  for(const s of trace){
   assert(Number.isSafeInteger(s.tick)&&s.tick>=0&&Number.isSafeInteger(s.resets)&&Number.isSafeInteger(s.generation),
    label+': invalid fixed tick/reset identity');
   for(const key of ['x','y','vx','vy'])assert(Number.isFinite(s[key]),label+': invalid '+key);
   if(result.has(s.tick)){
    const prior=result.get(s.tick);
    assert(prior.resets===s.resets&&prior.generation===s.generation&&
     ['x','y','vx','vy'].every(k=>prior[k]===s[k]),label+': conflicting duplicate fixed tick '+s.tick);
   }else result.set(s.tick,s);
  }
  return result;
 }
 const byA=index(a,'A'),byB=index(b,'B');
 const epochA=a.some(s=>s.engine_tick!==undefined),epochB=b.some(s=>s.engine_tick!==undefined);
 assert(epochA===epochB,'Camera A/B mixed vehicle-ready tick epochs');
 if(epochA){
  const firstA=byA.get(1),firstB=byB.get(1);
  assert(firstA&&firstB,'Missing first vehicle-ready A/B anchor');
  assert(firstA.resets===firstB.resets&&firstA.generation===firstB.generation,
   'Initial vehicle-ready reset/generation mismatch');
  assert(firstA.rear===firstB.rear&&firstA.front===firstB.front,
   'Initial vehicle-ready wheel-support mismatch');
  const startDiff=Math.max(...['x','y','vx','vy'].map(k=>Math.abs(firstA[k]-firstB[k])));
  assert(startDiff<0.5,'Initial vehicle-ready physics state mismatch: '+startDiff);
 }
 const validA=downhill?new Set(downhillA.map(s=>s.tick)):null;
 const validB=downhill?new Set(downhillB.map(s=>s.tick)):null;
 const ticksA=[...byA.keys()],ticksB=[...byB.keys()];
 const from=downhill?Math.min(...validA,...validB):Math.max(Math.min(...ticksA),Math.min(...ticksB));
 const to=downhill?Math.max(...validA,...validB):Math.min(Math.max(...ticksA),Math.max(...ticksB));
 assert(to>=from&&to-from+1>=(downhill?5:25),'Insufficient continuous fixed-tick A/B window');
 let max=0,firstIdentity=null,dualSupportedTicks=0,contactGapTicks=0;
 for(let tick=from;tick<=to;tick++){
  const s=byA.get(tick),other=byB.get(tick);
  assert(s&&other,'Missing/unmatched fixed tick '+tick+' in '+(downhill?'loaded downhill':'flat')+' A/B window');
  if(downhill){
   assert(typeof s.rear==='boolean'&&typeof s.front==='boolean'&&
    typeof other.rear==='boolean'&&typeof other.front==='boolean',
    'Missing real wheel-support state at fixed tick '+tick);
   assert(s.rear===other.rear&&s.front===other.front,
    'Camera A/B wheel-support mismatch at fixed tick '+tick);
   assert(validA.has(tick)===validB.has(tick),
    'Missing dual-supported downhill observation at fixed tick '+tick);
   if(validA.has(tick)){
    assert(s.rear&&s.front&&other.rear&&other.front,
     'Unloaded tick falsely classified as dual-supported at fixed tick '+tick);
    dualSupportedTicks++;
   }else contactGapTicks++;
  }
  assert(s.resets===other.resets&&s.generation===other.generation,
   'Camera A/B reset/generation mismatch at fixed tick '+tick);
  const identity=s.resets+':'+s.generation;
  if(firstIdentity===null)firstIdentity=identity;
  assert(identity===firstIdentity,'Reset/generation discontinuity in measured A/B window at tick '+tick);
  const difference=Math.max(...['x','y','vx','vy'].map(k=>Math.abs(s[k]-other[k])));
  assert(difference<0.5,'Camera A/B altered deterministic physics at tick '+tick+': '+difference);
  max=Math.max(max,difference);
 }
 if(downhill)assert(dualSupportedTicks>=5,'Insufficient real dual-supported downhill ticks');
 return {matched_ticks:to-from+1,window_start_tick:from,window_end_tick:to,
  continuous:true,downhill_loaded:downhill,dual_supported_ticks:dualSupportedTicks,
  compared_contact_gap_ticks:contactGapTicks,max_engine_units:max};
}
function alignedVisibility(a,b){
 const check=(ok,msg)=>{if(!ok)throw Error('Camera370 aligned visibility: '+msg);};
 check(a&&b&&a.summary&&b.summary,'missing A/B trial summaries');
 const sa=a.summary,sb=b.summary;
 check(sa.mode==='a'&&sb.mode==='b'&&sa.station==='ramps-long'&&sb.station==='ramps-long','expected authored downhill A/B trials');
 check(sa.source_sha&&sa.source_sha===sb.source_sha,'different A/B source builds');
 check(sa.viewport.width===sb.viewport.width&&sa.viewport.height===sb.viewport.height,'different A/B viewports');
 const samples=(trial,mode)=>{
  const {trace,measured,physicsTrace,summary}=trial;
  check(Array.isArray(trace)&&Array.isArray(measured)&&trace.length===measured.length&&trace.length>0,'missing or unpaired render frames '+mode);
  check(Array.isArray(physicsTrace)&&physicsTrace.length>0,'missing fixed-owner trace '+mode);
  const engineToVehicle=new Map();
  for(const p of physicsTrace){
   check(Number.isSafeInteger(p.tick)&&p.tick>=1&&Number.isSafeInteger(p.engine_tick),'missing vehicle-ready/engine tick '+mode);
   check(!engineToVehicle.has(p.engine_tick),'duplicate fixed-owner engine tick '+mode);
   check(p.source_sha===summary.source_sha&&p.mode===mode&&p.station==='ramps-long','fixed-owner source/station mismatch '+mode);
   engineToVehicle.set(p.engine_tick,p.tick);
  }
  const byVehicle=new Map();
  let repeatedRenderTicks=0;
  for(let i=0;i<trace.length;i++){
   const s=trace[i],m=measured[i];
   check(s.tick===m.tick&&s.source_sha===summary.source_sha&&s.mode===mode&&s.station==='ramps-long'&&s.section==='down-30',
    'render source/section/step mismatch '+mode+' frame '+i);
   const tick=engineToVehicle.get(s.tick);
   if(tick===undefined)continue; // Pre-vehicle-ready render frames have no comparable fixed owner.
   if(!(m.on_slope&&m.loaded&&m.vx>0.2&&m.vy< -0.1))continue;
   check(Number.isFinite(m.visible_slope_s)&&Number.isFinite(m.bottom_margin_px)&&Number.isFinite(m.screen_y_px),
    'invalid loaded downhill projection '+mode+' tick '+tick);
   if(byVehicle.has(tick)){repeatedRenderTicks++;continue;} // First render for this fixed step.
   byVehicle.set(tick,{tick,engine_tick:s.tick,visible_slope_s:m.visible_slope_s,
    bottom_margin_px:m.bottom_margin_px,screen_y_px:m.screen_y_px,
    fixture_limited:!!m.fixture_limited,viewport_truncated:!!m.viewport_truncated});
  }
  return {byVehicle,repeatedRenderTicks,valid_render_steps:byVehicle.size};
 };
 const A=samples(a,'a'),B=samples(b,'b');
 const ticks=[...A.byVehicle.keys()].filter(t=>B.byVehicle.has(t)).sort((x,y)=>x-y);
 const result={status:ticks.length>=5?'MEASURED':'INCONCLUSIVE',source_sha:sa.source_sha,
  viewport:sa.viewport,paired_vehicle_ticks:ticks.length,first_tick:ticks[0]??null,last_tick:ticks.at(-1)??null,
  a_valid_render_steps:A.valid_render_steps,b_valid_render_steps:B.valid_render_steps,
  a_repeated_render_ticks:A.repeatedRenderTicks,b_repeated_render_ticks:B.repeatedRenderTicks,
  method:'First loaded downhill render per canonical vehicle-ready fixed step; only shared A/B steps; no presented-FPS claim.'};
 if(ticks.length<5)return {...result,reason:'Fewer than five comparable loaded downhill render steps; no paired improvement claim'};
 const mean=(values)=>values.reduce((sum,x)=>sum+x,0)/values.length;
 const pair=ticks.map(t=>{
  const x=A.byVehicle.get(t),y=B.byVehicle.get(t);
  return {tick:t,a_visible_s:x.visible_slope_s,b_visible_s:y.visible_slope_s,
   delta_visible_s:y.visible_slope_s-x.visible_slope_s,
   a_bottom_px:x.bottom_margin_px,b_bottom_px:y.bottom_margin_px,
   a_screen_y_px:x.screen_y_px,b_screen_y_px:y.screen_y_px,
   a_fixture_limited:x.fixture_limited,b_fixture_limited:y.fixture_limited,
   a_viewport_truncated:x.viewport_truncated,b_viewport_truncated:y.viewport_truncated};
 });
 return {...result,mean_a_visible_s:mean(pair.map(p=>p.a_visible_s)),
  mean_b_visible_s:mean(pair.map(p=>p.b_visible_s)),
  mean_delta_visible_s:mean(pair.map(p=>p.delta_visible_s)),
  min_delta_visible_s:Math.min(...pair.map(p=>p.delta_visible_s)),
  max_delta_visible_s:Math.max(...pair.map(p=>p.delta_visible_s)),
  mean_a_bottom_px:mean(pair.map(p=>p.a_bottom_px)),
  mean_b_bottom_px:mean(pair.map(p=>p.b_bottom_px)),
  a_fixture_limited_ticks:pair.filter(p=>p.a_fixture_limited).length,
  b_fixture_limited_ticks:pair.filter(p=>p.b_fixture_limited).length,
  a_viewport_truncated_ticks:pair.filter(p=>p.a_viewport_truncated).length,
  b_viewport_truncated_ticks:pair.filter(p=>p.b_viewport_truncated).length,
  paired_samples:pair};
}
module.exports={slope,clip,measure,cameraReady,comparePhysics,alignedVisibility};
