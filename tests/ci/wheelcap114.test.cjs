'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {validate,compareRetry,TICKS,CAP_RAD_S}=require('../../tools/gym/wheel_cap114.cjs');
const sha='a'.repeat(40),runId='test-run';
function fixture(speed,reset=0){
 return Array.from({length:TICKS},(_,i)=>({
   source_sha:sha,run_id:runId,mode:'a',station:'ramps-long',section:'down-30',
   tick:1+i+reset*100,engine_tick:10+i+reset*100,resets:reset,generation:1+reset,
   dt:1/60,x:(113.7+0.21*i)*100,y:(3.7-0.12*i)*100,
   vx:speed*100,vy:-100,rear:true,front:true,
   rear_omega:i===0?-speed/.22:-(speed===11?CAP_RAD_S:40),
   front_omega:i===0?-speed/.22:-(speed===11?CAP_RAD_S:40)
 }));
}
test('tick-shaped below/above cap controls and deterministic retry (synthetic verifier only)',()=>{
 for(const speed of [9,11]){
  const a=validate(fixture(speed),{sha,runId,speed,reset:0});
  const b=validate(fixture(speed,1),{sha,runId,speed,reset:1});
  assert(a.comparable_downhill_ticks>=2);
  assert(a.runout_dual_ticks>=2);
  assert.equal(compareRetry(a,b).contacts_identical,true);
 }
});
test('missing fixed tick fails closed',()=>{
 const s=fixture(11);s.splice(14,1);s.push({...s.at(-1),tick:46,engine_tick:55});
 assert.throws(()=>validate(s,{sha,runId,speed:11,reset:0}),/missing\/repeated/);
});
test('wrong run state and missing contact fail closed',()=>{
 const s=fixture(11);s[10].generation++;
 assert.throws(()=>validate(s,{sha,runId,speed:11,reset:0}),/generation/);
 const noContact=fixture(11).map(s=>({...s,rear:false}));
 assert.throws(()=>validate(noContact,{sha,runId,speed:11,reset:0}),/INCONCLUSIVE/);
});
test('retry altered wheel angular velocity is rejected',()=>{
 const a=validate(fixture(9),{sha,runId,speed:9,reset:0});
 const b=validate(fixture(9,1),{sha,runId,speed:9,reset:1});
 b.trace[20].rear_rad_s+=1;
 assert.throws(()=>compareRetry(a,b),/diverged/);
});
test('wrong start speed and missing runout fail closed',()=>{
 assert.throws(()=>validate(fixture(9),{sha,runId,speed:11,reset:0}),/initial chassis speed/);
 const noRunout=fixture(11).map(s=>({...s,x:11500}));
 assert.throws(()=>validate(noRunout,{sha,runId,speed:11,reset:0}),/run-out/);
});
