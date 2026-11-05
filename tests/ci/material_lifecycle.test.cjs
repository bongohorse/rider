'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {checkRoute,CYCLES,PAYLOAD}=require('../../tools/terrain_play/material_lifecycle_check.cjs');
function fixture(route='legacy',variant='debug',step=1){
 const loads=Array.from({length:1+CYCLES*2},(_,i)=>{
  const n=2+i*step,buffers=[{id:1,bytes:PAYLOAD[route],targets:[34962]},
   ...Array.from({length:n},(_,j)=>({id:j+2,bytes:16,targets:[35345]})),
   ...Array.from({length:n},(_,j)=>({id:j+n+2,bytes:64,targets:[35345]}))];
  return {course:i%2===0?'a':'b',generation:3+i,world_ready_events:variant==='debug'?2+i:0,reset_count:0,
   mesh:variant==='debug'?{generation:3+i,chunks:11,resident:{allocated:1,bytes:PAYLOAD[route]}}:null,
   lifecycle:variant==='debug'?{created:i+1,released:i,owned:1}:null,
   projection:route==='legacy'?null:{stride:route==='textured'?52:48,material:{active:route==='textured'}},
   webgl:{created:buffers.length+i,deleted:i,live:buffers.length,failed_creates:0,buffers,
    histogram:{[PAYLOAD[route]]:1,16:n,64:n},uniform_histogram:{16:n,64:n},contexts:[{context_lost:false}]}};
 });
 const before=structuredClone(loads.at(-1)),after=structuredClone(before);after.reset_count++;
 return {route,variant,loads,retry:{before,after}};
}
test('all three route payloads and both variants retain eight full cycles; extra UBO churn remains measurable',()=>{
 for(const route of Object.keys(PAYLOAD))for(const variant of ['debug','release']){
  const result=checkRoute(fixture(route,variant,route==='textured'?2:1));assert.equal(result.cycles,8);assert.equal(result.per_switch.length,16);
  assert(result.per_switch.every(x=>x.uniform_delta[16]===(route==='textured'?2:1)));
 }
});
test('per-switch deltas keep every uniform size, and release must not gain Gym ready events',()=>{
 const r=fixture();for(const [i,x] of r.loads.entries())x.webgl.uniform_histogram[128]=i;
 assert(checkRoute(r).per_switch.every(x=>x.uniform_delta[128]===1));
 const release=fixture('legacy','release');release.loads[4].world_ready_events=1;assert.throws(()=>checkRoute(release));
});
test('missing worlds, stale census, VB accumulation, bad owner balance and Retry reloads fail independently',()=>{
 const mutations=[r=>r.loads.pop(),r=>r.loads[4].world_ready_events++,r=>r.loads[3].generation++,
  r=>r.loads[3].mesh.generation++,r=>r.loads[3].lifecycle.released++,r=>r.loads[4].webgl.histogram[PAYLOAD.legacy]++,
  r=>r.loads[4].webgl.failed_creates++,r=>r.loads[4].webgl.buffers[0].bytes=NaN,
  r=>r.loads[4].webgl.contexts[0].context_lost=true,r=>r.retry.after.world_ready_events++,r=>r.retry.after.generation++,
  r=>r.retry.after.webgl.created++,r=>r.retry.after.webgl.buffers[0].id++];
 for(const mutate of mutations){const r=fixture();mutate(r);assert.throws(()=>checkRoute(r));}
});
test('incidental GUI payload changes during Retry do not masquerade as world replacement',()=>{
 const r=fixture();r.retry.before.webgl.buffers.push({id:999,bytes:100,targets:[34962]});r.retry.after.webgl.buffers.push({id:999,bytes:120,targets:[34962]});
 checkRoute(r);
});
