const assert=require('node:assert/strict');
function checkMeshLoads(loads){
 for(const [i,x] of loads.entries()){
  // six-anchor at the fixed 1280x720 start view has 11 logical chunks, one resident VB.
  // terrain_residency.update uploads visible/near entries; unvisited chunks own no buffers.
  assert.equal(x.mesh.chunks,11);
  assert.equal(x.mesh.resident.allocated,1);assert.equal(x.mesh.resident.enabled,1);assert.equal(x.mesh.resident.cached,0);
  assert.equal(x.mesh.resident.bytes,41688);assert.equal(x.lifecycle.owned,1);
  assert.equal(x.lifecycle.created-x.lifecycle.released,x.lifecycle.owned);
  assert.equal(x.webgl.histogram[41472]||0,0);assert.equal(x.webgl.histogram[41688],1);assert.equal(x.webgl.histogram[17064]||0,0);
  // Preserve the pinned reference allowance: no additional per-switch shader-buffer growth.
  for(const size of [16,64])assert.ok((x.webgl.histogram[size]||0)<=(loads[0].webgl.histogram[size]||0)+i,
   'Additional shader-buffer growth at '+size+' bytes');
 }
}
module.exports={checkMeshLoads};
