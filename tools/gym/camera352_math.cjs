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
module.exports={slope,clip,measure,cameraReady,comparePhysics};
