// Pure fail-closed verifier for the debug fixed-tick coast/brake artifact (#345).
// Synthetic unit fixtures are NOT engine measurements.
const assert=require('node:assert/strict');
const ORDER=['coast','brake','coast'];
const BOUNDS={x0:-39,x1:79,y0:-5,y1:20};
const near=(a,b,eps=1e-8)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=eps;
function verify(report,expected){
  assert.equal(report.status,'PASS',report.error||'engine measurement failed');
  assert.equal(report.error,false);
  assert.equal(report.source_sha,expected.source_sha);
  assert.match(report.source_sha,/^[0-9a-f]{40}$/);
  assert.equal(report.run_id,expected.run_id);
  assert.equal(report.station,'straight');
  assert.equal(report.preset,'a');
  assert.equal(report.modified,false);
  assert.equal(report.config_identity,expected.config_identity);
  assert.ok(report.config_identity.length>0);
  assert.equal(report.physics_hz,60);
  assert.equal(report.configured_update_frequency_hz,60);
  assert.equal(report.render_fps,undefined,'configured update rate is not observed FPS');
  assert.ok(near(report.physics_scale,0.01,1e-6),'unexpected physics scale');
  assert.equal(report.time_factor,1);
  assert.equal(report.scaled_ticks,0);
  assert.equal(report.completed,3);
  assert.equal(report.runs.length,3);
  for(let i=0;i<3;i++){
    const r=report.runs[i],prior=report.runs[0];
    assert.equal(r.kind,ORDER[i]);
    assert.equal(r.boundary_crossed,false);
    assert.ok(Number.isSafeInteger(r.start_fixed_tick)&&r.start_fixed_tick>0);
    if(i>0){
      assert.ok(r.start_fixed_tick>report.runs[i-1].start_fixed_tick);
      assert.ok(near(r.start[1],prior.start[1],0.02),'inconsistent start x');
      assert.ok(near(r.start[2],prior.start[2],1e-6),'inconsistent start speed');
      assert.equal(r.start[3],prior.start[3]);assert.equal(r.start[4],prior.start[4]);
    }
    assert.ok(Number.isSafeInteger(r.ticks)&&r.ticks>=1&&r.ticks<=1200);
    assert.equal(r.trace.length,r.ticks+1);
    assert.equal(r.commands.length,r.ticks);
    assert.deepEqual(r.start,r.trace[0]);
    assert.deepEqual(r.stop,r.trace.at(-1));
    assert.ok(near(r.start[2],5,1e-6),'not a 5.0 m/s start');
    assert.equal(r.start[3],true,'rear wheel ungrounded at start');
    assert.equal(r.start[4],true,'front wheel ungrounded at start');
    assert.ok(near(r.start[5],-500/22,1e-6),'rear wheel seed mismatch');
    assert.ok(near(r.start[6],-500/22,1e-6),'front wheel seed mismatch');
    for(let k=0;k<r.trace.length;k++){
      const q=r.trace[k];
      assert.equal(q.length,8,'incomplete per-tick trace');
      assert.equal(q[0],k,'nonconsecutive fixed ticks');
      for(const n of [1,2,5,6,7])assert.ok(Number.isFinite(q[n]),'nonfinite sample');
      assert.ok(q[1]>=BOUNDS.x0&&q[1]<=BOUNDS.x1&&q[7]>=BOUNDS.y0&&q[7]<=BOUNDS.y1,'crossed Straight bounds');
      assert.equal(typeof q[3],'boolean');assert.equal(typeof q[4],'boolean');
      assert.ok(q[3]&&q[4],'lost dual-wheel support');
      if(k>0&&k<r.ticks)assert.ok(Math.abs(q[2])>=0.1,'stopped earlier than recorded');
    }
    assert.ok(Math.abs(r.stop[2])<0.1,'never stopped below 0.1 m/s');
    assert.ok(near(r.distance_m,r.stop[1]-r.start[1]),'incorrect distance');
    assert.ok(r.distance_m>=0,'negative stop distance');
    assert.ok(near(r.seconds,r.ticks/60),'not fixed 60-Hz time');
    for(const cmd of r.commands)assert.deepEqual(cmd,[0,i===1?1:0,0,false],'non-normalized command');
  }
  assert.ok(near(report.repeat_delta_m,report.runs[2].distance_m-report.runs[0].distance_m));
  assert.ok(near(report.repeat_delta_s,report.runs[2].seconds-report.runs[0].seconds));
  return report;
}
module.exports={verify};
