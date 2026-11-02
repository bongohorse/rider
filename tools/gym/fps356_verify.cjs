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

/* Factor-zero worlds need not emit update callbacks. Compare genuine controller
 * time_state boundaries, loader-authoritative pause flags and independent wall time. */
function comparePause(pause,resume,{loaderStart,loaderEnd,wallStartMs,wallEndMs,minSeconds=2}={}){
  assert(pause&&resume,'Missing Defold observer snapshots');
  for(const key of ['source_sha','run_id','generation','station']){
    assert(pause[key]&&resume[key]&&pause[key]===resume[key],key+' changed across measurement');
  }
  assert(pause.vehicle_ready===true&&resume.vehicle_ready===true,'Vehicle not drive-ready');
  assert(pause.kind==='world_update_callback_proxy'&&resume.kind===pause.kind,'Wrong observer type');
  assert(pause.presented_frames==='UNKNOWN'&&resume.presented_frames==='UNKNOWN','Misleading presented-frame claim');
  assert(pause.event==='time_state'&&resume.event==='time_state','Missing world pause/resume boundary events');
  assert(pause.paused===true&&pause.time_factor===0,'World pause boundary not confirmed');
  assert(resume.paused===false&&resume.time_factor===1,'World resume boundary not confirmed');
  assert(loaderStart?.paused===true&&loaderEnd?.paused===true,'Loader did not remain paused during window');
  assert(loaderStart.step===1&&loaderEnd.step===1,'Loader changed time scale during pause');
  assert(Number.isSafeInteger(pause.time_seq)&&resume.time_seq===pause.time_seq+1,'World pause/resume sequence mismatch');
  const elapsed=(wallEndMs-wallStartMs)/1000;
  assert(Number.isFinite(elapsed)&&elapsed>=minSeconds&&elapsed<minSeconds+10,'Invalid independent pause wall window');
  assert(Number.isSafeInteger(pause.fixed_ticks)&&Number.isSafeInteger(resume.fixed_ticks),'Missing fixed tick counters');
  assert.equal(resume.fixed_ticks-pause.fixed_ticks,0,'Fixed physics advanced while paused');
  assert.equal(resume.fixed-pause.fixed,0,'Observer fixed ticks advanced while paused');
  assert.equal(resume.world_s-pause.world_s,0,'World time advanced while paused');
  assert.equal(resume.bad_fixed_dt-pause.bad_fixed_dt,0,'Non-60Hz fixed dt during pause');
  assert.equal(resume.scaled_ticks-pause.scaled_ticks,0,'Scaled physics tick during pause');
  assert.equal(resume.reset_count,pause.reset_count,'Pause crossed Retry');
  assert(resume.sequence>pause.sequence,'Stale world resume event');
  return {phase:'paused',source_sha:pause.source_sha,run_id:pause.run_id,station:pause.station,
    elapsed_s:elapsed,requested_hz:'NOT_SET_BY_PROBE',
    world_update_callback_hz:null,fixed_tick_wall_hz:0,fixed_ticks_during_pause:0,
    fixed_dt_s:STEP,world_s:0,observer:'loader_time_state_world_boundary',
    browser_raf_callback_hz:null,presented_fps:null,presented_fps_status:'UNKNOWN',
    reset_count:pause.reset_count,physics_fixed_dt_valid:true};
}
module.exports={compare,comparePause};
