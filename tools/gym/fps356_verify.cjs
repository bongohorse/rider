// #356: fail-closed comparison of genuine Defold callback snapshots.
// The Lua observer emits world update callbacks, not presented frames.
'use strict';
const assert=require('node:assert/strict');
const STEP=1/60;
function compare(a,b,{phase='running',minSeconds=10}={}){
  assert(a&&b,'Missing Defold observer snapshots');
  for(const key of ['source_sha','run_id','generation','station']){
    assert(a[key]&&b[key]&&a[key]===b[key],key+' changed across measurement');
  }
  assert(a.vehicle_ready===true&&b.vehicle_ready===true,'Vehicle not drive-ready');
  assert(a.kind==='world_update_callback_proxy'&&b.kind===a.kind,'Wrong observer type');
  assert(a.presented_frames==='UNKNOWN'&&b.presented_frames==='UNKNOWN','Misleading presented-frame claim');
  const elapsed=(b.monotonic_ms-a.monotonic_ms)/1000;
  assert(Number.isFinite(elapsed)&&elapsed>=minSeconds&&elapsed<minSeconds+10,'Invalid monotonic window');
  const ticks=b.fixed_ticks-a.fixed_ticks, observed=b.fixed-a.fixed,updates=b.updates-a.updates;
  assert(Number.isSafeInteger(ticks)&&ticks===observed&&ticks>=0,'Fixed counter mismatch');
  assert(Number.isSafeInteger(updates)&&updates>0,'No Defold world update callbacks');
  assert.equal(b.bad_fixed_dt-a.bad_fixed_dt,0,'Non-60Hz fixed dt observed');
  assert.equal(b.scaled_ticks-a.scaled_ticks,0,'Scaled physics tick observed');
  assert.equal(b.reset_count,a.reset_count,'Window crossed Retry');
  assert(Math.abs(b.world_s-a.world_s-ticks*STEP)<1e-4,'World time differs from fixed ticks');
  if(ticks>0){
    assert(Math.abs(b.fixed_dt_min-STEP)<1e-4&&Math.abs(b.fixed_dt_max-STEP)<1e-4,'Wrong fixed dt extrema');
  }
  const fixedWallHz=ticks/elapsed;
  if(phase==='paused'){
    assert(a.paused&&b.paused,'Pause window not fully paused');
    assert.equal(ticks,0,'Fixed physics advanced while paused');
  }else if(phase==='running'){
    assert(!a.paused&&!b.paused&&a.time_factor===1&&b.time_factor===1,'Running window changed time factor');
    // A single valid 1/60 step in a ten-second window is NOT evidence of a running 60-Hz simulation.
    // Wall-clock throughput is a separate gate from per-tick dt, not proof of displayed frames.
    assert(fixedWallHz>=54&&fixedWallHz<=66,'Running fixed-tick wall cadence outside 60Hz +/-10%');
  }else throw Error('Unknown phase');
  return {phase,source_sha:a.source_sha,run_id:a.run_id,station:a.station,
    elapsed_s:elapsed,requested_hz:'NOT_SET_BY_PROBE',
    world_update_callback_hz:updates/elapsed,fixed_tick_wall_hz:fixedWallHz,
    fixed_dt_s:STEP,world_s:b.world_s-a.world_s,
    browser_raf_callback_hz:null,presented_fps:null,presented_fps_status:'UNKNOWN',
    reset_count:a.reset_count,physics_fixed_dt_valid:true};
}
module.exports={compare};
