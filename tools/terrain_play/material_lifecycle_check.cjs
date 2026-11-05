'use strict';
const assert=require('node:assert/strict');
const CYCLES=8,PAYLOAD={legacy:41688,perspective:55584,textured:60216};
function checkRoute(report){
 assert(['debug','release'].includes(report.variant));assert(PAYLOAD[report.route]);assert.equal(report.loads.length,1+CYCLES*2);
 for(const [i,x] of report.loads.entries()){
  assert.equal(x.course,i%2===0?'a':'b');// Release emits no Gym events; its reload evidence is generation plus handles and payloads.
  assert.equal(x.world_ready_events,report.variant==='debug'?report.loads[0].world_ready_events+i:0);
  if(i){
   const prev=report.loads[i-1],terrain=l=>l.webgl.buffers.filter(b=>b.bytes===PAYLOAD[report.route]).map(b=>b.id);
   assert.equal(x.generation,prev.generation+1);
   assert(x.webgl.created>prev.webgl.created&&x.webgl.deleted>prev.webgl.deleted,'world switch replaced no buffers');
   assert(!terrain(x).some(id=>terrain(prev).includes(id)),'terrain payload handle survived a world switch');
   assert.deepEqual(x.webgl.uniform_histogram,prev.webgl.uniform_histogram,'world switch changed retained uniform buffers');
  }
  assert.equal(x.webgl.failed_creates,0);assert.equal(x.webgl.created-x.webgl.deleted,x.webgl.live);
  assert.equal(x.webgl.buffers.length,x.webgl.live);assert.equal(new Set(x.webgl.buffers.map(b=>b.id)).size,x.webgl.live);
  assert(x.webgl.buffers.every(b=>Number.isSafeInteger(b.bytes)&&b.bytes>=0),'invalid buffer payload evidence');
  assert.equal(Object.values(x.webgl.histogram).reduce((a,b)=>a+b,0),x.webgl.live);
  assert.equal(x.webgl.contexts.length,1,'resource comparison requires one WebGL context');
  assert.equal(x.webgl.contexts[0].context_lost,false);
  assert((x.webgl.histogram[PAYLOAD[report.route]]||0)>0,'route-specific vertex payload missing');
  assert.equal(x.webgl.histogram[PAYLOAD[report.route]],report.loads[0].webgl.histogram[PAYLOAD[report.route]],'terrain payload handles accumulated');
  if(report.variant==='debug'){
   assert(x.mesh&&x.lifecycle);assert.equal(x.mesh.generation,x.generation);
   assert.equal(x.lifecycle.created-x.lifecycle.released,x.lifecycle.owned);assert.equal(x.mesh.resident.allocated,x.lifecycle.owned);
   assert(x.lifecycle.owned>0&&x.mesh.resident.bytes>0);
   assert.equal(x.mesh.chunks,11);
   if(report.route!=='legacy'){
    assert.equal(x.projection.stride,report.route==='textured'?52:48);
    assert.equal(x.projection.material.active,report.route==='textured');
   }
  }else assert.equal(x.mesh,null,'release must remain uninstrumented');
 }
 assert(Object.keys(report.loads[0].webgl.uniform_histogram||{}).length>0,'no uniform buffers observed');
 const {before,after}=report.retry;
 assert.equal(after.reset_count,before.reset_count+1);assert.equal(after.generation,before.generation);
 assert.equal(after.world_ready_events,before.world_ready_events,'Retry admitted another proxy world');
 assert.equal(after.webgl.created,before.webgl.created);assert.equal(after.webgl.deleted,before.webgl.deleted);
 assert.deepEqual(after.webgl.buffers.map(b=>b.id),before.webgl.buffers.map(b=>b.id),'Retry replaced a resource handle');
 const payload=b=>b.bytes===PAYLOAD[report.route];
 assert.deepEqual(after.webgl.buffers.filter(payload),before.webgl.buffers.filter(payload),'Retry replaced a terrain payload');
 return {switches:CYCLES*2,cycles:CYCLES,per_switch:report.loads.slice(1).map((x,i)=>({from:report.loads[i].course,to:x.course,
  created:x.webgl.created-report.loads[i].webgl.created,deleted:x.webgl.deleted-report.loads[i].webgl.deleted,live:x.webgl.live,
  terrain_vbs:x.webgl.histogram[PAYLOAD[report.route]],terrain_owner:x.lifecycle,
  uniform_delta:Object.fromEntries([...new Set([...Object.keys(x.webgl.uniform_histogram),...Object.keys(report.loads[i].webgl.uniform_histogram)])]
   .map(size=>[size,(x.webgl.uniform_histogram[size]||0)-(report.loads[i].webgl.uniform_histogram[size]||0)]))}))};
}
module.exports={CYCLES,PAYLOAD,checkRoute};
