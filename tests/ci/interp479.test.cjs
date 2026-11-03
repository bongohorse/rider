'use strict';
// #479: pure checks of the interp479 Gym runner (the runner itself needs a real Defold debug bundle): trace identity,
// window analysis and the per-cap verdicts, with deliberately broken inputs that must fail.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {parseArgs,compareTraces,detrendedVariance,analyse,verifyWindow,nextCap,emulateRefresh,THROTTLE_TICKS,GHOST_GAP_U,REFRESH_HZ}=require('../../tools/gym/interp479.cjs');
const root=path.resolve(__dirname,'../..');

test('CLI accepts exactly the interp479 case',()=>{
 assert.deepEqual(parseArgs(['out','sha','run','interp479','bundle']),{output:'out',sha:'sha',runId:'run',bundle:'bundle'});
 for(const bad of [[],['out','sha','run','fps417','bundle'],['out','sha','','interp479','bundle'],['out','sha','run','interp479','bundle','--x']])
  assert.throws(()=>parseArgs(bad),/Usage/);
});

test('constants mirror the game modules',()=>{
 const probe=fs.readFileSync(path.join(root,'main/gym/interp_probe479.lua'),'utf8');
 assert.match(probe,new RegExp(`M\\.THROTTLE_TICKS=${THROTTLE_TICKS}\\b`));
 const counter=fs.readFileSync(path.join(root,'main/game/fps_counter.lua'),'utf8');
 assert.match(counter,/30,\s*60,\s*90,\s*120,\s*144,\s*0/,'tap cycle of the counter');
 assert.deepEqual([60,90,120,144,0,30].map(nextCap),[90,120,144,0,30,60]);
 // The A21 position tolerance is 0.05 m = 5 engine units; the ghost bound is not looser.
 assert.match(fs.readFileSync(path.join(root,'main/game/replay.lua'),'utf8'),/position_m=0\.05/);
 assert.equal(GHOST_GAP_U,5);
 assert.equal(REFRESH_HZ,144);
});

const FIELDS=['x','y','a','vx','vy','w','rx','ry','ra','rw','fx','fy','fa','fw'];
function trace(n,f=()=>0){return Array.from({length:n},(_,i)=>Object.fromEntries([['tick',i+1],...FIELDS.map(k=>[k,i*0.5+f(i,k)])]));}

test('traces compare exactly, tick by tick and field by field',()=>{
 assert.deepEqual(compareTraces(trace(10),trace(12),10),{ticks:10,max_difference:0,first_difference:null});
 const c=compareTraces(trace(10),trace(10,(i,k)=>i===6&&k==='ra'?1e-9:0),10);
 assert.equal(c.first_difference.tick,7);assert.equal(c.first_difference.field,'ra');assert(c.max_difference>0);
 assert.throws(()=>compareTraces(trace(9),trace(10),10),/too short/);
 const gap=trace(10);gap.splice(4,1);gap.push({...trace(11)[10]});
 assert.throws(()=>compareTraces(gap,trace(11),10),/gap/);
 const nan=trace(10);nan[3].fx=NaN;
 assert.throws(()=>compareTraces(nan,trace(10),10),/Missing fx/);
});

test('detrended variance ignores a steady acceleration',()=>{
 assert(detrendedVariance([1,2,3,4,5,6])<1e-12);
 assert(Math.abs(detrendedVariance([0,2,0,2,0,2])-1)<0.1);
});

// Synthetic window: a car accelerating along x, 60 Hz ticks, frames at `hz` with `ticksAt(i)` engine ticks per frame.
function frames({hz=144,on=true,exact=!on,interpolate=on,ghost=false,cap=144,backward=false}={}){
 const out=[];let tick=0,t=0;const h=1/60,dt=1/hz;
 const pos=s=>1000+40*s+300*s*s; // engine units at time s
 for(let i=0;i<400;i++){
  t+=dt;const now=Math.floor(t/h+1e-9);tick=now;
  const raw=pos(tick*h),shown=interpolate?pos(t-h):raw;
  out.push({gen:2,tick,engine_tick:tick,dt,u:interpolate?(t/h-Math.floor(t/h)):1,on,exact,px:raw,
   qx:backward&&i===200?shown-50:shown,cx:shown-10,cy:0,gx:ghost?shown+(ghost===true?0:ghost):false,cap});
 }
 return out;
}

test('cap 60 must present the physics transform exactly',()=>{
 const ok=frames({hz:60,on:false,cap:60});
 assert.equal(verifyWindow(60,analyse(ok)).verdict,'IDENTICAL');
 assert.throws(()=>verifyWindow(60,analyse(frames({hz:60,on:true,cap:60}))),/Interpolation ran at cap 60/);
 const off=ok.map((f,i)=>i===100?{...f,exact:false}:f);
 assert.throws(()=>verifyWindow(60,analyse(off)),/presented another transform/);
});

test('irregular stepping must become measurably smoother; raw stepping fails the check',()=>{
 const good=analyse(frames({hz:144}));
 assert(good.irregular_share>0.3,'144 Hz frames over 60 Hz ticks are irregular');
 const v=verifyWindow(144,good);
 assert.equal(v.verdict,'SMOOTHER');assert(v.presented_step_variance_u2<v.raw_step_variance_u2/10);
 // Interpolation "on" but drawing the raw tick pose (what every cap drew before #479): not smoother.
 assert.throws(()=>verifyWindow(144,analyse(frames({hz:144,interpolate:false}))),/not below/);
 assert.throws(()=>verifyWindow(144,analyse(frames({hz:144,on:false}))),/Interpolation off at cap 144/);
 assert.throws(()=>verifyWindow(144,analyse(frames({hz:144,backward:true}))),/stepped backwards/);
});

test('frames out of order (a stale tick label) are refused',()=>{
 const f=frames({hz:144});f[100]={...f[100],tick:f[100].tick+50};
 assert.throws(()=>analyse(f),/out of order/);
});

test('regular stepping (cap 30: two ticks per frame) needs no smoothing but must not get worse',()=>{
 const a=analyse(frames({hz:30,cap:30}));
 assert.equal(a.irregular_frames,0);
 assert.equal(verifyWindow(30,a).verdict,'REGULAR_RAW');
});

test('the ghost must stay with the presented car',()=>{
 assert.equal(verifyWindow(144,analyse(frames({hz:144,ghost:true}))).ghost_gap_max_u,0);
 assert.throws(()=>verifyWindow(144,analyse(frames({hz:144,ghost:GHOST_GAP_U+1}))),/ghost/);
});

test('the emulated display fires animation frames on its grid',async()=>{
 // Run the page init script against a fake window/performance clock.
 let now=0;const timers=[];const calls=[];
 const sandbox={window:{},performance:{now:()=>now},setTimeout:(fn,ms)=>timers.push({fn,at:now+ms})};
 const fn=new Function('window','performance','setTimeout','return ('+emulateRefresh.toString()+')('+REFRESH_HZ+');');
 fn(sandbox.window,sandbox.performance,sandbox.setTimeout);
 const loop=t=>{calls.push(t);if(calls.length<20)sandbox.window.requestAnimationFrame(loop);};
 sandbox.window.requestAnimationFrame(loop);
 while(timers.length){const x=timers.shift();now=Math.max(now,x.at);
  // The busy wait advances the clock in the real page; here jump to the next millisecond until the target.
  const origNow=sandbox.performance.now;let spins=0;sandbox.performance.now=()=>{spins++;return spins>1?(now+=0.01):now;};
  x.fn();sandbox.performance.now=origNow;}
 assert.equal(calls.length,20);
 const gaps=calls.slice(1).map((t,i)=>t-calls[i]);
 for(const g of gaps)assert(Math.abs(g-1000/REFRESH_HZ)<0.05,'frame gap '+g);
});
