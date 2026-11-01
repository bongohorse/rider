const {test}=require('node:test');
const assert=require('node:assert/strict');
const {compare,comparePause}=require('../../tools/gym/fps356_verify.cjs');
const STEP=1/60;
const start=()=>({source_sha:'abc123',run_id:'realrun',generation:1,station:'straight',
  vehicle_ready:true,kind:'world_update_callback_proxy',presented_frames:'UNKNOWN',
  monotonic_ms:1000,updates:100,fixed:100,fixed_ticks:100,world_s:100*STEP,
  fixed_dt_min:STEP,fixed_dt_max:STEP,bad_fixed_dt:0,scaled_ticks:0,
  reset_count:0,paused:false,time_factor:1});
function end(a=start()){return {...a,monotonic_ms:a.monotonic_ms+11000,updates:a.updates+660,
  fixed:a.fixed+660,fixed_ticks:a.fixed_ticks+660,world_s:a.world_s+660*STEP};}
test('60Hz fixed tick is separate from callback proxy and presented FPS is unknown',()=>{
  const a=start(),b=end(a),r=compare(a,b);
  assert.equal(r.fixed_tick_wall_hz,60);
  assert.equal(r.world_update_callback_hz,60);
  assert.equal(r.presented_fps,null);
  assert.equal(r.requested_hz,'NOT_SET_BY_PROBE');
});
test('valid pause has zero fixed ticks despite callbacks',()=>{
  const a={...start(),paused:true},b={...a,monotonic_ms:a.monotonic_ms+11000,updates:a.updates+660};
  assert.equal(compare(a,b,{phase:'paused'}).fixed_tick_wall_hz,0);
});
for(const [name,change,reason] of [
  ['missing fixed tick',b=>{b.fixed_ticks--;},/Fixed counter mismatch/],
  ['scaled tick',b=>{b.scaled_ticks++;},/Scaled physics/],
  ['bad fixed dt',b=>{b.bad_fixed_dt++;},/Non-60Hz/],
  ['reset',b=>{b.reset_count++;},/crossed Retry/],
  ['wrong source',b=>{b.source_sha='other';},/source_sha/],
  ['short window',b=>{b.monotonic_ms=2000;},/monotonic window/],
  ['world drift',b=>{b.world_s+=0.1;},/World time/],
  ['false presented frames',b=>{b.presented_frames=60;},/Misleading presented-frame/],
  ['wrong dt extrema',b=>{b.fixed_dt_max=1/30;},/Wrong fixed dt/],
  ['changed generation',b=>{b.generation++;},/generation/],
  ['stalled fixed ticks despite valid 1/60 dt',b=>{b.fixed=101;b.fixed_ticks=101;b.world_s=start().world_s+STEP;},/wall cadence/],
  ['fixed ticks running twice as fast',b=>{b.fixed=1420;b.fixed_ticks=1420;b.world_s=start().world_s+1320*STEP;},/wall cadence/],
]){
 test('reject '+name,()=>{const a=start(),b=end(a);change(b);assert.throws(()=>compare(a,b),reason);});
}
test('reject ticks while paused',()=>{
 const a={...start(),paused:true},b={...end(a),paused:true};
 assert.throws(()=>compare(a,b,{phase:'paused'}),/advanced while paused/);
});

// A paused proxy may stop update() completely. Use real time_state boundaries.

const pauseCase=()=>{
  const a={...start(),event:'time_state',sequence:17,time_seq:4,paused:true,time_factor:0};
  const b={...a,event:'time_state',sequence:18,time_seq:5,paused:false,time_factor:1};
  return {a,b,opts:{loaderStart:{paused:true,step:1},loaderEnd:{paused:true,step:1},wallStartMs:1000,wallEndMs:3400,minSeconds:2}};
};
test('pause boundary accepts zero world update callbacks and frozen fixed ticks',()=>{
  const {a,b,opts}=pauseCase(),r=comparePause(a,b,opts);
  assert.equal(r.fixed_ticks_during_pause,0);
  assert.equal(r.world_update_callback_hz,null);
  assert.equal(r.elapsed_s,2.4);
  assert.equal(r.presented_fps,null);
});
for(const [name,mutate,reason] of [
  ['world fixed tick advanced',({b})=>{b.fixed_ticks++;},/Fixed physics advanced while paused/],
  ['observer fixed tick advanced',({b})=>{b.fixed++;},/Observer fixed ticks advanced while paused/],
  ['world time advanced',({b})=>{b.world_s+=STEP;},/World time advanced while paused/],
  ['stale resume event',({b})=>{b.sequence=17;},/Stale world resume event/],
  ['missing resume boundary',({b})=>{b.event='update';},/Missing world pause\/resume boundary events/],
  ['missing pause boundary',({a})=>{a.event='update';},/Missing world pause\/resume boundary events/],
  ['loader time scale changed during pause',({opts})=>{opts.loaderEnd.step=0.5;},/Loader changed time scale/],
  ['loader not paused at end',({opts})=>{opts.loaderEnd.paused=false;},/Loader did not remain paused/],
  ['wrong resume sequence',({b})=>{b.time_seq=6;},/World pause\/resume sequence mismatch/],
  ['wrong source',({b})=>{b.source_sha='bad';},/source_sha/],
  ['wrong generation',({b})=>{b.generation++;},/generation/],
  ['pause window too short',({opts})=>{opts.wallEndMs=1100;},/Invalid independent pause wall window/],
  ['scaled tick',({b})=>{b.scaled_ticks++;},/Scaled physics tick during pause/],
  ['bad dt',({b})=>{b.bad_fixed_dt++;},/Non-60Hz fixed dt during pause/],
  ['retry during pause',({b})=>{b.reset_count++;},/Pause crossed Retry/],
  ['false displayed frames',({b})=>{b.presented_frames=60;},/Misleading presented-frame claim/]
]){
  test('pause boundary rejects '+name,()=>{
    const c=pauseCase();mutate(c);
    assert.throws(()=>comparePause(c.a,c.b,c.opts),reason);
  });
}
