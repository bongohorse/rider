const test=require('node:test'),assert=require('node:assert/strict');
const {checkMeshLoads}=require('../../tools/terrain_play/lifecycle_check.cjs');
// Compact fixed-view census from the real #507 six-anchor import/switch probe.
function census(){return Array.from({length:8},(_,i)=>({mesh:{chunks:11,resident:{allocated:1,enabled:1,cached:0,bytes:41688}},
 lifecycle:{created:i+2,released:i+1,owned:1},webgl:{histogram:{16:2+i,64:6+i,41688:1}}}));}
test('current residency: one visible buffer, eleven logical chunks, only reference UBO growth',()=>{
 assert.doesNotThrow(()=>checkMeshLoads(census()));
});
test('missing, additional and retained prior-world terrain resources fail',()=>{
 const mutations=[
  x=>{x.mesh.chunks=10;},x=>{x.mesh.resident.allocated=0;},x=>{x.mesh.resident.enabled=0;},
  x=>{x.mesh.resident.cached=1;},x=>{x.mesh.resident.bytes=41687;},x=>{x.lifecycle.owned=2;},
  x=>{x.lifecycle.released--;},x=>{delete x.webgl.histogram[41688];},
  x=>{x.webgl.histogram[41688]=2;},x=>{x.webgl.histogram[41472]=1;},x=>{x.webgl.histogram[17064]=1;},
 ];
 for(const mutate of mutations){const rows=census();mutate(rows[7]);assert.throws(()=>checkMeshLoads(rows));}
});
test('one extra scratch UBO over the unchanged per-switch allowance fails',()=>{
 for(const size of [16,64]){const rows=census();rows[7].webgl.histogram[size]++;assert.throws(()=>checkMeshLoads(rows),/Additional shader-buffer growth/);}
});
