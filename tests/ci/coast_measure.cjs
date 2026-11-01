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
    preset:'a',modified:false,config_identity,physics_hz:60,render_fps:60,
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
    r=>{r.runs[0].trace[1][3]=false;r.runs[0].trace[1][4]=false;}
  ]){const r=fixture();mutate(r);assert.throws(()=>verify(r,expected));}
});
test('rejects foreign source, time scaling, missing run and changed command',()=>{
  for(const mutate of [
    r=>{r.source_sha='b'.repeat(40);},
    r=>{r.run_id='other';},
    r=>{r.config_identity='other';},
    r=>{r.scaled_ticks=1;},
    r=>{r.physics_hz=30;},
    r=>{r.runs[1].commands[0][3]=true;},
    r=>{r.completed=2;},
    r=>{r.status='FAIL';r.error='timeout';}
  ]){const r=fixture();mutate(r);assert.throws(()=>verify(r,expected));}
});
