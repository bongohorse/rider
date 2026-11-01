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
function comparePhysics(a,b){
 const byTick=new Map(b.map(s=>[s.tick,s]));
 const matches=[];
 for(const s of a){
  const other=byTick.get(s.tick);
  if(other&&s.resets===other.resets)matches.push({tick:s.tick,dx:Math.abs(s.x-other.x),dy:Math.abs(s.y-other.y),dvx:Math.abs(s.vx-other.vx),dvy:Math.abs(s.vy-other.vy)});
 }
 assert(matches.length>=25,'No sufficient matching fixed-owner ticks for A/B');
 const max=Math.max(...matches.flatMap(s=>[s.dx,s.dy,s.dvx,s.dvy]));
 assert(max<0.5,'Camera A/B altered deterministic physics tick trace: '+max);
 return {matched_ticks:matches.length,max_engine_units:max};
}
module.exports={slope,clip,measure,comparePhysics};
