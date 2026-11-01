const test=require('node:test'),assert=require('node:assert/strict');
const {verify}=require('../../tools/gym/coast_measure_report.cjs');
const sha='a'.repeat(40),run_id='synthetic-unit-test',config_identity='preset=A;synthetic=true';
const expected={source_sha:sha,run_id,config_identity};
// Deliberately synthetic data: tests serialization/invariant rejection, never a physics result.
function fixture(){
  const runs=['coast','brake','coast'].map((kind,i)=>{
    const start=[0,0,5,true,true,-500/22,-500/22,1];
    const stop=[1,0.1,0.05,true,true,-1,-1,1];
    return {kind,start,stop,trace:[start,stop],commands:[[0,i===1?1:0,0,false]],
      ticks:1,seconds:1/60,distance_m:0.1,start_fixed_tick:100+i*100,boundary_crossed:false};
  });
  return {status:'PASS',error:false,source_sha:sha,run_id,station:'straight',
    preset:'a',modified:false,config_identity,physics_hz:60,configured_update_frequency_hz:60,
    physics_scale:0.01,time_factor:1,scaled_ticks:0,runs,completed:3,
    repeat_delta_m:0,repeat_delta_s:0};
}
test('accepts complete serialized protocol (synthetic, not measured)',()=>{
  const report=JSON.parse(JSON.stringify(fixture()));
  assert.equal(verify(report,expected).completed,3);
});
test('rejects ungrounded or incorrect initial speed',()=>{
  for(const mutate of [
    r=>{r.runs[0].start[2]=4.8;},
    r=>{r.runs[0].start[3]=false;},
    r=>{r.runs[0].start[5]=0;},
    r=>{r.runs[1].start[1]=0.1;}
  ]){const r=fixture();mutate(r);assert.throws(()=>verify(r,expected));}
});
test('rejects nontermination, early stop and nonconsecutive samples',()=>{
  for(const mutate of [
    r=>{r.runs[0].stop[2]=0.2;},
    r=>{r.runs[0].ticks=1201;},
    r=>{r.runs[0].trace[1][0]=2;},
    r=>{r.runs[0].commands=[];},
    r=>{r.runs[0].trace[1][3]=false;},
    r=>{r.runs[0].trace[1][4]=false;}
  ]){const r=fixture();mutate(r);assert.throws(()=>verify(r,expected));}
});
test('rejects foreign source, time scaling, missing run and changed command',()=>{
  for(const mutate of [
    r=>{r.source_sha='b'.repeat(40);},
    r=>{r.run_id='other';},
    r=>{r.config_identity='other';},
    r=>{r.scaled_ticks=1;},
    r=>{r.physics_hz=30;},
    r=>{r.physics_scale=0.011;},
    r=>{r.configured_update_frequency_hz=30;},
    r=>{r.render_fps=60;},
    r=>{r.runs[1].commands[0][3]=true;},
    r=>{r.completed=2;},
    r=>{r.status='FAIL';r.error='timeout';}
  ]){const r=fixture();mutate(r);assert.throws(()=>verify(r,expected));}
});

test('observer reuses genuine loaded-contact predicate and does not claim measured render FPS',()=>{
  const fs=require('node:fs'),path=require('node:path');
  const observer=fs.readFileSync(path.join(__dirname,'../../main/gym/coast_measure.lua'),'utf8');
  assert.match(observer,/require "main\.gym\.seam_metrics"/);
  assert.match(observer,/seam_metrics\.supported\(v\.wheels\[1\]\)/);
  assert.match(observer,/seam_metrics\.supported\(v\.wheels\[2\]\)/);
  assert.doesNotMatch(observer,/get_contact_data/);
  assert.match(observer,/configured_update_frequency_hz=sys\.get_config_int/);
  assert.doesNotMatch(observer,/render_fps=/);
});

test('accepts float32 representation of configured physics scale only within narrow tolerance',()=>{
  const rounded=fixture();rounded.physics_scale=Math.fround(0.01);
  assert.equal(verify(rounded,expected).completed,3);
  for(const scale of [0.009,0.011,NaN]){
    const invalid=fixture();invalid.physics_scale=scale;
    assert.throws(()=>verify(invalid,expected));
  }
});
